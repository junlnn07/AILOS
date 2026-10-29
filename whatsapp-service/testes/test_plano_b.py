import sys, os, types, sqlite3, threading
os.environ.setdefault("DATABASE_URL", "postgres://x")
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(AQUI))

def modulo(nome, **attrs):
    m = types.ModuleType(nome); m.__dict__.update(attrs); sys.modules[nome] = m; return m
class _Erro(Exception): pass
modulo("psycopg", OperationalError=_Erro, InterfaceError=_Erro, errors=types.SimpleNamespace(UniqueViolation=_Erro), connect=lambda *a, **k: None)
modulo("neonize"); modulo("neonize.client", NewClient=type("NewClient", (), {"__init__": lambda self, name, database=None: None}))
modulo("neonize.events", MessageEv=object, ConnectedEv=object, DisconnectedEv=object)
modulo("neonize.utils", build_jid=lambda u, s: (u, s))
import app

def banco():
    c = sqlite3.connect(":memory:", check_same_thread=False)
    c.executescript("""
    create table wa_mensagens (id integer primary key autoincrement, operador_login text, chat text, wa_id text, ts integer, midia_id text,
      midia_status text, midia_tam integer, midia_erro text, midia_raw blob, midia_mime text, midia_nome text, tipo text, direcao text, texto text, contato text);
    create table wa_midia_cache (msg_id integer primary key, dados blob not null, mime text, nome text, ts integer not null);
    create table wa_erros (id integer primary key autoincrement, ts integer, origem text, operador_login text, ref text, detalhe text, resolvido int default 0);
    create table wa_contatos (operador_login text, chat text, nome_custom text default '', nome_wa text default '');
    """)
    def q(sql, *p, fetch=False):
        sql = sql.replace("octet_length", "length").replace("%s", "?")
        cur = c.execute(sql, p); r = cur.fetchall() if fetch else None; c.commit(); return r
    return c, q

def nova_msg(c):
    c.execute("insert into wa_mensagens (operador_login, chat, wa_id, ts, midia_status, tipo, direcao) values ('ana','5541@s.whatsapp.net','W1',1,'pendente','documento','in')"); c.commit()
    return c.execute("select max(id) from wa_mensagens").fetchone()[0]

app.ESPERAS_DOWNLOAD = (0, 0, 0, 0)
app.indexar_no_sheets = lambda *a, **k: None

class Cli:
    def __init__(self, falhas, dado=b"PDFDATA"): self.n, self.falhas, self.dado = 0, falhas, dado
    def download_any(self, m):
        self.n += 1
        if self.n <= self.falhas: raise RuntimeError("404 media not found")
        return self.dado
assert app.baixar(Cli(2), ["m"]) == b"PDFDATA"; print("ok download com novas tentativas")
try: app.baixar(Cli(99), ["m"]); raise SystemExit("deveria falhar")
except RuntimeError as e: assert "404" in str(e)
print("ok download esgotado levanta o último erro")
try: app.baixar(Cli(0, dado=b""), ["m"]); raise SystemExit("vazio deveria falhar")
except RuntimeError as e: assert "vazio" in str(e)
print("ok arquivo vazio é tratado como falha")

c, q = banco(); app.q = q
app.DRIVE_URL, app.DRIVE_KEY = "http://x", "k"
def drive_cai(*a, **k): raise OSError("HTTP Error 500")
app.drive_put = drive_cai
rid = nova_msg(c)
assert app.guardar("ana", rid, "contrato.pdf", "application/pdf", b"x" * 1000) is True
st = c.execute("select midia_status, midia_erro, midia_id, midia_tam from wa_mensagens where id=?", (rid,)).fetchone()
assert st[0] == "ok" and st[1] is None and st[2] is None and st[3] == 1000, st
assert c.execute("select count(*) from wa_midia_cache").fetchone()[0] == 1
assert c.execute("select count(*) from wa_erros where origem='drive'").fetchone()[0] == 1
print("ok Drive fora do ar: arquivo vai para o cache e aparece para o operador")

c, q = banco(); app.q = q; app.DRIVE_URL = app.DRIVE_KEY = ""
rid = nova_msg(c)
assert app.guardar("ana", rid, "a.png", "image/png", b"y" * 10) is True
assert c.execute("select midia_status from wa_mensagens where id=?", (rid,)).fetchone()[0] == "ok"
print("ok Drive não configurado: cache salva a mídia")

c, q = banco(); app.q = q; app.DRIVE_URL, app.DRIVE_KEY = "http://x", "k"; app.CACHE_ARQ = 100
rid = nova_msg(c)
assert app.guardar("ana", rid, "v.mp4", "video/mp4", b"z" * 500) is False
st = c.execute("select midia_status, midia_erro from wa_mensagens where id=?", (rid,)).fetchone()
assert st[0] == "erro" and "Drive" in st[1] and "cache" in st[1], st
print("ok falha total registra o motivo:", st[1][:90])
app.CACHE_ARQ = 8 * 1048576

c, q = banco(); app.q = q; app.CACHE_TOTAL = 1500
rid1, rid2 = nova_msg(c), nova_msg(c)
assert app.guardar("ana", rid1, "a", "x/y", b"a" * 1000)
assert app.guardar("ana", rid2, "b", "x/y", b"b" * 1000) is False
print("ok teto total do cache respeitado")
app.CACHE_TOTAL = 120 * 1048576

c, q = banco(); app.q = q; app.drive_put = drive_cai
rid = nova_msg(c); app.guardar("ana", rid, "doc.pdf", "application/pdf", b"p" * 50)
app.sincronizar_cache()
assert c.execute("select count(*) from wa_midia_cache").fetchone()[0] == 1, "Drive ainda fora: mantém no cache"
app.drive_put = lambda login, nome, mime, dados: {"ok": True, "id": "DRIVE123"}
app.sincronizar_cache()
st = c.execute("select midia_id from wa_mensagens where id=?", (rid,)).fetchone()[0]
assert st == "DRIVE123" and c.execute("select count(*) from wa_midia_cache").fetchone()[0] == 0
print("ok cache sincroniza com o Drive quando ele volta e libera o espaço no Neon")

def ev(nome):
    vals = {0: "DELIVERED", 1: "READ", 2: "READ_SELF", 3: "PLAYED"}
    enum = types.SimpleNamespace(values_by_number={k: types.SimpleNamespace(name=v) for k, v in vals.items()})
    desc = types.SimpleNamespace(fields_by_name={"Type": types.SimpleNamespace(enum_type=enum)})
    inv = {v: k for k, v in vals.items()}
    return types.SimpleNamespace(DESCRIPTOR=desc, Type=inv[nome])
assert [app.nivel_recibo(ev(n)) for n in ("DELIVERED", "READ", "READ_SELF", "PLAYED")] == [1, 2, 0, 2]
assert app.nivel_recibo(object()) == 0
print("ok recibos: entregue=1, lido/ouvido=2, leitura em outro aparelho ignorada")
print("TODOS OS TESTES PASSARAM")
