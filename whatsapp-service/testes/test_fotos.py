import sys, os, types, sqlite3
os.environ.setdefault("DATABASE_URL", "postgres://x")
AQUI = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(AQUI))
def modulo(nome, **a):
    m = types.ModuleType(nome); m.__dict__.update(a); sys.modules[nome] = m; return m
class _E(Exception): pass
modulo("psycopg", OperationalError=_E, InterfaceError=_E, errors=types.SimpleNamespace(UniqueViolation=_E), connect=lambda *a, **k: None)
modulo("neonize"); modulo("neonize.client", NewClient=type("NewClient", (), {}))
modulo("neonize.events", MessageEv=object, ConnectedEv=object, DisconnectedEv=object)
modulo("neonize.utils", build_jid=lambda u, s: (u, s))
import app

c = sqlite3.connect(":memory:", check_same_thread=False)
c.executescript("""
create table wa_mensagens (id integer primary key autoincrement, operador_login text, chat text, ts integer);
create table wa_contatos (operador_login text, chat text, foto blob, foto_ts integer, primary key (operador_login, chat));
""")
def q(sql, *p, fetch=False):
    cur = c.execute(sql.replace("%s", "?"), p); r = cur.fetchall() if fetch else None; c.commit(); return r
app.q = q
for i, ch in enumerate(["1@s.whatsapp.net", "2@s.whatsapp.net", "3@s.whatsapp.net"]):
    c.execute("insert into wa_mensagens (operador_login, chat, ts) values ('ana', ?, ?)", (ch, i)); c.commit()
FOTO = b"\xff\xd8" + b"x" * 500
def buscar(cli, chat):
    if chat.startswith("1"): return FOTO
    if chat.startswith("2"): return None
    raise RuntimeError("timeout")
app.buscar_foto = buscar
ses = {"ana": types.SimpleNamespace(on=True, cli=None)}
app.atualizar_fotos(ses, limite=5)
rows = {r[0]: r for r in c.execute("select chat, foto, foto_ts from wa_contatos")}
assert bytes(rows["1@s.whatsapp.net"][1]) == FOTO and rows["1@s.whatsapp.net"][2] > 0
assert rows["2@s.whatsapp.net"][1] is None and rows["2@s.whatsapp.net"][2] > 0
agora = app.agora_ms()
assert rows["3@s.whatsapp.net"][1] is None and rows["3@s.whatsapp.net"][2] < agora - app.FOTO_RENOVAR_MS + app.FOTO_RETENTAR_MS + 5000, "falha temporária volta a tentar em ~1 dia"
print("ok foto salva, contato sem foto e falha temporária")
app.atualizar_fotos(ses, limite=5)
assert c.execute("select count(*) from wa_contatos").fetchone()[0] == 3
print("ok não busca de novo antes da hora")
ses["ana"].on = False
c.execute("insert into wa_mensagens (operador_login, chat, ts) values ('ana','9@s.whatsapp.net',9)"); c.commit()
app.atualizar_fotos(ses, limite=5)
assert c.execute("select count(*) from wa_contatos where chat='9@s.whatsapp.net'").fetchone()[0] == 0
print("ok sessão desconectada é ignorada\nTODOS OS TESTES PASSARAM")
