import os, sys, time, signal, threading, logging, inspect, json, base64, mimetypes, sqlite3, importlib, urllib.request
from importlib import metadata
from datetime import datetime, time as hora
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from zoneinfo import ZoneInfo
import psycopg
from neonize.client import NewClient
from neonize.events import MessageEv, ConnectedEv, DisconnectedEv
try: from neonize.events import ReceiptEv
except Exception: ReceiptEv = None
try: from neonize.events import LoggedOutEv
except Exception: LoggedOutEv = None
from neonize.utils import build_jid
import arquivador

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("wa")

DSN = os.environ["DATABASE_URL"]
SESSAO_DB = os.getenv("WA_SESSAO_DB") or None
if os.getenv("RENDER") and not SESSAO_DB:
    sys.exit("ERRO: no Render o disco é temporário. Defina WA_SESSAO_DB (conexão DIRETA do Neon, sem -pooler).")
PASTA = os.path.abspath(os.getenv("SESSOES_DIR", "./sessoes"))
os.makedirs(PASTA, mode=0o700, exist_ok=True)

TZ = ZoneInfo("America/Sao_Paulo")
H = lambda v: hora(*map(int, v.split(":")))
INI, FIM = H(os.getenv("WA_INICIO", "07:00")), H(os.getenv("WA_FIM", "18:30"))
DIAS = {int(x) for x in os.getenv("WA_DIAS", "0,1,2,3,4,5,6").split(",")}
POLL = float(os.getenv("WA_POLL", "4"))
MAX_MIN = int(os.getenv("WA_MAX_MIN", "0"))
SAIR_FORA = os.getenv("WA_SAIR_FORA") == "1"
DRIVE_URL = os.getenv("DRIVE_URL") or arquivador.GOOGLE_URL
DRIVE_KEY = os.getenv("DRIVE_KEY") or arquivador.GOOGLE_KEY
ESPERAS_DOWNLOAD = (3, 8, 20, 45)
CACHE_ARQ = int(os.getenv("WA_CACHE_ARQ_MB", "8")) * 1048576
CACHE_TOTAL = int(os.getenv("WA_CACHE_TOTAL_MB", "120")) * 1048576
FOTO_MAX = 150_000
FOTO_RENOVAR_MS, FOTO_RETENTAR_MS = 7 * 86400000, 86400000
MAX_MIDIA = int(os.getenv("WA_MAX_MIDIA_MB", "25")) * 1024 * 1024
PARAR = threading.Event()
agora_ms = lambda: int(time.time() * 1000)

_lock = threading.RLock()
_conn = None


def q(sql, *p, fetch=False):
    global _conn
    with _lock:
        for tentativa in (1, 2):
            try:
                if _conn is None or _conn.closed:
                    _conn = psycopg.connect(DSN, autocommit=True, connect_timeout=15, prepare_threshold=None)
                with _conn.cursor() as cur:
                    cur.execute(sql, p)
                    return cur.fetchall() if fetch else None
            except (psycopg.OperationalError, psycopg.InterfaceError):
                try: _conn.close()
                except Exception: pass
                _conn = None
                if tentativa == 2: raise


def evento(login, ev, det=""):
    q("insert into wa_eventos (operador_login,evento,detalhe,ts) values (%s,%s,%s,%s)", login, ev, det[:300], agora_ms())


def ping(det=""):
    ts = agora_ms()
    if not q("update wa_eventos set ts=%s, detalhe=%s where operador_login='_servico' and evento='ping' returning id", ts, det, fetch=True):
        q("insert into wa_eventos (operador_login,evento,detalhe,ts) values ('_servico','ping',%s,%s)", det, ts)


def estado(login, status, **kw):
    cols = {"status": status, "atualizado_em": agora_ms(), **kw}
    sets = ",".join(f"{k}=%s" for k in cols)
    q("insert into wa_sessoes (operador_login) values (%s) on conflict do nothing", login)
    q(f"update wa_sessoes set {sets} where operador_login=%s", *cols.values(), login)


def apagar_dispositivo(numero):
    if not SESSAO_DB or not numero: return
    num = "".join(c for c in str(numero) if c.isdigit())
    if not num: return
    try:
        with psycopg.connect(SESSAO_DB, autocommit=True, connect_timeout=15, prepare_threshold=None) as c, c.cursor() as cur:
            cur.execute("delete from whatsmeow_device where jid like %s or jid like %s", (num + ":%@%", num + "@%"))
    except Exception: log.exception("apagar aparelho %s do banco de sessões", num[-4:])


def limpar_sessao_salva(login, numero=None):
    q("delete from wa_sessao_arquivo where operador_login=%s", login)
    for ext in ("", "-wal", "-shm", "-journal"):
        try: os.remove(os.path.join(PASTA, f"{login}.sqlite3{ext}"))
        except FileNotFoundError: pass
        except Exception: log.exception("apagar arquivo da sessão de %s", login)
    apagar_dispositivo(numero)


def registrar_queda(login, motivo, desejada=None):
    ts = agora_ms()
    q("insert into wa_sessoes (operador_login) values (%s) on conflict do nothing", login)
    if desejada is None:
        q("update wa_sessoes set status=%s, qr=null, erro=%s, atualizado_em=%s where operador_login=%s", "desconectado", motivo, ts, login)
    else:
        q("update wa_sessoes set status=%s, desejada=%s, qr=null, numero=null, erro=%s, atualizado_em=%s where operador_login=%s", "desconectado", desejada, motivo, ts, login)
    evento(login, "desconectado", motivo)
    erro_visivel("whatsapp", motivo, login)


