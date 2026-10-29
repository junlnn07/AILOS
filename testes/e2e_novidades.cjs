const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
const { chromium } = require(process.env.PW_PATH || 'playwright');
const RAIZ = path.join(__dirname, '..'), A = '5541988887777@s.whatsapp.net';
const ok = (m) => console.log('  ✓ ' + m);
const rec = { connect: [] };
const BASE = [
  { id: '1', coop: 'TRANSPOCRED', doc: '1', nome: 'BETO', razao: 'BETO', atraso: '10', saldo: 100, tel: '', garantia: 'Sim' },
  { id: '2', coop: 'VIACREDI', doc: '2', nome: 'ANA', razao: 'ANA', atraso: '200', saldo: 5000.5, tel: '', garantia: 'Não' },
  { id: '3', coop: 'TRANSPOCRED', doc: '3', nome: 'CARLA', razao: 'CARLA', atraso: '45', saldo: 20, tel: '', garantia: 'Não' },
];
const sess = [{ login: 'ana', nome: 'Ana', desejada: true, status: 'conectado', numero: '5541900000000', atualizado_em: Date.now() }];
function api(r) {
  switch (r.action) {
    case 'login': case 'load': return { ok: true, token: 'tok', me: { role: 'op', nome: 'Ana', login: 'ana' }, acordos: [], nomes: [] };
    case 'base': return { ok: true, base: BASE };
    case 'wa_sessoes': return { ok: true, servico: { ts: Date.now(), det: '', agora: Date.now() }, sessoes: sess };
    case 'wa_conversas': return { ok: true, arq_n: 0, etq: [], conversas: [{ op: 'ana', chat: A, contato: 'Zé', nome_custom: '', ts: Date.now(), ultima: 'oi', ultimo_tipo: 'texto', nao_lidas: 0, arquivada: false, etiquetas: [], fixada: false, forcar_nao_lida: false, favorito: false }] };
    case 'wa_msgs': return { ok: true, msgs: [], mais: false };
    case 'wa_connect': rec.connect.push(r.op); return { ok: true };
    default: return { ok: true };
  }
}
const srv = http.createServer((req, res) => {
  if (req.url.startsWith('/api')) { let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(api(JSON.parse(b)))); }); return; }
  let u = decodeURIComponent(req.url.split('?')[0]); if (/^\/whats\/?$/.test(u)) u = '/operador/index.html';
  let f = path.join(RAIZ, u); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!f.startsWith(RAIZ) || !fs.existsSync(f)) { res.statusCode = 404; return res.end(); }
  res.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png' }[path.extname(f)] || 'application/octet-stream'); res.end(fs.readFileSync(f));
});
(async () => {
  await new Promise((r) => srv.listen(8124, r));
  const browser = await chromium.launch(), erros = [];
  const nova = async (w = 1280, h = 800) => { const p = await browser.newPage({ viewport: { width: w, height: h } }); p.on('pageerror', (e) => erros.push(e.message)); await p.route(/cdnjs|fonts\./, (r) => r.abort()); return p; };
  try {
    let page = await nova();
    await page.goto('http://localhost:8124/operador/'); await page.fill('#lu', 'ana'); await page.fill('#lp', '123456'); await page.click('#lg');
    await page.click('.it[data-t="base"]'); await page.waitForSelector('#tb_base tr td');
    const nomes = () => page.$$eval('#tb_base tr', (t) => t.map((r) => r.children[2].textContent));
    await page.click('#bh_atraso'); await page.waitForSelector('#bmenu');
    await page.click('#bmenu [data-bso="atraso|-1"]');
    assert.deepEqual(await nomes(), ['ANA', 'CARLA', 'BETO']); ok('Base: Dias em atraso, maior → menor');
    await page.click('#bh_atraso'); await page.click('#bmenu [data-bso="atraso|1"]');
    assert.deepEqual(await nomes(), ['BETO', 'CARLA', 'ANA']); ok('Base: Dias em atraso, menor → maior');
    await page.click('#bh_nome'); await page.click('#bmenu [data-bso="nome|-1"]');
    assert.deepEqual(await nomes(), ['CARLA', 'BETO', 'ANA']); ok('Base: nome Z → A');
    await page.click('#bh_saldo'); await page.click('#bmenu [data-bso="saldo|-1"]');
    assert.deepEqual(await nomes(), ['ANA', 'BETO', 'CARLA']); ok('Base: saldo maior → menor');
    await page.click('#bh_coop'); await page.click('#bmenu [data-bfv^="coop|VIACREDI"]');
    assert.deepEqual(await nomes(), ['ANA']); ok('Base: filtro por cooperativa');
    await page.click('#bh_coop'); await page.click('#bmenu [data-clr="coop"]');
    assert.equal((await nomes()).length, 3); ok('Base: limpar filtro');
    assert.equal(await page.$('#bmenu'), null); ok('menu fecha depois de escolher');

    await page.click('.it[data-t="wa"]'); await page.waitForSelector('.wa-c');
    assert.equal(await page.$('.wa-bar'), null); ok('barra superior removida');
    assert.ok(await page.$('.wa-cfgf')); ok('engrenagem disponível sem conversa aberta');
    await page.click('.wa-c'); await page.waitForSelector('.wa-ch [data-wa="cfg"]');
    const ordem = await page.$$eval('.wa-ch > button', (b) => b.map((x) => x.dataset.wa));
    assert.ok(ordem.indexOf('cfg') === ordem.indexOf('busca') + 1, ordem.join()); ok('engrenagem logo depois da lupa: ' + ordem.join(' '));
    const box = await page.$eval('.wa-box', (e) => e.getBoundingClientRect().top); assert.ok(box < 20, 'topo=' + box); ok('chat sobe até o topo (' + Math.round(box) + 'px)');
    await page.click('.wa-ch [data-wa="cfg"]'); await page.waitForSelector('#wa_cfg');
    const txt = await page.textContent('#wa_cfg');
    for (const t of ['Conectado', '+5541900000000', 'Reconectar', 'Desconectar', 'Tela cheia', 'Som ao chegar']) assert.ok(txt.includes(t), 'falta ' + t);
    ok('painel mostra conectado, número, reconectar, desconectar, preferências e tela cheia');
    assert.ok(await page.$('#wa_cfg a[href="/whats"]')); ok('painel tem o link para /whats');
    assert.equal(await page.$eval('.wa-ch .wa-cfgdot', (e) => e.className.includes('ok')), true); ok('ponto verde na engrenagem');
    await page.click('#wa_cfg [data-k="connect"]'); await page.waitForTimeout(300);
    assert.deepEqual(rec.connect, ['ana']); ok('Reconectar chama a API');
    await page.keyboard.press('Escape'); await page.close();

    page = await nova();
    await page.goto('http://localhost:8124/whats'); await page.waitForSelector('#lu');
    assert.ok((await page.textContent('h1')).includes('WhatsApp')); ok('/whats mostra login do WhatsApp');
    await page.fill('#lu', 'ana'); await page.fill('#lp', '123456'); await page.click('#lg');
    await page.waitForSelector('.wa-c');
    assert.equal(await page.isVisible('.sb'), false); ok('/whats: sem menu lateral');
    const w = await page.$eval('.wa-box', (e) => e.getBoundingClientRect().width); assert.ok(w > 1200, 'w=' + w); ok('/whats: ocupa a largura toda (' + Math.round(w) + 'px)');
    await page.click('.wa-cfgf'); await page.waitForSelector('#wa_cfg');
    const t2 = await page.textContent('#wa_cfg'); assert.ok(t2.includes('Sair') && t2.includes('Área do Operador')); ok('/whats: painel com Sair e link para a Área do Operador');
    await page.close();

    await browser.close(); srv.close();
  } catch (e) { console.error('FALHOU:', e.message); await browser.close().catch(() => {}); srv.close(); process.exit(1); }
  if (erros.length) { console.error('ERROS DE PÁGINA:', erros); process.exit(1); }
  console.log('TUDO OK');
})();
