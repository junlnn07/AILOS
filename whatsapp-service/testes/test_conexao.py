import sys, os, types
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

def ses(on, **cli):
    return types.SimpleNamespace(on=on, cli=types.SimpleNamespace(**cli))

assert app.vivo(ses(False, is_connected=True, is_logged_in=True)) is False
assert app.vivo(ses(True, is_connected=True, is_logged_in=True)) is True
assert app.vivo(ses(True, is_connected=True, is_logged_in=False)) is False
assert app.vivo(ses(True, is_connected=False, is_logged_in=True)) is False
assert app.vivo(ses(True, is_connected=lambda: True, is_logged_in=lambda: True)) is True
def get_me_erro(): raise RuntimeError("deslogado")
assert app.vivo(ses(True, get_me=get_me_erro)) is False
ok = types.SimpleNamespace(JID=types.SimpleNamespace(User="5541999999999"))
assert app.vivo(ses(True, get_me=lambda: ok)) is True
print("ok vivo(): só considera conectado se o WhatsApp confirma")

chamadas = []
def q(sql, *p, fetch=False):
    chamadas.append((sql, p)); return [] if fetch else None
app.q = q
app.registrar_queda("ana", "O WhatsApp foi desconectado pelo celular.", desejada=False)
sqls = " | ".join(c[0] for c in chamadas)
assert "update wa_sessoes set" in sqls and "wa_eventos" in sqls and "wa_erros" in sqls, sqls
upd = [c for c in chamadas if c[0].startswith("update wa_sessoes")][0]
assert "desejada" in upd[0] and "desconectado" in upd[1] and False in upd[1]
print("ok queda registrada: sessão desconectada, evento e erro visível para o admin")
chamadas.clear()
app.limpar_sessao_salva("ana")
assert any("delete from wa_sessao_arquivo" in c[0] for c in chamadas)
print("ok sessão salva apagada ao sair pelo celular (próximo Conectar gera QR novo)")
chamadas.clear()
saiu = []
def q2(sql, *p, fetch=False):
    chamadas.append((sql, p))
    return [("jose", "5541999999999"), ("ana", None)] if fetch and "from wa_sessoes s" in sql else ([] if fetch else None)
app.q = q2
viva = types.SimpleNamespace(sair=lambda: saiu.append("jose"))
mapa = {"jose": viva}
app.limpar_desconectados(mapa)
assert saiu == ["jose"] and "jose" not in mapa
assert any("delete from wa_sessao_arquivo" in c[0] and c[1] == ("ana",) for c in chamadas)
assert sum("update wa_sessoes set numero=null" in c[0] for c in chamadas) == 2
print("ok Desconectar: sessão ativa faz logout; sessão só salva no banco é apagada; número liberado")
assert app.variantes_br("5541999998888") == ["554199998888", "5541999998888"]
assert app.variantes_br("554199998888") == ["554199998888", "5541999998888"]
assert app.variantes_br("5511999998888") == ["5511999998888", "551199998888"]
assert app.variantes_br("551199998888") == ["5511999998888", "551199998888"]
assert app.variantes_br("554133334444") == ["554133334444"]
assert app.variantes_br("14155550123") == ["14155550123"]
J = lambda u, sv="s.whatsapp.net": types.SimpleNamespace(User=u, Server=sv)
cli_ok = types.SimpleNamespace(is_on_whatsapp=lambda *n: [types.SimpleNamespace(IsIn=(q_ == "+554199998888"), Query=q_, JID=J("554199998888" if q_ == "+554199998888" else "")) for q_ in n])
d, ver = app.destinos(cli_ok, "5541999998888", "s.whatsapp.net")
assert ver and len(d) == 1 and d[0][0] == ["554199998888"]
cli_lid = types.SimpleNamespace(is_on_whatsapp=lambda *n: [types.SimpleNamespace(IsIn=True, Query=n[0], JID=J("146359751548936", "lid")), types.SimpleNamespace(IsIn=True, Query=n[1], JID=J("146359751548936", "lid"))])
d, ver = app.destinos(cli_lid, "41997448311", "s.whatsapp.net")
assert len(d) == 1 and d[0][0] == ["554197448311", "5541997448311"] and "146359751548936" not in str(d[0][0])
def _erro(*n): raise RuntimeError("sem rede")
d, ver = app.destinos(types.SimpleNamespace(is_on_whatsapp=_erro), "5541999998888", "s.whatsapp.net")
assert not ver and [f for f, _ in d] == [["554199998888"], ["5541999998888"]]
print("ok número com e sem o 9: usa o confirmado pelo WhatsApp, ou os dois se não der para checar")
chamadas.clear()
def q3(sql, *p, fetch=False):
    chamadas.append((sql, p))
    if fetch and sql.startswith("select id,operador_login,numero from wa_checagens"): return [(1, "jose", "5541997448311"), (2, "jose", "5541911112222"), (3, "ana", "5541900000000")]
    if fetch and "returning id" in sql: return [(1,)]
    return [] if fetch else None
app.q = q3
def isw(*n):
    if any("5541911112222" in q_ for q_ in n): return [types.SimpleNamespace(IsIn=False, Query=n[0], JID=J("")), types.SimpleNamespace(IsIn=False, Query=n[1], JID=J(""))]
    return [types.SimpleNamespace(IsIn=True, Query=n[0], JID=J("146359751548936", "lid")), types.SimpleNamespace(IsIn=True, Query=n[1], JID=J("146359751548936", "lid"))]
app.processar_checagens({"jose": types.SimpleNamespace(on=True, cli=types.SimpleNamespace(is_on_whatsapp=isw))})
ups = [c for c in chamadas if c[0].startswith("update wa_checagens set status='ok'")]
assert ups[0][1][0] is True and ups[0][1][1] == "554197448311"
assert ups[1][1][0] is False and ups[1][1][1] is None
assert any("status='erro'" in c[0] and c[1][0].startswith("WhatsApp do operador") for c in chamadas)
print("ok Abrir: informa se tem WhatsApp (com o número real), se não tem, ou erro quando desconectado")
assert app.variantes_br("41997448311") == ["554197448311", "5541997448311"]
assert app.variantes_br("4197448311") == ["554197448311", "5541997448311"]
assert app.variantes_br("+55 (41) 99744-8311") == ["554197448311", "5541997448311"]
print("ok número sem +55: 4197448311 e 41997448311 viram o mesmo contato")
print("TODOS OS TESTES PASSARAM")