def vivo(s):
    if not s.on: return False
    cli, achou = s.cli, False
    for nome in ("is_connected", "is_logged_in"):
        if hasattr(cli, nome):
            achou = True
            v = getattr(cli, nome)
            try: v = v() if callable(v) else v
            except Exception: return False
            if not v: return False
    if achou: return True
    try: return bool(cli.get_me().JID.User)
    except Exception: return False


def limpar_desconectados(ses):
    rows = q("select s.operador_login, s.numero from wa_sessoes s where not s.desejada and (s.numero is not null or exists (select 1 from wa_sessao_arquivo a where a.operador_login = s.operador_login))", fetch=True)
    for login, numero in rows:
        try:
            s = ses.pop(login, None)
            if s: s.sair()
            else: limpar_sessao_salva(login, numero)
            q("update wa_sessoes set numero=null, qr=null where operador_login=%s", login)
            evento(login, "sessao_apagada", numero or "")
            log.info("sessão de %s apagada (final do número %s)", login, (numero or "")[-4:])
        except Exception: log.exception("apagar sessão de %s", login)


class Saude(BaseHTTPRequestHandler):
    def _ok(self, corpo=True):
        txt = b"ok"
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(txt)))
        self.end_headers()
        if corpo: self.wfile.write(txt)

    def do_GET(self): self._ok()
    def do_HEAD(self): self._ok(False)
    def log_message(self, *a): pass


def servidor_saude():
    porta = int(os.getenv("PORT", "10000"))
    srv = ThreadingHTTPServer(("0.0.0.0", porta), Saude)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    log.info("Porta de saúde aberta em %s (/health)", porta)


def auto_ping():
    url = os.getenv("RENDER_EXTERNAL_URL")
    if not url: return

    def laco():
        while not PARAR.wait(600):
            try: urllib.request.urlopen(url.rstrip("/") + "/health", timeout=20).read()
            except Exception as e: log.warning("auto-ping falhou: %s", e)
    threading.Thread(target=laco, daemon=True).start()


def restaurar_sessao(login, arq):
    if os.path.exists(arq): return
    try:
        r = q("select dados from wa_sessao_arquivo where operador_login=%s", login, fetch=True)
        if r:
            with open(arq + ".tmp", "wb") as f: f.write(bytes(r[0][0]))
            os.replace(arq + ".tmp", arq)
            log.info("sessão de %s restaurada do banco (%d bytes)", login, os.path.getsize(arq))
    except Exception: log.exception("restaurar sessão")


class Sessao:
    arq, _h = None, None
    apagada = False

    def snapshot(self):
        if not self.arq or self.apagada: return
        if not os.path.exists(self.arq):
            log.warning("arquivo da sessão não encontrado em %s; pasta: %s", self.arq, os.listdir(PASTA)); return
        try:
            src, dst = sqlite3.connect(self.arq, timeout=10), sqlite3.connect(":memory:")
            src.backup(dst); src.close()
            dados = dst.serialize(); dst.close()
            h = hash(dados)
            if h == self._h: return
            q("insert into wa_sessao_arquivo (operador_login,dados,atualizado_em) values (%s,%s,%s) on conflict (operador_login) do update set dados=excluded.dados, atualizado_em=excluded.atualizado_em",
              self.login, bytes(dados), agora_ms())
            self._h = h
        except Exception: log.exception("salvar sessão no banco")

    def __init__(self, login):
        self.login, self.on, self.tentativas = login, False, 0
        self.numero, self.ultimo_qr, self.t = None, 0.0, time.time() + 20
        _params = list(inspect.signature(NewClient.__init__).parameters)
        log.info("neonize %s | NewClient params: %s", metadata.version("neonize"), _params)
        if "database" in _params:
            self.cli = NewClient(login, database=SESSAO_DB or os.path.join(PASTA, f"{login}.sqlite3"))
        else:
            self.arq = os.path.join(PASTA, f"{login}.sqlite3")
            restaurar_sessao(login, self.arq)
            self.cli = NewClient(self.arq)
        self._eventos()
        threading.Thread(target=self._rodar, daemon=True).start()

    def _eventos(self):
        c, login = self.cli, self.login

        @c.event.qr
        def _qr(_c, dados: bytes):
            self.ultimo_qr = time.time()
            try: estado(login, "aguardando_qr", qr=dados.decode(), erro=None)
            except Exception: log.exception("salvar qr")

        @c.event(ConnectedEv)
        def _on(_c, _e):
            self.on, self.tentativas = True, 0
            try: num = c.get_me().JID.User
            except Exception: num = None
            self.numero = num
            threading.Timer(8, self.snapshot).start()
            try:
                estado(login, "conectado", qr=None, erro=None, numero=num)
                evento(login, "conectado", num or "")
            except Exception: log.exception("salvar conexão")

        @c.event(DisconnectedEv)
        def _off(_c, _e):
            self.on = False
            try:
                estado(login, "desconectado")
                evento(login, "desconectado")
            except Exception: log.exception("salvar desconexão")

        if LoggedOutEv is not None:
            @c.event(LoggedOutEv)
            def _fora(_c, _e):
                if self.apagada: return
                self.on, self.apagada = False, True
                try:
                    registrar_queda(login, "O WhatsApp foi desconectado pelo celular.", desejada=False)
                    limpar_sessao_salva(login, self.numero)
                except Exception: log.exception("salvar saída pelo celular")

        @c.event(MessageEv)
        def _msg(_c, m: MessageEv):
            try: salvar(login, m, c)
            except Exception as e: log.exception("salvar msg: %s", e)

        if ReceiptEv is not None:
            @c.event(ReceiptEv)
            def _rec(_c, e):
                try: aplicar_recibo(login, e)
                except Exception: log.exception("recibo")

    def _rodar(self):
        try: self.cli.connect()
        except Exception as e:
            self.on = False
            try:
                estado(self.login, "erro", erro=str(e)[:200]); evento(self.login, "erro", str(e))
            except Exception: log.exception("salvar erro")

    def sair(self):
        self.apagada = True
        try: self.cli.logout()
        except Exception as e: log.info("logout de %s: %s", self.login, str(e)[:120])
        try: self.cli.disconnect()
        except Exception: pass
        self.on = False
        limpar_sessao_salva(self.login, self.numero)

    def parar(self):
        if self.on: self.snapshot()
        try: self.cli.disconnect()
        except Exception: pass
        self.on = False


