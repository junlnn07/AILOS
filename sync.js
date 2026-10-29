import { timingSafeEqual } from 'node:crypto';
import { db, garantirSchema, TABELAS, paraJson, inserirLote, lerCorpo, cabecalhos, erroSeguro } from './_lib.js';

function chaveOk(req) {
  const certa = process.env.SYNC_KEY;
  if (!certa || certa.length < 16) throw new Error('Variável SYNC_KEY ausente ou curta demais (use 16 caracteres ou mais)');
  const a = Buffer.from(String(req.headers['x-sync-key'] || ''));
  const b = Buffer.from(certa);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  cabecalhos(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (!chaveOk(req)) return res.status(401).json({ ok: false, erro: 'Chave inválida' });
    await garantirSchema();

    const tabela = String(req.method === 'GET' ? req.query.tabela : lerCorpo(req).tabela || '');
    if (!TABELAS[tabela]) throw new Error('Tabela inválida (use acordos, operadores ou base)');

    if (req.method === 'GET') {
      const cols = TABELAS[tabela].cols.filter((c) => !(tabela === 'operadores' && c[0] === 'senhaHash'));
      const ordem = tabela === 'acordos' ? 'criado_em desc nulls last' : tabela === 'operadores' ? 'nome' : 'destino, nome';
      const rows = await db().query(`select ${cols.map((c) => c[1]).join(',')} from ${tabela} order by ${ordem}`);
      const full = rows.map((r) => paraJson(tabela, r));
      return res.status(200).json({
        ok: true,
        cabecalho: cols.map((c) => c[0]),
        linhas: full.map((o) => cols.map((c) => o[c[0]])),
      });
    }

    if (req.method === 'POST') {
      const body = lerCorpo(req);
      const linhas = Array.isArray(body.linhas) ? body.linhas.filter((o) => o && o.id) : [];
      if (body.limpar) await db().query(`delete from ${tabela}`);
      const n = await inserirLote(tabela, linhas, { upsert: true });
      return res.status(200).json({ ok: true, gravadas: n });
    }

    return res.status(405).json({ ok: false, erro: 'Método não permitido' });
  } catch (err) {
    return res.status(200).json({ ok: false, erro: erroSeguro(err) });
  }
}
