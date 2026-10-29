
const SENHA = (function () {
  const s = PropertiesService.getScriptProperties().getProperty('ADMIN_SENHA');
  if (!s) throw new Error('Defina ADMIN_SENHA em Configurações do projeto > Propriedades do script');
  return s;
})();
const ABA_A = 'Acordos';
const ABA_O = 'Operadores';
const ABA_B = 'Base';
const CAB_A = ['id', 'operador', 'cpf', 'nome', 'telefone', 'tipo', 'valor', 'qtdParc', 'valorParc', 'venc', 'coop', 'fechado', 'ativo', 'status', 'criadoEm', 'dia', 'atualizadoEm'];
const CAB_O = ['id', 'nome', 'login', 'criadoEm', 'senhaHash'];
const CAB_B = ['id', 'destino', 'coop', 'doc', 'nome', 'razao', 'atraso', 'saldo', 'tel', 'garantia', 'msgPor', 'msgEm'];
const TEXTO = ['id', 'cpf', 'venc', 'dia', 'login', 'telefone', 'doc', 'tel'];
const STATUS = ['aberto', 'pago', 'prazo', 'quebra'];
const TIPOS = ['À vista', 'Parcelado', 'Renegociação', 'Quitação', 'Boleto', 'Pix'];
const TOKEN_DIAS = 30;

function doGet() {
  return out({ ok: true, msg: 'API Controle de Acordos no ar' });
}

function doPost(e) {
  try {
    const r = JSON.parse(e.postData.contents);
    const escrita = ['save', 'status', 'del', 'addop', 'delop', 'setpass', 'basesave', 'basemsg'].indexOf(r.action) >= 0;
    if (!escrita) return out(handle(r));
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try { return out(handle(r)); } finally { lock.releaseLock(); }
  } catch (err) {
    return out({ ok: false, erro: String(err.message || err) });
  }
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}


function cabecalho(sh) {
  const c = sh.getLastColumn();
  if (c < 1) return [];
  return sh.getRange(1, 1, 1, c).getValues()[0].map(String);
}

function estilo(sh, col, nome) {
  sh.getRange(1, col).setValue(nome).setFontWeight('bold').setBackground('#7c3aed').setFontColor('#ffffff');
  if (TEXTO.indexOf(nome) >= 0) sh.getRange(1, col, sh.getMaxRows(), 1).setNumberFormat('@');
}

function aba(nome, cab) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(nome);
  if (!sh) {
    sh = ss.insertSheet(nome);
    cab.forEach(function (c, i) { estilo(sh, i + 1, c); });
    sh.setFrozenRows(1);
    return sh;
  }
  const atual = cabecalho(sh);
  let col = atual.length;
  cab.forEach(function (c) {
    if (atual.indexOf(c) < 0) { col++; estilo(sh, col, c); }
  });
  return sh;
}

function ler(sh) {
  const n = sh.getLastRow();
  if (n < 2) return [];
  const cab = cabecalho(sh);
  const tz = Session.getScriptTimeZone();
  return sh.getRange(2, 1, n - 1, cab.length).getValues().map(function (l) {
    const o = {};
    cab.forEach(function (c, i) {
      let v = l[i];
      if (v instanceof Date) v = Utilities.formatDate(v, tz, 'yyyy-MM-dd');
      o[c] = v;
    });
    return o;
  });
}

function anexar(sh, obj) {
  const cab = cabecalho(sh);
  sh.appendRow(cab.map(function (c) { return obj[c] === undefined ? '' : obj[c]; }));
}

function colunaDe(sh, nome) {
  return cabecalho(sh).indexOf(nome) + 1;
}

function linhaDoId(sh, id) {
  const n = sh.getLastRow();
  if (n < 2) return -1;
  const ids = sh.getRange(2, colunaDe(sh, 'id'), n - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}


function hex(bytes) {
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}
function sha(txt) {
  return hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, txt, Utilities.Charset.UTF_8));
}
function normSenha(s) { return String(s || '').trim().toLowerCase(); }
function hashSenha(id, senha) { return sha(id + ':' + normSenha(senha)); }

function segredo() {
  const p = PropertiesService.getScriptProperties();
  let s = p.getProperty('SEGREDO');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('SEGREDO', s); }
  return s;
}
function assinar(txt) {
  return hex(Utilities.computeHmacSha256Signature(txt, segredo()));
}
function criarToken(login, chave) {
  const exp = Date.now() + TOKEN_DIAS * 864e5;
  return exp + '.' + assinar(login + '|' + exp + '|' + chave);
}
function tokenOk(login, chave, token) {
  const p = String(token || '').split('.');
  if (p.length !== 2 || Number(p[0]) < Date.now()) return false;
  return assinar(login + '|' + p[0] + '|' + chave) === p[1];
}

