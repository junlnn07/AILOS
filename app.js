const API='/api';
const KEY='ac_admin';

const TIPOS=['À vista','Parcelado','Renegociação','Quitação','Boleto','Pix'],
COOPERATIVAS=['TRANSPOCRED','VIACREDI AV','ACREDICOOP','CREDICOMIN','CREDICREA','CREDIFOZ','VIACREDI','CREVISC','ACENTRA','UNILOS','EVOLUA','CIVIA'],
FECHADO_POR=['WhatsApp','Discador','Zap2Go'],
ST={prazo:'No prazo',pago:'Sim (Pago)',quebra:'Quebra',aberto:'Aberto'};

const $=(s,e=document)=>e.querySelector(s),
esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
brl=n=>(+n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),
dt=s=>s?esc(String(s).split('-').reverse().join('/')):'',
hoje=()=>new Date().toLocaleDateString('sv-SE'),
hojeBr=()=>new Date().toLocaleDateString('pt-BR'),
slug=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'.').replace(/^\.|\.$/g,''),
sum=L=>L.reduce((s,a)=>s+(+a.valor||0),0),
negoc=a=>(+a.valor||0)+((+a.qtdParc||1)>1?(+a.qtdParc)*(+a.valorParc||0):0),sumN=L=>L.reduce((t,a)=>t+negoc(a),0),
mcpf=v=>v.replace(/\D/g,'').slice(0,11).replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2');

let me=null,cred=null,A=[],O=[],NM=[],last='',busy=false,timer=null,tab='reg',fl='todos',q='',R=null,pend=null,sidebarCollapsed=(()=>{try{return localStorage.getItem('ac_sb')==='1'}catch(e){return false}})();
const app=$('#app'),
apiOk=()=>API&&!/^COLE/.test(API),
mine=()=>me.role==='admin'?A:A.filter(a=>a.operador===me.nome),
snap=()=>{const h=hoje();R={ts:Date.now(),list:A.filter(a=>(a.criadoEm&&new Date(a.criadoEm).toLocaleDateString('sv-SE')===h)||a.dia===h)}},
fil=()=>mine().filter(a=>(fl==='todos'||a.status===fl)&&(!q||(a.nome+' '+a.cpf+' '+String(a.cpf).replace(/\D/g,'')+' '+a.operador+' '+a.coop).toLowerCase().includes(q)));

function mtel(v){const d=v.replace(/\D/g,'').slice(0,11);if(!d)return '';if(d.length<=2)return '('+d;if(d.length<=6)return '('+d.slice(0,2)+') '+d.slice(2);if(d.length<=10)return '('+d.slice(0,2)+') '+d.slice(2,6)+'-'+d.slice(6);return '('+d.slice(0,2)+') '+d.slice(2,7)+'-'+d.slice(7)}
let cpfSeq=0;
const nk=s=>String(s==null?'':s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
async function buscaCpf(v){
 const d=v.replace(/\D/g,''),h=$('#cpf_hint');if(!h)return;
 if(d.length!==11){cpfSeq++;h.textContent='';return}
 const seq=++cpfSeq;h.style.color='var(--mut)';h.textContent='🔎 Buscando na base…';
 try{const j=await api('buscacpf',{cpf:d});if(seq!==cpfSeq||!$('#cpf_hint'))return;
  const L=j.achou||[];if(!L.length){h.textContent='Cliente não encontrado na base — preencha os dados manualmente.';return}
  const b=L[0],n=$('#f2'),t=$('#f_tel'),c=$('#f6'),td=String(b.tel||'').replace(/\D/g,'');
  if(n)n.value=b.nome||b.razao||'';
  if(t&&(td.length===10||td.length===11))t.value=mtel(td);
  if(c&&b.coop){let o=[...c.options].find(x=>x.value&&nk(x.value)===nk(b.coop))||[...c.options].find(x=>x.value&&(nk(x.value).includes(nk(b.coop))||nk(b.coop).includes(nk(x.value))));if(!o){o=new Option(b.coop,b.coop);c.add(o)}c.value=o.value}
  h.style.color='var(--ok)';
  h.innerHTML='✅ Encontrado na base: <b>'+esc(b.nome||b.razao)+'</b> · '+esc(b.coop||'—')+' · '+(+b.atraso||0)+' dias em atraso · saldo '+brl(b.saldo)+(L.length>1?' · '+L.length+' registros desse CPF':'')}
 catch(x){if(seq===cpfSeq&&$('#cpf_hint'))h.textContent=''}}
function toast(m,bad){const t=document.createElement('div');t.className='tt'+(bad?' bad':'');t.textContent=m;document.body.append(t);setTimeout(()=>t.remove(),3200)}
function setN(id,t,m){const e=$('#'+id);if(!e)return;const a=e._v||0,s=performance.now();e._v=t;(function f(n){const k=Math.min(1,(n-s)/700),v=a+(t-a)*(1-Math.pow(1-k,3));e.textContent=m?brl(v):Math.round(v);if(k<1)requestAnimationFrame(f)})(s)}
function mm(e){const n=e.value.replace(/\D/g,'');e.dataset.v=(+n||0)/100;e.value=n?brl(n/100):''}
const errMsg=x=>/failed to fetch|networkerror|load failed/i.test(x.message)?'Sem conexão com o servidor':x.message;

async function api(action,extra){
 const r=await fetch(API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(Object.assign({action,login:cred.login},cred.token?{token:cred.token}:{senha:cred.senha},extra||{}))});
 const j=await r.json();if(!j.ok){if(/Sess[aã]o expirada/.test(j.erro||''))sessaoExpirou();throw new Error(j.erro||'Erro no servidor')}return j}
