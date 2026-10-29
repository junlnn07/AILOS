const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
const { chromium } = require(process.env.PW_PATH || 'playwright');
const RAIZ = path.join(__dirname, '..');
const ok = (m) => console.log('  ✓ ' + m);

const OPS = [{ id: '1', nome: 'Ana Souza', login: 'ana', criadoEm: 1 }, { id: '2', nome: 'Bruno Lima', login: 'bruno', criadoEm: 1 }];
const DIA_HOJE = new Date().toLocaleDateString('sv-SE');
const t0 = Date.now() - 3600e3;
const ACORDOS = [
  { id: 'a1', operador: 'Ana Souza', cpf: '529.982.247-25', nome: 'CLIENTE UM', telefone: '', tipo: 'Pix', valor: 100, qtdParc: 1, valorParc: 0, venc: '2026-11-04', coop: 'Transpocred', fechado: 'WhatsApp', ativo: 'Sim', status: 'prazo', criadoEm: t0, dia: DIA_HOJE },
  { id: 'a2', operador: 'Bruno Lima', cpf: '111.444.777-35', nome: 'CLIENTE DOIS', telefone: '', tipo: 'Boleto', valor: 250, qtdParc: 1, valorParc: 0, venc: '2026-11-05', coop: 'Credforce', fechado: 'Discador', ativo: 'Sim', status: 'prazo', criadoEm: t0 - 5 * 864e5, dia: '2020-01-02' },
];
let SOLS = [], seq = 0;
const quem = (r) => (r.login === 'admin' ? { role: 'admin', nome: 'Administrador', login: 'admin' } : { role: 'op', ...OPS.find((o) => o.login === r.login) });
const pendDe = (login) => SOLS.filter((s) => (s.destino === 'TODOS' || s.destino === login) && !s.cien[login]).length;

function api(r) {
  const me = quem(r), admin = me.role === 'admin';
  const base = () => ({ ok: true, token: 'tok', me, acordos: admin ? ACORDOS : ACORDOS.filter((a) => a.operador === me.nome), operadores: admin ? OPS : [], nomes: OPS.map((o) => o.nome), ...(admin ? {} : { solPend: pendDe(me.login) }) });
  const lista = () => {
    if (admin) return { ok: true, solicitacoes: SOLS.map((s) => ({ id: s.id, titulo: s.titulo, texto: s.texto, destino: s.destino, criadoPor: 'Administrador', criadoEm: s.criadoEm, alvos: OPS.filter((o) => s.destino === 'TODOS' || o.login === s.destino).map((o) => ({ login: o.login, nome: o.nome, cienteEm: s.cien[o.login] || 0 })) })) };
    const mine = SOLS.filter((s) => s.destino === 'TODOS' || s.destino === me.login).map((s) => ({ id: s.id, titulo: s.titulo, texto: s.texto, destino: s.destino, criadoPor: 'Administrador', criadoEm: s.criadoEm, cienteEm: s.cien[me.login] || 0 }));
    return { ok: true, solicitacoes: mine, pendentes: mine.filter((s) => !s.cienteEm).length };
  };
  switch (r.action) {
    case 'login': case 'load': return base();
    case 'sol_lista': return lista();
    case 'sol_enviar': if (!admin) return { ok: false, erro: 'Apenas o administrador pode enviar solicitações' };
      SOLS.unshift({ id: 's' + ++seq, titulo: r.titulo, texto: r.texto, destino: r.destino, criadoEm: Date.now(), cien: {} }); return lista();
    case 'sol_excluir': SOLS = SOLS.filter((s) => s.id !== r.id); return lista();
    case 'sol_ciente': SOLS.find((s) => s.id === r.id).cien[me.login] = Date.now(); return lista();
    default: return { ok: true };
  }
}

const reqs = [];
const srv = http.createServer((req, res) => {
  if (req.url.startsWith('/api')) { let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => { const j = JSON.parse(b); reqs.push(j.action); res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(api(j))); }); return; }
  let u = decodeURIComponent(req.url.split('?')[0]);
  let f = path.join(RAIZ, u); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!f.startsWith(RAIZ) || !fs.existsSync(f)) { res.statusCode = 404; return res.end(); }
  res.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' }[path.extname(f)] || 'application/octet-stream'); res.end(fs.readFileSync(f));
});