function autenticar(r, ops) {
  const login = String(r.login || '').trim().toLowerCase();
  const usaToken = !!r.token;
  const erroCred = new Error(usaToken ? 'Sessão expirada. Entre novamente.' : 'Login ou senha inválidos');

  if (login === 'admin') {
    const chave = sha('admin:' + normSenha(SENHA));
    const ok = usaToken ? tokenOk(login, chave, r.token) : normSenha(r.senha) === normSenha(SENHA);
    if (!ok) throw erroCred;
    return { me: { role: 'admin', nome: 'Administrador', login: login }, chave: chave };
  }

  if (login === 'preventivo') {
    const chaveP = sha('prev:' + normSenha(SENHA));
    const okP = usaToken ? tokenOk(login, chaveP, r.token) : normSenha(r.senha) === normSenha(SENHA);
    if (!okP) throw erroCred;
    return { me: { role: 'prev', nome: 'Preventivo', login: login }, chave: chaveP };
  }

  const o = ops.filter(function (x) { return String(x.login) === login; })[0];
  if (!o) throw erroCred;
  const chave = o.senhaHash ? String(o.senhaHash) : sha('legado:' + normSenha(SENHA));
  const ok = usaToken
    ? tokenOk(login, chave, r.token)
    : (o.senhaHash ? hashSenha(o.id, r.senha) === o.senhaHash : normSenha(r.senha) === normSenha(SENHA));
  if (!ok) throw erroCred;
  return { me: { role: 'op', nome: o.nome, login: login, id: o.id }, chave: chave };
}


function soDigitos(s) { return String(s || '').replace(/\D/g, ''); }

function handle(r) {
  const shO = aba(ABA_O, CAB_O), shA = aba(ABA_A, CAB_A);
  const ops = ler(shO);
  const au = autenticar(r, ops);
  const me = au.me;
  const admin = me.role === 'admin';
  if (me.role === 'prev' && ['login', 'load'].indexOf(r.action) < 0) throw new Error('Sem permissão (acesso somente leitura)');
  const agora = Date.now();
  const tz = Session.getScriptTimeZone();

  if (r.action === 'base') return { ok: true, base: lerBase(me, admin) };
  if (r.action === 'basesave') return salvarBase(r, admin);
  if (r.action === 'basemsg') return marcarMsg(r, me, tz);

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
        ativo: d.ativo === 'Não' ? 'Não' : 'Sim'
      };
      if (o.tipo === 'Parcelado') {
        o.qtdParc = Math.max(1, Math.floor(Number(d.qtdParc) || 1));
        o.valorParc = Number(d.valorParc) || 0;
        if (o.qtdParc < 2 || o.valorParc <= 0) throw new Error('Parcelado: informe a quantidade de parcelas (2 ou mais) e o valor da parcela');
      }
      if (!o.operador || !o.nome || !o.venc || !o.coop || !o.fechado || o.valor <= 0) throw new Error('Preencha todos os campos corretamente');
      if (soDigitos(o.cpf).length !== 11) throw new Error('CPF inválido');
      if (o.telefone) {
        const nt = soDigitos(o.telefone).length;
        if (nt < 10 || nt > 11) throw new Error('Telefone inválido (informe DDD + número)');
      }
      if (TIPOS.indexOf(o.tipo) < 0) throw new Error('Tipo de negociação inválido');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(o.venc)) throw new Error('Vencimento inválido');
      o.id = Utilities.getUuid();
      o.status = 'prazo';
      o.criadoEm = agora;
      o.dia = String(r.dia || Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'));
      o.atualizadoEm = '';
      anexar(shA, o);
      break;
    }

    case 'status': {
      if (STATUS.indexOf(r.status) < 0) throw new Error('Status inválido');
      const linha = linhaDoId(shA, r.id);
      if (linha < 0) throw new Error('Acordo não encontrado');
      if (!admin) donoOuErro(shA, linha, me);
      shA.getRange(linha, colunaDe(shA, 'status')).setValue(r.status);
      shA.getRange(linha, colunaDe(shA, 'atualizadoEm')).setValue(agora);
      break;
    }

    case 'del': {
      const linha = linhaDoId(shA, r.id);
      if (linha > 0) {
        if (!admin) donoOuErro(shA, linha, me);
        shA.deleteRow(linha);
      }
      break;
    }

    case 'addop': {
      if (!admin) throw new Error('Apenas o administrador pode adicionar operadores');
      const nome = String(r.nome || '').trim();
      const lg = String(r.novoLogin || '').trim().toLowerCase();
      const cpf = soDigitos(r.cpf);
      if (!nome || !lg) throw new Error('Informe nome e login');
      if (cpf.length !== 11) throw new Error('Informe o CPF do operador (a senha inicial são os 6 primeiros dígitos)');
      if (lg === 'admin' || lg === 'preventivo' || ops.some(function (x) { return String(x.login) === lg; })) throw new Error('Esse login já existe');
      const id = Utilities.getUuid();
      anexar(shO, { id: id, nome: nome, login: lg, criadoEm: agora, senhaHash: hashSenha(id, cpf.slice(0, 6)) });
      break;
    }

    case 'setpass': {
      if (!admin) throw new Error('Apenas o administrador pode trocar senhas');
      const nova = String(r.novaSenha || '').trim();
      if (nova.length < 4) throw new Error('A senha precisa ter pelo menos 4 caracteres');
      const linha = linhaDoId(shO, r.id);
      if (linha < 0) throw new Error('Operador não encontrado');
      shO.getRange(linha, colunaDe(shO, 'senhaHash')).setValue(hashSenha(r.id, nova));
      break;
    }

    case 'delop': {
      if (!admin) throw new Error('Apenas o administrador pode remover operadores');
      const linha = linhaDoId(shO, r.id);
      if (linha > 0) shO.deleteRow(linha);
      break;
    }

    default:
      throw new Error('Ação desconhecida');
  }

  const todosOps = ler(shO).map(function (x) {
    return { id: x.id, nome: x.nome, login: x.login, criadoEm: x.criadoEm };
  });
  let acordos = ler(shA);
  if (me.role === 'prev') acordos = acordos.filter(function (a) { return a.tipo === 'Parcelado' && Number(a.qtdParc) > 1 && a.status !== 'pago' && a.status !== 'quebra'; });
  else if (!admin) acordos = acordos.filter(function (a) { return a.operador === me.nome; });
  const resp = {
    ok: true,
    me: { role: me.role, nome: me.nome, login: me.login },
    acordos: acordos,
    operadores: admin ? todosOps : todosOps.filter(function (x) { return x.login === me.login; }),
    nomes: todosOps.map(function (x) { return x.nome; })
  };
  if (r.action === 'login') resp.token = criarToken(me.login, au.chave);
  return resp;
}

