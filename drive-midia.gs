var LIMITE_SITE = 3000000;

function props_() { return PropertiesService.getScriptProperties(); }

function raiz_() {
  var p = props_(), id = p.getProperty('FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var f = DriveApp.createFolder('AILOS - WhatsApp');
  p.setProperty('FOLDER_ID', f.getId());
  return f;
}

function sub_(nome) {
  var raiz = raiz_(), it = raiz.getFoldersByName(nome);
  return it.hasNext() ? it.next() : raiz.createFolder(nome);
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var r = JSON.parse(e.postData.contents);
    var chave = props_().getProperty('DRIVE_KEY');
    if (!chave || r.key !== chave) return out_({ ok: false, erro: 'chave inválida' });

    if (r.action === 'put') {
      var blob = Utilities.newBlob(Utilities.base64Decode(r.b64), r.mime || 'application/octet-stream', r.nome || 'arquivo');
      var f = sub_(String(r.op || 'geral')).createFile(blob);
      return out_({ ok: true, id: f.getId(), url: f.getUrl(), tam: f.getSize() });
    }
    if (r.action === 'get') {
      var arq = DriveApp.getFileById(r.id), tam = arq.getSize();
      if (tam > LIMITE_SITE) return out_({ ok: true, grande: true, url: arq.getUrl(), tam: tam });
      var b = arq.getBlob();
      return out_({ ok: true, mime: b.getContentType(), b64: Utilities.base64Encode(b.getBytes()), tam: tam });
    }
    return out_({ ok: false, erro: 'ação desconhecida' });
  } catch (err) {
    return out_({ ok: false, erro: String(err) });
  }
}

function testar() { Logger.log(raiz_().getUrl()); }