(async () => {
  await new Promise((r) => srv.listen(8125, r));
  const browser = await chromium.launch(), erros = [];
  const nova = async () => { const p = await browser.newPage({ viewport: { width: 1400, height: 900 } }); p.on('pageerror', (e) => erros.push(e.message)); await p.route(/cdnjs|fonts\./, (r) => r.abort()); return p; };
  try {
    const adm = await nova();
    await adm.goto('http://localhost:8125/'); await adm.fill('#lu', 'admin'); await adm.fill('#lp', 'x'); await adm.click('#lg');
    await adm.waitForSelector('.it[data-t="sol"]'); ok('admin: menu tem "Solicitação"');

    await adm.click('.it[data-t="plan"]'); await adm.waitForSelector('#tb tr td');
    const heads = await adm.$$eval('thead th', (t) => t.map((x) => x.textContent));
    assert.equal(heads[0], 'Registrado em'); ok('admin: Planilha começa com a coluna "Registrado em"');
    const cel = await adm.$$eval('#tb tr', (rs) => rs.map((r) => r.children[0].textContent));
    const hhmm = new Date(t0).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    assert.ok(cel.some((c) => c.includes(new Date(t0).toLocaleDateString('pt-BR')) && c.includes(hhmm)), cel.join('|')); ok('admin: mostra dia e hora do registro (' + cel[0] + ')');
    assert.ok(cel.some((c) => c.includes('fechado em 02/01/2020')), cel.join('|')); ok('admin: acordo incluído com data retroativa mostra "fechado em"');

    await adm.click('.it[data-t="sol"]'); await adm.waitForSelector('#sol_m');
    await adm.click('#sol_btn'); await adm.waitForSelector('.tt.bad');
    assert.ok(!reqs.includes('sol_enviar')); ok('admin: mensagem vazia não é enviada');
    await adm.fill('#sol_t', 'Aviso <b>importante</b>'); await adm.fill('#sol_m', 'Linha 1\nLinha 2 <img src=x onerror=window.__xss=1>');
    await adm.click('#sol_btn'); await adm.waitForSelector('#sol_l .sol');
    assert.equal(await adm.$('#sol_l img'), null); assert.equal(await adm.evaluate(() => window.__xss), undefined); ok('admin: texto do recado é escapado (sem HTML injetado)');
    assert.ok((await adm.textContent('#sol_l')).includes('0 de 2 deram ciência')); ok('admin: recado enviado a todos, 0 de 2 com ciência');
    assert.equal(await adm.inputValue('#sol_m'), ''); ok('admin: formulário limpa depois de enviar');

    const op = await nova();
    await op.goto('http://localhost:8125/operador/'); await op.fill('#lu', 'ana'); await op.fill('#lp', '123456'); await op.click('#lg');
    await op.waitForSelector('#sol_l .sol.pend'); ok('operador: com recado pendente, já abre em Solicitação');
    assert.equal(await op.textContent('#bdg_sol'), '1'); ok('operador: selo vermelho mostra 1 pendente');
    assert.ok((await op.textContent('#sol_l')).includes('Linha 2')); ok('operador: lê o texto do admin');
    await op.click('[data-sci]');
    assert.ok((await op.textContent('[data-sci]')).includes('confirmar')); assert.equal(await op.$('.sol.done'), null); ok('operador: 1º clique só pede confirmação');
    await op.click('[data-sci]'); await op.waitForSelector('.sol.done');
    assert.ok((await op.textContent('.sol.done')).includes('Ciência dada em')); ok('operador: 2º clique registra a ciência');
    assert.equal(await op.$eval('#bdg_sol', (e) => getComputedStyle(e).display), 'none'); ok('operador: selo some depois da ciência');

    await adm.click('.it[data-t="plan"]'); await adm.click('.it[data-t="sol"]'); await adm.waitForFunction(() => (document.querySelector('#sol_l') || {}).textContent?.includes('1 de 2'));
    const txt = await adm.textContent('#sol_l');
    assert.ok(txt.includes('1 de 2 deram ciência') && txt.includes('✅ Ana Souza · ciente em') && txt.includes('⏳ Bruno Lima · aguardando')); ok('admin: vê Ana ciente e Bruno aguardando');

    await adm.click('[data-sdel]'); assert.ok(await adm.$('[data-sdel]')); ok('admin: 1º clique em excluir só pede confirmação');
    await adm.click('[data-sdel]'); await adm.waitForFunction(() => !document.querySelector('#sol_l .sol'));
    ok('admin: 2º clique exclui o recado');

    const bru = await nova();
    await bru.goto('http://localhost:8125/operador/'); await bru.fill('#lu', 'bruno'); await bru.fill('#lp', '123456'); await bru.click('#lg');
    await bru.waitForSelector('#v'); assert.equal(await bru.$('#sol_l'), null); ok('operador sem pendência abre na tela normal');
    assert.equal(erros.length, 0, erros.join(' | ')); ok('sem erros de JavaScript nas páginas');
    console.log('TODOS OS TESTES PASSARAM');
  } catch (e) { console.error('FALHOU:', e.message); process.exitCode = 1; }
  finally { await browser.close(); srv.close(); }
})();
