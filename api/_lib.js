import { neon } from '@neondatabase/serverless';
import { createHash, createHmac, timingSafeEqual, randomUUID, randomBytes, scrypt } from 'node:crypto';

export const TOKEN_DIAS = 7;
export const STATUS = ['aberto', 'pago', 'prazo', 'quebra'];
export const TIPOS = ['À vista', 'Parcelado', 'Renegociação', 'Quitação', 'Boleto', 'Pix'];


let _sql;
export function db() {
  if (!_sql) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada na Vercel');
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

export const TABELAS = {
  operadores: {
    cols: [
      ['id', 'id', 'text'],
      ['nome', 'nome', 'text'],
      ['login', 'login', 'text'],
      ['criadoEm', 'criado_em', 'bigint', true],
      ['senhaHash', 'senha_hash', 'text', true],
    ],
  },
  acordos: {
    cols: [
      ['id', 'id', 'text'],
      ['operador', 'operador', 'text'],
      ['cpf', 'cpf', 'text'],
      ['nome', 'nome', 'text'],
      ['telefone', 'telefone', 'text'],
      ['tipo', 'tipo', 'text'],
      ['valor', 'valor', 'numeric'],
      ['qtdParc', 'qtd_parc', 'int'],
      ['valorParc', 'valor_parc', 'numeric'],
      ['venc', 'venc', 'text'],
      ['coop', 'coop', 'text'],
      ['fechado', 'fechado', 'text'],
      ['ativo', 'ativo', 'text'],
      ['status', 'status', 'text'],
      ['criadoEm', 'criado_em', 'bigint', true],
      ['dia', 'dia', 'text'],
      ['atualizadoEm', 'atualizado_em', 'bigint', true],
    ],
  },
  base: {
    cols: [
      ['id', 'id', 'text'],
      ['destino', 'destino', 'text'],
      ['coop', 'coop', 'text'],
      ['doc', 'doc', 'text'],
      ['nome', 'nome', 'text'],
      ['razao', 'razao', 'text'],
      ['atraso', 'atraso', 'int'],
      ['saldo', 'saldo', 'numeric'],
      ['tel', 'tel', 'text'],
      ['garantia', 'garantia', 'text'],
      ['msgPor', 'msg_por', 'text'],
      ['msgEm', 'msg_em', 'text'],
    ],
  },
};

const DDL = [
  `create table if not exists operadores (
     id text primary key, nome text not null, login text not null unique,
     criado_em bigint, senha_hash text)`,
  `create table if not exists acordos (
     id text primary key, operador text not null, cpf text not null default '',
     nome text not null default '', telefone text not null default '', tipo text not null default '',
     valor numeric(14,2) not null default 0, qtd_parc integer not null default 1,
     valor_parc numeric(14,2) not null default 0, venc text not null default '',
     coop text not null default '', fechado text not null default '', ativo text not null default 'Sim',
     status text not null default 'prazo', criado_em bigint, dia text not null default '',
     atualizado_em bigint)`,
  `create index if not exists acordos_operador_idx on acordos (operador)`,
  `create index if not exists acordos_status_idx on acordos (status)`,
  `create table if not exists base (
     id text primary key, destino text not null default 'TODOS', coop text not null default '',
     doc text not null default '', nome text not null default '', razao text not null default '',
     atraso integer not null default 0, saldo numeric(14,2) not null default 0,
     tel text not null default '', garantia text not null default '',
     msg_por text not null default '', msg_em text not null default '')`,
  `create index if not exists base_destino_idx on base (destino)`,
  `create index if not exists base_doc_idx on base ((regexp_replace(doc, '\\D', '', 'g')))`,
  `create table if not exists wa_sessoes (
     operador_login text primary key, desejada boolean not null default false, status text not null default 'desconectado',
     numero text, qr text, erro text, atualizado_em bigint)`,
  `create table if not exists wa_mensagens (
     id bigserial primary key, operador_login text not null, chat text not null, contato text not null default '',
     wa_id text not null, direcao text not null, texto text not null default '', tipo text not null default 'texto',
     ts bigint not null, status text not null default 'recebida', lida boolean not null default false,
     unique (operador_login, wa_id))`,
  `create index if not exists wa_msg_chat_idx on wa_mensagens (operador_login, chat, id desc)`,
  `create index if not exists wa_msg_ts_idx on wa_mensagens (operador_login, ts desc)`,
  `create index if not exists wa_msg_pend_idx on wa_mensagens (status) where status = 'pendente'`,
  `create table if not exists wa_eventos (
     id bigserial primary key, operador_login text not null, evento text not null, detalhe text, ts bigint not null)`,
  `alter table wa_mensagens add column if not exists midia_id text`,
  `alter table wa_mensagens add column if not exists midia_mime text`,
  `alter table wa_mensagens add column if not exists midia_nome text`,
  `alter table wa_mensagens add column if not exists midia_status text`,
  `alter table wa_mensagens add column if not exists midia_tam bigint`,
  `alter table wa_mensagens add column if not exists oculta boolean not null default false`,
  `alter table wa_mensagens add column if not exists revogar boolean not null default false`,
  `alter table wa_mensagens add column if not exists up_id text`,
  `create table if not exists wa_upload_partes (
     up_id text not null, n int not null, dados bytea not null, ts bigint not null, primary key (up_id, n))`,
  `create table if not exists wa_sessao_arquivo (operador_login text primary key, dados bytea not null, atualizado_em bigint)`,
  `create table if not exists wa_conversas_meta (
     operador_login text not null, chat text not null, arquivada boolean not null default false,
     etiquetas text[] not null default '{}', primary key (operador_login, chat))`,
  `create table if not exists wa_etiquetas (
     operador_login text not null, nome text not null, cor text not null default '#00a884', primary key (operador_login, nome))`,

  `alter table wa_mensagens add column if not exists voz boolean not null default false`,
  `alter table wa_mensagens add column if not exists midia_seg integer`,
  `alter table wa_mensagens add column if not exists reacao text`,
  `alter table wa_conversas_meta add column if not exists fixada boolean not null default false`,
  `alter table wa_conversas_meta add column if not exists forcar_nao_lida boolean not null default false`,
  `create table if not exists wa_contatos (
     operador_login text not null, chat text not null,
     nome_custom text not null default '', nome_wa text not null default '', obs text not null default '',
     doc text not null default '', empresa text not null default '', email text not null default '',
     endereco text not null default '', favorito boolean not null default false,
     ultima_ts bigint, ultima text, ultimo_tipo text, atualizado_em bigint,
     primary key (operador_login, chat))`,
  `alter table wa_contatos add column if not exists oculta_ate bigint`,
  `create table if not exists wa_arquivo_estado (
     id integer primary key, lock_ate bigint not null default 0, ultima_exec bigint, ultimo_ok bigint,
     arquivadas bigint not null default 0, ultimo_erro text)`,
  `create table if not exists wa_erros (
     id bigserial primary key, ts bigint not null, origem text not null, operador_login text, ref text,
     detalhe text, resolvido boolean not null default false)`,
  `create index if not exists wa_erros_idx on wa_erros (resolvido, ts desc)`,
  `create index if not exists wa_msg_arq_idx on wa_mensagens (ts)`,
  `alter table wa_mensagens add column if not exists midia_erro text`,
  `alter table wa_mensagens add column if not exists midia_raw bytea`,
  `create table if not exists wa_midia_cache (msg_id bigint primary key, dados bytea not null, mime text, nome text, ts bigint not null)`,
  `alter table wa_contatos add column if not exists foto bytea`,
  `alter table wa_contatos add column if not exists foto_ts bigint`,
  `create table if not exists wa_respostas (
     id bigserial primary key, operador_login text not null, titulo text not null, texto text not null,
     ordem int not null default 0, criado_em bigint)`,
  `create index if not exists wa_resp_idx on wa_respostas (operador_login, ordem, id)`,
  `create table if not exists wa_checagens (id bigserial primary key, operador_login text not null, numero text not null, status text not null default 'pendente', existe boolean, jid_numero text, erro text, criado_em bigint, atualizado_em bigint)`,
  `create table if not exists login_falhas (chave text primary key, n int not null default 0, ate bigint not null default 0, ultimo bigint not null)`,
  `create table if not exists solicitacoes (
     id text primary key, titulo text not null default '', texto text not null default '',
     destino text not null default 'TODOS', criado_por text not null default '', criado_em bigint not null)`,
  `create index if not exists solicitacoes_criado_idx on solicitacoes (criado_em desc)`,
  `create table if not exists solicitacoes_ciencia (
     solicitacao_id text not null, operador_login text not null, ciente_em bigint not null,
     primary key (solicitacao_id, operador_login))`,
  `create index if not exists solicitacoes_ciencia_op_idx on solicitacoes_ciencia (operador_login)`,
];

let _pronto;
export function garantirSchema() {
  if (!_pronto) {
    _pronto = (async () => {
      const sql = db();
      for (const q of DDL) await sql.query(q);
    })().catch((e) => { _pronto = null; throw e; });
  }
  return _pronto;
}


export function converter(tipo, v, anulavel) {
  if (tipo === 'text') {
    if (v === null || v === undefined || v === '') return anulavel ? null : '';
    return String(v);
  }
  if (v === null || v === undefined || v === '') return anulavel ? null : 0;
  const n = Number(v);
  if (!Number.isFinite(n)) return anulavel ? null : 0;
  return tipo === 'numeric' ? n : Math.round(n);
}

export function paraJson(tabela, row) {
  const o = {};
  for (const [k, c, t] of TABELAS[tabela].cols) {
    let v = row[c];
    if (v === null || v === undefined) v = t === 'text' ? '' : t === 'bigint' ? '' : 0;
    else if (t !== 'text') v = Number(v);
    o[k] = v;
  }
  return o;
}

export async function inserirLote(tabela, objs, { upsert = false } = {}) {
  if (!objs.length) return 0;
  const cols = TABELAS[tabela].cols;
  const nomes = cols.map((c) => c[1]).join(',');
  const arrays = cols.map(([k, , t, an]) => objs.map((o) => converter(t, o[k], an)));
  const sel = cols.map(([, , t], i) => `$${i + 1}::${t === 'int' ? 'integer' : t}[]`).join(',');
  let q = `insert into ${tabela} (${nomes}) select * from unnest(${sel})`;
  if (upsert) {
    const sets = cols.filter((c) => c[1] !== 'id').map((c) => `${c[1]}=excluded.${c[1]}`).join(',');
    q += ` on conflict (id) do update set ${sets}`;
  }
  await db().query(q, arrays);
  return objs.length;
}


export const sha = (t) => createHash('sha256').update(t, 'utf8').digest('hex');
export const normSenha = (s) => String(s || '').trim().toLowerCase();
export const hashSenha = (id, senha) => sha(id + ':' + normSenha(senha));
export const novoId = () => randomUUID();

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const scryptP = (senha, salt) => new Promise((ok, no) => scrypt(senha, salt, 32, SCRYPT, (e, k) => (e ? no(e) : ok(k))));
export async function hashSenhaForte(senha) {
  const salt = randomBytes(16);
  const k = await scryptP(normSenha(senha), salt);
  return 's1$' + salt.toString('hex') + '$' + k.toString('hex');
}
const ehForte = (h) => /^s1\$[0-9a-f]{32}\$[0-9a-f]{64}$/.test(String(h || ''));
export async function conferirSenha(id, senha, guardado) {
  if (ehForte(guardado)) {
    const [, salt, hex] = guardado.split('$');
    const k = await scryptP(normSenha(senha), Buffer.from(salt, 'hex'));
    return igual(k.toString('hex'), hex);
  }
  return igual(hashSenha(id, senha), guardado);
}

const MAX_FALHAS_LOGIN = 8, MAX_FALHAS_IP = 40, BLOQUEIO_MS = 15 * 60000;
const chaveFalha = (t, v) => t + ':' + String(v || '?').toLowerCase().slice(0, 80);
async function checarBloqueio(chaves) {
  const rows = await db().query('select chave, ate from login_falhas where chave = any($1::text[])', [chaves]);
  const ate = Math.max(0, ...rows.map((x) => Number(x.ate) || 0));
  if (ate > Date.now()) throw new Error('Muitas tentativas de login. Aguarde ' + Math.ceil((ate - Date.now()) / 60000) + ' minuto(s) e tente de novo.');
}
async function registrarFalha(chaves, limites) {
  const agora = Date.now();
  for (let i = 0; i < chaves.length; i++) {
    await db().query(
      `insert into login_falhas (chave, n, ate, ultimo) values ($1, 1, 0, $2)
       on conflict (chave) do update set
         n = case when login_falhas.ultimo < $2 - $4 then 1 else login_falhas.n + 1 end,
         ate = case when (case when login_falhas.ultimo < $2 - $4 then 1 else login_falhas.n + 1 end) >= $3 then $2 + $4 else login_falhas.ate end,
         ultimo = $2`, [chaves[i], agora, limites[i], BLOQUEIO_MS]);
  }
  if (Math.random() < 0.05) await db().query('delete from login_falhas where ultimo < $1', [agora - 86400000]);
}
async function limparFalhas(chave) { await db().query('delete from login_falhas where chave = $1', [chave]); }
export const ipDe = (req) => String((req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip'])) || '').split(',')[0].trim().slice(0, 64) || 'desconhecido';
export const soDigitos = (s) => String(s || '').replace(/\D/g, '');

function env(nome) {
  const v = process.env[nome];
  if (!v) throw new Error(`Variável ${nome} não configurada na Vercel`);
  return v;
}

function igual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

const assinar = (txt) => createHmac('sha256', env('TOKEN_SECRET')).update(txt).digest('hex');

export function criarToken(login, chave) {
  const exp = Date.now() + TOKEN_DIAS * 864e5;
  return exp + '.' + assinar(login + '|' + exp + '|' + chave);
}

export function tokenOk(login, chave, token) {
  const p = String(token || '').split('.');
  if (p.length !== 2 || Number(p[0]) < Date.now()) return false;
  return igual(assinar(login + '|' + p[0] + '|' + chave), p[1]);
}

export async function autenticar(r, ip = 'desconhecido') {
  const login = String(r.login || '').trim().toLowerCase().slice(0, 80);
  const usaToken = !!r.token;
  const erroCred = new Error(usaToken ? 'Sessão expirada. Entre novamente.' : 'Login ou senha inválidos');
  const SENHA = env('ADMIN_SENHA');
  const SENHA_PREV = String(process.env.PREV_SENHA || '').trim() || SENHA;
  const kU = chaveFalha('u', login), kI = chaveFalha('ip', ip);

  if (!usaToken) {
    if (!r.senha) throw erroCred;
    await checarBloqueio([kU, kI]);
  }
  const falhou = async () => { if (!usaToken) await registrarFalha([kU, kI], [MAX_FALHAS_LOGIN, MAX_FALHAS_IP]); throw erroCred; };
  const passou = async () => { if (!usaToken) await limparFalhas(kU); };

  const confere = (chave, senhaCerta) =>
    usaToken ? tokenOk(login, chave, r.token) : igual(normSenha(r.senha), normSenha(senhaCerta));

  if (login === 'admin') {
    const chave = sha('admin:' + normSenha(SENHA));
    if (!confere(chave, SENHA)) return falhou();
    await passou();
    return { me: { role: 'admin', nome: 'Administrador', login }, chave };
  }
  if (login === 'preventivo') {
    const chave = sha('prev:' + normSenha(SENHA_PREV));
    if (!confere(chave, SENHA_PREV)) return falhou();
    await passou();
    return { me: { role: 'prev', nome: 'Preventivo', login }, chave };
  }

  const rows = await db().query('select id, nome, login, senha_hash from operadores where login = $1', [login]);
  const o = rows[0];
  if (!o) { if (!usaToken) await scryptP(normSenha(r.senha), Buffer.alloc(16)); return falhou(); }
  let chave = o.senha_hash ? String(o.senha_hash) : sha('legado:' + normSenha(SENHA));
  let ok;
  if (usaToken) ok = tokenOk(login, chave, r.token);
  else if (o.senha_hash) ok = await conferirSenha(o.id, r.senha, o.senha_hash);
  else ok = igual(normSenha(r.senha), normSenha(SENHA));
  if (!ok) return falhou();
  await passou();
  if (!usaToken && o.senha_hash && !ehForte(o.senha_hash)) {
    const novo = await hashSenhaForte(r.senha);
    await db().query('update operadores set senha_hash = $1 where id = $2 and senha_hash = $3', [novo, o.id, o.senha_hash]);
    chave = novo;
  }
  return { me: { role: 'op', nome: o.nome, login, id: o.id }, chave };
}

export const hmacSegredo = (txt) => assinar(txt);


export function lerCorpo(req) {
  const b = req.body;
  if (b === undefined || b === null || b === '') return {};
  if (typeof b === 'string') return JSON.parse(b);
  if (Buffer.isBuffer(b)) return JSON.parse(b.toString('utf8'));
  return b;
}

export function cabecalhos(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
}

export function erroSeguro(err) {
  const comum = err && err.name === 'Error' && !err.code;
  if (comum) return String(err.message || 'Erro');
  if (err && err.name === 'SyntaxError') return 'Pedido inválido';
  console.error('erro interno:', err);
  return 'Erro interno. Tente novamente em instantes.';
}
