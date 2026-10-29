const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
const { chromium } = require(process.env.PW_PATH || 'playwright');
const RAIZ = path.join(__dirname, '..'), AGORA = Date.now(), MIN = 60000, DIA = 86400000;
const A = '5541988887777@s.whatsapp.net', B = '5511977776666@s.whatsapp.net';

const PNG = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=';
const wav = (() => { const n = 8000, b = Buffer.alloc(44 + n); b.write('RIFF', 0); b.writeUInt32LE(36 + n, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(8000, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34); b.write('data', 36); b.writeUInt32LE(n, 40); b.fill(128, 44); return b.toString('base64'); })();
const PDF = Buffer.from('%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 100 100]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF').toString('base64');

const rec = { salvar: null, flags: [], midiaPedidos: [], hist: [], antes: [] };
const conv = [
  { op: 'ana', chat: A, contato: 'ZePush', nome_custom: '', ts: AGORA, ultima: 'oi 😀', ultimo_tipo: 'texto', nao_lidas: 2, arquivada: false, etiquetas: [], fixada: false, forcar_nao_lida: false, favorito: false },
  { op: 'ana', chat: B, contato: 'Maria Push', nome_custom: 'Maria Cliente VIP', ts: AGORA - 9 * DIA, ultima: 'resumo arquivado', ultimo_tipo: 'texto', nao_lidas: 0, arquivada: false, etiquetas: [], fixada: false, forcar_nao_lida: false, favorito: false },
];
const M = (id, o) => ({ id, direcao: id % 2 ? 'in' : 'out', texto: 'mensagem ' + id, tipo: 'texto', ts: AGORA - (61 - id) * MIN, status: id % 2 ? 'recebida' : 'enviada', midia_status: null, midia_mime: null, midia_nome: null, midia_tam: null, voz: false, midia_seg: null, reacao: null, revogar: false, ...o });
const todas = [];
for (let i = 1; i <= 60; i++) todas.push(M(i));
Object.assign(todas[59], { texto: 'Bom dia 😀👍' });
Object.assign(todas[58], { tipo: 'imagem', texto: 'foto do contrato', midia_status: 'ok', midia_mime: 'image/jpeg', midia_nome: 'foto.jpg', midia_tam: 2048 });
Object.assign(todas[57], { tipo: 'audio', texto: '', midia_status: 'ok', midia_mime: 'audio/wav', midia_nome: 'voz.wav', voz: true, midia_seg: 1, midia_tam: 8044 });
Object.assign(todas[56], { tipo: 'documento', texto: '', midia_status: 'ok', midia_mime: 'application/pdf', midia_nome: 'contrato.pdf', midia_tam: 150000 });
Object.assign(todas[55], { tipo: 'documento', texto: '', midia_status: 'ok', midia_mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', midia_nome: 'planilha.xlsx', midia_tam: 30000 });
Object.assign(todas[54], { reacao: '👍' });
Object.assign(todas[53], { tipo: 'imagem', texto: '', midia_status: 'erro', midia_mime: 'image/jpeg', midia_nome: 'expirou.jpg' });
const hist = [1, 2, 3].map((i) => ({ id: 'h:H' + i, hist: true, direcao: 'in', texto: 'arquivada ' + i, tipo: 'texto', ts: AGORA - 20 * DIA + i * MIN, status: 'recebida', midia_status: null, mid: '', ref: '' }));
hist.push({ id: 'h:H4', hist: true, direcao: 'in', texto: '', tipo: 'audio', ts: AGORA - 20 * DIA, status: 'recebida', midia_status: 'ok', midia_mime: 'audio/wav', midia_nome: 'antigo.wav', voz: true, midia_seg: 1, mid: 'DRIVEID9', ref: 'REFASSINADA' });

function apiHandler(r) {
  switch (r.action) {
    case 'login': case 'load': return { ok: true, token: 'tok', me: { role: 'op', nome: 'Ana', login: 'ana' }, acordos: [], nomes: [] };
    case 'wa_sessoes': return { ok: true, servico: { ts: Date.now(), det: '', agora: Date.now() }, sessoes: [{ login: 'ana', nome: 'Ana', desejada: true, status: 'conectado', numero: '5541900000000', atualizado_em: Date.now() }] };
    case 'wa_conversas': return { ok: true, arq_n: 0, etq: [], conversas: [...conv].sort((a, b) => (b.fixada - a.fixada) || b.ts - a.ts) };
    case 'wa_msgs': if (r.antes) { rec.antes.push(r.antes); return { ok: true, msgs: todas.filter((m) => m.id < r.antes), mais: false }; }
      return { ok: true, msgs: r.chat === A ? todas.filter((m) => m.id > 10) : [], mais: true };
    case 'wa_msgs_hist': rec.hist.push(r.antes_ts); return { ok: true, msgs: hist, mais: false };
    case 'wa_midia': {
      rec.midiaPedidos.push(r);
      if (r.ref) { assert.equal(r.ref, 'REFASSINADA'); assert.equal(r.mid, 'DRIVEID9'); return { ok: true, mime: 'audio/wav', nome: 'antigo.wav', b64: wav }; }
      const m = todas.find((x) => x.id === r.id);
      const b64 = m.tipo === 'imagem' ? PNG : m.tipo === 'audio' ? wav : m.midia_mime === 'application/pdf' ? PDF : Buffer.from('xlsx').toString('base64');
      return { ok: true, mime: m.midia_mime, nome: m.midia_nome, b64 };
    }
    case 'wa_contato_get': return { ok: true, contato: { chat: r.chat, telefone: '5541988887777', nome_custom: conv[0].nome_custom, nome_wa: 'ZePush', obs: '', empresa: '', email: '', endereco: '', favorito: false, doc: '', doc_editavel: true, etiquetas: [] },
      arquivos: [{ id: 59, tipo: 'imagem', midia_nome: 'foto.jpg', midia_mime: 'image/jpeg', midia_tam: 2048, ts: AGORA }, { id: 'h:DRIVEID9', hist: true, mid: 'DRIVEID9', ref: 'REFASSINADA', tipo: 'audio', midia_nome: 'antigo.wav', midia_mime: 'audio/wav', ts: AGORA - 20 * DIA }] };
    case 'wa_contato_salvar':
      if (r.doc && r.doc !== '11144477735') throw new Error('CPF/CNPJ inválido (deixe em branco se não quiser informar)');
      rec.salvar = r; conv[0].nome_custom = r.nome_custom; return { ok: true };
    case 'wa_chat_flag': rec.flags.push(r); const c = conv.find((x) => x.chat === r.chat); c[r.campo] = r.valor; return { ok: true };
    case 'wa_read': return { ok: true };
    default: return { ok: true };
  }
}
const srv = http.createServer((req, res) => {
  if (req.url.startsWith('/api')) {
    let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => {
      let out; try { out = req.method === 'POST' ? apiHandler(JSON.parse(b)) : { ok: true }; } catch (e) { out = { ok: false, erro: e.message }; }
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(out));
    }); return;
  }
  let f = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0])); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!f.startsWith(RAIZ) || !fs.existsSync(f)) { res.statusCode = 404; return res.end(); }
  res.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png' }[path.extname(f)] || 'application/octet-stream'); res.end(fs.readFileSync(f));
});