function sessaoExpirou(){me=null;cred=null;last='';clearInterval(timer);try{localStorage.removeItem(KEY)}catch(x){}loginView();toast('Sessão expirada. Entre novamente.',1)}
function apply(j,force){
 const s=JSON.stringify([j.acordos,j.operadores,j.nomes]);if(!force&&s===last)return;last=s;
 A=j.acordos.map(a=>Object.assign({},a,{valor:+a.valor||0,valorParc:+a.valorParc||0,qtdParc:+a.qtdParc||1,criadoEm:+a.criadoEm||0})).sort((a,b)=>b.criadoEm-a.criadoEm);
 O=j.operadores.slice().sort((a,b)=>String(a.nome).localeCompare(String(b.nome)));NM=j.nomes.slice().sort((a,b)=>String(a).localeCompare(String(b)));
 if(me)fill()}
async function run(action,extra,okMsg){
 if(busy)return false;busy=true;
 try{const j=await api(action,extra);apply(j,1);if(okMsg)toast(okMsg);return true}
 catch(x){toast(errMsg(x),1);return false}
 finally{busy=false}}
function iniciar(){clearInterval(timer);timer=setInterval(async()=>{if(!me||busy||document.hidden)return;try{apply(await api('load'));if(tab==='rel'){snap();fRel();const u=$('#upd');if(u)u.textContent=new Date().toLocaleTimeString('pt-BR')}}catch(x){}},30000)}

function loginView(){app.innerHTML='<div class="lc"><div class="c"><img class="brandlogo" src="/logo.png" alt="Meet Call"><h1 style="margin:0 0 4px;font-size:24px">Controle de Acordos</h1><p style="color:var(--mut);margin:0 0 22px">Administrador · Acesso Restrito</p><div style="text-align:left"><label>Login</label><input id="lu" autocomplete="username" placeholder="seu.login"><label style="margin-top:12px">Senha</label><input id="lp" type="password" autocomplete="current-password" placeholder="••••••••"></div><button class="b" id="lg" style="width:100%;margin-top:18px">Entrar</button></div></div>';$('#lg').onclick=entrar;$('#lp').onkeydown=e=>{if(e.key==='Enter')entrar()};$('#lu').onkeydown=e=>{if(e.key==='Enter')$('#lp').focus()}}
async function entrar(){
 if(busy)return;if(!apiOk())return toast('Configure a URL do Apps Script',1);
 const u=$('#lu').value.trim().toLowerCase(),p=$('#lp').value.trim();if(!u||!p)return toast('Informe login e senha',1);
 busy=true;const bt=$('#lg');bt.disabled=true;bt.textContent='Entrando…';
 try{cred={login:u,senha:p};const j=await api('login');cred={login:u,token:j.token};if(j.me.role!=='admin')throw new Error('Acesso exclusivo do administrador');me=j.me;apply(j,1);try{localStorage.setItem(KEY,JSON.stringify(cred))}catch(e){}tab='reg';shell();iniciar()}
 catch(x){cred=null;me=null;toast(errMsg(x),1);bt.disabled=false;bt.textContent='Entrar'}
 finally{busy=false}}

function MENU(){
 const ad=me.role==='admin',m=[['reg','📝','Registrar acordo'],['plan','📊','Planilha'],['prev','📞','Preventivo'],['op','👥','Operadores']];
 if(ad){m.push(['rel','⏱️','Hora a Hora']);m.push(['dash','📊','Dashboard']);m.push(['wa','💬','WhatsApp']);m.push(['sendbase','📥','Carregar Base'])}
 return m;
}

function shell(){
 app.innerHTML='<div class="lay'+(sidebarCollapsed?' collapsed':'')+'" id="mainLayout"><aside class="sb">'+
 '<div class="brand"><button class="burger-btn" data-a="toggleSidebar" title="Recolher/Expandir Menu">☰</button><div class="lg"><img src="/favicon.png" alt="Meet Call"></div><div class="brand-text"><b>Controle de Acordos</b><span>Painel Admin</span></div></div>'+
 '<nav class="mn">'+MENU().map(m=>'<button class="it" data-t="'+esc(m[0])+'" title="'+esc(m[2])+'"><span class="ic">'+m[1]+'</span><span class="it-text">'+m[2]+'</span></button>').join('')+'</nav>'+
 '<div class="me"><div class="who"><div class="av">'+esc((me.nome[0]||'?').toUpperCase())+'</div><div class="who-text"><b>'+esc(me.nome)+'</b><span>Administrador</span></div></div><div class="ac"><button class="b g" data-a="th" title="Tema"><span class="ic">🌓</span></button><button class="b g" data-a="out" title="Sair"><span class="ic">🚪</span><span class="it-text">Sair</span></button></div></div></aside><main id="v"></main></div>';
 go(tab)}
function go(t){tab=t;document.querySelectorAll('.it').forEach(b=>b.classList.toggle('on',b.dataset.t===t));WA.layout(t==='wa');$('#v').innerHTML=V[t]();fill();if(t==='wa')WA.init()}
function fill(){const F={reg:fReg,plan:fPlan,prev:fPrev,op:fOp,rel:fRel,dash:fDash,wa:()=>{},sendbase:fSendBase}[tab];if(F&&$('#v'))F()}