function donoOuErro(sh, linha, me) {
  const dono = sh.getRange(linha, colunaDe(sh, 'operador')).getValue();
  if (String(dono) !== me.nome) throw new Error('Você só pode alterar os seus próprios acordos');
}


function lerBase(me, admin) {
  const sh = aba(ABA_B, CAB_B);
  return ler(sh)
    .filter(function (b) { return admin || b.destino === 'TODOS' || b.destino === me.nome; })
    .map(function (b) {
      return { id: b.id, destino: b.destino, coop: b.coop, doc: b.doc, nome: b.nome, razao: b.razao,
               atraso: b.atraso, saldo: b.saldo, tel: b.tel, garantia: b.garantia, msgPor: b.msgPor, msgEm: b.msgEm };
    });
}

function salvarBase(r, admin) {
  if (!admin) throw new Error('Apenas o administrador pode carregar a base');
  const destino = String(r.destino || 'TODOS').trim();
  const rows = r.rows || [];
  const sh = aba(ABA_B, CAB_B);
  const cab = cabecalho(sh);
  const lote = Date.now().toString(36) + (r.parte || 0);

  if (r.first) {
    const n = sh.getLastRow();
    if (n > 1) {
      const dest = cab.indexOf('destino');
      const todas = sh.getRange(2, 1, n - 1, cab.length).getValues();
      const mantem = todas.filter(function (l) { return String(l[dest]) !== destino; });
      sh.getRange(2, 1, n - 1, cab.length).clearContent();
      if (mantem.length) sh.getRange(2, 1, mantem.length, cab.length).setValues(mantem);
    }
  }
  if (!rows.length) return { ok: true, gravadas: 0 };

  const novas = rows.map(function (x, i) {
    const o = {
      id: lote + '-' + i, destino: destino,
      coop: String(x.coop || ''), doc: String(x.doc || ''), nome: String(x.nome || ''), razao: String(x.razao || ''),
      atraso: Number(x.atraso) || 0, saldo: Number(x.saldo) || 0,
      tel: String(x.tel || ''), garantia: String(x.garantia || ''), msgPor: '', msgEm: ''
    };
    return cab.map(function (c) { return o[c] === undefined ? '' : o[c]; });
  });
  const ini = Math.max(sh.getLastRow(), 1) + 1;
  if (sh.getMaxRows() < ini + novas.length) sh.insertRowsAfter(sh.getMaxRows(), ini + novas.length - sh.getMaxRows());
  sh.getRange(ini, 1, novas.length, cab.length).setValues(novas);
  return { ok: true, gravadas: novas.length };
}

function marcarMsg(r, me, tz) {
  const sh = aba(ABA_B, CAB_B);
  const linha = linhaDoId(sh, r.id);
  if (linha < 0) throw new Error('Cliente não encontrado na base');
  const em = Utilities.formatDate(new Date(), tz, 'dd/MM HH:mm');
  sh.getRange(linha, colunaDe(sh, 'msgPor')).setValue(me.nome);
  sh.getRange(linha, colunaDe(sh, 'msgEm')).setValue(em);
  return { ok: true, msgPor: me.nome, msgEm: em };
}
