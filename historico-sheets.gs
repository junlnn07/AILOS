var COLUNAS = ['key', 'operador_login', 'chat', 'contato', 'wa_id', 'direcao', 'ts', 'tipo', 'texto', 'status',
  'midia_id', 'midia_mime', 'midia_nome', 'midia_tam', 'midia_status', 'oculta', 'voz', 'midia_seg', 'arquivada_em'];
var COLUNAS_ARQ = ['id_arquivo', 'key_mensagem', 'operador', 'conversa', 'telefone', 'nome_cliente', 'tipo', 'nome_original',
  'mime', 'tam_bytes', 'ts', 'direcao', 'legenda', 'armazenamento', 'midia_id', 'estado', 'registrado_em'];
var TZ = 'America/Sao_Paulo';

function props_() { return PropertiesService.getScriptProperties(); }

function planilha_() {
  var p = props_(), id = p.getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  var s = SpreadsheetApp.create('AILOS - Histórico WhatsApp');
  p.setProperty('SHEET_ID', s.getId());
  return s;
}

function aba_(ss, nome, cols) {
  var sh = ss.getSheetByName(nome);
  if (!sh) {
    sh = ss.insertSheet(nome);
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange(1, 1, sh.getMaxRows(), cols.length).setNumberFormat('@');
  }
  return sh;
}

