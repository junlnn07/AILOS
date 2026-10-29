import os, json, time, logging, urllib.request

log = logging.getLogger("wa.arq")

RETENCAO_DIAS = int(os.getenv("WA_RETENCAO_DIAS", "7"))
LOTE = int(os.getenv("WA_ARQ_LOTE", "200"))
MAX_LOTES = int(os.getenv("WA_ARQ_MAX_LOTES", "25"))
INTERVALO_OK_H = float(os.getenv("WA_ARQ_INTERVALO_H", "24"))
REPETIR_ERRO_MIN = float(os.getenv("WA_ARQ_REPETIR_MIN", "15"))
LOCK_MS = 15 * 60 * 1000
GOOGLE_URL = (os.getenv("GOOGLE_URL") or "").strip()
GOOGLE_KEY = os.getenv("GOOGLE_KEY", "")
HIST_URL = os.getenv("HIST_URL") or GOOGLE_URL
HIST_KEY = os.getenv("HIST_KEY") or GOOGLE_KEY

CAMPOS = ("id", "operador_login", "chat", "contato", "wa_id", "direcao", "texto", "tipo", "ts", "status",
          "midia_id", "midia_mime", "midia_nome", "midia_tam", "midia_status", "oculta", "voz", "midia_seg", "lida")


def mes_de(ts):
    return time.strftime("%Y_%m", time.gmtime(ts / 1000 - 3 * 3600))


def chave(op, wa_id):
    return f"{op}|{wa_id}"


def hist_http(action, tentativas=3, **kw):
    if not HIST_URL or not HIST_KEY:
        raise RuntimeError("HIST_URL / HIST_KEY não configurados")
    corpo = json.dumps({"key": HIST_KEY, "action": action, **kw}).encode()
    ultimo = None
    for i in range(tentativas):
        try:
            req = urllib.request.Request(HIST_URL, data=corpo, headers={"Content-Type": "text/plain"})
            with urllib.request.urlopen(req, timeout=120) as r:
                d = json.loads(r.read().decode())
            if not d.get("ok"):
                raise RuntimeError(d.get("erro") or "falha no Sheets")
            return d
        except Exception as e:
            ultimo = e
            if i < tentativas - 1:
                time.sleep(2 * (3 ** i))
    raise RuntimeError(f"Sheets indisponível: {ultimo}")


def registrar_erro(q, agora, origem, detalhe, op=None, ref=None):
    try:
        q("insert into wa_erros (ts, origem, operador_login, ref, detalhe) values (%s,%s,%s,%s,%s)",
          agora, origem, op, ref, str(detalhe)[:400])
    except Exception:
        log.exception("registrar erro")


def devido(q, agora):
    q("insert into wa_arquivo_estado (id) values (1) on conflict do nothing")
    ult_exec, ult_ok = q("select ultima_exec, ultimo_ok from wa_arquivo_estado where id=1", fetch=True)[0]
    ult_exec, ult_ok = ult_exec or 0, ult_ok or 0
    if agora - ult_ok >= INTERVALO_OK_H * 3600000 and agora - ult_exec >= REPETIR_ERRO_MIN * 60000:
        return True
    return False


def travar(q, agora):
    q("insert into wa_arquivo_estado (id) values (1) on conflict do nothing")
    r = q("update wa_arquivo_estado set lock_ate=%s, ultima_exec=%s where id=1 and lock_ate < %s returning id",
          agora + LOCK_MS, agora, agora, fetch=True)
    return bool(r)


def destravar(q):
    q("update wa_arquivo_estado set lock_ate=0 where id=1")


def linha(row):
    d = dict(zip(CAMPOS, row))
    d["key"] = chave(d["operador_login"], d["wa_id"])
    for k in ("ts", "midia_tam", "midia_seg"):
        d[k] = int(d[k]) if d[k] is not None else None
    d.pop("id")
    return d


