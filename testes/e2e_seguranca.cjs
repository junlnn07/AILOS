const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
const { chromium } = require(process.env.PW_PATH || 'playwright');
const RAIZ = path.join(__dirname, '..'), A = '5541988887777@s.whatsapp.net';
const X = '<img src=x onerror="(window.__xs=window.__xs||[]).push((this.closest(&quot;[id]&quot;)||{}).id+&quot; :: &quot;+this.parentElement.outerHTML.slice(0,160))">', X2 = '"><svg onload="(window.__xs=window.__xs||[]).push(&quot;svg :: &quot;+this.parentElement.outerHTML.slice(0,160))">';
let PAPEL = 'op';
const ok = (m) => console.log('  ✓ ' + m);
const cfg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'vercel.json'), 'utf8'));
const hdr = Object.fromEntries(cfg.headers[0].headers.map((h) => [h.key, h.value]));
const base = [{ id: X2, coop: X, doc: X, nome: X, razao: X2, atraso: 3, saldo: 10, tel: X, garantia: X, msgPor: X, msgEm: X }];
const acordos = [{ id: X2, operador: X, cpf: X, nome: X, telefone: X, tipo: X, valor: 1, qtdParc: 1, valorParc: 0, venc: X, coop: X, fechado: X, ativo: 'Sim', status: 'prazo', criadoEm: 1, dia: X }];
const msgs = [
  { id: 1, ts: Date.now(), direcao: 'in', texto: X + ' https://exemplo.com/?a=1&b="' + X2, tipo: 'texto', status: 'recebida', wa_id: 'a' },
  { id: 2, ts: Date.now(), direcao: 'in', texto: X, tipo: 'documento', midia_nome: X, midia_mime: 'application/pdf', midia_status: 'ok', midia_tam: 10, status: 'recebida', wa_id: 'b' },
  { id: 3, ts: Date.now(), direcao: 'in', texto: X2, tipo: 'imagem', midia_nome: X2, midia_mime: 'image/png', midia_status: 'ok', status: 'recebida', wa_id: 'c', reacao: X },
];
function api(r) {
  switch (r.action) {
    case 'login': case 'load': return { ok: true, token: 'tok', me: { role: PAPEL, nome: X, login: PAPEL === 'op' ? 'ana' : PAPEL }, acordos, nomes: [X], operadores: [{ id: X2, nome: X, login: X2, criadoEm: 1 }] };
    case 'base': return { ok: true, base };
    case 'buscacpf': return { ok: true, achou: base };
    case 'wa_sessoes': return { ok: true, servico: { ts: Date.now(), det: '', agora: Date.now() }, sessoes: [{ login: 'ana', nome: X, desejada: true, status: 'conectado', numero: X, erro: X, atualizado_em: Date.now() }] };
    case 'wa_conversas': return { ok: true, arq_n: 0, etq: [{ nome: X, cor: '#00a884' }], conversas: [{ op: 'ana', chat: A, contato: X, nome_custom: X2, ts: Date.now(), ultima: X, ultimo_tipo: 'texto', nao_lidas: 1, arquivada: false, etiquetas: [X], fixada: false, forcar_nao_lida: false, favorito: false }] };
    case 'wa_msgs': return { ok: true, msgs, mais: false };
    case 'wa_contato': return { ok: true, contato: { chat: A, telefone: X, nome_custom: X, nome_wa: X, obs: X, empresa: X, email: X, endereco: X, favorito: false, doc: '', doc_editavel: true, etiquetas: [X] }, arquivos: [] };
    default: return { ok: true, respostas: [], erros: [] };
  }
}
const srv = http.createServer((req, res) => {
  if (req.url.startsWith('/api')) { let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(api(JSON.parse(b)))); }); return; }
  let u = decodeURIComponent(req.url.split('?')[0]);
  let f = path.join(RAIZ, u); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!f.startsWith(RAIZ) || !fs.existsSync(f)) { res.statusCode = 404; return res.end(); }
  for (const [k, v] of Object.entries(hdr)) res.setHeader(k, v);
  res.setHeader('Content-Type', { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' }[path.extname(f)] || 'application/octet-stream'); res.end(fs.readFileSync(f));
});
(async () => {
  await new Promise((r) => srv.listen(8125, r));
  const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const csp = [], falhas = [];
  page.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text()) && !/cdnjs|fonts\./.test(m.text())) csp.push(m.text().slice(0, 160)); });
  page.on('pageerror', (e) => falhas.push(e.message));
  await page.route(/cdnjs|fonts\./, (r) => r.abort());
  try {
    const rotas = [['/operador/', 'op'], ['/', 'admin'], ['/preventivo/', 'prev']];
    for (const [url, papel] of rotas) {
      PAPEL = papel; csp.length = 0;
      await page.goto('http://localhost:8125' + url); await page.waitForSelector('#lu');
      await page.fill('#lu', papel === 'op' ? 'ana' : papel); await page.fill('#lp', '123456'); await page.click('#lg');
      await page.waitForSelector('.it', { timeout: 8000 }).catch(() => {});
      const n = await page.$$eval('.it', (e) => e.length);
      for (let i = 0; i < n; i++) {
        await page.evaluate((i) => document.querySelectorAll('.it')[i].click(), i); await page.waitForTimeout(500);
        if (await page.$('.wa-c')) { await page.click('.wa-c'); await page.waitForTimeout(700); await page.click('.wa-ch [data-wa="cfg"]').catch(() => {}); await page.waitForTimeout(200); await page.keyboard.press('Escape'); await page.click('.wa-ch .wa-t').catch(() => {}); await page.waitForTimeout(300); await page.keyboard.press('Escape'); }
      }
      await page.waitForTimeout(400);
      const xs = await page.evaluate(() => window.__xs || []);
      assert.deepEqual(xs, [], 'XSS em ' + url + ': ' + JSON.stringify(xs));
      assert.deepEqual(csp, [], csp.join('\n'));
      ok(url + ' (' + papel + '): ' + n + ' abas percorridas, nenhum script injetado executou, sem violação de CSP');
    }
    assert.ok(hdr['X-Frame-Options'] === 'DENY' && /frame-ancestors 'none'/.test(hdr['Content-Security-Policy'])); ok('cabeçalhos de proteção configurados');
  } catch (e) { console.error('FALHOU:', e.message); await browser.close(); srv.close(); process.exit(1); }
  await browser.close(); srv.close();
  if (falhas.length) { console.error('ERROS DE PÁGINA:', falhas.slice(0, 3)); process.exit(1); }
  console.log('TUDO OK');
})();