MIDIAS = (("imageMessage", "imagem"), ("videoMessage", "video"), ("audioMessage", "audio"),
          ("documentMessage", "documento"), ("stickerMessage", "sticker"))


EMBRULHOS = ("ephemeralMessage", "viewOnceMessage", "viewOnceMessageV2", "viewOnceMessageV2Extension",
             "documentWithCaptionMessage", "deviceSentMessage", "editedMessage")


def desembrulhar(msg):
    for _ in range(4):
        for w in EMBRULHOS:
            try:
                if msg.HasField(w):
                    msg = getattr(msg, w).message
                    break
            except ValueError:
                continue
        else:
            break
    return msg


def detectar_midia(msg):
    for campo, tipo in MIDIAS:
        try:
            if msg.HasField(campo):
                sub = getattr(msg, campo)
                mime = (getattr(sub, "mimetype", "") or "application/octet-stream").split(";")[0].strip()
                voz = bool(getattr(sub, "PTT", False) or getattr(sub, "ptt", False)) if tipo == "audio" else False
                seg = int(getattr(sub, "seconds", 0) or 0) or None
                tam = int(getattr(sub, "fileLength", 0) or 0) or None
                return tipo, mime, getattr(sub, "caption", "") or "", getattr(sub, "fileName", "") or "", voz, seg, tam
        except ValueError:
            pass
    return None


def detectar_especial(msg):
    try:
        if msg.HasField("locationMessage"):
            l = msg.locationMessage
            nome = (l.name or "").strip()
            return "localizacao", f"📍 {nome + ' — ' if nome else ''}https://maps.google.com/?q={l.degreesLatitude},{l.degreesLongitude}"
        if msg.HasField("contactMessage"):
            c = msg.contactMessage
            tels = [ln.split(":", 1)[1].strip() for ln in (c.vcard or "").splitlines() if ln.upper().startswith("TEL") and ":" in ln]
            return "contato", f"👤 {c.displayName or 'Contato'}" + (f" — {', '.join(tels[:3])}" if tels else "")
    except ValueError:
        pass
    return None