(async () => {
  await new Promise((ok) => srv.listen(8123, ok));
  const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const erros = []; page.on('pageerror', (e) => erros.push(e.stack.split("\n").slice(0,3).join(" | ")));
  await page.route(/cdnjs|fonts\./, (r) => r.abort());
  await page.goto('http://localhost:8123/operador/');
  await page.fill('#lu', 'ana'); await page.fill('#lp', '123456'); await page.click('#lg');
  await page.click('.it[data-t="wa"]');
  await page.waitForSelector('.wa-c');
  const ok = (m) => console.log('  ✓', m);

  const nomes = await page.$$eval('.wa-c .wa-r1 b', (e) => e.map((x) => x.textContent));
  assert.ok(nomes.some((n) => n.includes('Maria Cliente VIP')) && !nomes.some((n) => n.includes('Maria Push')), JSON.stringify(nomes));
  ok('nome personalizado prevalece na lista; conversa só-arquivada (resumo) aparece');

  await page.click('.wa-c[data-chat="' + A + '"]');
  await page.waitForSelector('.wa-b img');
  await page.waitForFunction(() => { const i = document.querySelector('.wa-b img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 8000 });
  ok('imagem aparece na conversa (carregada via API, sem URL pública)');
  assert.ok((await page.textContent('#wa_msgs')).includes('foto do contrato')); ok('legenda da imagem exibida');
  assert.ok((await page.textContent('#wa_msgs')).includes('😀👍')); ok('emojis recebidos sem corromper');
  await page.waitForSelector('.wa-au .pl');
  await page.click('.wa-au .pl'); await page.waitForFunction(() => document.querySelector('.wa-au .pl').textContent === '⏸', null, { timeout: 4000 });
  ok('áudio/voz: player com botão, ▶→⏸ ao reproduzir, duração e botão baixar');
  const docs = await page.$$eval('.wa-doc', (e) => e.map((x) => x.innerText));
  assert.ok(docs.some((d) => d.includes('contrato.pdf') && d.includes('146 KB')) && docs.some((d) => d.includes('planilha.xlsx')), JSON.stringify(docs));
  assert.ok(await page.$('.wa-doc [data-wa="pdf"]')); ok('documentos: cartão com ícone, nome, tamanho, baixar; PDF com visualizar');
  await page.click('.wa-doc [data-wa="pdf"]'); await page.waitForSelector('.wa-mod iframe'); await page.click('.wa-mod [data-x]'); ok('PDF abre em modal e fecha');
  assert.ok((await page.textContent('#wa_msgs')).includes('Mídia indisponível')); ok('mídia expirada mostra erro claro');
  assert.ok(await page.$('.wa-rx')); ok('reação com emoji exibida');
  await page.click('.wa-b img'); await page.waitForSelector('.wa-zoom a[download]'); await page.click('.wa-zoom img'); ok('imagem amplia ao clicar, com botão de download');

  await page.evaluate(() => { const m = document.querySelector('#wa_msgs'); m.scrollTop = 0; m.dispatchEvent(new Event('scroll')); });
  await page.waitForFunction(() => document.querySelectorAll('#wa_msgs .wa-b').length >= 58, null, { timeout: 6000 });
  assert.deepEqual(rec.antes, [11]); ok('rolagem carrega mensagens anteriores do banco (paginação)');
  await page.evaluate(() => { const m = document.querySelector('#wa_msgs'); m.scrollTop = 0; m.dispatchEvent(new Event('scroll')); });
  await page.waitForFunction(() => document.body.innerText.includes('arquivada 3'), null, { timeout: 6000 });
  assert.equal(rec.hist.length, 1); ok('depois do banco, a rolagem busca o histórico arquivado no Sheets (1 chamada, paginada)');
  await page.waitForFunction(() => document.querySelectorAll('.wa-au .pl').length >= 2, null, { timeout: 6000 });
  assert.ok(rec.midiaPedidos.some((p) => p.ref === 'REFASSINADA')); ok('áudio de mensagem arquivada é recuperado pela referência assinada');
  const dias = await page.$$eval('#wa_msgs .wa-day', (e) => e.map((x) => x.textContent)); assert.equal(new Set(dias).size, dias.length, 'separadores de data duplicados: ' + dias); ok('separadores de data sem duplicar (' + dias.length + ')');

  await page.click('.wa-ch .wa-t'); await page.waitForSelector('#wa_cp');
  assert.ok(await page.$eval('#wa_cp', (e) => e.textContent.includes('Arquivos e documentos desta conversa (2)'))); ok('painel lista arquivos recentes e arquivados');
  await page.fill('#cp_doc', '123'); await page.click('#wa_cp [data-s]'); await page.waitForSelector('.tt.bad'); assert.ok(await page.$('#wa_cp')); ok('CPF inválido é recusado e o painel permanece aberto');
  await page.fill('#cp_doc', ''); await page.fill('#cp_nome', 'José da Silva'); await page.fill('#cp_obs', 'cliente pontual'); await page.click('#wa_cp [data-s]');
  await page.waitForFunction(() => !document.querySelector('#wa_cp')); assert.equal(rec.salvar.doc, ''); assert.equal(rec.salvar.nome_custom, 'José da Silva'); ok('salva com CPF/CNPJ em branco (opcional)');
  await page.waitForFunction(() => document.querySelector('.wa-ch .wa-t b').textContent === 'José da Silva', null, { timeout: 8000 });
  const lista = await page.$$eval('.wa-c .wa-r1 b', (e) => e.map((x) => x.textContent)); assert.ok(lista.some((n) => n.includes('José da Silva'))); ok('nome novo aparece no cabeçalho e na lista (o do WhatsApp não sobrescreve)');
  await page.click('.wa-ch .wa-t small', { force: true }).catch(() => {}); await page.waitForSelector('#wa_cp'); await page.click('#wa_cp [data-x]');

  await page.fill('#wa_txt', 'Olá  tudo bem'); await page.evaluate(() => { const t = document.querySelector('#wa_txt'); t.focus(); t.setSelectionRange(4, 4); });
  await page.click('[data-wa="emoji"]'); await page.waitForSelector('.wa-emo'); await page.fill('.wa-emo input', 'dinheiro'); await page.click('.wa-emo [data-e]');
  assert.equal(await page.inputValue('#wa_txt'), 'Olá 💰 tudo bem'); ok('emoji inserido no meio do texto, com busca; texto preservado');

  await page.click('.wa-c[data-chat="' + B + '"]', { button: 'right' }); await page.click('#wa_menu >> text=Fixar');
  await page.waitForFunction(() => document.querySelector('.wa-c .wa-pin')); assert.equal(rec.flags[0].campo, 'fixada'); assert.equal(rec.flags[0].valor, true);
  const primeira = await page.$eval('.wa-c .wa-r1 b', (e) => e.textContent); assert.ok(primeira.includes('Maria Cliente VIP')); ok('menu de contexto: fixar sobe a conversa ao topo');

  await page.screenshot({ path: '/home/claude/e2e.png' });
  assert.deepEqual(erros, [], 'erros JS na página: ' + erros); ok('nenhum erro de JavaScript na página');
  await browser.close(); srv.close(); console.log('E2E: TODOS OS CENÁRIOS PASSARAM');
})().catch(async (e) => { console.error('FALHOU:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
