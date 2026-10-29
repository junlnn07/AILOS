
var SINC_ABAS = { operadores: 'Operadores', acordos: 'Acordos', base: 'Base' };
var SINC_TEXTO = ['id', 'cpf', 'venc', 'dia', 'login', 'telefone', 'doc', 'tel'];
var SINC_LOTE = 500;

function sincCfg_() {
  var p = PropertiesService.getScriptProperties();
  var url = (p.getProperty('VERCEL_URL') || '').replace(/\/+$/, '');
  var key = p.getProperty('SYNC_KEY');
  if (!url || !key) throw new Error('Defina VERCEL_URL e SYNC_KEY em Propriedades do script');
  return { url: url + '/api/sync', key: key };
}

function sincChamar_(metodo, tabela, corpo) {
  var c = sincCfg_();
  var opt = { method: metodo, headers: { 'x-sync-key': c.key }, muteHttpExceptions: true };
  var url = c.url;
  if (metodo === 'get') {
    url += '?tabela=' + encodeURIComponent(tabela);
  } else {
    opt.contentType = 'application/json';
    opt.payload = JSON.stringify(corpo);
  }
  var resp = UrlFetchApp.fetch(url, opt);
  var j;
  try { j = JSON.parse(resp.getContentText()); } catch (e) { throw new Error('Resposta inválida da API (HTTP ' + resp.getResponseCode() + ')'); }
  if (!j.ok) throw new Error(j.erro || 'Erro na API');
  return j;
}


function sincEnviarParaNeon() {
  var p = PropertiesService.getScriptProperties();
  if (p.getProperty('SINC_MIGRADO') === '1') {
    throw new Error('A migração já foi feita. Se quiser repetir (isso apaga e recarrega o Neon), rode sincEnviarParaNeonDeNovo().');
  }
  sincEnviarTudo_();
  p.setProperty('SINC_MIGRADO', '1');
}

function sincEnviarParaNeonDeNovo() {
  sincEnviarTudo_();
  PropertiesService.getScriptProperties().setProperty('SINC_MIGRADO', '1');
}

function sincEnviarTudo_() {
  ['operadores', 'acordos', 'base'].forEach(function (t) {
    var linhas = sincLerAba_(SINC_ABAS[t]);
    if (!linhas.length) {
      sincChamar_('post', t, { tabela: t, linhas: [], limpar: true });
      Logger.log(t + ': 0 linhas');
      return;
    }
    for (var i = 0; i < linhas.length; i += SINC_LOTE) {
      sincChamar_('post', t, { tabela: t, linhas: linhas.slice(i, i + SINC_LOTE), limpar: i === 0 });
    }
    Logger.log(t + ': ' + linhas.length + ' linhas enviadas');
  });
}

function sincLerAba_(nome) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome);
  if (!sh || sh.getLastRow() < 2) return [];
  var n = sh.getLastRow(), c = sh.getLastColumn();
  var cab = sh.getRange(1, 1, 1, c).getValues()[0].map(String);
  var tz = Session.getScriptTimeZone();
  return sh.getRange(2, 1, n - 1, c).getValues()
    .map(function (l) {
      var o = {};
      cab.forEach(function (k, i) {
        var v = l[i];
        if (v instanceof Date) v = Utilities.formatDate(v, tz, 'yyyy-MM-dd');
        o[k] = v;
      });
      return o;
    })
    .filter(function (o) { return String(o.id || '') !== ''; });
}


function sincEspelharNoSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SINC_ABAS).forEach(function (t) {
    var j = sincChamar_('get', t);
    var nome = SINC_ABAS[t];
    var sh = ss.getSheetByName(nome) || ss.insertSheet(nome);
    var cab = j.cabecalho, linhas = j.linhas;
    if (sh.getMaxColumns() < cab.length) sh.insertColumnsAfter(sh.getMaxColumns(), cab.length - sh.getMaxColumns());

    sh.clear();
    cab.forEach(function (c, i) {
      if (SINC_TEXTO.indexOf(c) >= 0) sh.getRange(1, i + 1, Math.max(sh.getMaxRows(), linhas.length + 1), 1).setNumberFormat('@');
    });
    sh.getRange(1, 1, 1, cab.length).setValues([cab])
      .setFontWeight('bold').setBackground('#7c3aed').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    if (linhas.length) {
      if (sh.getMaxRows() < linhas.length + 1) sh.insertRowsAfter(sh.getMaxRows(), linhas.length + 1 - sh.getMaxRows());
      sh.getRange(2, 1, linhas.length, cab.length).setValues(linhas);
    }
    Logger.log(nome + ': ' + linhas.length + ' linhas');
  });
}

function sincCriarGatilho() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sincEspelharNoSheets') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sincEspelharNoSheets').timeBased().everyMinutes(15).create();
}
