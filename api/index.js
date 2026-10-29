import { wa } from './_wa.js';
import {
  db, garantirSchema, autenticar, criarToken, hashSenhaForte, novoId, soDigitos, paraJson,
  inserirLote, lerCorpo, cabecalhos, erroSeguro, ipDe, STATUS, TIPOS,
} from './_lib.js';

export default async function handler(req, res) {
  cabecalhos(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method === 'GET') return res.status(200).json({ ok: true });
  if (req.method !== 'POST') return res.status(405).json({ ok: false, erro: 'Método não permitido' });
  try {
    const r = lerCorpo(req);
    if (!r || typeof r !== 'object' || Array.isArray(r)) throw new Error('Pedido inválido');
    await garantirSchema();
    return res.status(200).json(await handle(r, ipDe(req)));
  } catch (err) {
    return res.status(200).json({ ok: false, erro: erroSeguro(err) });
  }
}

async function handle(r, ip) {
  const sql = db();
  const au = await autenticar(r, ip);
  const me = au.me;
  const admin = me.role === 'admin';
  if (me.role === 'prev' && !['login', 'load'].includes(r.action)) {
    throw new Error('Sem permissão (acesso somente leitura)');
  }
  const agora = Date.now();

  if (String(r.action).startsWith('wa_')) return wa(r, me, admin);
  if (r.action === 'base') return { ok: true, base: await lerBase(me, admin) };
  if (r.action === 'basesave') return salvarBase(r, admin);
  if (r.action === 'basemsg') return marcarMsg(r, me);
  if (r.action === 'buscacpf') return buscarCpf(r, me, admin);
  if (String(r.action).startsWith('sol_')) return solicitacoes(r, me, admin, agora);

  switch (r.action) {
    case 'login':
    case 'load':
      break;

    case 'save': {
      const d = r.d || {};
      const o = {
        operador: admin ? String(d.operador || '').trim() : me.nome,
        cpf: String(d.cpf || '').trim(),
        nome: String(d.nome || '').trim(),
        telefone: String(d.telefone || '').trim(),
        tipo: String(d.tipo || '').trim(),
        valor: Number(d.valor) || 0,
        qtdParc: 1,
        valorParc: 0,
        venc: String(d.venc || '').trim(),
        coop: String(d.coop || '').trim(),
        fechado: String(d.fechado || '').trim(),
        ativo: d.ativo === 'Não' ? 'Não' : 'Sim',
      };
      if (o.tipo === 'Parcelado') {
        o.qtdParc = Math.max(1, Math.floor(Number(d.qtdParc) || 1));
        o.valorParc = Number(d.valorParc) || 0;
        if (o.qtdParc < 2 || o.valorParc <= 0) {
          throw new Error('Parcelado: informe a quantidade de parcelas (2 ou mais) e o valor da parcela');
        }
      }
      if (!o.operador || !o.nome || !o.venc || !o.coop || !o.fechado || o.valor <= 0) {
        throw new Error('Preencha todos os campos corretamente');
      }
      if (soDigitos(o.cpf).length !== 11) throw new Error('CPF inválido');
      if (o.telefone) {
        const nt = soDigitos(o.telefone).length;
        if (nt < 10 || nt > 11) throw new Error('Telefone inválido (informe DDD + número)');
      }
      if (!TIPOS.includes(o.tipo)) throw new Error('Tipo de negociação inválido');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(o.venc)) throw new Error('Vencimento inválido');
      const campos = { nome: 120, cpf: 20, telefone: 20, coop: 60, fechado: 40, operador: 120 };
      for (const [k, max] of Object.entries(campos)) if (o[k].length > max) throw new Error('Campo "' + k + '" muito longo');
      if (o.valor > 1e9 || o.valorParc > 1e9 || o.qtdParc > 360) throw new Error('Valor ou quantidade de parcelas fora do limite');
      const dia = /^\d{4}-\d{2}-\d{2}$/.test(String(r.dia || '')) ? String(r.dia) : new Date().toISOString().slice(0, 10);
      if (dia > new Date(Date.now() + 864e5).toISOString().slice(0, 10)) throw new Error('A data do acordo não pode ser futura');
      await sql.query(
        `insert into acordos (id, operador, cpf, nome, telefone, tipo, valor, qtd_parc, valor_parc,
                              venc, coop, fechado, ativo, status, criado_em, dia)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'prazo',$14,$15)`,
        [novoId(), o.operador, o.cpf, o.nome, o.telefone, o.tipo, o.valor, o.qtdParc, o.valorParc,
         o.venc, o.coop, o.fechado, o.ativo, agora, dia],
      );
      break;
    }

    case 'status': {
      if (!STATUS.includes(r.status)) throw new Error('Status inválido');
      const [a] = await sql.query('select operador from acordos where id = $1', [String(r.id || '')]);
      if (!a) throw new Error('Acordo não encontrado');
      if (!admin && a.operador !== me.nome) throw new Error('Você só pode alterar os seus próprios acordos');
      await sql.query('update acordos set status = $1, atualizado_em = $2 where id = $3', [r.status, agora, String(r.id)]);
      break;
    }

    case 'del': {
      const [a] = await sql.query('select operador from acordos where id = $1', [String(r.id || '')]);
      if (a) {
        if (!admin && a.operador !== me.nome) throw new Error('Você só pode alterar os seus próprios acordos');
        await sql.query('delete from acordos where id = $1', [String(r.id)]);
      }
      break;
    }

    case 'addop': {
      if (!admin) throw new Error('Apenas o administrador pode adicionar operadores');
      const nome = String(r.nome || '').trim();
      const lg = String(r.novoLogin || '').trim().toLowerCase();
      const cpf = soDigitos(r.cpf);
      if (!nome || !lg) throw new Error('Informe nome e login');
      if (nome.length > 80) throw new Error('Nome muito longo');
      if (!/^[a-z0-9._-]{3,40}$/.test(lg)) throw new Error('Login inválido (3 a 40 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado)');
      if (cpf.length !== 11) throw new Error('Informe o CPF do operador (a senha inicial são os 6 primeiros dígitos)');
      const [ja] = await sql.query('select 1 as x from operadores where login = $1 or lower(nome) = lower($2)', [lg, nome]);
      if (lg === 'admin' || lg === 'preventivo' || ja) throw new Error('Esse login ou nome já existe');
      const id = novoId();
      await sql.query(
        'insert into operadores (id, nome, login, criado_em, senha_hash) values ($1,$2,$3,$4,$5)',
        [id, nome, lg, agora, await hashSenhaForte(cpf.slice(0, 6))],
      );
      break;
    }

    case 'setpass': {
      if (!admin) throw new Error('Apenas o administrador pode trocar senhas');
      const nova = String(r.novaSenha || '').trim();
      if (nova.length < 6 || nova.length > 100) throw new Error('A senha precisa ter de 6 a 100 caracteres');
      const [o] = await sql.query('select id from operadores where id = $1', [String(r.id || '')]);
      if (!o) throw new Error('Operador não encontrado');
      await sql.query('update operadores set senha_hash = $1 where id = $2', [await hashSenhaForte(nova), o.id]);
      break;
    }

    case 'delop': {
      if (!admin) throw new Error('Apenas o administrador pode remover operadores');
      await sql.query('delete from operadores where id = $1', [String(r.id || '')]);
      break;
    }

    default:
      throw new Error('Ação desconhecida');
  }

  const todosOps = (await sql.query('select id, nome, login, criado_em from operadores order by nome'))
    .map((x) => ({ id: x.id, nome: x.nome, login: x.login, criadoEm: Number(x.criado_em) || 0 }));

  let acordosSql = 'select * from acordos';
  let params = [];
  if (me.role === 'prev') {
    acordosSql += " where tipo = 'Parcelado' and qtd_parc > 1 and status not in ('pago','quebra')";
  } else if (!admin) {
    acordosSql += ' where operador = $1';
    params = [me.nome];
  }
  const acordos = (await sql.query(acordosSql + ' order by criado_em desc', params)).map((x) => paraJson('acordos', x));

  const resp = {
    ok: true,
    me: { role: me.role, nome: me.nome, login: me.login },
    acordos,
    operadores: admin ? todosOps : todosOps.filter((x) => x.login === me.login),
    nomes: todosOps.map((x) => x.nome),
  };
  if (me.role === 'op') resp.solPend = (await pendentesDe(sql, me.login)).length;
  if (r.action === 'login') resp.token = criarToken(me.login, au.chave);
  return resp;
}

