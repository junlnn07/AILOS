import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const props = { GOOGLE_KEY: 'segredo-de-teste-1234567' };
class Faixa { constructor(sh, r, c, n, m) { Object.assign(this, { sh, r, c, n, m }); }
  getValues() { const o = []; for (let i = 0; i < this.n; i++) o.push(Array.from({ length: this.m }, (_, j) => (this.sh.rows[this.r - 1 + i] || [])[this.c - 1 + j] ?? '')); return o; }
  setValues(v) { v.forEach((lin, i) => { const R = (this.sh.rows[this.r - 1 + i] = this.sh.rows[this.r - 1 + i] || []); lin.forEach((x, j) => { R[this.c - 1 + j] = x; }); }); return this; }
  setFontWeight() { return this; } setNumberFormat() { return this; } }
class Aba { constructor(nome) { this.nome = nome; this.rows = []; }
  getName() { return this.nome; } getLastRow() { return this.rows.length; } getMaxRows() { return 1000; } setFrozenRows() {}
  getRange(r, c, n, m) { return new Faixa(this, r, c, n || 1, m || 1); } appendRow(l) { this.rows.push(l); } }
const planilha = { abas: {}, getSheetByName(n) { return this.abas[n] || null; }, insertSheet(n) { return (this.abas[n] = new Aba(n)); },
  getSheets() { return Object.values(this.abas); }, getUrl: () => 'https://docs/x', getId: () => 'SHEET' };
const arquivos = {};
const ctx = {
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null, setProperty: (k, v) => { props[k] = v; } }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t) => ({ setMimeType: () => JSON.parse(t) }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  SpreadsheetApp: { create: () => planilha, openById: () => planilha, flush() {} },
  Utilities: { formatDate: (d) => d.toISOString().slice(0, 7).replace('-', '_'), base64Decode: (b) => Buffer.from(b, 'base64'), base64Encode: (b) => Buffer.from(b).toString('base64'),
    newBlob: (dados, mime, nome) => ({ dados, mime, nome, getContentType: () => mime, getBytes: () => dados }) },
  DriveApp: { createFolder: () => ({ getId: () => 'PASTA', getFoldersByName: () => ({ hasNext: () => false }), createFolder: () => ({ createFile: (b) => { arquivos.F1 = b; return { getId: () => 'F1', getUrl: () => 'u', getSize: () => b.dados.length }; } }), getUrl: () => 'p' }),
    getFolderById: () => ({ getId: () => 'PASTA', getFoldersByName: () => ({ hasNext: () => false }), createFolder: () => ({ createFile: (b) => { arquivos.F1 = b; return { getId: () => 'F1', getUrl: () => 'u', getSize: () => b.dados.length }; } }) }),
    getFileById: (id) => ({ getSize: () => arquivos[id].dados.length, getUrl: () => 'u', getBlob: () => arquivos[id], getParents: () => ({ hasNext: () => true, next: () => ({ getId: () => 'PASTA', getParents: () => ({ hasNext: () => false }) }) }) }) },
  Logger: { log() {} }, Date, JSON, String, Number, Math, Object, Array,
};
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../google-ailos.gs', import.meta.url), 'utf8'), ctx);
const post = (o) => ctx.doPost({ postData: { contents: JSON.stringify(o) } });

assert.equal(post({ action: 'ping', key: 'errada' }).erro, 'chave inválida');
assert.deepEqual({ ...post({ action: 'ping', key: 'segredo-de-teste-1234567' }) }, { ok: true, drive: true, sheets: true, versao: 'unificado-2' });
console.log('ok ping e senha');

props.FOLDER_ID = 'PASTA';
const put = post({ action: 'put', key: 'segredo-de-teste-1234567', op: 'ana', nome: 'c.pdf', mime: 'application/pdf', b64: Buffer.from('conteudo').toString('base64') });
assert.equal(put.ok, true); assert.equal(put.id, 'F1');
const get = post({ action: 'get', key: 'segredo-de-teste-1234567', id: 'F1' });
assert.equal(Buffer.from(get.b64, 'base64').toString(), 'conteudo');
assert.equal(post({ action: 'put', key: 'x' }).erro, 'chave inválida');
console.log('ok Drive: guardar e buscar arquivo');

const ts = Date.UTC(2026, 9, 10);
const linha = (id) => ({ key: 'ana|' + id, operador_login: 'ana', chat: '5541@s.whatsapp.net', contato: 'Maria', wa_id: id, direcao: 'in', ts, tipo: 'texto', texto: 'oi ' + id, status: 'recebida' });
assert.equal(post({ action: 'append', key: 'segredo-de-teste-1234567', linhas: [linha('A'), linha('B')] }).novas, 2);
assert.equal(post({ action: 'append', key: 'segredo-de-teste-1234567', linhas: [linha('A')] }).novas, 0, 'idempotente');
assert.deepEqual([...post({ action: 'verify', key: 'segredo-de-teste-1234567', chaves: ['ana|A', 'ana|Z'] }).presentes], ['ana|A']);
const lst = post({ action: 'list', key: 'segredo-de-teste-1234567', operador: 'ana', chat: '5541@s.whatsapp.net' });
assert.equal(lst.msgs.length, 2);
assert.equal(post({ action: 'stats', key: 'segredo-de-teste-1234567' }).mensagens, 2);
assert.equal(post({ action: 'nada', key: 'segredo-de-teste-1234567' }).erro, 'ação desconhecida');
console.log('ok Sheets: gravar sem duplicar, conferir, listar e estatísticas');
console.log('OK: google-ailos.gs atende Drive e Sheets no mesmo endereço');