const V={
prev(){const ad=me.role==='admin',H=['Dia do acordo'].concat(ad?['Operador']:[],['Cliente','CPF','Telefone','Valor de entrada','Parcelas','1º vencimento','Cooperativa','Status','Contato']);
return '<div class="kp5"><div class="c"><span>Acordos parcelados</span><b id="pk0">0</b></div><div class="c"><span>Valor de entrada</span><b id="pk1">R$ 0,00</b></div><div class="c"><span>1º venc. em até 7 dias</span><b id="pk2">0</b></div></div><div class="c"><h2 style="margin:0 0 4px">📞 Preventivo</h2><p style="color:var(--mut);margin:0 0 14px">Acordos parcelados: dia do acordo, valor de entrada e telefone para entrar em contato antes do vencimento.</p><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px"><input id="pqb" placeholder="🔍 Buscar nome, CPF ou telefone" style="flex:1;min-width:200px" value="'+esc(pq)+'"><div id="pchs" style="display:flex;gap:6px;flex-wrap:wrap"></div></div><div class="tw"><table><thead><tr>'+H.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody id="ptb"></tbody></table></div></div>'},
reg(){const ad=me.role==='admin',on=NM.map(n=>'<option>'+esc(n)+'</option>').join(''),
coops=COOPERATIVAS.map(c=>'<option>'+esc(c)+'</option>').join(''),
fch=FECHADO_POR.map(f=>'<option>'+esc(f)+'</option>').join(''),
f=(l,h)=>'<div><label>'+l+'</label>'+h+'</div>';
return '<div class="c"><h2 style="margin:0 0 4px">Registrar acordo</h2><p style="color:var(--mut);margin:0 0 18px">Preencha os dados do acordo fechado com o cliente.</p><div class="fg">'+
f('Operador',ad?'<select id="f0"><option value="">Selecione o operador</option>'+on+'</select>':'<input id="f0" value="'+esc(me.nome)+'" readonly>')+
f('CPF','<input id="f1" inputmode="numeric" placeholder="000.000.000-00"><div id="cpf_hint" style="font-size:12px;margin-top:5px;min-height:16px;color:var(--mut)"></div>')+
f('Nome','<input id="f2" placeholder="Nome do cliente">')+
f('Telefone (opcional)','<input id="f_tel" inputmode="tel" placeholder="(00) 00000-0000 · usado no Preventivo">')+
f('Tipo de negociação','<select id="f3" onchange="toggleParc()"><option value="">Selecione</option>'+TIPOS.map(t=>'<option>'+t+'</option>').join('')+'</select>')+
f('Valor 1º pagamento','<input id="f4" inputmode="numeric" placeholder="R$ 0,00">')+
'<div id="sec_parc" style="display:none;grid-column:1/-1;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;padding:12px;border:1px dashed var(--bd);border-radius:12px;background:rgba(139,92,246,.04)">'+
f('Qtd. de Parcelas','<input id="f_qtd_parc" type="number" min="2" value="2" placeholder="Ex: 12">')+
f('Valor das Parcelas','<input id="f_val_parc" inputmode="numeric" placeholder="R$ 0,00">')+
'</div>'+
f('Vencimento 1ª Parcela / Pagamento','<input id="f5" type="date">')+
f('Cooperativa','<select id="f6"><option value="">Selecione a cooperativa</option>'+coops+'</select>')+
f('Fechado por','<select id="f7"><option value="">Selecione</option>'+fch+'</select>')+
f('Ativo','<select id="f8"><option>Sim</option><option>Não</option></select>')+
'</div><button class="b" id="bsave" data-a="save" style="margin-top:20px">✨ Registrar acordo</button></div><div class="c" style="margin-top:16px"><h3 style="margin:0 0 6px">Últimos acordos</h3><div id="rec"></div></div>'},

plan(){const H=['Operador','CPF','Nome','Telefone','Tipo','Valor 1º Pag.','Parcelas','Vencimento','Cooperativa','Fechado por','Status',''];
return '<div class="kp5">'+['Acordos','Valor 1º Pagamento'].map((l,i)=>'<div class="c"><span>'+l+'</span><b id="k'+i+'">0</b></div>').join('')+'</div><div class="c"><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px"><input id="bq" placeholder="🔍 Buscar nome, CPF, cooperativa ou operador" style="flex:1;min-width:200px" value="'+esc(q)+'"><div id="chs" style="display:flex;gap:6px;flex-wrap:wrap"></div><button class="b" data-a="csv">⬇️ Baixar planilha (CSV)</button></div><div class="tw"><table><thead><tr>'+H.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody id="tb"></tbody></table></div></div>'},

op(){return '<div class="c"><h2 style="margin:0 0 12px">Gerenciar Operadores</h2><div class="fg" style="align-items:end"><div><label>Nome</label><input id="on" placeholder="Nome do operador"></div><div><label>Login</label><input id="ol" placeholder="nome.sobrenome"></div><div><label>CPF (senha inicial = 6 primeiros dígitos)</label><input id="ocpf" inputmode="numeric" placeholder="000.000.000-00"></div><button class="b" data-a="addop">➕ Adicionar operador</button></div></div><div class="og" id="og" style="margin-top:16px"></div>'},

rel(){
return '<div class="c" style="margin-bottom:16px"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div><h2 style="margin:0">📈 Acumulado do dia — <span id="dt_rel">'+hojeBr()+'</span></h2></div><small style="color:var(--mut)">Atualiza sozinho a cada 30s · última: <b id="upd">'+new Date().toLocaleTimeString('pt-BR')+'</b></small><button class="b" data-a="ref">🔄 Atualizar agora</button></div></div>'+
'<div class="kp5">'+
'<div class="c"><span>🤝 ACORDOS NO DIA</span><b id="k0">0</b></div>'+
'<div class="c"><span>💵 VALOR TOTAL (1º PAGAMENTO)</span><b id="k1">R$ 0,00</b></div>'+
'<div class="c"><span>👤 OPERADORES ATIVOS</span><b id="k3">0</b></div>'+
'<div class="c"><span>🏛️ COOPERATIVAS DISTINTAS</span><b id="k4">0</b></div>'+
'</div>'+
'<div class="c" style="margin-bottom:18px"><h3 style="margin:0 0 12px;font-size:15px">📊 PRODUÇÃO HORA A HORA (QUANTIDADE DE ACORDOS POR HORA)</h3><div class="ht" id="ht"></div>'+
'<div class="lgd"><span><i style="background:#16a34a"></i> Hora com acordos</span><span><i style="background:#8b5cf6"></i> Hora fechada de referência</span><span><i style="background:#cbd5e1"></i> Hora sem acordos</span></div></div>'+
'<div class="stack-views">'+
'<div class="c"><h3 style="margin:0 0 12px;font-size:15px">🏆 RANKING DE OPERADORES DO DIA</h3><div class="tw"><table><thead><tr><th>NOME</th><th>ACORDOS</th><th>VALOR 1º PAGAMENTO</th><th>VALOR NEGOCIADO</th><th>PARTICIPAÇÃO</th></tr></thead><tbody id="tb_ops"></tbody></table></div></div>'+
'<div class="c"><h3 style="margin:0 0 12px;font-size:15px">🏛️ COOPERATIVAS DO DIA</h3><div class="tw"><table><thead><tr><th>NOME</th><th>ACORDOS</th><th>VALOR 1º PAGAMENTO</th><th>VALOR NEGOCIADO</th><th>PARTICIPAÇÃO</th></tr></thead><tbody id="tb_coops"></tbody></table></div></div>'+
'</div>'+
'<div class="c" style="margin-top:16px"><h3 style="margin:0 0 12px;font-size:15px">🤝 ACORDOS DO DIA</h3><div class="tw"><table><thead><tr><th>HORA</th><th>OPERADOR</th><th>CLIENTE</th><th>TIPO</th><th>COOPERATIVA</th><th>1º PAG.</th><th>NEGOCIADO</th><th>STATUS</th></tr></thead><tbody id="tb_dia"></tbody></table></div></div>'},

wa(){return WA.html()},
dash(){const hj=hoje(),sel=(id)=>'<select id="'+esc(id)+'" onchange="fDash()"></select>';return '<div class="c" style="margin-bottom:16px"><h2 style="margin:0 0 12px">📊 Dashboard de Acordos</h2><div class="fg" style="align-items:end"><div><label>Data inicial</label><input type="date" id="d_ini" value="'+hj.slice(0,8)+'01" onchange="fDash()"></div><div><label>Data final</label><input type="date" id="d_fim" value="'+esc(hj)+'" onchange="fDash()"></div><div><label>Operador</label>'+sel('d_op')+'</div><div><label>Cooperativa</label>'+sel('d_co')+'</div><div><label>Status</label><select id="d_st" onchange="fDash()"><option value="">Todos</option><option value="prazo">No prazo</option><option value="pago">Pago</option><option value="aberto">Aberto</option><option value="quebra">Quebra</option></select></div><div><label>Busca (nome ou CPF)</label><input id="d_q" placeholder="Digite para buscar…" oninput="fDash()"></div></div><p id="d_n" style="margin:12px 0 0;color:var(--mut)"></p></div><div class="kp5" id="d_k" style="display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));margin-bottom:16px"></div><div class="stack-views"><div class="c"><h3 style="margin:0 0 12px;font-size:15px">🏆 RANKING DE OPERADORES</h3><div class="tw"><table>'+RH+'<tbody id="d_tops"></tbody></table></div></div><div class="c"><h3 style="margin:0 0 12px;font-size:15px">🏛️ COOPERATIVAS</h3><div class="tw"><table>'+RH+'<tbody id="d_tcoops"></tbody></table></div></div></div>'},
sendbase(){const ops=O.map(o=>'<option value="'+esc(o.nome)+'">'+esc(o.nome)+' (@'+esc(o.login)+')</option>').join('');
return '<div class="c"><h2 style="margin:0 0 6px">📥 Carregar e Distribuir Base</h2><p style="color:var(--mut);margin:0 0 18px">Envie a planilha da base diária (.csv, .xlsx, .xls). Ela é processada aqui e os operadores recebem só: Cooperativa, CPF/CNPJ, Nome, Nome / Razão Social, Dias em atraso, Saldo em atraso, Telefone e Possui garantia.</p><div class="fg"><div><label>Destino da Base</label><select id="sb_op"><option value="TODOS">📢 Todos os Operadores (Compartilhada)</option>'+ops+'</select></div><div><label>Arquivo da Base (.csv, .xlsx, .xls)</label><input type="file" id="sb_file" accept=".csv,.xlsx,.xls"></div></div><p style="color:var(--mut);font-size:13px;margin:14px 0 0">Ao enviar, a base anterior do mesmo destino é substituída.</p><button class="b" id="sb_btn" data-a="sendbase" style="margin-top:14px">📥 Processar e enviar base</button><div id="sb_res" style="margin-top:14px;color:var(--mut);font-size:13px"></div></div>'}
};

let pf='todos',pq='';
const diasAte=s=>{if(!s)return null;const d=new Date(s+'T00:00:00'),h=new Date();h.setHours(0,0,0,0);return Math.round((d-h)/864e5)};
const pOk=(a,k)=>{const d=diasAte(a.venc);return k==='todos'||(d!==null&&((k==='hoje'&&d===0)||(k==='7d'&&d>=0&&d<=7)||(k==='venc'&&d<0)))};
function fPrev(){if(!$('#ptb'))return;
 const ad=me.role==='admin',L=(typeof mine==='function'?mine():A).filter(a=>a.tipo==='Parcelado'&&(+a.qtdParc||1)>1&&a.status!=='pago'&&a.status!=='quebra'),
 F=[['todos','Todos'],['hoje','Vencem hoje'],['7d','Próx. 7 dias'],['venc','Vencidos']],
 rows=L.filter(a=>pOk(a,pf)&&(!pq||(a.nome+' '+a.cpf+' '+String(a.cpf).replace(/\D/g,'')+' '+a.telefone+' '+String(a.telefone).replace(/\D/g,'')).toLowerCase().includes(pq))).sort((a,b)=>String(a.venc).localeCompare(String(b.venc)));
 $('#pchs').innerHTML=F.map(([k,v])=>'<button class="ch'+(pf===k?' on':'')+'" data-pf="'+esc(k)+'">'+v+' · '+L.filter(a=>pOk(a,k)).length+'</button>').join('');
 setN('pk0',L.length);setN('pk1',sum(L),1);setN('pk2',L.filter(a=>pOk(a,'7d')).length);
 $('#ptb').innerHTML=rows.slice(0,300).map(a=>{const t=String(a.telefone||'').replace(/\D/g,''),
  st='<select class="s '+a.status+'" data-s="'+esc(a.id)+'">'+Object.entries(ST).map(([k,v])=>'<option value="'+esc(k)+'"'+(k===a.status?' selected':'')+'>'+v+'</option>').join('')+'</select>',
  ct=t?'<a class="x" style="text-decoration:none;display:inline-block" target="_blank" rel="noopener" href="https://wa.me/55'+t+'">💬 WhatsApp</a>':'—',
  td=v=>'<td>'+esc(v)+'</td>';
  return '<tr><td>'+dt(a.dia)+'</td>'+(ad?td(a.operador):'')+'<td><b>'+esc(a.nome)+'</b></td>'+td(a.cpf)+td(a.telefone||'—')+td(brl(a.valor))+td(a.qtdParc+'x '+brl(a.valorParc))+'<td>'+dt(a.venc)+'</td>'+td(a.coop||'—')+'<td>'+st+'</td><td>'+ct+'</td></tr>'
 }).join('')||'<tr><td colspan="'+(ad?11:10)+'" style="text-align:center;color:var(--mut);padding:30px">Nenhum acordo parcelado'+(pf==='todos'&&!pq?' ainda.':' nesse filtro.')+'</td></tr>'}

function toggleParc(){
 const t=$('#f3')?.value,s=$('#sec_parc');
 if(s)s.style.display=(t==='Parcelado'?'grid':'none');}

function fReg(){const r=$('#rec');if(!r)return;r.className='ac-l';r.innerHTML=mine().slice(0,6).map(a=>'<div class="ac-i"><div class="ac-t"><b>'+esc(a.nome)+'</b><span class="s '+a.status+'">'+(ST[a.status]||'')+'</span></div><div class="ac-m">'+'<span>👤 '+esc(a.operador)+'</span>'+'<span>🏦 '+esc(a.coop||'--')+'</span><span>📄 '+esc(a.tipo)+'</span><span>💰 1º Pag: '+brl(a.valor)+'</span><span>📅 Vence '+dt(a.venc)+'</span></div></div>').join('')||'<p style="color:var(--mut)">Nenhum acordo registrado ainda.</p>'}

function row(a,i){const ad=me.role==='admin',td=v=>'<td>'+esc(v)+'</td>',
st=ad?'<select class="s '+a.status+'" data-s="'+esc(a.id)+'">'+Object.entries(ST).map(([k,v])=>'<option value="'+esc(k)+'"'+(k===a.status?' selected':'')+'>'+v+'</option>').join('')+'</select>':'<span class="s '+a.status+'">'+(ST[a.status]||'')+'</span>',
pStr=a.tipo==='Parcelado'?(a.qtdParc+'x '+brl(a.valorParc)):'—';
return '<tr>'+td(a.operador)+td(a.cpf)+td(a.nome)+td(a.telefone||'—')+td(a.tipo)+td(brl(a.valor))+td(pStr)+'<td>'+dt(a.venc)+'</td>'+td(a.coop||'—')+td(a.fechado)+'<td>'+st+'</td>'+(ad?'<td><button class="x" data-del="'+esc(a.id)+'">🗑</button></td>':'')+'</tr>'}

function fPlan(){if(!$('#tb'))return;const L=mine(),c=s=>L.filter(a=>a.status===s).length,rows=fil();
$('#chs').innerHTML=[['todos','Todos',L.length]].concat(Object.entries(ST).map(([k,v])=>[k,v,c(k)])).map(([k,v,n])=>'<button class="ch'+(fl===k?' on':'')+'" data-f="'+esc(k)+'">'+v+' · '+n+'</button>').join('');
setN('k0',L.length);setN('k1',sum(L),1);
$('#tb').innerHTML=rows.slice(0,300).map(row).join('')||'<tr><td colspan="12" style="text-align:center;color:var(--mut);padding:30px">Nenhum acordo encontrado.</td></tr>'}

function fOp(){const g=$('#og');if(!g)return;
g.innerHTML=O.map((o,i)=>{const L=A.filter(a=>a.operador===o.nome),p=L.filter(a=>a.status==='pago'||a.status==='prazo').length,pc=L.length?Math.round(p/L.length*100):0;
return '<div class="c"><div style="display:flex;gap:12px;align-items:center"><div class="av">'+esc((o.nome[0]||'?').toUpperCase())+'</div><div style="flex:1"><b>'+esc(o.nome)+'</b><div style="color:var(--mut);font-size:12px">@'+esc(o.login)+'</div></div><button class="x" data-dop="'+esc(o.id)+'" title="Excluir">🗑</button></div><div style="display:flex;justify-content:space-between;margin:14px 0 8px;font-size:13px"><span>'+L.length+' acordos</span><span>'+brl(sum(L))+'</span></div><div class="pg"><i style="width:'+pc+'%"></i></div><div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--bd);display:flex;gap:8px;align-items:center"><input type="password" id="pwd_'+o.id+'" placeholder="Nova senha" style="padding:6px 10px;font-size:12px"><button class="b" style="padding:6px 10px;font-size:12px;white-space:nowrap" onclick="mudarSenha(this.dataset.i)" data-i="'+esc(o.id)+'">🔑 Alterar Senha</button></div></div>'}).join('')||'<div class="c">Nenhum operador cadastrado ainda.</div>'}

async function mudarSenha(opId){
 const inp=$('#pwd_'+opId),v=inp?inp.value.trim():'';
 if(!v)return toast('Digite a nova senha do operador',1);
 if(v.length<6)return toast('A senha precisa ter pelo menos 6 caracteres',1);
 await run('setpass',{id:opId,novaSenha:v},'Senha alterada com sucesso!')}

function fSendBase(){}

const norm=s=>String(s==null?'':s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
function lerCsv(txt){
 txt=txt.replace(/^\ufeff/,'');
 const first=txt.split(/\r?\n/,1)[0]||'',cnt=c=>first.split(c).length-1;
 const sep=(cnt(';')>=cnt(',')&&cnt(';')>=cnt('\t'))?';':(cnt('\t')>cnt(',')?'\t':',');
 const rows=[];let row=[],cell='',aq=false;
 for(let i=0;i<txt.length;i++){const ch=txt[i];
  if(aq){if(ch==='"'){if(txt[i+1]==='"'){cell+='"';i++}else aq=false}else cell+=ch}
  else if(ch==='"')aq=true;
  else if(ch===sep){row.push(cell);cell=''}
  else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&txt[i+1]==='\n')i++;row.push(cell);cell='';rows.push(row);row=[]}
  else cell+=ch}
 if(cell!==''||row.length){row.push(cell);rows.push(row)}
 return rows.filter(r=>r.some(c=>String(c).trim()!==''))}
async function lerArquivo(f){
 const nome=f.name.toLowerCase(),buf=await f.arrayBuffer();
 if(/\.(csv|txt)$/.test(nome)){
  let t=new TextDecoder('utf-8').decode(buf);
  if(t.includes('\ufffd'))t=new TextDecoder('windows-1252').decode(buf);
  return lerCsv(t)}
 if(typeof XLSX==='undefined')throw new Error('Leitor de Excel não carregou. Verifique a internet e recarregue a página.');
 const wb=XLSX.read(buf,{type:'array'}),ws=wb.Sheets[wb.SheetNames[0]];
 return XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:''}).filter(r=>r.some(c=>String(c).trim()!==''))}