const BLOQUEIOS = {};
const nk = (t) => String(t == null ? '' : t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const bloqueada = (login, coop) => { const k = nk(coop); return (BLOQUEIOS[login] || []).some((b) => k.includes(b)); };

function juntar(lista) {
  const G = new Map();
  const vazio = (v) => v === undefined || v === null || String(v).trim() === '';
  for (const b of lista) {
    const d = soDigitos(b.doc);
    const key = d || 'id:' + b.id;
    let g = G.get(key);
    if (!g) {
      g = { ...b, saldo: Number(b.saldo) || 0, atraso: Number(b.atraso) || 0, qtd: 1,
            _co: new Set(vazio(b.coop) ? [] : [String(b.coop).trim()]),
            _ga: new Set(vazio(b.garantia) ? [] : [String(b.garantia).trim()]) };
      G.set(key, g);
      continue;
    }
    g.qtd++;
    g.saldo += Number(b.saldo) || 0;
    g.atraso = Math.max(g.atraso, Number(b.atraso) || 0);
    if (!vazio(b.coop)) g._co.add(String(b.coop).trim());
    if (!vazio(b.garantia)) g._ga.add(String(b.garantia).trim());
    for (const c of ['nome', 'razao', 'tel']) if (vazio(g[c]) && !vazio(b[c])) g[c] = b[c];
    if (vazio(g.msgEm) && !vazio(b.msgEm)) { g.msgPor = b.msgPor; g.msgEm = b.msgEm; }
  }
  return [...G.values()].map((g) => {
    const ga = [...g._ga], pos = ga.filter((v) => !/^n[aã]o/i.test(v));
    g.coop = [...g._co].join(' / ');
    g.garantia = (pos.length ? pos : ga).join(' + ');
    g.saldo = Math.round(g.saldo * 100) / 100;
    delete g._co; delete g._ga;
    return g;
  });
}


async function lerBase(me, admin) {
  if (admin) return (await db().query('select * from base')).map((x) => paraJson('base', x));
  const rows = await db().query("select * from base where destino = 'TODOS' or destino = $1", [me.nome]);
  return juntar(rows.map((x) => paraJson('base', x)).filter((b) => !bloqueada(me.login, b.coop)));
}

async function salvarBase(r, admin) {
  if (!admin) throw new Error('Apenas o administrador pode carregar a base');
  const destino = String(r.destino || 'TODOS').trim().slice(0, 120);
  const rows = (Array.isArray(r.rows) ? r.rows : []).slice(0, 5000).filter((x) => x && typeof x === 'object');
  if (r.first) await db().query('delete from base where destino = $1', [destino]);
  if (!rows.length) return { ok: true, gravadas: 0 };
  const lote = Date.now().toString(36) + (r.parte || 0) + '-' + Math.random().toString(36).slice(2, 6);
  const objs = rows.map((x, i) => ({
    id: lote + '-' + i, destino,
    coop: x.coop, doc: x.doc, nome: x.nome, razao: x.razao,
    atraso: x.atraso, saldo: x.saldo, tel: x.tel, garantia: x.garantia, msgPor: '', msgEm: '',
  }));
  const gravadas = await inserirLote('base', objs);
  return { ok: true, gravadas };
}

async function marcarMsg(r, me) {
  const pt = Object.fromEntries(new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).map((p) => [p.type, p.value]));
  const em = `${pt.day}/${pt.month} ${pt.hour}:${pt.minute}`;
  const [alvo] = await db().query('select doc from base where id = $1', [r.id]);
  const dig = alvo ? soDigitos(alvo.doc) : '';
  const rows = await db().query(
    `update base set msg_por = $1, msg_em = $2
      where ((id = $3) or ($5 <> '' and regexp_replace(doc, '\\D', '', 'g') = $5))
        and (destino = 'TODOS' or destino = $1 or $4) returning id`,
    [me.nome, em, r.id, me.role === 'admin', dig],
  );
  if (!rows.length) throw new Error('Cliente não encontrado na base');
  return { ok: true, msgPor: me.nome, msgEm: em };
}