function mes_(ts) { return Utilities.formatDate(new Date(Number(ts)), TZ, 'yyyy_MM'); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function txt_(v, n) { v = (v === null || v === undefined) ? '' : String(v); return v.length > (n || 45000) ? v.slice(0, n || 45000) : v; }

function abasMsgs_(ss, meses) {
  var nomes = ss.getSheets().map(function (s) { return s.getName(); })
    .filter(function (n) { return /^msgs_\d{4}_\d{2}$/.test(n); });
  if (meses && meses.length) nomes = nomes.filter(function (n) { return meses.indexOf(n.slice(5)) > -1; });
  return nomes.sort().reverse();
}

function chavesDe_(sh) {
  var n = sh.getLastRow() - 1;
  if (n < 1) return {};
  var o = {};
  sh.getRange(2, 1, n, 1).getValues().forEach(function (r) { o[String(r[0])] = 1; });
  return o;
}

function paraObj_(r) {
  var o = {};
  COLUNAS.forEach(function (c, i) { o[c] = r[i]; });
  o.ts = Number(o.ts); o.midia_tam = o.midia_tam === '' ? null : Number(o.midia_tam);
  o.midia_seg = o.midia_seg === '' ? null : Number(o.midia_seg);
  o.oculta = o.oculta === 'true' || o.oculta === true; o.voz = o.voz === 'true' || o.voz === true;
  return o;
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var r = JSON.parse(e.postData.contents);
    var chave = props_().getProperty('HIST_KEY');
    if (!chave || r.key !== chave) return out_({ ok: false, erro: 'chave inválida' });
    var ss = planilha_();

    if (r.action === 'append') {
      lock.waitLock(30000);
      var porMes = {}, agora = new Date().toISOString(), novas = 0;
      (r.linhas || []).forEach(function (d) { (porMes[mes_(d.ts)] = porMes[mes_(d.ts)] || []).push(d); });
      Object.keys(porMes).forEach(function (m) {
        var sh = aba_(ss, 'msgs_' + m, COLUNAS), ja = chavesDe_(sh), rows = [];
        porMes[m].forEach(function (d) {
          if (ja[d.key]) return;
          ja[d.key] = 1;
          d.arquivada_em = agora;
          rows.push(COLUNAS.map(function (c) { return c === 'texto' ? txt_(d[c]) : txt_(d[c], 500); }));
        });
        if (rows.length) { sh.getRange(sh.getLastRow() + 1, 1, rows.length, COLUNAS.length).setValues(rows); novas += rows.length; }
      });
      SpreadsheetApp.flush();
      return out_({ ok: true, novas: novas });
    }

    if (r.action === 'verify') {
      var pedidas = r.chaves || [], achadas = {};
      abasMsgs_(ss, r.meses).forEach(function (n) {
        var ks = chavesDe_(ss.getSheetByName(n));
        pedidas.forEach(function (k) { if (ks[k]) achadas[k] = 1; });
      });
      return out_({ ok: true, presentes: Object.keys(achadas) });
    }

    if (r.action === 'list') {
      var lim = Math.min(Number(r.limite) || 50, 100), antes = Number(r.antes_ts) || 9e15, achou = [];
      var nomes = abasMsgs_(ss);
      for (var i = 0; i < nomes.length && achou.length < lim; i++) {
        var sh = ss.getSheetByName(nomes[i]), n = sh.getLastRow() - 1;
        if (n < 1) continue;
        var vals = sh.getRange(2, 1, n, COLUNAS.length).getValues(), parte = [];
        vals.forEach(function (v) {
          if (v[1] === r.operador && v[2] === r.chat && Number(v[6]) < antes) parte.push(paraObj_(v));
        });
        parte.sort(function (a, b) { return b.ts - a.ts; });
        achou = achou.concat(parte);
      }
      achou.sort(function (a, b) { return b.ts - a.ts; });
      return out_({ ok: true, msgs: achou.slice(0, lim), mais: achou.length > lim || i < nomes.length });
    }

    if (r.action === 'search') {
      var termo = String(r.q || '').toLowerCase(), max = Math.min(Number(r.limite) || 50, 100), res = [];
      if (termo.length < 2) return out_({ ok: true, msgs: [] });
      var ns = abasMsgs_(ss);
      for (var j = 0; j < ns.length && res.length < max; j++) {
        var s2 = ss.getSheetByName(ns[j]), n2 = s2.getLastRow() - 1;
        if (n2 < 1) continue;
        s2.getRange(2, 1, n2, COLUNAS.length).getValues().forEach(function (v) {
          if (res.length >= max || (r.operador && v[1] !== r.operador)) return;
          if (String(v[8]).toLowerCase().indexOf(termo) > -1 || String(v[12]).toLowerCase().indexOf(termo) > -1 || String(v[3]).toLowerCase().indexOf(termo) > -1) res.push(paraObj_(v));
        });
      }
      res.sort(function (a, b) { return b.ts - a.ts; });
      return out_({ ok: true, msgs: res });
    }

    if (r.action === 'arquivo') {
      lock.waitLock(30000);
      var sa = aba_(ss, 'arquivos', COLUNAS_ARQ), d2 = r.linha || {};
      var idArq = txt_(d2.midia_id, 200);
      var existentes = sa.getLastRow() > 1 ? sa.getRange(2, 1, sa.getLastRow() - 1, 1).getValues().map(function (x) { return String(x[0]); }) : [];
      if (existentes.indexOf(idArq) > -1) return out_({ ok: true, repetido: true });
      sa.appendRow([idArq, txt_(d2.key, 300), txt_(d2.operador, 100), txt_(d2.chat, 100), txt_(d2.telefone, 40), txt_(d2.nome_cliente, 200),
        txt_(d2.tipo, 30), txt_(d2.nome, 300), txt_(d2.mime, 100), String(d2.tam || ''), String(d2.ts || ''), txt_(d2.direcao, 10),
        txt_(d2.legenda, 1000), 'drive', idArq, txt_(d2.estado || 'ok', 30), new Date().toISOString()]);
      return out_({ ok: true });
    }

    if (r.action === 'arquivos_chat') {
      var sa2 = ss.getSheetByName('arquivos'), lista = [];
      if (sa2 && sa2.getLastRow() > 1) {
        sa2.getRange(2, 1, sa2.getLastRow() - 1, COLUNAS_ARQ.length).getValues().forEach(function (v) {
          if (v[2] === r.operador && v[3] === r.chat) { var o = {}; COLUNAS_ARQ.forEach(function (c, i) { o[c] = v[i]; }); lista.push(o); }
        });
      }
      lista.sort(function (a, b) { return Number(b.ts) - Number(a.ts); });
      return out_({ ok: true, arquivos: lista.slice(0, 60) });
    }

    if (r.action === 'stats') {
      var tot = 0, porAba = {};
      abasMsgs_(ss).forEach(function (n) { var k = Math.max(0, ss.getSheetByName(n).getLastRow() - 1); porAba[n] = k; tot += k; });
      var sh3 = ss.getSheetByName('arquivos');
      return out_({ ok: true, mensagens: tot, arquivos: sh3 ? Math.max(0, sh3.getLastRow() - 1) : 0, abas: porAba, planilha: ss.getUrl() });
    }
    return out_({ ok: false, erro: 'ação desconhecida' });
  } catch (err) {
    return out_({ ok: false, erro: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

function testar() { Logger.log(planilha_().getUrl()); }