function numBr(v){if(typeof v==='number')return v;let s=String(v==null?'':v).replace(/[^\d,.\-]/g,'');if(!s)return 0;if(s.includes(',')){s=s.replace(/\./g,'').replace(',','.')}else if((s.match(/\./g)||[]).length>1){s=s.replace(/\./g,'')}return +s||0}
function fmtDoc(v){let d=String(v==null?'':(typeof v==='number'?v.toFixed(0):v)).replace(/\D/g,'');if(!d)return '';
 if(d.length<=11){d=d.padStart(11,'0');return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4')}
 d=d.padStart(14,'0');return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5')}
function fmtTel(v){const raw=String(v==null?'':(typeof v==='number'?v.toFixed(0):v)).trim();if(!raw)return '';if(/[;\/,|]/.test(raw))return raw;
 let d=raw.replace(/\D/g,'');if(/^55\d{10,11}$/.test(d))d=d.slice(2);
 if(d.length===11)return '('+d.slice(0,2)+') '+d.slice(2,7)+'-'+d.slice(7);
 if(d.length===10)return '('+d.slice(0,2)+') '+d.slice(2,6)+'-'+d.slice(6);
 return raw}
function fmtGar(v){const s=norm(v);if(!s)return '';if(/^(s|sim|1|true|y|yes|x)$/.test(s))return 'Sim';if(/^(n|nao|0|false|no)$/.test(s))return 'Não';return String(v).trim()}
function processarBase(rows){
 if(rows.length<2)throw new Error('A planilha está vazia');
 const H=rows[0].map(norm),ix=(...ns)=>{for(const n of ns){const i=H.indexOf(norm(n));if(i>=0)return i}return -1};
 const c={coop:ix('cooperativa'),doc:ix('CLI_CPF_CNPJ','cpf_cnpj'),nome:ix('CLI_NOME'),razao:ix('nome_razao_social'),atraso:ix('DIV_ATRASO'),saldo:ix('DIV_SALDO'),tel:ix('telefone'),gar:ix('possui_garantia')};
 const falta=[['coop','cooperativa'],['doc','CLI_CPF_CNPJ'],['nome','CLI_NOME'],['atraso','DIV_ATRASO'],['saldo','DIV_SALDO']].filter(([k])=>c[k]<0).map(x=>x[1]);
 if(falta.length)throw new Error('Colunas não encontradas na planilha: '+falta.join(', '));
 const g=(r,i)=>i<0?'':r[i];let ign=0;const lista=[];
 rows.slice(1).forEach(r=>{const doc=fmtDoc(g(r,c.doc)),nome=String(g(r,c.nome)).trim();if(!doc&&!nome){ign++;return}
  lista.push({coop:String(g(r,c.coop)).trim(),doc,nome,razao:String(g(r,c.razao)).trim(),atraso:Math.round(numBr(g(r,c.atraso))),saldo:numBr(g(r,c.saldo)),tel:fmtTel(g(r,c.tel)),garantia:fmtGar(g(r,c.gar))})});
 return {lista,ignoradas:ign}}
async function enviarBase(){
 if(busy)return;const f=$('#sb_file')?.files[0];if(!f)return toast('Selecione o arquivo da base',1);
 const bt=$('#sb_btn'),res=$('#sb_res'),dest=$('#sb_op').value;busy=true;bt.disabled=true;
 try{
  bt.textContent='Lendo arquivo…';
  const {lista,ignoradas}=processarBase(await lerArquivo(f));
  if(!lista.length)throw new Error('Nenhum cliente válido encontrado na planilha');
  const T=1000;
  for(let i=0,p=0;i<lista.length;i+=T,p++){
   bt.textContent='Enviando '+Math.min(i+T,lista.length)+' de '+lista.length+'…';
   await api('basesave',{destino:dest,rows:lista.slice(i,i+T),first:i===0,parte:p})}
  res.innerHTML='✅ <b>'+lista.length+'</b> clientes processados e enviados'+(dest==='TODOS'?' para todos os operadores':' para '+esc(dest))+(ignoradas?' · '+ignoradas+' linhas sem CPF/nome ignoradas':'')+'.';
  toast('Base carregada e disponibilizada com sucesso!');$('#sb_file').value=''}
 catch(x){res.textContent='';toast(errMsg(x),1)}
 finally{busy=false;bt.disabled=false;bt.textContent='📥 Processar e enviar base'}}

const RH='<thead><tr><th>NOME</th><th>ACORDOS</th><th>VALOR 1º PAGAMENTO</th><th>VALOR NEGOCIADO</th><th>PARTICIPAÇÃO</th></tr></thead>';
function rankHtml(L,kf,vazio){const M={};L.forEach(a=>{const k=kf(a),o=M[k]||(M[k]={nome:k,qtd:0,v1:0,vn:0});o.qtd++;o.v1+=+a.valor||0;o.vn+=negoc(a)});const tot=sum(L)||1;return Object.values(M).sort((x,y)=>y.v1-x.v1).map(o=>{const p=(o.v1/tot*100).toFixed(1);return '<tr><td><b>'+esc(o.nome)+'</b></td><td>'+o.qtd+'</td><td>'+brl(o.v1)+'</td><td>'+brl(o.vn)+'</td><td><div style="display:flex;align-items:center;gap:8px"><div class="pg" style="width:80px"><i style="width:'+p+'%"></i></div><span>'+p+'%</span></div></td></tr>'}).join('')||'<tr><td colspan="5" style="text-align:center;color:var(--mut);padding:20px">'+vazio+'</td></tr>'}
function fDash(){if(!$('#d_k'))return;
const opt=(id,arr,all)=>{const e=$('#'+id),v=e.value;if(e.options.length!==arr.length+1){e.innerHTML='<option value="">'+all+'</option>'+arr.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');e.value=v}};
const cs=[...new Set(A.map(a=>a.coop).filter(Boolean))].sort();opt('d_op',NM,'Todos');opt('d_co',cs,'Todas');
const i=$('#d_ini').value,f=$('#d_fim').value,op=$('#d_op').value,co=$('#d_co').value,st=$('#d_st').value,q=nk($('#d_q').value);
const L=A.filter(a=>(!i||a.dia>=i)&&(!f||a.dia<=f)&&(!op||a.operador===op)&&(!co||a.coop===co)&&(!st||a.status===st)&&(!q||nk(a.nome+a.cpf).includes(q)));
const tn=sumN(L),pg=L.filter(a=>a.status==='pago'),ab=L.filter(a=>a.status!=='pago'&&a.status!=='quebra');
const K=[['TOTAL DE ACORDOS',L.length,'no filtro atual'],['VALOR TOTAL NEGOCIADO',brl(tn),'soma dos acordos'],['TICKET MÉDIO',brl(L.length?tn/L.length:0),'valor ÷ acordos'],['ACORDOS PAGOS',pg.length,brl(sumN(pg))],['ACORDOS EM ABERTO',ab.length,brl(sumN(ab))],['TAXA DE PAGAMENTO',(L.length?pg.length/L.length*100:0).toFixed(1)+'%','pagos ÷ total']];
$('#d_k').innerHTML=K.map(k=>'<div class="c"><span>'+k[0]+'</span><b>'+k[1]+'</b><small style="color:var(--mut)">'+k[2]+'</small></div>').join('');
$('#d_n').textContent=L.length+' acordo(s) encontrado(s) · atualiza sozinho a cada 30s';
$('#d_tops').innerHTML=rankHtml(L,a=>a.operador,'Nenhum acordo no período');$('#d_tcoops').innerHTML=rankHtml(L,a=>a.coop||'Não informada','Nenhum acordo no período')}
function fRel(){
if(!$('#ht'))return;snap();const L=R.list;
const h=Array(24).fill(0);L.forEach(a=>h[new Date(a.criadoEm).getHours()]++);
const m=Math.max(1,...h),curH=new Date().getHours();

setN('k0',L.length);
setN('k1',sum(L),1);
const opsAtivos=new Set(L.map(a=>a.operador)).size;
const coopsDist=new Set(L.map(a=>(a.coop||a.cooperativa)).filter(Boolean)).size;
setN('k3',opsAtivos);
setN('k4',coopsDist);

$('#ht').innerHTML=h.map((n,i)=>{
 const isCur=(i===curH),hasData=n>0;
 const cls=isCur?'is-peak':(hasData?'has-data':'');
 return '<div class="'+esc(cls)+'" title="'+n+' acordos às '+i+'h"><em>'+(n||'')+'</em><i style="height:'+(n?Math.max(15,n/m*80):4)+'%"></i><span>'+String(i).padStart(2,'0')+'</span></div>'
}).join('');

const totV1Day=sum(L)||1;

$('#tb_ops').innerHTML=rankHtml(L,a=>a.operador,'Nenhum dado registrado hoje');
$('#tb_coops').innerHTML=rankHtml(L,a=>a.coop||a.cooperativa||'Não informada','Nenhum dado registrado hoje');
const td_=$('#tb_dia');if(td_)td_.innerHTML=L.slice().sort((x,y)=>y.criadoEm-x.criadoEm).map(a=>'<tr><td>'+new Date(a.criadoEm).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})+(a.dia&&a.dia!==new Date(a.criadoEm).toLocaleDateString('sv-SE')?' <small style="color:var(--mut)" title="Acordo fechado em outro dia e incluído pela Planilha">↩ fechado em '+dt(a.dia)+'</small>':'')+'</td><td>'+esc(a.operador)+'</td><td><b>'+esc(a.nome)+'</b></td><td>'+esc(a.tipo)+'</td><td>'+esc(a.coop||'—')+'</td><td>'+brl(a.valor)+'</td><td>'+brl(negoc(a))+'</td><td>'+(ST[a.status]||a.status)+'</td></tr>').join('')||'<tr><td colspan="8" style="text-align:center;color:var(--mut);padding:20px">Nenhum acordo hoje</td></tr>';
}

async function save(){
 const g=i=>$('#f'+i)?.value.trim()||'';
 const tipo=$('#f3').value;
 const o={
  operador:$('#f0').value.trim(),
  cpf:g(1),
  nome:g(2),
  telefone:$('#f_tel')?.value.trim()||'',
  tipo:tipo,
  valor:+$('#f4')?.dataset.v||0,
  qtdParc:tipo==='Parcelado'?(+$('#f_qtd_parc')?.value||1):1,
  valorParc:tipo==='Parcelado'?(+$('#f_val_parc')?.dataset.v||0):0,
  venc:g(5),
  coop:$('#f6')?.value||'',
  fechado:g(7),
  ativo:g(8)
 };
 if(!o.operador||!o.cpf||!o.nome||!o.tipo||!o.venc||!o.coop||!o.fechado||o.cpf.replace(/\D/g,'').length!==11||(o.telefone&&!/^\d{10,11}$/.test(o.telefone.replace(/\D/g,''))))return toast('Preencha todos os campos corretamente',1);
 if(tipo==='Parcelado'&&(o.qtdParc<2||o.valorParc<=0))return toast('Parcelado: informe a quantidade de parcelas (2 ou mais) e o valor da parcela',1);
 const bt=$('#bsave');if(bt)bt.disabled=true;
 if(await run('save',{d:o,dia:hoje()},(tipo==='Parcelado'?'Acordo registrado e enviado ao Preventivo! 🎉':'Acordo registrado com sucesso! 🎉'))){go('reg')}else if(bt)bt.disabled=false}

async function addop(){const n=$('#on').value.trim(),l=slug($('#ol').value),c=$('#ocpf').value.trim();if(!n||!l)return toast('Informe nome e login',1);
if(c.replace(/\D/g,'').length!==11)return toast('Informe o CPF do operador (senha inicial = 6 primeiros dígitos)',1);
if(await run('addop',{nome:n,novoLogin:l,cpf:c},'Operador adicionado')){const a=$('#on'),b=$('#ol'),d=$('#ocpf');if(a)a.value='';if(b)b.value='';if(d)d.value=''}}

function csv(){const z=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"',
H=['Operador','CPF','Nome','Telefone','Tipo','Valor 1º Pag.','Qtd Parcelas','Valor Parcela','Vencimento','Cooperativa','Fechado por','Ativo','Status','Registrado em'],
rows=fil().map(a=>[a.operador,a.cpf,a.nome,a.telefone||'',a.tipo,(+a.valor||0).toFixed(2).replace('.',','),a.qtdParc||1,(+a.valorParc||0).toFixed(2).replace('.',','),dt(a.venc),a.coop,a.fechado,a.ativo,ST[a.status],new Date(a.criadoEm).toLocaleString('pt-BR')]);
const blob=new Blob(['\ufeff'+[H].concat(rows).map(r=>r.map(z).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}),u=URL.createObjectURL(blob),l=document.createElement('a');
l.href=u;l.download='acordos_'+hoje()+'.csv';document.body.append(l);l.click();l.remove();setTimeout(()=>URL.revokeObjectURL(u),1500)}

app.addEventListener('click',async e=>{const b=e.target.closest('[data-a],[data-t],[data-f],[data-pf],[data-del],[data-dop]');if(!b)return;const d=b.dataset;
if(d.t)return go(d.t);
if(d.pf){pf=d.pf;return fPrev()}
if(d.f){fl=d.f;return fill()}
if(d.a==='toggleSidebar'){sidebarCollapsed=!sidebarCollapsed;try{localStorage.setItem('ac_sb',sidebarCollapsed?'1':'0')}catch(x){}const lay=$('#mainLayout');if(lay)lay.classList.toggle('collapsed',sidebarCollapsed);return}
if(d.a==='out'){me=null;cred=null;last='';A=[];O=[];NM=[];clearInterval(timer);try{localStorage.removeItem(KEY)}catch(x){}return loginView()}
if(d.a==='th'){const r=document.documentElement,dk=(r.dataset.theme||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'))==='dark';r.dataset.theme=dk?'light':'dark';return}
if(d.a==='save')return save();
if(d.a==='csv')return csv();
if(d.a==='sendbase')return enviarBase();
if(d.a==='addop')return addop();
if(d.a==='ref'){try{apply(await api('load'),1)}catch(x){toast(errMsg(x),1)}snap();toast('Relatório atualizado');return go('rel')}
if(d.del||d.dop){if(pend!==b){pend=b;b.textContent='Confirmar?';setTimeout(()=>{if(pend===b){pend=null;b.textContent='🗑'}},3000);return}
pend=null;await run(d.del?'del':'delop',{id:d.del||d.dop},'Removido')}});
app.addEventListener('change',async e=>{const s=e.target.dataset.s;if(!s)return;if(!await run('status',{id:s,status:e.target.value},'Status atualizado'))fill()});
app.addEventListener('input',e=>{const t=e.target;if(t.id==='f1'){t.value=mcpf(t.value);buscaCpf(t.value)}if(t.id==='f_tel')t.value=mtel(t.value);if(t.id==='ocpf')t.value=mcpf(t.value);if(t.id==='pqb'){pq=t.value.trim().toLowerCase();fPrev()}if(t.id==='f4'||t.id==='f_val_parc'){mm(t)}if(t.id==='bq'){q=t.value.trim().toLowerCase();fill()}if(t.id==='on')$('#ol').value=slug(t.value)});

(async()=>{loginView();
 let c=null;try{c=JSON.parse(localStorage.getItem(KEY))}catch(x){}
 if(c&&apiOk()){busy=true;try{cred=c;const j=await api('login');if(j.token){cred.token=j.token;try{localStorage.setItem(KEY,JSON.stringify(cred))}catch(e){}}if(j.me.role!=='admin')throw 0;me=j.me;apply(j,1);shell();iniciar()}catch(x){cred=null;me=null}finally{busy=false}}
 setInterval(()=>{if(me&&me.role==='admin'){snap();if(tab==='rel')go('rel')}},864e5)})();