async function buscarCpf(r, me, admin) {
  const cpf = soDigitos(r.cpf);
  if (cpf.length !== 11) return { ok: true, achou: [] };
  const rows = await db().query(
    `select * from base
      where regexp_replace(doc, '\\D', '', 'g') = $1
        and ($2 or destino = 'TODOS' or destino = $3)
      order by saldo desc limit 20`,
    [cpf, admin, me.nome],
  );
  const lista = rows.map((x) => paraJson('base', x)).filter((b) => admin || !bloqueada(me.login, b.coop));
  return { ok: true, achou: juntar(lista) };
}

const SOL_LIMITE = 100;

async function criadoEmDe(sql, login) {
  const [o] = await sql.query('select criado_em from operadores where login = $1', [login]);
  return o ? Number(o.criado_em) || 0 : 0;
}

async function pendentesDe(sql, login) {
  const desde = await criadoEmDe(sql, login);
  return sql.query(
    `select s.id from solicitacoes s
       left join solicitacoes_ciencia c on c.solicitacao_id = s.id and c.operador_login = $1
      where c.ciente_em is null and ((s.destino = 'TODOS' and s.criado_em >= $2) or s.destino = $1)`,
    [login, desde],
  );
}

async function solicitacoes(r, me, admin, agora) {
  const sql = db();
  if (r.action === 'sol_enviar') {
    if (!admin) throw new Error('Apenas o administrador pode enviar solicitações');
    const titulo = String(r.titulo || '').trim();
    const texto = String(r.texto || '').trim();
    const destino = String(r.destino || 'TODOS').trim();
    if (!texto) throw new Error('Escreva a solicitação');
    if (titulo.length > 120) throw new Error('Título muito longo (máximo 120 caracteres)');
    if (texto.length > 2000) throw new Error('Solicitação muito longa (máximo 2000 caracteres)');
    if (destino !== 'TODOS') {
      const [o] = await sql.query('select 1 as x from operadores where login = $1', [destino]);
      if (!o) throw new Error('Operador não encontrado');
    }
    await sql.query(
      'insert into solicitacoes (id, titulo, texto, destino, criado_por, criado_em) values ($1,$2,$3,$4,$5,$6)',
      [novoId(), titulo, texto, destino, me.nome, agora],
    );
  } else if (r.action === 'sol_excluir') {
    if (!admin) throw new Error('Apenas o administrador pode excluir solicitações');
    const id = String(r.id || '');
    await sql.query('delete from solicitacoes_ciencia where solicitacao_id = $1', [id]);
    await sql.query('delete from solicitacoes where id = $1', [id]);
  } else if (r.action === 'sol_ciente') {
    if (me.role !== 'op') throw new Error('Apenas operadores dão ciência');
    const id = String(r.id || '');
    const [s] = await sql.query('select destino, criado_em from solicitacoes where id = $1', [id]);
    if (!s) throw new Error('Solicitação não encontrada');
    const meu = s.destino === 'TODOS' ? Number(s.criado_em) >= (await criadoEmDe(sql, me.login)) : s.destino === me.login;
    if (!meu) throw new Error('Essa solicitação não é para você');
    await sql.query(
      'insert into solicitacoes_ciencia (solicitacao_id, operador_login, ciente_em) values ($1,$2,$3) on conflict do nothing',
      [id, me.login, agora],
    );
  } else if (r.action !== 'sol_lista') {
    throw new Error('Ação desconhecida');
  }

  const fmt = (s) => ({
    id: s.id, titulo: s.titulo, texto: s.texto, destino: s.destino,
    criadoPor: s.criado_por, criadoEm: Number(s.criado_em) || 0,
  });

  if (!admin) {
    const desde = await criadoEmDe(sql, me.login);
    const rows = await sql.query(
      `select s.*, c.ciente_em from solicitacoes s
         left join solicitacoes_ciencia c on c.solicitacao_id = s.id and c.operador_login = $1
        where (s.destino = 'TODOS' and s.criado_em >= $2) or s.destino = $1
        order by s.criado_em desc limit ${SOL_LIMITE}`,
      [me.login, desde],
    );
    const lista = rows.map((s) => ({ ...fmt(s), cienteEm: s.ciente_em ? Number(s.ciente_em) : 0 }));
    return { ok: true, solicitacoes: lista, pendentes: lista.filter((s) => !s.cienteEm).length };
  }

  const rows = await sql.query(`select * from solicitacoes order by criado_em desc limit ${SOL_LIMITE}`);
  const ops = await sql.query('select login, nome, criado_em from operadores order by nome');
  const cien = rows.length
    ? await sql.query('select * from solicitacoes_ciencia where solicitacao_id = any($1::text[])', [rows.map((s) => s.id)])
    : [];
  const quando = new Map(cien.map((c) => [c.solicitacao_id + '|' + c.operador_login, Number(c.ciente_em) || 0]));
  const lista = rows.map((s) => {
    const alvos = ops
      .filter((o) => (s.destino === 'TODOS' ? Number(s.criado_em) >= (Number(o.criado_em) || 0) : o.login === s.destino))
      .map((o) => ({ login: o.login, nome: o.nome, cienteEm: quando.get(s.id + '|' + o.login) || 0 }));
    return { ...fmt(s), alvos };
  });
  return { ok: true, solicitacoes: lista };
}
