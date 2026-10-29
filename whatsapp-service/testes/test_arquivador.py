import sqlite3, json, re, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import arquivador as A

DIA = 86400000
AGORA = 1_800_000_000_000

def novo_banco():
    c = sqlite3.connect(":memory:")
    c.executescript("""
    create table wa_mensagens (id integer primary key autoincrement, operador_login text, chat text, contato text default '', wa_id text,
      direcao text, texto text default '', tipo text default 'texto', ts integer, status text default 'recebida', lida int default 0,
      midia_id text, midia_mime text, midia_nome text, midia_tam integer, midia_status text, oculta int default 0, voz int default 0, midia_seg integer,
      unique(operador_login, wa_id));
    create table wa_upload_partes (up_id text, n int, dados blob, ts integer);
    create table wa_midia_cache (msg_id integer primary key, dados blob, mime text, nome text, ts integer);
    create table wa_contatos (operador_login text, chat text, nome_custom text default '', nome_wa text default '', ultima_ts integer, ultima text, ultimo_tipo text, atualizado_em integer, primary key(operador_login, chat));
    create table wa_arquivo_estado (id integer primary key, lock_ate integer default 0, ultima_exec integer, ultimo_ok integer, arquivadas integer default 0, ultimo_erro text);
    create table wa_erros (id integer primary key autoincrement, ts integer, origem text, operador_login text, ref text, detalhe text, resolvido int default 0);
    """)
    def q(sql, *p, fetch=False):
        sql = sql.replace("= any(%s)", "in (select value from json_each(%s))")
        p = [json.dumps(x) if isinstance(x, list) else x for x in p]
        cur = c.execute(sql.replace("%s", "?"), p)
        r = cur.fetchall() if fetch else None
        c.commit()
        return r
    return c, q

class Sheets:
    def __init__(self): self.linhas = {}; self.falhas = 0; self.perde = set(); self.chamadas = []
    def __call__(self, action, **kw):
        self.chamadas.append(action)
        if self.falhas > 0:
            self.falhas -= 1; raise RuntimeError("Sheets indisponível")
        if action == "append":
            for d in kw["linhas"]:
                if d["key"] not in self.perde: self.linhas[d["key"]] = d
            return {"ok": True}
        if action == "verify":
            return {"ok": True, "presentes": [k for k in kw["chaves"] if k in self.linhas]}

def semear(c, n=10, idade_dias=10, op="ana", chat="5541999990000@s.whatsapp.net", pref="m"):
    for i in range(n):
        c.execute("insert into wa_mensagens (operador_login,chat,contato,wa_id,direcao,texto,ts) values (?,?,?,?,?,?,?)",
                  (op, chat, "Maria Push", f"{pref}{i}", "in" if i % 2 == 0 else "out", f"msg {i}", AGORA - idade_dias * DIA + i))
    c.commit()

def conta(c, t="wa_mensagens"): return c.execute(f"select count(*) from {t}").fetchone()[0]

def t_fluxo_basico():
    c, q = novo_banco(); sh = Sheets(); semear(c, 10, 10); semear(c, 3, 1, pref="novo")
    r = A.ciclo(q, sh, AGORA, lote=4)
    assert r["arquivadas"] == 10 and r["erro"] is None, r
    assert conta(c) == 3, "só as recentes (1 dia) ficam"
    assert len(sh.linhas) == 10
    ct = c.execute("select nome_wa, ultima from wa_contatos").fetchone()
    assert ct[0] == "Maria Push" and ct[1] == "msg 9", ct
    print("ok fluxo básico (lotes, retenção, resumo preservado)")

def t_nada_apagado_se_sheets_falha():
    c, q = novo_banco(); sh = Sheets(); sh.falhas = 99; semear(c, 6, 10)
    r = A.ciclo(q, sh, AGORA)
    assert r["erro"] and conta(c) == 6, "falha no Sheets -> nada pode ser apagado"
    assert conta(c, "wa_erros") >= 1
    print("ok nada é apagado quando o Sheets falha")

def t_recupera_apos_falha_temporaria():
    c, q = novo_banco(); sh = Sheets(); sh.falhas = 1; semear(c, 6, 10)
    A.ciclo(q, sh, AGORA); assert conta(c) == 6
    r = A.ciclo(q, sh, AGORA + 20 * 60000)
    assert r["arquivadas"] == 6 and conta(c) == 0
    print("ok recuperação na execução seguinte")

def t_sem_duplicacao():
    c, q = novo_banco(); sh = Sheets(); semear(c, 5, 10)
    A.ciclo(q, sh, AGORA)
    semear(c, 5, 10)
    c.execute("delete from wa_mensagens"); c.commit(); semear(c, 5, 10)
    A.ciclo(q, sh, AGORA + 20 * 60000)
    assert len(sh.linhas) == 5, "chaves iguais não duplicam"
    print("ok idempotência (sem duplicação)")

def t_nao_apaga_o_que_o_sheets_nao_confirmou():
    c, q = novo_banco(); sh = Sheets(); semear(c, 4, 10); sh.perde = {"ana|m1"}
    r = A.ciclo(q, sh, AGORA)
    restantes = [x[0] for x in c.execute("select wa_id from wa_mensagens")]
    assert restantes == ["m1"], restantes
    assert conta(c, "wa_erros") >= 1
    print("ok só apaga o que foi confirmado")

def t_lock():
    c, q = novo_banco(); sh = Sheets(); semear(c, 3, 10)
    assert A.travar(q, AGORA) is True
    assert A.ciclo(q, sh, AGORA + 1000).get("pulado") and conta(c) == 3
    print("ok lock impede execução simultânea")

def t_pendentes_e_recentes_ficam():
    c, q = novo_banco(); sh = Sheets(); semear(c, 2, 10)
    c.execute("update wa_mensagens set status='pendente' where wa_id='m0'"); c.commit()
    A.ciclo(q, sh, AGORA)
    assert [x[0] for x in c.execute("select wa_id from wa_mensagens")] == ["m0"]
    print("ok mensagens pendentes de envio nunca são arquivadas")

def t_midia_so_no_cache_nao_e_arquivada():
    c, q = novo_banco(); sh = Sheets(); semear(c, 2, 10)
    rid = c.execute("select id from wa_mensagens where wa_id='m0'").fetchone()[0]
    c.execute("insert into wa_midia_cache (msg_id, dados, ts) values (?,?,?)", (rid, b"x", AGORA)); c.commit()
    A.ciclo(q, sh, AGORA)
    assert [x[0] for x in c.execute("select wa_id from wa_mensagens")] == ["m0"], "mídia que ainda só existe no cache do banco não pode sumir"
    c.execute("delete from wa_midia_cache"); c.commit()
    A.ciclo(q, sh, AGORA + 25 * 3600000)
    assert conta(c) == 0
    print("ok mídia que só está no cache do banco fica até ir para o Drive")

def t_agendamento():
    c, q = novo_banco()
    assert A.devido(q, AGORA) is True
    A.ciclo(q, Sheets(), AGORA)
    assert A.devido(q, AGORA + 3600000) is False
    assert A.devido(q, AGORA + 25 * 3600000) is True
    print("ok agendamento diário")

for f in [v for k, v in dict(globals()).items() if k.startswith("t_")]: f()
print("TODOS OS TESTES PASSARAM")