def drive_put(login, nome, mime, dados):
    corpo = json.dumps({"key": DRIVE_KEY, "action": "put", "op": login, "nome": nome, "mime": mime,
                        "b64": base64.b64encode(dados).decode()}).encode()
    req = urllib.request.Request(DRIVE_URL, data=corpo, headers={"Content-Type": "text/plain"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(r.read().decode())


def _tam(n):
    return f"{n / 1048576:.0f} MB" if n >= 1048576 else f"{n} B"


def erro_visivel(origem, detalhe, login=None, ref=None):
    try:
        d = str(detalhe)[:400]
        if q("select 1 from wa_erros where origem=%s and not resolvido and detalhe=%s and ts > %s limit 1", origem, d, agora_ms() - 600000, fetch=True):
            return
        arquivador.registrar_erro(q, agora_ms(), origem, d, login, ref)
    except Exception:
        log.exception("registrar erro")


def baixar(cli, candidatos):
    ultimo = None
    for espera in (0,) + tuple(ESPERAS_DOWNLOAD):
        if espera: time.sleep(espera)
        for msg in candidatos:
            try:
                dados = cli.download_any(msg)
                if dados: return bytes(dados)
                ultimo = RuntimeError("download vazio")
            except Exception as e:
                ultimo = e
    raise RuntimeError(str(ultimo) if ultimo else "download falhou")


def cache_put(rid, nome, mime, dados):
    tam = len(dados)
    if tam > CACHE_ARQ: raise RuntimeError(f"arquivo maior que o limite do cache ({_tam(CACHE_ARQ)})")
    usado = int(q("select coalesce(sum(octet_length(dados)),0) from wa_midia_cache where msg_id <> %s", rid, fetch=True)[0][0] or 0)
    if usado + tam > CACHE_TOTAL: raise RuntimeError(f"cache cheio ({_tam(usado)} de {_tam(CACHE_TOTAL)})")
    q("""insert into wa_midia_cache (msg_id, dados, mime, nome, ts) values (%s,%s,%s,%s,%s)
         on conflict (msg_id) do update set dados=excluded.dados, mime=excluded.mime, nome=excluded.nome, ts=excluded.ts""",
      rid, dados, mime, nome, agora_ms())


def guardar(login, rid, nome, mime, dados):
    tam = len(dados)
    try:
        if not DRIVE_URL or not DRIVE_KEY: raise RuntimeError("Drive não configurado (falta a senha GOOGLE_KEY no Render)")
        if tam > MAX_MIDIA: raise RuntimeError(f"arquivo maior que {MAX_MIDIA // 1048576} MB")
        r = drive_put(login, nome, mime, dados)
        if not r.get("ok"): raise RuntimeError(r.get("erro") or "falha no Drive")
        q("update wa_mensagens set midia_id=%s, midia_status='ok', midia_erro=null, midia_raw=null, midia_tam=%s where id=%s", r["id"], tam, rid)
        threading.Thread(target=indexar_no_sheets, args=(rid, login, r["id"], nome, mime, tam), daemon=True).start()
        return True
    except Exception as e:
        drive_erro = f"Drive: {str(e)[:160]}"
        log.error("mídia da mensagem %s: %s", rid, drive_erro)
    try:
        cache_put(rid, nome, mime, dados)
        q("update wa_mensagens set midia_status='ok', midia_erro=null, midia_raw=null, midia_tam=%s where id=%s", tam, rid)
        erro_visivel("drive", drive_erro + " — arquivo mantido no cache do banco até o Drive voltar", login, str(rid))
        return True
    except Exception as e:
        motivo = f"{drive_erro}; cache: {str(e)[:120]}"
        log.error("mídia da mensagem %s sem destino: %s", rid, motivo)
        try: q("update wa_mensagens set midia_status='erro', midia_erro=%s where id=%s", motivo, rid)
        except Exception: pass
        erro_visivel("drive", motivo, login, str(rid))
        return False


def sincronizar_cache(limite=5):
    try: q("delete from wa_midia_cache where msg_id not in (select id from wa_mensagens)")
    except Exception: log.exception("limpar cache")
    if not DRIVE_URL or not DRIVE_KEY: return 0
    n = 0
    for rid, login, dados, mime, nome in q("""select c.msg_id, m.operador_login, c.dados, c.mime, c.nome from wa_midia_cache c
                                              join wa_mensagens m on m.id = c.msg_id order by c.ts limit %s""", limite, fetch=True):
        dados = bytes(dados)
        try:
            r = drive_put(login, nome or "arquivo", mime or "application/octet-stream", dados)
            if not r.get("ok"): raise RuntimeError(r.get("erro") or "falha no Drive")
        except Exception as e:
            log.warning("sincronizar cache (mensagem %s): %s", rid, e)
            break
        q("update wa_mensagens set midia_id=%s where id=%s", r["id"], rid)
        q("delete from wa_midia_cache where msg_id=%s", rid)
        threading.Thread(target=indexar_no_sheets, args=(rid, login, r["id"], nome, mime, len(dados)), daemon=True).start()
        n += 1
    return n


def indexar_no_sheets(rid, login, drive_id, nome, mime, tam):
    if not arquivador.HIST_URL or not arquivador.HIST_KEY: return
    try:
        r = q("""select m.chat, m.wa_id, m.tipo, m.ts, m.direcao, m.texto, coalesce(nullif(c.nome_custom,''), nullif(c.nome_wa,''), m.contato, '')
                 from wa_mensagens m left join wa_contatos c on c.operador_login=m.operador_login and c.chat=m.chat where m.id=%s""", rid, fetch=True)
        if not r: return
        chat, wid, tipo, ts, direcao, legenda, cliente = r[0]
        arquivador.indexar_arquivo(q, arquivador.hist_http, agora_ms(), key=arquivador.chave(login, wid), operador=login, chat=chat,
                                   telefone=chat.split("@")[0], nome_cliente=cliente, tipo=tipo, nome=nome, mime=mime, tam=tam,
                                   ts=int(ts), direcao=direcao, legenda=legenda, midia_id=drive_id)
    except Exception as e:
        log.warning("índice do arquivo no Sheets: %s", e)


def baixar_midia(cli, login, rid, candidatos, nome, mime):
    try:
        dados = baixar(cli, candidatos)
    except Exception as e:
        motivo = f"Download do WhatsApp: {str(e)[:200]}"
        log.error("download da mensagem %s: %s", rid, motivo)
        try: q("update wa_mensagens set midia_status='erro', midia_erro=%s where id=%s", motivo, rid)
        except Exception: pass
        erro_visivel("midia", motivo, login, str(rid))
        return
    guardar(login, rid, nome, mime, dados)


def chamar(fn, *a, **kw):
    ps = inspect.signature(fn).parameters
    return fn(*a, **{k: v for k, v in kw.items() if k in ps and v not in (None, "")})


def enviar_arquivo(cli, jid, dados, mime, nome, legenda):
    if mime.startswith("image/"): return chamar(cli.send_image, jid, dados, caption=legenda)
    if mime.startswith("video/"): return chamar(cli.send_video, jid, dados, caption=legenda)
    if mime.startswith("audio/"): return chamar(cli.send_audio, jid, dados)
    return chamar(cli.send_document, jid, dados, caption=legenda, filename=nome, title=nome, mimetype=mime)


_LOGSRC, _PN, _MESCLADOS, _MSG_CLS = [0], {}, set(), [None]


def chat_visivel(cli, src, saindo):
    user, srv = src.Chat.User, src.Chat.Server
    if _LOGSRC[0] < 3:
        _LOGSRC[0] += 1; log.info("MessageSource: %s", str(src).replace("\n", " ")[:400])
    if srv != "lid": return user, srv
    if user in _PN: return _PN[user]
    alt = None
    try:
        a = src.RecipientAlt if saindo else src.SenderAlt
        if a is not None and a.User: alt = (a.User, a.Server or "s.whatsapp.net")
    except Exception: pass
    if not alt and cli is not None and hasattr(cli, "get_pn_from_lid"):
        try:
            a = cli.get_pn_from_lid(src.Chat)
            if a is not None and a.User: alt = (a.User, a.Server or "s.whatsapp.net")
        except Exception: pass
    if alt: _PN[user] = alt
    return alt or (user, srv)


def salvar(login, m, cli=None):
    info, src = m.Info, m.Info.MessageSource
    srv = src.Chat.Server
    if srv in ("g.us", "broadcast", "newsletter") or src.Chat.User == "status": return
    msg = desembrulhar(m.Message)
    try:
        if msg.HasField("reactionMessage"):
            rm = msg.reactionMessage
            if rm.HasField("key") and rm.key.ID:
                q("update wa_mensagens set reacao=%s where operador_login=%s and wa_id=%s", (rm.text or None), login, rm.key.ID)
            return
        if msg.HasField("protocolMessage"):
            pm = msg.protocolMessage
            if pm.type == 0 and pm.HasField("key") and pm.key.ID:
                q("update wa_mensagens set tipo='apagada', texto='', midia_status=null where operador_login=%s and wa_id=%s", login, pm.key.ID)
                return
    except ValueError: pass
    texto = msg.conversation or msg.extendedTextMessage.text or ""
    tipo, md = "texto" if texto else "outro", detectar_midia(msg)
    voz = seg = tam_orig = None
    if md:
        tipo, mime, texto, nome_doc, voz, seg, tam_orig = md
    elif not texto:
        esp = detectar_especial(msg)
        if esp: tipo, texto = esp
        else:
            texto = "[tipo de mensagem ainda não suportado]"
            log.info("tipo não tratado: campos=%s", [f.name for f, _ in msg.ListFields()][:6])
    ts = int(info.Timestamp); ts = ts * 1000 if ts < 10**11 else ts
    saindo = bool(src.IsFromMe)
    lid = f"{src.Chat.User}@{srv}"
    cu, cs = chat_visivel(cli, src, saindo)
    chat = f"{cu}@{cs}"
    if chat != lid and lid not in _MESCLADOS:
        _MESCLADOS.add(lid)
        try:
            q("update wa_mensagens set chat=%s where operador_login=%s and chat=%s", chat, login, lid)
            q("update wa_conversas_meta set chat=%s where operador_login=%s and chat=%s and not exists (select 1 from wa_conversas_meta where operador_login=%s and chat=%s)", chat, login, lid, login, chat)
        except Exception: log.exception("mesclar conversa")
    nome = None
    if md:
        ext = mimetypes.guess_extension(mime) or ""
        nome = nome_doc or f"{tipo}_{ts}{ext}"
    raw = None
    if md:
        _MSG_CLS[0] = type(msg)
        try: raw = msg.SerializeToString()
        except Exception: raw = None
    linhas = q("""insert into wa_mensagens (operador_login,chat,contato,wa_id,direcao,texto,tipo,ts,status,lida,midia_mime,midia_nome,midia_status,voz,midia_seg,midia_tam,midia_raw)
         values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) on conflict (operador_login,wa_id) do nothing returning id""",
      login, chat, "" if saindo else (info.Pushname or ""), info.ID,
      "out" if saindo else "in", texto, tipo, ts, "enviada" if saindo else "recebida", saindo,
      mime if md else None, nome, "pendente" if md else None, bool(voz), seg, tam_orig, raw, fetch=True)
    if not saindo:
        try: q("update wa_conversas_meta set arquivada=false where operador_login=%s and chat=%s and arquivada", login, chat)
        except Exception: pass
    if md and linhas and cli is not None:
        cands = [msg] + ([m.Message] if m.Message is not msg else [])
        threading.Thread(target=baixar_midia, args=(cli, login, linhas[0][0], cands, nome, mime), daemon=True).start()


def variantes_br(user):
    u = "".join(c for c in str(user) if c.isdigit())
    if (len(u) == 11 and u[2] == "9") or (len(u) == 10 and u[2] in "6789"): u = "55" + u
    com9 = sem9 = None
    if u.startswith("55") and len(u) == 13 and u[4] == "9": com9, sem9 = u, u[:4] + u[5:]
    elif u.startswith("55") and len(u) == 12 and u[4] in "6789": com9, sem9 = u[:4] + "9" + u[4:], u
    if not com9: return [u or user]
    return [sem9, com9] if int(u[2:4]) >= 31 else [com9, sem9]


def checar_numero(cli, user):
    vs = variantes_br(user)
    contas = {}
    for r in cli.is_on_whatsapp(*["+" + v for v in vs]):
        if not getattr(r, "IsIn", False): continue
        tel = "".join(c for c in str(getattr(r, "Query", "")) if c.isdigit())
        jid = r.JID
        chave = (getattr(jid, "User", ""), getattr(jid, "Server", ""))
        fones, _ = contas.setdefault(chave, ([], jid))
        if tel and tel not in fones: fones.append(tel)
    return [(f, j) for f, j in contas.values()]


def escolher_chat(login, fones):
    try:
        r = q("select chat from wa_mensagens where operador_login=%s and chat = any(%s) order by ts desc limit 1", login, [f + "@s.whatsapp.net" for f in fones], fetch=True)
        if r: return r[0][0].split("@")[0]
    except Exception: log.exception("escolher conversa")
    return fones[0]


def destinos(cli, user, srv):
    vs = variantes_br(user) if srv == "s.whatsapp.net" else [user]
    if len(vs) < 2: return [([v], build_jid(v, srv)) for v in vs], True
    try:
        achados = checar_numero(cli, user)
        if achados: return achados, True
    except Exception as e: log.info("checar número no WhatsApp: %s", str(e)[:120])
    return [([v], build_jid(v, srv)) for v in vs], False


def processar_checagens(ses):
    for cid, login, numero in q("select id,operador_login,numero from wa_checagens where status='pendente' order by id limit 10", fetch=True):
        if not q("update wa_checagens set status='checando' where id=%s and status='pendente' returning id", cid, fetch=True): continue
        s, ts = ses.get(login), agora_ms()
        try:
            if not s or not s.on: raise RuntimeError("WhatsApp do operador não está conectado")
            achados = checar_numero(s.cli, numero)
            escolhido = escolher_chat(login, achados[0][0]) if achados else None
            q("update wa_checagens set status='ok', existe=%s, jid_numero=%s, atualizado_em=%s where id=%s", bool(achados), escolhido, ts, cid)
        except Exception as e:
            log.info("checagem %s: %s", cid, str(e)[:120])
            q("update wa_checagens set status='erro', erro=%s, atualizado_em=%s where id=%s", str(e)[:200], ts, cid)
    q("delete from wa_checagens where criado_em < %s", agora_ms() - 3600000)


def enviar_pendentes(ses):
    for mid, login, chat, texto, ts, up, mime, nome in q("select id,operador_login,chat,texto,ts,up_id,midia_mime,midia_nome from wa_mensagens where status='pendente' and direcao='out' order by id limit 20", fetch=True):
        s = ses.get(login)
        if not s or not s.on:
            if agora_ms() - ts > 10 * 60000: q("update wa_mensagens set status='falhou' where id=%s", mid)
            continue
        if not q("update wa_mensagens set status='enviando' where id=%s and status='pendente' returning id", mid, fetch=True):
            continue
        try:
            user, srv = chat.split("@")
            dados = None
            if up:
                partes = q("select dados from wa_upload_partes where up_id=%s order by n", up, fetch=True)
                dados = b"".join(bytes(p[0]) for p in partes)
                if not dados: raise RuntimeError("arquivo não encontrado (envio expirou)")
            r, falha, usado = None, None, None
            def enviar_a(jid):
                if up: return enviar_arquivo(s.cli, jid, dados, mime or "application/octet-stream", nome or "arquivo", texto)
                return s.cli.send_message(jid, texto)
            alvos, verificado = destinos(s.cli, user, srv)
            for fones, jid in alvos:
                if r is not None and not verificado: break
                try:
                    r1 = enviar_a(jid)
                    if r is None: r, usado = r1, fones
                except Exception as e:
                    falha = e; log.info("envio para %s falhou: %s", fones[0][-4:], str(e)[:120])
            if r is None and srv == "s.whatsapp.net":
                tentados = {f for fones, _ in alvos for f in fones}
                for v in [v for v in variantes_br(user) if v not in tentados]:
                    try: r, usado = enviar_a(build_jid(v, srv)), [v]; break
                    except Exception as e: falha = e
            if r is None:
                erro_visivel("envio", f"Falha ao enviar para {user}: {str(falha)[:200]}", login, str(mid))
                raise falha or RuntimeError("nenhum destino")
            if srv == "s.whatsapp.net" and usado and user not in usado:
                q("update wa_mensagens set chat=%s where id=%s", escolher_chat(login, usado) + "@" + srv, mid)
            wid = getattr(r, "ID", None) or f"env-{mid}"
            try: q("update wa_mensagens set wa_id=%s,status='enviada' where id=%s", wid, mid)
            except psycopg.errors.UniqueViolation: q("delete from wa_mensagens where id=%s", mid)
            if up:
                threading.Thread(target=guardar, args=(login, mid, nome or "arquivo", mime or "application/octet-stream", dados), daemon=True).start()
                q("delete from wa_upload_partes where up_id=%s", up)
        except Exception:
            log.exception("envio"); q("update wa_mensagens set status='falhou', midia_status=case when up_id is null then midia_status else 'erro' end where id=%s", mid)


def revogar_pendentes(ses):
    for mid, login, chat, wid in q("select id,operador_login,chat,wa_id from wa_mensagens where revogar and tipo<>'apagada' order by id limit 20", fetch=True):
        s = ses.get(login)
        if not s or not s.on: continue
        try:
            user, srv = chat.split("@")
            s.cli.revoke_message(build_jid(user, srv), s.cli.get_me().JID, wid)
            q("update wa_mensagens set tipo='apagada', texto='', midia_status=null, revogar=false where id=%s", mid)
        except Exception:
            log.exception("apagar para todos"); q("update wa_mensagens set revogar=false where id=%s", mid)


def nivel_recibo(ev):
    try:
        enum = ev.DESCRIPTOR.fields_by_name["Type"].enum_type
        nome = enum.values_by_number[ev.Type].name
    except Exception:
        return 0
    return {"DELIVERED": 1, "READ": 2, "PLAYED": 2}.get(str(nome).upper(), 0)


def aplicar_recibo(login, ev):
    nv = nivel_recibo(ev)
    ids = [str(i) for i in (getattr(ev, "MessageIDs", None) or [])]
    if not nv or not ids: return
    novo, antes = ("entregue", ["enviada"]) if nv == 1 else ("visualizada", ["enviada", "entregue"])
    q("update wa_mensagens set status=%s where operador_login=%s and wa_id = any(%s) and direcao='out' and status = any(%s)", novo, login, ids, antes)


def classe_message():
    if _MSG_CLS[0] is not None: return _MSG_CLS[0]
    for caminho in ("neonize.proto.waE2E.WAWebProtobufsE2E_pb2", "neonize.proto.Neonize_pb2"):
        try: return importlib.import_module(caminho).Message
        except Exception: continue
    return None


def refazer_midias(ses):
    for rid, login, raw, nome, mime in q("select id, operador_login, midia_raw, midia_nome, midia_mime from wa_mensagens where midia_status='refazer' order by id limit 5", fetch=True):
        s = ses.get(login)
        if not raw:
            q("update wa_mensagens set midia_status='erro', midia_erro=%s where id=%s", "Este arquivo não pode mais ser baixado. Peça para o cliente enviar de novo.", rid); continue
        if not s or not s.on: continue
        cls = classe_message()
        if cls is None:
            q("update wa_mensagens set midia_status='erro', midia_erro=%s where id=%s", "Esta versão do serviço não consegue refazer o download.", rid); continue
        if not q("update wa_mensagens set midia_status='pendente' where id=%s and midia_status='refazer' returning id", rid, fetch=True): continue
        try: msg = cls.FromString(bytes(raw))
        except Exception as e:
            q("update wa_mensagens set midia_status='erro', midia_erro=%s where id=%s", f"Mensagem guardada ilegível: {str(e)[:100]}", rid); continue
        threading.Thread(target=baixar_midia, args=(s.cli, login, rid, [msg], nome or "arquivo", mime or "application/octet-stream"), daemon=True).start()


def buscar_foto(cli, chat):
    user, srv = chat.split("@")
    jid = build_jid(user, srv)
    fn = getattr(cli, "get_profile_picture", None)
    if fn is None: raise RuntimeError("esta versão do neonize não tem get_profile_picture")
    tentativas = []
    try:
        from neonize.proto.Neonize_pb2 import GetProfilePictureParams
        tentativas.append(lambda: fn(jid, GetProfilePictureParams(Preview=True)))
    except Exception: pass
    tentativas.append(lambda: fn(jid))
    info, ultimo = None, None
    for t in tentativas:
        try: info = t(); break
        except Exception as e: ultimo = e
    if info is None:
        if ultimo and any(k in str(ultimo).lower() for k in ("not-authorized", "item-not-found", "401", "404", "not found", "no profile", "unauthorized")): return None
        raise ultimo or RuntimeError("sem resposta")
    url = getattr(info, "URL", "") or getattr(info, "url", "") or ""
    if not url: return None
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=15) as r: dados = r.read(FOTO_MAX + 1)
    return dados if 200 < len(dados) <= FOTO_MAX else None


def atualizar_fotos(ses, limite=2):
    agora = agora_ms()
    for login, s in list(ses.items()):
        if not s.on: continue
        pend = q("""select m.chat from wa_mensagens m left join wa_contatos c on c.operador_login = m.operador_login and c.chat = m.chat
                    where m.operador_login = %s and (c.foto_ts is null or c.foto_ts < %s)
                    group by m.chat order by max(m.ts) desc limit %s""", login, agora - FOTO_RENOVAR_MS, limite, fetch=True)
        for (chat,) in pend:
            try:
                dados = buscar_foto(s.cli, chat)
                q("""insert into wa_contatos (operador_login, chat, foto, foto_ts) values (%s,%s,%s,%s)
                     on conflict (operador_login, chat) do update set foto = excluded.foto, foto_ts = excluded.foto_ts""", login, chat, dados, agora_ms())
            except Exception as e:
                log.info("foto de perfil (%s): %s", chat.split("@")[0][-4:], str(e)[:120])
                try:
                    q("""insert into wa_contatos (operador_login, chat, foto_ts) values (%s,%s,%s)
                         on conflict (operador_login, chat) do update set foto_ts = excluded.foto_ts""", login, chat, agora_ms() - FOTO_RENOVAR_MS + FOTO_RETENTAR_MS)
                except Exception: log.exception("salvar tentativa da foto")


def expediente():
    n = datetime.now(TZ)
    return n.weekday() in DIAS and INI <= n.time() < FIM


def reiniciar(s, agora):
    if agora < s.t: return False
    if agora - s.ultimo_qr < 150: return False
    return s.tentativas < 5 or agora > s.t + 600


def main():
    signal.signal(signal.SIGTERM, lambda *a: PARAR.set())
    servidor_saude(); auto_ping()
    ses, dentro, t0, bloqueio, ultimo_snap = {}, None, time.time(), {}, 0.0
    log.info("Serviço WhatsApp iniciado (expediente %s–%s, dias %s)", INI, FIM, sorted(DIAS))
    try: log.info("Python %s | neonize %s", sys.version.split()[0], metadata.version("neonize"))
    except Exception: pass
    try:
        for cmd in ("alter table wa_mensagens add column if not exists midia_id text",
                    "alter table wa_mensagens add column if not exists midia_mime text",
                    "alter table wa_mensagens add column if not exists midia_nome text",
                    "alter table wa_mensagens add column if not exists midia_status text",
                    "alter table wa_mensagens add column if not exists midia_tam bigint",
                    "alter table wa_mensagens add column if not exists oculta boolean not null default false",
                    "alter table wa_mensagens add column if not exists revogar boolean not null default false",
                    "alter table wa_mensagens add column if not exists up_id text",
                    "alter table wa_mensagens add column if not exists voz boolean not null default false",
                    "alter table wa_mensagens add column if not exists midia_seg integer",
                    "alter table wa_mensagens add column if not exists reacao text",
                    "create table if not exists wa_contatos (operador_login text not null, chat text not null, nome_custom text not null default '', nome_wa text not null default '', obs text not null default '', doc text not null default '', empresa text not null default '', email text not null default '', endereco text not null default '', favorito boolean not null default false, ultima_ts bigint, ultima text, ultimo_tipo text, atualizado_em bigint, primary key (operador_login, chat))",
                    "alter table wa_contatos add column if not exists oculta_ate bigint",
                    "alter table wa_contatos add column if not exists foto bytea",
                    "alter table wa_contatos add column if not exists foto_ts bigint",
                    "alter table wa_mensagens add column if not exists midia_erro text",
                    "alter table wa_mensagens add column if not exists midia_raw bytea",
                    "create table if not exists wa_midia_cache (msg_id bigint primary key, dados bytea not null, mime text, nome text, ts bigint not null)",
                    "create table if not exists wa_arquivo_estado (id integer primary key, lock_ate bigint not null default 0, ultima_exec bigint, ultimo_ok bigint, arquivadas bigint not null default 0, ultimo_erro text)",
                    "create table if not exists wa_erros (id bigserial primary key, ts bigint not null, origem text not null, operador_login text, ref text, detalhe text, resolvido boolean not null default false)",
                    "create table if not exists wa_upload_partes (up_id text not null, n int not null, dados bytea not null, ts bigint not null, primary key (up_id, n))",
                    "create table if not exists wa_checagens (id bigserial primary key, operador_login text not null, numero text not null, status text not null default 'pendente', existe boolean, jid_numero text, erro text, criado_em bigint, atualizado_em bigint)",
                "create table if not exists wa_sessao_arquivo (operador_login text primary key, dados bytea not null, atualizado_em bigint)",
                    "create table if not exists wa_conversas_meta (operador_login text not null, chat text not null, arquivada boolean not null default false, etiquetas text[] not null default '{}', primary key (operador_login, chat))"):
            q(cmd)
    except Exception: log.exception("migração")
    try:
        q("update wa_sessoes set status=%s, qr=null where desejada", "aguardando" if expediente() else "fora_expediente")
    except Exception: log.exception("estado inicial")
    arq_rodando = threading.Event()

    def rodar_arquivador():
        try: log.info("Arquivamento concluído: %s", arquivador.ciclo(q, arquivador.hist_http, agora_ms()))
        except Exception: log.exception("arquivador")
        finally: arq_rodando.clear()

    ultima_checagem_arq, ultimo_cache, ultima_foto = 0.0, 0.0, 0.0
    foto_rodando = threading.Event()

    def rodar_fotos(copia):
        try: atualizar_fotos(copia)
        except Exception: log.exception("fotos de perfil")
        finally: foto_rodando.clear()

    while not PARAR.is_set():
        try:
            if arquivador.HIST_URL and arquivador.HIST_KEY and time.time() - ultima_checagem_arq > 300 and not arq_rodando.is_set():
                ultima_checagem_arq = time.time()
                try:
                    if arquivador.devido(q, agora_ms()):
                        arq_rodando.set(); threading.Thread(target=rodar_arquivador, daemon=True).start()
                except Exception: log.exception("checar arquivamento")
            ok = expediente()
            try: ping("" if ok else "fechado")
            except Exception: log.exception("ping")
            try: limpar_desconectados(ses)
            except Exception: log.exception("limpar desconectados")
            if ok != dentro:
                log.info("Expediente %s", "ABERTO: iniciando sessões" if ok else "ENCERRADO: finalizando sessões com segurança")
                dentro = ok
            if ok:
                quer = dict(q("select operador_login, status from wa_sessoes where desejada", fetch=True))
                agora = time.time()
                for login, st in quer.items():
                    s = ses.get(login)
                    if s is None:
                        if agora < bloqueio.get(login, 0): continue
                        try: ses[login] = Sessao(login)
                        except Exception as e:
                            log.error("Não foi possível iniciar a sessão de %s: %s", login, e)
                            bloqueio[login] = agora + 60
                            estado(login, "erro", erro=str(e)[:200])
                    elif s.on:
                        if st != "conectado":
                            estado(login, "conectado", qr=None, erro=None, numero=s.numero)
                    elif reiniciar(s, agora):
                        n = s.tentativas + 1 if s.tentativas < 5 else 0
                        s.parar()
                        novo = Sessao(login); novo.tentativas = n; novo.t = agora + 20 * (n + 1)
                        ses[login] = novo
                for login in [l for l in ses if l not in quer]:
                    ses.pop(login).sair()
                enviar_pendentes(ses); revogar_pendentes(ses); refazer_midias(ses)
                try: processar_checagens(ses)
                except Exception: log.exception("checagens")
                if time.time() - ultimo_cache > 60:
                    ultimo_cache = time.time()
                    try: sincronizar_cache()
                    except Exception: log.exception("sincronizar cache")
                if time.time() - ultima_foto > 8 and not foto_rodando.is_set():
                    ultima_foto = time.time(); foto_rodando.set()
                    threading.Thread(target=rodar_fotos, args=(dict(ses),), daemon=True).start()
                if time.time() - ultimo_snap > 90:
                    ultimo_snap = time.time()
                    for s_ in list(ses.values()):
                        if s_.on: s_.snapshot()
            elif ses:
                for login, s in ses.items():
                    s.parar(); estado(login, "fora_expediente")
                ses.clear()
            if MAX_MIN and time.time() - t0 > MAX_MIN * 60:
                log.info("Tempo máximo do ciclo atingido: encerrando para a próxima execução assumir")
                for login, s in ses.items(): s.parar(); estado(login, "aguardando")
                return
            if SAIR_FORA and not ok and not ses:
                log.info("Fora do expediente: processo encerrado"); return
        except Exception: log.exception("loop")
        PARAR.wait(POLL)
    log.info("Desligando: finalizando sessões")
    for login, s in ses.items():
        s.parar()
        try: estado(login, "aguardando")
        except Exception: pass


if __name__ == "__main__":
    main()
