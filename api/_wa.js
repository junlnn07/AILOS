import { timingSafeEqual, createHash } from 'node:crypto';
import { db, hmacSegredo } from './_lib.js';

const CHAT = /^[0-9A-Za-z._-]{3,40}@[a-z.]{3,20}$/;
const NOME_ETQ = /^[^"\\{},]{1,24}$/;

const GOOGLE_URL = String(process.env.GOOGLE_URL || '').trim();
const envT = (n) => String(process.env[n] || '').trim();
const driveCfg = () => ({ url: envT('DRIVE_URL') || GOOGLE_URL, key: envT('DRIVE_KEY') || envT('GOOGLE_KEY') });
async function hist(action, dados) {
  const url = envT('HIST_URL') || GOOGLE_URL, key = envT('HIST_KEY') || envT('GOOGLE_KEY');
  if (!url || !key) throw new Error('Histórico no Google Sheets não configurado (falta a senha GOOGLE_KEY na Vercel)');
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 25000);
  try {
    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ key, action, ...dados }), signal: ctl.signal });
    const d = await resp.json();
    if (!d.ok) throw new Error('Sheets: ' + (d.erro || 'falha'));
    return d;
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? 'O Google Sheets demorou demais para responder' : e.message);
  } finally { clearTimeout(t); }
}
const refMidia = (op, midiaId) => hmacSegredo('midia|' + op + '|' + midiaId).slice(0, 32);
const refOk = (op, midiaId, ref) => { const a = Buffer.from(refMidia(op, midiaId)), b = Buffer.from(String(ref || '')); return a.length === b.length && timingSafeEqual(a, b); };
const upId = (login, up) => createHash('sha256').update(login).digest('hex').slice(0, 12) + up;
const soNum = (v) => String(v || '').replace(/\D/g, '');
function docValido(d) {
  d = soNum(d); if (!d) return true;
  const calc = (base, pesos) => { const x = base.split('').reduce((a, c, i) => a + Number(c) * pesos[i], 0) % 11; return x < 2 ? 0 : 11 - x; };
  if (d.length === 11) { if (/^(\d)\1+$/.test(d)) return false; const p1 = calc(d.slice(0, 9), [10,9,8,7,6,5,4,3,2]), p2 = calc(d.slice(0, 9) + p1, [11,10,9,8,7,6,5,4,3,2]); return d.endsWith('' + p1 + p2); }
  if (d.length === 14) { if (/^(\d)\1+$/.test(d)) return false; const p1 = calc(d.slice(0, 12), [5,4,3,2,9,8,7,6,5,4,3,2]), p2 = calc(d.slice(0, 12) + p1, [6,5,4,3,2,9,8,7,6,5,4,3,2]); return d.endsWith('' + p1 + p2); }
  return false;
}
const mascarar = (d) => { d = soNum(d); return d.length === 11 ? '***.' + d.slice(3, 6) + '.***-**' : d.length === 14 ? '**.***.' + d.slice(5, 8) + '/****-**' : d ? '***' : ''; };
const limpa = (v, n) => String(v || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const num = (c) => String(c || '').split('@')[0];
const msgJson = (x) => ({ ...x, id: Number(x.id), ts: Number(x.ts) });

function canonBR(num) {
  let u = String(num || '').replace(/\D/g, '');
  if ((u.length === 11 && u[2] === '9') || (u.length === 10 && '6789'.includes(u[2]))) u = '55' + u;
  if (!u.startsWith('55')) return u;
  const ddd = Number(u.slice(2, 4));
  if (u.length === 13 && u[4] === '9' && ddd >= 31) return u.slice(0, 4) + u.slice(5);
  if (u.length === 12 && '6789'.includes(u[4]) && ddd < 31) return u.slice(0, 4) + '9' + u.slice(4);
  return u;
}

export async function wa(r, me, admin) {
  const sql = db();
  const agora = Date.now();
  const op = admin ? String(r.op || '').trim().toLowerCase() : me.login;
  if (!admin && me.role !== 'op') throw new Error('Sem permissão');

  switch (r.action) {
    case 'wa_sessoes': {
      const rows = await sql.query(
        `select o.login, o.nome, s.desejada, coalesce(s.status,'desconectado') as status, s.numero, s.erro, s.atualizado_em,
                case when o.login = $2 or ($3 <> '' and o.login = $3) then s.qr end as qr
           from operadores o left join wa_sessoes s on s.operador_login = o.login
          where ($1 = '' or o.login = $1) order by o.nome`, [op, me.login, admin ? String(r.alvo || '').trim().toLowerCase() : '']);
      const [sv] = await sql.query(`select max(ts) as ts, max(detalhe) as det from wa_eventos where operador_login = '_servico' and evento = 'ping'`);
      return { ok: true, servico: { ts: Number(sv && sv.ts) || 0, det: (sv && sv.det) || '', agora }, sessoes: rows.map((x) => ({ ...x, atualizado_em: Number(x.atualizado_em) || 0 })) };
    }
    case 'wa_connect': {
      if (!op) throw new Error('Informe o operador');
      if (admin) {
        const [o] = await sql.query('select 1 from operadores where login = $1', [op]);
        if (!o) throw new Error('Operador não encontrado');
      }
      await sql.query(
        `insert into wa_sessoes (operador_login, desejada, status, qr, erro, atualizado_em) values ($1,true,'aguardando',null,null,$2)
         on conflict (operador_login) do update set desejada=true, status='aguardando', qr=null, erro=null, atualizado_em=$2`, [op, agora]);
      if (admin) await sql.query('insert into wa_eventos (operador_login, evento, detalhe, ts) values ($1,$2,$3,$4)', [op, 'conexao_solicitada', 'pelo admin ' + me.login, agora]);
      return { ok: true };
    }
    case 'wa_disconnect': {
      if (!op) throw new Error('Informe o operador');
      await sql.query(
        `insert into wa_sessoes (operador_login, desejada, status, atualizado_em) values ($1,false,'desconectado',$2)
         on conflict (operador_login) do update set desejada=false, status='desconectado', qr=null, erro=null, atualizado_em=$2`, [op, agora]);
      await sql.query('insert into wa_eventos (operador_login, evento, detalhe, ts) values ($1,$2,$3,$4)',
        [op, 'desconexao_solicitada', 'por ' + me.login, agora]);
      return { ok: true };
    }
    case 'wa_conversas': {
      const q = String(r.q || '').trim().slice(0, 60);
      const de = Number(r.de) || 0, ate = Number(r.ate) || 0, arq = r.arq ? true : false, fav = r.fav ? true : false;
      const rows = await sql.query(
        `with ativo as (
           select m.operador_login as op, m.chat, max(m.contato) filter (where m.contato <> '') as contato, max(m.ts) as ts,
                  (array_agg(m.texto order by m.id desc))[1] as ultima, (array_agg(m.tipo order by m.id desc))[1] as ultimo_tipo,
                  count(*) filter (where m.direcao = 'in' and not m.lida and not m.oculta) as nao_lidas
             from wa_mensagens m
            where ($1 = '' or m.operador_login = $1) and ($3::bigint = 0 or m.ts >= $3::bigint) and ($4::bigint = 0 or m.ts <= $4::bigint) and (not m.oculta or $6)
            group by m.operador_login, m.chat
         ), so_arq as (
           select c.operador_login as op, c.chat, nullif(c.nome_wa, '') as contato, c.ultima_ts as ts, c.ultima, c.ultimo_tipo, 0::bigint as nao_lidas
             from wa_contatos c
            where c.ultima_ts is not null and ($1 = '' or c.operador_login = $1) and ($3::bigint = 0 or c.ultima_ts >= $3::bigint) and ($4::bigint = 0 or c.ultima_ts <= $4::bigint)
              and coalesce(c.oculta_ate, 0) < c.ultima_ts
              and not exists (select 1 from ativo a where a.op = c.operador_login and a.chat = c.chat)
         ), u as (select * from ativo union all select * from so_arq)
         select u.op, u.chat, coalesce(u.contato, nullif(ct.nome_wa, '')) as contato, coalesce(ct.nome_custom, '') as nome_custom,
                u.ts, u.ultima, u.ultimo_tipo, u.nao_lidas, coalesce(k.arquivada, false) as arquivada, coalesce(k.etiquetas, '{}') as etiquetas,
                coalesce(k.fixada, false) as fixada, coalesce(k.forcar_nao_lida, false) as forcar_nao_lida, coalesce(ct.favorito, false) as favorito,
                case when ct.foto is not null then ct.foto_ts end as foto_v
           from u
           left join wa_conversas_meta k on k.operador_login = u.op and k.chat = u.chat
           left join wa_contatos ct on ct.operador_login = u.op and ct.chat = u.chat
          where ($2 = '' or u.chat ilike '%' || $2 || '%' or coalesce(u.contato, '') ilike '%' || $2 || '%'
                 or coalesce(ct.nome_custom, '') ilike '%' || $2 || '%' or coalesce(ct.empresa, '') ilike '%' || $2 || '%')
            and coalesce(k.arquivada, false) = $5 and (not $7 or coalesce(ct.favorito, false))
          order by coalesce(k.fixada, false) desc, u.ts desc limit 100`, [op, q, de, ate, arq, !!admin, fav]);
      const [{ n }] = await sql.query(`select count(*) as n from wa_conversas_meta where arquivada and ($1 = '' or operador_login = $1)`, [op]);
      const etq = await sql.query(`select operador_login as op, nome, cor from wa_etiquetas where ($1 = '' or operador_login = $1) order by nome`, [op]);
      return { ok: true, arq_n: Number(n), etq, conversas: rows.map((x) => ({ ...x, ts: Number(x.ts), nao_lidas: Number(x.nao_lidas), foto_v: x.foto_v ? Number(x.foto_v) : 0 })) };
    }
    case 'wa_msgs': {
      if (!op) throw new Error('Informe o operador');
      const antes = Number(r.antes) || 0;
      const rows = await sql.query(
        `select id, direcao, texto, tipo, ts, status, midia_status, midia_mime, midia_nome, midia_tam, voz, midia_seg, reacao, revogar, midia_erro, (midia_raw is not null) as refazer from wa_mensagens
          where operador_login = $1 and chat = $2 and ($3 = 0 or id < $3) and (not oculta or $4) order by id desc limit 50`, [op, String(r.chat || ''), antes, !!admin]);
      return { ok: true, msgs: rows.reverse().map((x) => ({ ...x, id: Number(x.id), ts: Number(x.ts) })), mais: rows.length === 50 };
    }
    case 'wa_midia': {
      const dono = admin ? String(r.op || '') : me.login;
      let m;
      if (r.ref) {
        const midiaId = String(r.mid || '');
        if (!dono || !midiaId || !refOk(dono, midiaId, r.ref)) throw new Error('Referência de mídia inválida');
        m = { midia_id: midiaId, midia_mime: String(r.mime || ''), midia_nome: String(r.nome || '') };
      } else {
        [m] = await sql.query(
          `select w.midia_id, w.midia_mime, w.midia_nome, (select octet_length(c.dados) from wa_midia_cache c where c.msg_id = w.id) as cache_tam
             from wa_mensagens w where w.id = $1 and ($2 = '' or w.operador_login = $2) and w.midia_status = 'ok'`,
          [Number(r.id) || 0, dono]);
      }
      if (!m) throw new Error('Mídia não encontrada');
      if (!m.midia_id && Number(m.cache_tam)) {
        const PARTE = 2400000, off = Math.max(0, Number(r.off) || 0), tam = Number(m.cache_tam);
        const [c] = await sql.query(`select encode(substring(dados from $2::int for $3::int), 'base64') as b64 from wa_midia_cache where msg_id = $1`, [Number(r.id), off + 1, PARTE]);
        return { ok: true, mime: m.midia_mime, nome: m.midia_nome, grande: false, url: '', b64: String((c && c.b64) || '').replace(/\s/g, ''), tam, off, parcial: off + PARTE < tam };
      }
      const { url, key } = driveCfg();
      if (!url || !key) throw new Error('Este arquivo está no Google Drive, mas a Vercel não encontrou a senha GOOGLE_KEY. Crie a variável GOOGLE_KEY na Vercel (marque Production), com a mesma senha do Apps Script, e faça Redeploy.');
      const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ key, action: 'get', id: m.midia_id }) });
      const d = await resp.json();
      if (!d.ok) throw new Error('Drive: ' + (d.erro || 'falha'));
      return { ok: true, mime: m.midia_mime || d.mime, nome: m.midia_nome, grande: !!d.grande, url: d.url || '', b64: d.b64 || '' };
    }
    case 'wa_midia_refazer': {
      if (admin) throw new Error('Somente o operador dono do número');
      const x = await sql.query(`update wa_mensagens set midia_status = 'refazer', midia_erro = null
                                  where id = $1 and operador_login = $2 and midia_status = 'erro' and direcao = 'in' returning id`, [Number(r.id) || 0, me.login]);
      if (!x.length) throw new Error('Esta mídia não pode ser baixada de novo');
      return { ok: true };
    }
    case 'wa_fotos': {
      const chats = (Array.isArray(r.chats) ? r.chats : []).map(String).filter((c) => CHAT.test(c)).slice(0, 40);
      if (!chats.length || !op) return { ok: true, fotos: {} };
      const lit = '{' + chats.map((c) => '"' + c + '"').join(',') + '}';
      const rows = await sql.query(
        `select chat, foto_ts, encode(foto, 'base64') as b64 from wa_contatos where operador_login = $1 and chat = any($2::text[]) and foto is not null`, [op, lit]);
      return { ok: true, fotos: Object.fromEntries(rows.map((x) => [x.chat, { v: Number(x.foto_ts) || 0, b64: String(x.b64 || '').replace(/\s/g, '') }])) };
    }
    case 'wa_novas': {
      if (admin) return { ok: true, conversas: [], total: 0 };
      const rows = await sql.query(
        `select m.chat, count(*) as n, max(m.ts) as ts, max(m.id) as ultimo_id, max(m.contato) filter (where m.contato <> '') as contato,
                (array_agg(m.texto order by m.id desc))[1] as ultima, (array_agg(m.tipo order by m.id desc))[1] as ultimo_tipo,
                coalesce(max(ct.nome_custom), '') as nome_custom, max(case when ct.foto is not null then ct.foto_ts end) as foto_v
           from wa_mensagens m
           left join wa_contatos ct on ct.operador_login = m.operador_login and ct.chat = m.chat
           left join wa_conversas_meta k on k.operador_login = m.operador_login and k.chat = m.chat
          where m.operador_login = $1 and m.direcao = 'in' and not m.lida and not m.oculta and not coalesce(k.arquivada, false)
          group by m.chat order by max(m.ts) desc limit 20`, [me.login]);
      const conversas = rows.map((x) => ({ chat: x.chat, n: Number(x.n), ts: Number(x.ts), ultimo_id: Number(x.ultimo_id), contato: x.contato || '', nome_custom: x.nome_custom || '',
        ultima: String(x.ultima || '').slice(0, 160), ultimo_tipo: x.ultimo_tipo, foto_v: x.foto_v ? Number(x.foto_v) : 0 }));
      return { ok: true, conversas, total: conversas.length };
    }
    case 'wa_resp_list': {
      if (admin) return { ok: true, respostas: [] };
      const rows = await sql.query('select id, titulo, texto from wa_respostas where operador_login = $1 order by ordem, id limit 100', [me.login]);
      return { ok: true, respostas: rows.map((x) => ({ ...x, id: Number(x.id) })) };
    }
    case 'wa_resp_save': {
      if (admin) throw new Error('Somente o operador cria respostas rápidas');
      const titulo = limpa(r.titulo, 40), texto = String(r.texto || '').replace(/\u0000/g, '').trim().slice(0, 1000), id = Number(r.id) || 0;
      if (!titulo || !texto) throw new Error('Informe o título e o texto da resposta');
      if (id) {
        const x = await sql.query('update wa_respostas set titulo = $3, texto = $4 where id = $1 and operador_login = $2 returning id', [id, me.login, titulo, texto]);
        if (!x.length) throw new Error('Resposta não encontrada');
      } else {
        const [{ n }] = await sql.query('select count(*) as n from wa_respostas where operador_login = $1', [me.login]);
        if (Number(n) >= 50) throw new Error('Limite de 50 respostas rápidas');
        await sql.query('insert into wa_respostas (operador_login, titulo, texto, criado_em) values ($1,$2,$3,$4)', [me.login, titulo, texto, agora]);
      }
      return { ok: true };
    }
    case 'wa_resp_del': {
      if (admin) throw new Error('Somente o operador remove respostas rápidas');
      await sql.query('delete from wa_respostas where id = $1 and operador_login = $2', [Number(r.id) || 0, me.login]);
      return { ok: true };
    }
    case 'wa_msgs_hist': {
      if (!op) throw new Error('Informe o operador');
      const chat = String(r.chat || '');
      if (!CHAT.test(chat)) throw new Error('Conversa inválida');
      const d = await hist('list', { operador: op, chat, antes_ts: Number(r.antes_ts) || 0, limite: 50 });
      const msgs = (d.msgs || []).filter((x) => admin || !x.oculta).reverse().map((x) => ({
        id: 'h:' + x.wa_id, hist: true, direcao: x.direcao, texto: x.texto, tipo: x.tipo, ts: Number(x.ts), status: x.status,
        midia_status: x.midia_id ? 'ok' : x.midia_status || null, midia_mime: x.midia_mime || null, midia_nome: x.midia_nome || null,
        midia_tam: x.midia_tam, voz: !!x.voz, midia_seg: x.midia_seg, mid: x.midia_id || '', ref: x.midia_id ? refMidia(op, x.midia_id) : '',
      }));
      return { ok: true, msgs, mais: !!d.mais };
    }
    case 'wa_busca_hist': {
      const d = await hist('search', { operador: op, q: String(r.q || '').slice(0, 60), limite: 50 });
      return { ok: true, msgs: (d.msgs || []).map((x) => ({ op: x.operador_login, chat: x.chat, ts: Number(x.ts), texto: String(x.texto || '').slice(0, 160), tipo: x.tipo, nome: x.midia_nome })) };
    }
    case 'wa_contato_get': {
      const chat = String(r.chat || '');
      if (!CHAT.test(chat) || !op) throw new Error('Conversa inválida');
      const [c] = await sql.query('select * from wa_contatos where operador_login = $1 and chat = $2', [op, chat]);
      const [k] = await sql.query('select etiquetas, arquivada, fixada from wa_conversas_meta where operador_login = $1 and chat = $2', [op, chat]);
      const [pw] = await sql.query(`select max(contato) filter (where contato <> '') as push from wa_mensagens where operador_login = $1 and chat = $2`, [op, chat]);
      const arqs = await sql.query(
        `select id, tipo, midia_id, midia_nome, midia_mime, midia_tam, ts, direcao from wa_mensagens
          where operador_login = $1 and chat = $2 and midia_status = 'ok' and not oculta order by id desc limit 40`, [op, chat]);
      let antigos = [];
      try {
        const d = await hist('arquivos_chat', { operador: op, chat });
        const jaTem = new Set(arqs.map((x) => String(x.midia_id || '')));
        antigos = (d.arquivos || []).map((x) => ({ id: 'h:' + x.midia_id, hist: true, tipo: x.tipo, midia_nome: x.nome_original, midia_mime: x.mime, midia_tam: Number(x.tam_bytes) || null,
          ts: Number(x.ts), direcao: x.direcao, mid: x.midia_id, ref: refMidia(op, x.midia_id) })).filter((x) => !jaTem.has(x.mid));
      } catch (_) { }
      const dono = !admin;
      return { ok: true, contato: {
        chat, telefone: num(chat), nome_custom: c ? c.nome_custom : '', nome_wa: (c && c.nome_wa) || (pw && pw.push) || '',
        obs: c ? c.obs : '', empresa: c ? c.empresa : '', email: c ? c.email : '', endereco: c ? c.endereco : '', favorito: !!(c && c.favorito),
        doc: c ? (dono ? c.doc : mascarar(c.doc)) : '', doc_editavel: dono, etiquetas: (k && k.etiquetas) || [],
      }, arquivos: [...arqs.map(({ midia_id, ...x }) => msgJson(x)), ...antigos.map(({ mid, ...x }) => ({ ...x, mid }))] };
    }
    case 'wa_contato_salvar': {
      if (admin) throw new Error('Somente o operador dono do número edita contatos');
      const chat = String(r.chat || '');
      if (!CHAT.test(chat)) throw new Error('Conversa inválida');
      const doc = soNum(r.doc);
      if (!docValido(doc)) throw new Error('CPF/CNPJ inválido (deixe em branco se não quiser informar)');
      const email = limpa(r.email, 120);
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('E-mail inválido');
      await sql.query(
        `insert into wa_contatos (operador_login, chat, nome_custom, obs, doc, empresa, email, endereco, favorito, atualizado_em)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         on conflict (operador_login, chat) do update set nome_custom = $3, obs = $4, doc = $5, empresa = $6, email = $7, endereco = $8, favorito = $9, atualizado_em = $10`,
        [me.login, chat, limpa(r.nome_custom, 80), limpa(r.obs, 2000), doc, limpa(r.empresa, 120), email, limpa(r.endereco, 250), !!r.favorito, agora]);
      await sql.query('insert into wa_eventos (operador_login, evento, detalhe, ts) values ($1,$2,$3,$4)', [me.login, 'contato_editado', num(chat) + (doc ? ' doc=' + mascarar(doc) : ''), agora]);
      return { ok: true };
    }
    case 'wa_chat_flag': {
      if (admin) throw new Error('Somente o operador organiza as conversas');
      const chat = String(r.chat || ''), campo = String(r.campo || ''), v = !!r.valor;
      if (!CHAT.test(chat)) throw new Error('Conversa inválida');
      if (campo === 'favorito') {
        await sql.query(`insert into wa_contatos (operador_login, chat, favorito, atualizado_em) values ($1,$2,$3,$4)
                         on conflict (operador_login, chat) do update set favorito = $3, atualizado_em = $4`, [me.login, chat, v, agora]);
      } else if (campo === 'fixada' || campo === 'forcar_nao_lida') {
        await sql.query(`insert into wa_conversas_meta (operador_login, chat, ${campo}) values ($1,$2,$3)
                         on conflict (operador_login, chat) do update set ${campo} = $3`, [me.login, chat, v]);
      } else throw new Error('Opção inválida');
      return { ok: true };
    }
    case 'wa_arquivo_status': {
      if (!admin) throw new Error('Somente administradores');
      const corte = agora - 7 * 86400000;
      const [e] = await sql.query('select * from wa_arquivo_estado where id = 1');
      const [c] = await sql.query(`select count(*) as recentes, count(*) filter (where ts < $1) as aguardando from wa_mensagens`, [corte]);
      const [f] = await sql.query(`select count(*) filter (where midia_status = 'ok') as arquivos, count(*) filter (where midia_status = 'erro') as erros_midia from wa_mensagens`);
      const [er] = await sql.query('select count(*) as n from wa_erros where not resolvido');
      const [tam] = await sql.query('select pg_database_size(current_database()) as b');
      let sheets = null, sheetsErro = null;
      try { sheets = await hist('stats', {}); } catch (x) { sheetsErro = x.message; }
      return { ok: true, estado: e ? { ultima_exec: Number(e.ultima_exec) || 0, ultimo_ok: Number(e.ultimo_ok) || 0, arquivadas: Number(e.arquivadas), ultimo_erro: e.ultimo_erro } : null,
        recentes: Number(c.recentes), aguardando: Number(c.aguardando), arquivos_recentes: Number(f.arquivos), erros_midia: Number(f.erros_midia),
        erros_abertos: Number(er.n), banco_mb: Math.round(Number(tam.b) / 1048576 * 10) / 10, limite_mb: 500,
        sheets: sheets && { mensagens: sheets.mensagens, arquivos: sheets.arquivos }, sheets_erro: sheetsErro };
    }
    case 'wa_arquivo_forcar': {
      if (!admin) throw new Error('Somente administradores');
      await sql.query(`insert into wa_arquivo_estado (id, ultima_exec, ultimo_ok) values (1, 0, 0) on conflict (id) do update set ultima_exec = 0, ultimo_ok = 0`);
      return { ok: true };
    }
    case 'wa_erros': {
      if (!admin) throw new Error('Somente administradores');
      const rows = await sql.query(`select id, ts, origem, operador_login, ref, detalhe, resolvido from wa_erros order by resolvido, ts desc limit 100`);
      return { ok: true, erros: rows.map((x) => ({ ...x, id: Number(x.id), ts: Number(x.ts) })) };
    }
    case 'wa_erro_resolver': {
      if (!admin) throw new Error('Somente administradores');
      await sql.query('update wa_erros set resolvido = true where id = $1', [Number(r.id) || 0]);
      return { ok: true };
    }
    case 'wa_arquivar': {
      if (admin) throw new Error('Somente o operador dono do número organiza as conversas');
      const chat = String(r.chat || '');
      if (!CHAT.test(chat)) throw new Error('Conversa inválida');
      await sql.query(
        `insert into wa_conversas_meta (operador_login, chat, arquivada) values ($1,$2,$3)
         on conflict (operador_login, chat) do update set arquivada = $3`, [me.login, chat, !!r.arq]);
      return { ok: true };
    }
    case 'wa_etiqueta_salvar': {
      if (admin) throw new Error('Somente o operador cria etiquetas');
      const nome = String(r.nome || '').trim(), cor = String(r.cor || '#00a884');
      if (!NOME_ETQ.test(nome)) throw new Error('Nome da etiqueta inválido (1 a 24 caracteres, sem aspas, vírgula ou chaves)');
      if (!/^#[0-9a-fA-F]{6}$/.test(cor)) throw new Error('Cor inválida');
      const [{ n }] = await sql.query('select count(*) as n from wa_etiquetas where operador_login = $1', [me.login]);
      if (Number(n) >= 30) throw new Error('Limite de 30 etiquetas');
      await sql.query(
        `insert into wa_etiquetas (operador_login, nome, cor) values ($1,$2,$3)
         on conflict (operador_login, nome) do update set cor = $3`, [me.login, nome, cor]);
      return { ok: true };
    }
    case 'wa_etiqueta_del': {
      if (admin) throw new Error('Somente o operador remove etiquetas');
      const nome = String(r.nome || '');
      await sql.query('delete from wa_etiquetas where operador_login = $1 and nome = $2', [me.login, nome]);
      await sql.query('update wa_conversas_meta set etiquetas = array_remove(etiquetas, $2) where operador_login = $1', [me.login, nome]);
      return { ok: true };
    }
    case 'wa_chat_etq': {
      if (admin) throw new Error('Somente o operador organiza as conversas');
      const chat = String(r.chat || '');
      if (!CHAT.test(chat)) throw new Error('Conversa inválida');
      const nomes = (Array.isArray(r.etiquetas) ? r.etiquetas : []).map(String).filter((n) => NOME_ETQ.test(n)).slice(0, 30);
      const lit = '{' + nomes.map((n) => '"' + n + '"').join(',') + '}';
      await sql.query(
        `insert into wa_conversas_meta (operador_login, chat, etiquetas) values ($1,$2,$3::text[])
         on conflict (operador_login, chat) do update set etiquetas = $3::text[]`, [me.login, chat, lit]);
      return { ok: true };
    }
    case 'wa_read': {
      if (admin) return { ok: true };
      await sql.query(`update wa_mensagens set lida = true where operador_login = $1 and chat = $2 and direcao = 'in' and not lida and not oculta`,
        [me.login, String(r.chat || '')]);
      await sql.query(`update wa_conversas_meta set forcar_nao_lida = false where operador_login = $1 and chat = $2 and forcar_nao_lida`, [me.login, String(r.chat || '')]);
      return { ok: true };
    }
    case 'wa_checar': {
      if (admin) throw new Error('Somente o operador dono do número confere contatos');
      const numero = canonBR(r.numero);
      if (numero.length < 10 || numero.length > 15) throw new Error('Número inválido');
      const [s] = await sql.query('select status from wa_sessoes where operador_login = $1', [me.login]);
      if (!s || s.status !== 'conectado') throw new Error('Seu WhatsApp não está conectado');
      const [row] = await sql.query(
        `insert into wa_checagens (operador_login, numero, criado_em) values ($1,$2,$3) returning id`, [me.login, numero, agora]);
      return { ok: true, id: Number(row.id) };
    }
    case 'wa_checar_res': {
      const [row] = await sql.query(
        `select status, existe, jid_numero, erro from wa_checagens where id = $1 and operador_login = $2`, [Number(r.id) || 0, me.login]);
      if (!row) throw new Error('Consulta não encontrada');
      return { ok: true, status: row.status, existe: row.existe, numero: row.jid_numero || '', erro: row.erro || '' };
    }
    case 'wa_send': {
      if (admin) throw new Error('Somente o operador dono do número envia mensagens');
      const chat0 = String(r.chat || ''), texto = String(r.texto || '').trim();
      const chat = chat0.endsWith('@s.whatsapp.net') ? canonBR(chat0.split('@')[0]) + '@s.whatsapp.net' : chat0;
      if (!CHAT.test(chat)) throw new Error('Conversa inválida');
      if (!texto || texto.length > 4000) throw new Error('Mensagem vazia ou longa demais (máx. 4000)');
      const [{ n }] = await sql.query(
        `select count(*) as n from wa_mensagens where operador_login = $1 and direcao = 'out' and ts > $2`, [me.login, agora - 60000]);
      if (Number(n) >= 30) throw new Error('Limite de 30 mensagens por minuto atingido');
      const [s] = await sql.query('select status from wa_sessoes where operador_login = $1', [me.login]);
      if (!s || s.status !== 'conectado') throw new Error('Seu WhatsApp não está conectado');
      const wid = String(r.cid || '').slice(0, 60) || 'local-' + agora;
      await sql.query(
        `insert into wa_mensagens (operador_login, chat, wa_id, direcao, texto, ts, status, lida) values ($1,$2,$3,'out',$4,$5,'pendente',true)
         on conflict (operador_login, wa_id) do nothing`, [me.login, chat, 'local-' + wid, texto, agora]);
      return { ok: true };
    }
    case 'wa_apagar': {
      if (admin) throw new Error('Somente o operador dono do número apaga mensagens');
      const ids = (Array.isArray(r.ids) ? r.ids : []).map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 50);
      if (!ids.length) throw new Error('Nenhuma mensagem selecionada');
      const lit = '{' + ids.join(',') + '}';
      if (r.modo === 'todos') {
        const x = await sql.query(
          `update wa_mensagens set revogar = true
            where operador_login = $1 and id = any($2::bigint[]) and direcao = 'out' and tipo <> 'apagada' and status in ('enviada','entregue','visualizada')
              and ts > $3 and wa_id not like 'local-%' and wa_id not like 'env-%' returning id`, [me.login, lit, agora - 2 * 86400000]);
        if (!x.length) throw new Error('Só é possível apagar para todos mensagens enviadas por você nas últimas 48 horas');
        return { ok: true, n: x.length };
      }
      await sql.query(`update wa_mensagens set oculta = true where operador_login = $1 and id = any($2::bigint[])`, [me.login, lit]);
      return { ok: true };
    }
    case 'wa_apagar_conversa': {
      if (admin) throw new Error('Somente o operador dono do número apaga conversas');
      const chat = String(r.chat || '');
      if (!CHAT.test(chat)) throw new Error('Conversa inválida');
      await sql.query(`update wa_mensagens set oculta = true where operador_login = $1 and chat = $2`, [me.login, chat]);
      await sql.query(`insert into wa_contatos (operador_login, chat, oculta_ate, atualizado_em) values ($1,$2,$3,$3)
                       on conflict (operador_login, chat) do update set oculta_ate = $3`, [me.login, chat, agora]);
      return { ok: true };
    }
    case 'wa_arq_parte': {
      if (admin) throw new Error('Somente o operador envia arquivos');
      const up = String(r.up || ''), n = Number(r.n), b64 = String(r.b64 || '');
      if (!/^[0-9a-z]{8,40}$/.test(up) || !Number.isInteger(n) || n < 0 || n > 20) throw new Error('Envio inválido');
      if (!b64 || b64.length > 3500000 || !/^[A-Za-z0-9+/=]+$/.test(b64)) throw new Error('Parte do arquivo inválida');
      await sql.query('delete from wa_upload_partes where ts < $1', [agora - 3600000]);
      const uid = upId(me.login, up);
      const [{ usado }] = await sql.query(`select coalesce(sum(length(dados)),0) as usado from wa_upload_partes where up_id like $1`, [upId(me.login, '') + '%']);
      if (Number(usado) > 80 * 1048576) throw new Error('Muitos arquivos em envio. Aguarde alguns minutos.');
      await sql.query(
        `insert into wa_upload_partes (up_id, n, dados, ts) values ($1,$2,decode($3,'base64'),$4)
         on conflict (up_id, n) do update set dados = excluded.dados, ts = excluded.ts`, [uid, n, b64, agora]);
      return { ok: true };
    }
    case 'wa_send_arq': {
      if (admin) throw new Error('Somente o operador dono do número envia arquivos');
      const chat = String(r.chat || ''), up = String(r.up || ''), partes = Number(r.partes);
      const mime = String(r.mime || 'application/octet-stream').toLowerCase().slice(0, 100);
      const nome = String(r.nome || 'arquivo').replace(/[\\/:*?"<>|\r\n]/g, '_').slice(0, 120) || 'arquivo';
      const legenda = String(r.texto || '').trim().slice(0, 1000);
      if (!CHAT.test(chat)) throw new Error('Conversa inválida');
      if (!/^[0-9a-z]{8,40}$/.test(up) || !Number.isInteger(partes) || partes < 1 || partes > 21) throw new Error('Envio inválido');
      if (!/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(mime)) throw new Error('Tipo de arquivo inválido');
      const [{ n, tam }] = await sql.query('select count(*) as n, coalesce(sum(length(dados)),0) as tam from wa_upload_partes where up_id = $1', [upId(me.login, up)]);
      if (Number(n) !== partes) throw new Error('Envio incompleto, tente de novo');
      if (Number(tam) > 25 * 1048576) throw new Error('Arquivo maior que 25 MB');
      const [s] = await sql.query('select status from wa_sessoes where operador_login = $1', [me.login]);
      if (!s || s.status !== 'conectado') throw new Error('Seu WhatsApp não está conectado');
      const tipo = mime.startsWith('image/') ? 'imagem' : mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : 'documento';
      const wid = String(r.cid || '').slice(0, 60) || 'local-' + agora;
      await sql.query(
        `insert into wa_mensagens (operador_login, chat, wa_id, direcao, texto, tipo, ts, status, lida, midia_mime, midia_nome, midia_status, up_id)
         values ($1,$2,$3,'out',$4,$5,$6,'pendente',true,$7,$8,'pendente',$9) on conflict (operador_login, wa_id) do nothing`,
        [me.login, chat, 'local-' + wid, legenda, tipo, agora, mime, nome, upId(me.login, up)]);
      return { ok: true };
    }
    default:
      throw new Error('Ação desconhecida');
  }
}