def preservar_resumo(q, agora, linhas):
    por_chat = {}
    for d in linhas:
        k = (d["operador_login"], d["chat"])
        a = por_chat.setdefault(k, {"push": "", "ts": 0, "texto": "", "tipo": ""})
        if d["direcao"] == "in" and d.get("contato"):
            a["push"] = d["contato"]
        if d["ts"] >= a["ts"]:
            a.update(ts=d["ts"], texto=(d["texto"] or "")[:120], tipo=d["tipo"])
    for (op, chat), a in por_chat.items():
        q("""insert into wa_contatos (operador_login, chat, nome_wa, ultima_ts, ultima, ultimo_tipo, atualizado_em)
             values (%s,%s,%s,%s,%s,%s,%s)
             on conflict (operador_login, chat) do update set
               nome_wa = case when excluded.nome_wa <> '' then excluded.nome_wa else wa_contatos.nome_wa end,
               ultima_ts = case when wa_contatos.ultima_ts is null or excluded.ultima_ts >= wa_contatos.ultima_ts then excluded.ultima_ts else wa_contatos.ultima_ts end,
               ultima = case when wa_contatos.ultima_ts is null or excluded.ultima_ts >= wa_contatos.ultima_ts then excluded.ultima else wa_contatos.ultima end,
               ultimo_tipo = case when wa_contatos.ultima_ts is null or excluded.ultima_ts >= wa_contatos.ultima_ts then excluded.ultimo_tipo else wa_contatos.ultimo_tipo end,
               atualizado_em = excluded.atualizado_em""",
          op, chat, a["push"], a["ts"], a["texto"], a["tipo"], agora)


def ciclo(q, hist, agora, lote=LOTE, max_lotes=MAX_LOTES, retencao_dias=RETENCAO_DIAS):
    if not travar(q, agora):
        return {"pulado": "outra execução em andamento"}
    total, erro = 0, None
    try:
        corte = agora - retencao_dias * 86400000
        q("update wa_mensagens set midia_status='erro' where midia_status='pendente' and ts < %s", agora - 86400000)
        q("delete from wa_upload_partes where ts < %s", agora - 3600000)
        for _ in range(max_lotes):
            rows = q(f"""select {",".join(CAMPOS)} from wa_mensagens
                         where ts < %s and status not in ('pendente','enviando') and coalesce(midia_status,'') not in ('pendente','refazer')
                           and not exists (select 1 from wa_midia_cache c where c.msg_id = wa_mensagens.id)
                         order by ts, id limit %s""", corte, lote, fetch=True)
            if not rows:
                break
            linhas = [linha(r) for r in rows]
            ids = [r[0] for r in rows]
            hist("append", linhas=linhas)
            meses = sorted({mes_de(d["ts"]) for d in linhas})
            v = hist("verify", chaves=[d["key"] for d in linhas], meses=meses)
            presentes = set(v.get("presentes") or [])
            conf = [(i, d) for i, d in zip(ids, linhas) if d["key"] in presentes]
            if len(conf) != len(linhas):
                registrar_erro(q, agora, "arquivamento", f"{len(linhas) - len(conf)} de {len(linhas)} registros não confirmados no Sheets; mantidos no banco")
            if not conf:
                raise RuntimeError("nenhum registro do lote foi confirmado pelo Sheets")
            preservar_resumo(q, agora, [d for _, d in conf])
            q("delete from wa_mensagens where id = any(%s)", [i for i, _ in conf])
            total += len(conf)
            if len(conf) != len(linhas):
                break
        q("update wa_arquivo_estado set ultimo_ok=%s, arquivadas=arquivadas+%s, ultimo_erro=null where id=1", agora, total)
    except Exception as e:
        erro = str(e)[:300]
        log.error("arquivamento falhou: %s", erro)
        registrar_erro(q, agora, "arquivamento", erro)
        try:
            q("update wa_arquivo_estado set ultimo_erro=%s, arquivadas=arquivadas+%s where id=1", erro, total)
        except Exception:
            pass
    finally:
        try:
            destravar(q)
        except Exception:
            log.exception("destravar")
    return {"arquivadas": total, "erro": erro}


def indexar_arquivo(q, hist, agora, **d):
    try:
        hist("arquivo", linha=d)
    except Exception as e:
        registrar_erro(q, agora, "indice_arquivo", e, d.get("operador"), d.get("midia_id"))
