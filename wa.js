(function(){
const ST={conectado:['ok','Conectado'],aguardando:['wait','Iniciando…'],iniciando_servico:['wait','Gerando QR Code…'],aguardando_qr:['wait','Aguardando leitura do QR Code'],desconectado:['off','Desconectado'],fora_expediente:['off','Fora do expediente (07h–18h30)'],erro:['bad','Erro na conexão']};
const S={op:'',chat:null,chatOp:'',busca:'',de:'',ate:'',aba:'ativas',fEtq:'',conv:[],arqN:0,etq:[],sess:[],msgs:[],media:{},novo:null,t:null,qrTxt:'',pop:false,srv:null,popQr:'',etqPop:false,hid:false,oldKey:'',moreDb:true,moreHist:undefined,loadOld:false,cp:null,bq:'',
 fotos:{},fotoBusy:false,visto:null,vistoLogin:'',w:false,wt:null,resp:null,drafts:{},abaixo:0,abrirDepois:'',titulo:''};
const hm=ts=>{const d=new Date(ts),h=new Date();return d.toLocaleString('pt-BR',d.toDateString()===h.toDateString()?{hour:'2-digit',minute:'2-digit'}:{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})};
const hora=ts=>new Date(ts).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
const dia=ts=>{const d=new Date(ts),h=new Date();return d.toDateString()===h.toDateString()?'Hoje':d.toDateString()===new Date(h-864e5).toDateString()?'Ontem':d.toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})};
const num=c=>String(c||'').split('@')[0];
const urlDrive=u=>/^https:\/\/(drive|docs)\.google\.com\//.test(String(u||''));
const adm=()=>me.role==='admin';
const ICO={imagem:'📷 ',sticker:'🏷️ ',video:'🎥 ',audio:'🎤 ',documento:'📄 '},ROT={imagem:'Foto',sticker:'Figurinha',video:'Vídeo',audio:'Áudio',documento:'Documento'};
const prev=c=>(ICO[c.ultimo_tipo]||'')+(c.ultima||ROT[c.ultimo_tipo]||'');
const cor=(op,n)=>{const e=S.etq.find(x=>x.op===op&&x.nome===n);return e?e.cor:'#8696a0'};
const tel=ch=>/@lid$/.test(ch||'')?'':'+'+num(ch);
const nome=c=>c.nome_custom||c.contato||tel(c.chat)||'Contato';
const ini=c=>{const n=(c.nome_custom||c.contato||'').trim();return n?n[0].toUpperCase():''};
const tam=b=>!b?'':b<1024?b+' B':b<1048576?(b/1024).toFixed(0)+' KB':(b/1048576).toFixed(1)+' MB';
const mmss=t=>{t=Math.max(0,Math.round(t||0));return Math.floor(t/60)+':'+String(t%60).padStart(2,'0')};
const todas=()=>S.novo&&S.aba==='ativas'&&!S.conv.some(x=>x.chat===S.novo.chat&&x.op===S.novo.op)?[S.novo,...S.conv]:S.conv;
const achar=()=>todas().find(x=>x.chat===S.chat&&x.op===S.chatOp)||(S.novo&&S.novo.chat===S.chat?S.novo:{chat:S.chat,op:S.chatOp});
const emWA=()=>!!$('#wa_root');
const PREF='wa_pref';
const pref=()=>{try{return Object.assign({som:true,previa:false},JSON.parse(localStorage.getItem(PREF)||'{}'))}catch(e){return{som:true,previa:false}}};
const setPref=p=>{try{localStorage.setItem(PREF,JSON.stringify(Object.assign(pref(),p)))}catch(e){}};
const saud=()=>{const h=new Date().getHours();return h<12?'Bom dia':h<18?'Boa tarde':'Boa noite'};
const linkar=t=>esc(t).replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g,u=>'<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">'+u+'</a>');

const CORES=['#8b5cf6','#d946ef','#6366f1','#0ea5e9','#14b8a6','#f59e0b','#f43f5e','#22c55e'];
const corAv=c=>{const s=String(c.chat||'');let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return CORES[h%CORES.length]};
const fotoUrl=(op,chat)=>{const f=S.fotos[op+'|'+chat];return f&&f.url||''};
const PESSOA='<svg viewBox="0 0 24 24" width="55%" height="55%" fill="currentColor" aria-hidden="true"><path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm0 2c-4 0-7.5 2.2-7.5 5v1.5h15V19c0-2.8-3.5-5-7.5-5z"/></svg>';
const avatar=(c,cls)=>{const u=fotoUrl(c.op||S.chatOp,c.chat);return '<div class="wa-av '+(cls||'')+'" style="background:'+corAv(c)+'">'+(u?'<img src="'+esc(u)+'" alt="" draggable="false">':(esc(ini(c))||PESSOA))+'</div>'};
async function carregarFotos(extra){
 if(S.fotoBusy)return;
 const falta={},pede=(op,chat,v)=>{if(!v||!op||!chat)return;const f=S.fotos[op+'|'+chat];if(!f||f.v!==v)(falta[op]=falta[op]||new Set()).add(chat)};
 for(const c of todas())pede(c.op,c.chat,c.foto_v);
 for(const c of extra||[])pede(me.login,c.chat,c.foto_v);
 const ops=Object.keys(falta);if(!ops.length)return;
 S.fotoBusy=true;let mudou=false;
 try{for(const op of ops){const lote=[...falta[op]].slice(0,40),d=await api('wa_fotos',{op,chats:lote});
   const vmap={};for(const c of [...todas(),...(extra||[])])if(c.chat)vmap[(c.op||me.login)+'|'+c.chat]=c.foto_v;
   for(const ch of lote){const x=d.fotos[ch],k=op+'|'+ch;S.fotos[k]={v:vmap[k]||(x&&x.v)||0,url:x&&x.b64?'data:image/jpeg;base64,'+x.b64:''};mudou=true}}
 }catch(e){}finally{S.fotoBusy=false}
 if(mudou){const l=$('#wa_list');if(l)l.dataset.sig='';lista();const c=$('#wa_chat');if(c&&S.chat){c.dataset.h='';chat()}}
}

const css=`
.wa-v{--w-bg:#efeae2;--w-pn:#fff;--w-hd:#f7f4fd;--w-in:#fff;--w-out:#d9fdd3;--w-bd:rgba(147,51,234,.2);--w-tx:#1e1035;--w-mu:#6b5a88;--w-hv:rgba(147,51,234,.08);--w-inp:#f0eaff;--w-meta:#667781;--w-ink:#111b21;--w-sh:0 14px 44px rgba(76,29,149,.16);--w-pat:rgba(139,92,246,.07);--w-ok:#16a34a;--w-p:#8b5cf6;--w-p2:#d946ef;--w-g:#00a884;--w-bad:#e11d48;--w-wait:#f59e0b}
@media(prefers-color-scheme:dark){:root:not([data-theme="light"]) .wa-v{--w-bg:#0b141a;--w-pn:#111b21;--w-hd:#1a2730;--w-in:#202c33;--w-out:#005c4b;--w-bd:rgba(168,85,247,.3);--w-tx:#e9edef;--w-mu:#8fa0aa;--w-hv:rgba(168,85,247,.16);--w-inp:#2a3942;--w-meta:#ffffff99;--w-ink:#e9edef;--w-sh:0 16px 50px rgba(0,0,0,.55);--w-pat:rgba(255,255,255,.035)}}
:root[data-theme="dark"] .wa-v{--w-bg:#0b141a;--w-pn:#111b21;--w-hd:#1a2730;--w-in:#202c33;--w-out:#005c4b;--w-bd:rgba(168,85,247,.3);--w-tx:#e9edef;--w-mu:#8fa0aa;--w-hv:rgba(168,85,247,.16);--w-inp:#2a3942;--w-meta:#ffffff99;--w-ink:#e9edef;--w-sh:0 16px 50px rgba(0,0,0,.55);--w-pat:rgba(255,255,255,.035)}
#wa_root{display:flex;flex-direction:column;gap:10px;color:var(--w-tx);min-height:0}
#wa_root button,#wa_root input,#wa_root textarea,#wa_root select{font-family:inherit}
.wa-ab{position:relative}.wa-cfgdot{position:absolute;right:3px;top:4px;width:9px;height:9px;border-radius:50%;background:var(--w-mu);border:2px solid var(--w-hd);box-sizing:content-box}.wa-cfgdot.ok{background:var(--w-g)}.wa-cfgdot.wait{background:var(--w-wait)}.wa-cfgdot.bad{background:var(--w-bad)}
.wa-cfgf{position:absolute;top:12px;right:14px;z-index:2}.wa-cfgm{display:none;position:relative}
.wa-cfg{position:fixed;z-index:100001;width:340px;max-width:calc(100vw - 16px);max-height:calc(100vh - 80px);overflow:auto;background:var(--w-pn);color:var(--w-tx);border:1px solid var(--w-bd);border-radius:16px;box-shadow:var(--w-sh);padding:10px;font-size:13.5px}
.wa-cfg .wa-cs{padding:10px;border:1px solid var(--w-bd);border-radius:12px;margin-bottom:8px}.wa-cfg .wa-cl{display:flex;align-items:center;gap:8px}.wa-cfg .wa-ld2{width:9px;height:9px;border-radius:50%;background:var(--w-mu);flex:none}.wa-cfg .wa-ld2.ok{background:var(--w-g);box-shadow:0 0 0 4px rgba(0,168,132,.18)}.wa-cfg .wa-ld2.wait{background:var(--w-wait)}.wa-cfg .wa-ld2.bad{background:var(--w-bad)}
.wa-cfg .mu{color:var(--w-mu);margin-top:3px}.wa-cfg .err{color:var(--w-bad);margin-top:4px;font-size:12px}.wa-cfg .wa-cb{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.wa-cfg .wa-sep{height:1px;background:var(--w-bd);margin:6px 2px}.wa-cfg a.wa-mi{text-decoration:none;box-sizing:border-box}
.wa-bar{display:flex;flex-wrap:wrap;gap:8px 10px;align-items:center}.wa-bar .wa-sp{flex:1}
.wa-st{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:6px 14px;border:1px solid var(--w-bd);border-radius:99px;background:var(--w-pn);font-size:13px;box-shadow:0 4px 18px rgba(139,92,246,.08)}
.wa-st .wa-ld2{width:9px;height:9px;border-radius:50%;background:var(--w-mu);flex:none}.wa-st .ok{background:var(--w-g);box-shadow:0 0 0 4px rgba(0,168,132,.18)}.wa-st .wait{background:var(--w-wait);animation:waP 1.4s infinite}.wa-st .bad{background:var(--w-bad)}
@keyframes waP{50%{opacity:.35}}
.wa-st b{font-weight:700}.wa-st .mu{color:var(--w-mu)}.wa-st .err{color:var(--w-bad);flex-basis:100%}
.wa-btn{border:1px solid var(--w-bd);background:var(--w-pn);color:var(--w-tx);border-radius:99px;padding:6px 14px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;transition:.18s;display:inline-flex;align-items:center;gap:6px}
.wa-btn:hover{background:var(--w-hv);transform:translateY(-1px)}
.wa-btn.pri{background:linear-gradient(135deg,var(--w-p),var(--w-p2));color:#fff;border-color:transparent;box-shadow:0 6px 18px rgba(139,92,246,.35)}
.wa-btn.pri:hover{filter:brightness(1.08)}
.wa-btn.dg:hover{background:var(--w-bad);color:#fff;border-color:transparent}
.wa-box{display:grid;grid-template-columns:minmax(300px,390px) 1fr;border:1px solid var(--w-bd);border-radius:20px;overflow:hidden;height:calc(100vh - 150px);min-height:520px;background:var(--w-pn);box-shadow:var(--w-sh)}
.wa-l{display:flex;flex-direction:column;border-right:1px solid var(--w-bd);background:var(--w-pn);min-height:0;min-width:0}
.wa-lh{padding:12px 12px 6px;display:flex;gap:8px;flex-wrap:wrap}
.wa-lh input,.wa-lh select{background:var(--w-inp);border:1px solid transparent;color:var(--w-tx);border-radius:12px;padding:10px 14px;flex:1;min-width:0;font:inherit;outline:0;transition:.15s;width:auto}
.wa-lh input:focus,.wa-lh select:focus{border-color:var(--w-p);box-shadow:0 0 0 3px rgba(139,92,246,.2)}
.wa-lh input::placeholder{color:var(--w-mu)}
.wa-ib{background:linear-gradient(135deg,var(--w-p),var(--w-p2));border:0;color:#fff;border-radius:12px;width:42px;cursor:pointer;font-size:20px;line-height:1;box-shadow:0 6px 16px rgba(139,92,246,.35)}
.wa-tabs{display:flex;margin:4px 12px 0;border-bottom:1px solid var(--w-bd)}.wa-tabs button{flex:1;background:none;border:0;color:var(--w-mu);padding:10px;cursor:pointer;border-bottom:3px solid transparent;font:inherit;font-weight:700;font-size:13px}.wa-tabs button.on{color:var(--w-p);border-color:var(--w-p)}
.wa-chips{display:flex;gap:6px;padding:10px 12px 8px;overflow:auto;scrollbar-width:none}.wa-chips::-webkit-scrollbar{display:none}
.wa-chip{flex:none;background:var(--w-inp);color:var(--w-mu);border:0;border-radius:99px;padding:5px 13px;cursor:pointer;font:inherit;font-size:12.5px;font-weight:700;transition:.15s}.wa-chip:hover{background:var(--w-hv)}.wa-chip.on{background:linear-gradient(135deg,var(--w-p),var(--w-p2));color:#fff}
.wa-list{overflow:auto;flex:1;min-height:0}
.wa-c{display:flex;gap:12px;padding:11px 14px;cursor:pointer;align-items:center;position:relative;transition:background .12s}
.wa-c:hover{background:var(--w-hv)}.wa-c.on{background:var(--w-hv)}.wa-c.on:before{content:"";position:absolute;left:0;top:10px;bottom:10px;width:4px;border-radius:0 4px 4px 0;background:linear-gradient(180deg,var(--w-p),var(--w-p2))}
.wa-c:after{content:"";position:absolute;left:72px;right:0;bottom:0;border-bottom:1px solid var(--w-bd);opacity:.45}
.wa-av{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;font-weight:800;color:#fff;flex:none;font-size:19px;overflow:hidden;position:relative;box-shadow:0 2px 8px rgba(0,0,0,.18)}.wa-av img{width:100%;height:100%;object-fit:cover;display:block}
.wa-av.g{width:96px;height:96px;font-size:38px}.wa-av.m{width:42px;height:42px;font-size:17px}.wa-av.s{width:36px;height:36px;font-size:15px}
.wa-cb{flex:1;min-width:0}.wa-r1,.wa-r2{display:flex;justify-content:space-between;gap:8px;align-items:center}.wa-r2{margin-top:2px}
.wa-r1 small{color:var(--w-mu);font-size:11.5px;white-space:nowrap}.wa-r1 small.un{color:var(--w-p);font-weight:800}
.wa-r1 b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:14.5px;font-weight:700}.wa-r1 b small{font-weight:500}
.wa-pv{color:var(--w-mu);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13.5px}
.wa-n{background:linear-gradient(135deg,var(--w-p),var(--w-p2));color:#fff;border-radius:99px;padding:1px 8px;font-size:11.5px;font-weight:800;flex:none;min-width:21px;text-align:center}
.wa-dot{background:var(--w-p);border-radius:50%;width:10px;height:10px;flex:none}.wa-pin{color:var(--w-mu);font-size:11px;margin-left:4px}
.wa-tg{display:inline-block;color:#fff;border-radius:99px;padding:0 8px;font-size:11px;margin:4px 4px 0 0;font-weight:600}
.wa-x{position:absolute;right:8px;top:8px;display:none;background:var(--w-pn);border:1px solid var(--w-bd);color:var(--w-tx);border-radius:8px;cursor:pointer;padding:1px 7px;z-index:2}.wa-c:hover .wa-x{display:block}
.wa-vazio{padding:34px 22px;text-align:center;color:var(--w-mu);font-size:14px}
.wa-r{display:flex;flex-direction:column;min-width:0;min-height:0;background:var(--w-bg);position:relative}
.wa-ph{margin:auto;color:var(--w-mu);text-align:center;padding:30px;max-width:340px}.wa-ph .big{font-size:54px;margin-bottom:10px;filter:drop-shadow(0 8px 16px rgba(139,92,246,.35))}.wa-ph h3{margin:0 0 6px;color:var(--w-tx);font-size:19px}.wa-ph p{margin:0;font-size:13.5px;line-height:1.5}
.wa-ch{display:flex;align-items:center;gap:8px;padding:9px 14px;background:var(--w-hd);border-bottom:1px solid var(--w-bd);position:relative}
.wa-hid{flex:1;min-width:0;display:flex;align-items:center;gap:12px;cursor:pointer}.wa-ht{min-width:0}.wa-ht b,.wa-ht small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wa-ht b{font-size:15px}.wa-ht small{color:var(--w-mu);font-size:12.5px}
.wa-ab{background:none;border:0;color:var(--w-mu);font-size:19px;cursor:pointer;border-radius:10px;padding:7px 9px;transition:.15s;line-height:1}.wa-ab:hover{background:var(--w-hv);color:var(--w-tx)}
.wa-mw{position:relative;flex:1;min-height:0;display:flex}
.wa-m{flex:1;overflow:auto;padding:16px 7%;display:flex;flex-direction:column;gap:3px;background:var(--w-bg);background-image:radial-gradient(var(--w-pat) 1.6px,transparent 1.7px);background-size:22px 22px;min-width:0}
.wa-b{max-width:min(76%,640px);padding:7px 10px 5px;border-radius:12px;word-break:break-word;white-space:pre-wrap;font-size:14.5px;line-height:1.38;box-shadow:0 1px 1px rgba(0,0,0,.13);position:relative;color:var(--w-ink)}
.wa-b.in{background:var(--w-in);align-self:flex-start;border-top-left-radius:3px}.wa-b.out{background:var(--w-out);align-self:flex-end;border-top-right-radius:3px}
.wa-b a{color:#2563eb;text-decoration:underline;word-break:break-all}:root[data-theme="dark"] .wa-b a{color:#53bdeb}@media(prefers-color-scheme:dark){:root:not([data-theme="light"]) .wa-b a{color:#53bdeb}}
.wa-meta{float:right;margin:6px 0 0 14px;color:var(--w-meta);font-size:11px;display:inline-flex;align-items:center;gap:3px;white-space:nowrap}.wa-b:after{content:"";display:block;clear:both}
.wa-tk{width:16px;height:12px;display:inline-block;vertical-align:-2px}.wa-tk.lido{color:#53bdeb}.wa-meta .fl{color:var(--w-bad);font-weight:700}
.wa-day{align-self:center;background:var(--w-pn);color:var(--w-mu);border-radius:10px;padding:4px 14px;font-size:12px;font-weight:600;margin:12px 0 6px;box-shadow:0 1px 3px rgba(0,0,0,.12)}
.wa-md{margin-bottom:4px}.wa-md img,.wa-md video{max-width:100%;max-height:340px;border-radius:8px;display:block}.wa-md img{cursor:zoom-in}.wa-md audio{width:250px;max-width:100%;display:block}.wa-md a{color:#2563eb}
.wa-cap{margin-top:4px}
.wa-rx{position:absolute;bottom:-11px;left:8px;background:var(--w-pn);border:1px solid var(--w-bd);border-radius:99px;padding:0 6px;font-size:13px;box-shadow:0 1px 3px rgba(0,0,0,.25)}
.wa-bm{position:absolute;right:3px;top:2px;display:none;background:var(--w-pn);border:0;color:var(--w-tx);border-radius:8px;cursor:pointer;padding:0 7px;font-size:14px;box-shadow:0 1px 4px rgba(0,0,0,.25)}.wa-b:hover .wa-bm{display:block}.wa-apg{font-style:italic;color:var(--w-meta)}
.wa-load{display:flex;align-items:center;gap:8px;color:var(--w-mu);font-size:13px;padding:6px 0}.wa-sp2{width:15px;height:15px;border:2px solid var(--w-bd);border-top-color:var(--w-p);border-radius:50%;animation:waR .8s linear infinite;flex:none}@keyframes waR{to{transform:rotate(360deg)}}
.wa-bad{display:flex;flex-direction:column;gap:6px;background:rgba(225,29,72,.09);border:1px dashed rgba(225,29,72,.45);border-radius:10px;padding:9px 12px;font-size:13px;min-width:210px}.wa-bad b{color:var(--w-bad)}.wa-bad small{color:var(--w-mu);float:none;margin:0;font-size:11.5px;word-break:break-word}
.wa-bad button{align-self:flex-start;background:linear-gradient(135deg,var(--w-p),var(--w-p2));color:#fff;border:0;border-radius:99px;padding:5px 14px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer}
.wa-ld{align-self:center;color:var(--w-mu);font-size:12px;padding:6px}
.wa-au{display:flex;align-items:center;gap:8px;min-width:240px}.wa-au .pl{width:38px;height:38px;border-radius:50%;border:0;background:linear-gradient(135deg,var(--w-p),var(--w-p2));color:#fff;cursor:pointer;flex:none;font-size:14px}.wa-au input[type=range]{flex:1;min-width:80px;accent-color:var(--w-p)}.wa-au .tm{font-size:11px;color:var(--w-meta);min-width:34px}.wa-au a{color:var(--w-p);text-decoration:none;font-size:15px}
.wa-doc{display:flex;align-items:center;gap:10px;background:rgba(139,92,246,.1);border:1px solid var(--w-bd);border-radius:10px;padding:9px 11px;min-width:240px}.wa-doc .ic{font-size:30px}.wa-doc .nm{flex:1;min-width:0}.wa-doc .nm b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:14px}.wa-doc .nm small{float:none;margin:0;color:var(--w-mu);font-size:11.5px}.wa-doc a,.wa-doc button{color:var(--w-p);background:none;border:0;cursor:pointer;font:inherit;font-size:16px;text-decoration:none;padding:2px 4px}
.wa-fab{position:absolute;right:18px;bottom:14px;width:42px;height:42px;border-radius:50%;border:1px solid var(--w-bd);background:var(--w-pn);color:var(--w-tx);cursor:pointer;display:none;place-items:center;box-shadow:0 6px 18px rgba(0,0,0,.25);font-size:18px;z-index:4}.wa-fab.on{display:grid}
.wa-fab i{position:absolute;top:-7px;right:-4px;background:linear-gradient(135deg,var(--w-p),var(--w-p2));color:#fff;font-style:normal;font-size:11px;font-weight:800;border-radius:99px;padding:1px 7px}
.wa-f{display:flex;gap:6px;padding:10px 12px;background:var(--w-hd);border-top:1px solid var(--w-bd);align-items:flex-end;position:relative}
.wa-f textarea{flex:1;background:var(--w-pn);border:1px solid var(--w-bd);color:var(--w-tx);border-radius:22px;padding:11px 16px;font:inherit;font-size:14.5px;resize:none;max-height:140px;min-height:44px;line-height:1.35;outline:0;transition:.15s;width:auto}.wa-f textarea:focus{border-color:var(--w-p);box-shadow:0 0 0 3px rgba(139,92,246,.2)}.wa-f textarea::placeholder{color:var(--w-mu)}
.wa-f .wa-ro{color:var(--w-mu);padding:8px;font-size:13px}.wa-f .wa-ab{height:44px;font-size:20px}
.wa-send{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,var(--w-p),var(--w-p2));border:0;color:#fff;cursor:pointer;font-size:18px;flex:none;box-shadow:0 6px 16px rgba(139,92,246,.4);transition:.15s}.wa-send:hover{transform:scale(1.07)}
.wa-drop{position:absolute;inset:0;z-index:30;background:rgba(139,92,246,.18);backdrop-filter:blur(3px);border:3px dashed var(--w-p);border-radius:14px;display:none;place-items:center;font-size:20px;font-weight:800;color:var(--w-p);pointer-events:none}.wa-drop.on{display:grid}
.wa-pp{position:absolute;right:10px;top:56px;z-index:20;background:var(--w-pn);color:var(--w-tx);border:1px solid var(--w-bd);border-radius:14px;padding:12px;width:260px;box-shadow:var(--w-sh)}
.wa-ol{display:flex;align-items:center;gap:8px;padding:5px 2px;cursor:pointer}.wa-ol i{width:12px;height:12px;border-radius:50%;flex:none}.wa-ol span{flex:1;overflow:hidden;text-overflow:ellipsis}.wa-ol button{background:none;border:0;color:var(--w-mu);cursor:pointer}
.wa-pp .wa-new{display:flex;gap:6px;margin-top:8px}.wa-pp .wa-new input[type=text]{flex:1;min-width:0;background:var(--w-inp);border:0;color:var(--w-tx);border-radius:8px;padding:6px 8px;width:auto}.wa-pp input[type=color]{width:34px;border:0;background:none;padding:0}
.wa-mi{display:block;width:100%;text-align:left;background:none;border:0;color:var(--w-tx);padding:9px 11px;border-radius:9px;cursor:pointer;font:inherit;font-size:14px}.wa-mi:hover{background:var(--w-hv)}
.wa-sw{display:flex;align-items:center;gap:10px;padding:8px 6px;cursor:pointer;font-size:13.5px}.wa-sw input{width:auto;accent-color:var(--w-p)}.wa-sw small{display:block;color:var(--w-mu);font-size:11.5px}
.wa-zoom{position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:100000;display:grid;place-items:center;cursor:zoom-out}.wa-zoom img{max-width:94vw;max-height:94vh}
.wa-mod{position:fixed;inset:0;background:rgba(10,4,24,.62);backdrop-filter:blur(4px);z-index:100002;display:grid;place-items:center;padding:12px}
.wa-card{background:var(--w-pn);color:var(--w-tx);border:1px solid var(--w-bd);border-radius:20px;width:min(540px,100%);max-height:92vh;overflow:auto;padding:20px;box-shadow:var(--w-sh)}
.wa-card h3{margin:0 0 12px;font-size:18px}.wa-card label{display:block;font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--w-mu);margin:12px 0 4px}
.wa-card input:not([type=checkbox]),.wa-card textarea{width:100%;box-sizing:border-box;background:var(--w-inp);border:1px solid transparent;color:var(--w-tx);border-radius:10px;padding:10px 12px;font:inherit;outline:0}.wa-card input:focus,.wa-card textarea:focus{border-color:var(--w-p)}.wa-card textarea{min-height:76px;resize:vertical}
.wa-card .row{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}.wa-card .row button,.wa-card .bt{background:linear-gradient(135deg,var(--w-p),var(--w-p2));border:0;color:#fff;border-radius:99px;padding:9px 20px;cursor:pointer;font:inherit;font-weight:700}.wa-card .row .sec{background:var(--w-inp);color:var(--w-tx)}
.wa-fl{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--w-bd);font-size:13px}.wa-fl span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wa-fl button{background:var(--w-inp);border:0;color:var(--w-tx);border-radius:8px;padding:4px 11px;cursor:pointer;font:inherit}
.wa-perfil{display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center;margin-bottom:6px}.wa-perfil b{font-size:18px}.wa-perfil small{color:var(--w-mu)}
.wa-emo{position:absolute;left:8px;bottom:68px;z-index:30;background:var(--w-pn);border:1px solid var(--w-bd);border-radius:16px;padding:10px;width:min(340px,calc(100% - 16px));box-shadow:var(--w-sh)}.wa-emo input{width:100%;box-sizing:border-box;background:var(--w-inp);border:0;color:var(--w-tx);border-radius:10px;padding:8px 11px;margin-bottom:6px;outline:0}.wa-emo div.g{display:grid;grid-template-columns:repeat(8,1fr);gap:2px;max-height:190px;overflow:auto}.wa-emo button{background:none;border:0;font-size:22px;cursor:pointer;border-radius:8px;padding:2px}.wa-emo button:hover{background:var(--w-hv)}
.wa-rp{position:absolute;left:8px;right:8px;bottom:68px;z-index:30;background:var(--w-pn);border:1px solid var(--w-bd);border-radius:16px;box-shadow:var(--w-sh);max-height:300px;display:flex;flex-direction:column;overflow:hidden}
.wa-rp .lst{overflow:auto;flex:1}.wa-rp .it2{display:block;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid var(--w-bd);padding:10px 14px;cursor:pointer;color:var(--w-tx);font:inherit}.wa-rp .it2:hover,.wa-rp .it2.on{background:var(--w-hv)}.wa-rp .it2 b{display:block;font-size:13.5px}.wa-rp .it2 span{display:block;font-size:12.5px;color:var(--w-mu);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wa-rp .hd{display:flex;justify-content:space-between;align-items:center;padding:6px 8px 6px 14px;font-size:13px;background:var(--w-hd);border-bottom:1px solid var(--w-bd)}.wa-rp .lap{background:none;border:0;cursor:pointer;font-size:17px;line-height:1;padding:6px 8px;border-radius:50%}.wa-rp .lap:hover{background:var(--w-hv)}
.wa-rp .ft{display:flex;justify-content:space-between;align-items:center;padding:7px 14px;font-size:12px;color:var(--w-mu);background:var(--w-hd)}.wa-rp .ft button{background:none;border:0;color:var(--w-p);font:inherit;font-weight:700;cursor:pointer}
.wa-pv2{display:flex;flex-direction:column;gap:10px;max-height:46vh;overflow:auto;margin:6px 0}.wa-pv2 .arq{display:flex;align-items:center;gap:12px;background:var(--w-inp);border-radius:12px;padding:8px}.wa-pv2 img,.wa-pv2 video{max-width:100%;max-height:240px;border-radius:8px;display:block}.wa-pv2 .arq .ic{font-size:30px;width:54px;text-align:center}.wa-pv2 .arq .nm{flex:1;min-width:0}.wa-pv2 .arq .nm b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13.5px}.wa-pv2 .arq .nm small{color:var(--w-mu)}
.wa-nts{position:fixed;top:16px;right:16px;z-index:100010;display:flex;flex-direction:column;gap:10px;width:min(360px,calc(100vw - 32px));pointer-events:none}
.wa-nt{pointer-events:auto;display:flex;gap:12px;align-items:center;padding:12px 14px;border-radius:18px;background:var(--w-pn);color:var(--w-tx);border:1px solid var(--w-bd);box-shadow:var(--w-sh);cursor:pointer;position:relative;overflow:hidden;animation:waIn .35s cubic-bezier(.2,.9,.3,1.2) both}
.wa-nt:before{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:linear-gradient(180deg,var(--w-p),var(--w-p2))}
.wa-nt .nt-x{flex:1;min-width:0}.wa-nt .nt-t{display:flex;justify-content:space-between;gap:8px;align-items:baseline}.wa-nt b{font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wa-nt small{color:var(--w-mu);font-size:11px;white-space:nowrap}
.wa-nt p{margin:2px 0 0;font-size:13px;color:var(--w-mu);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.wa-nt .nt-cl{position:absolute;top:4px;right:6px;background:none;border:0;color:var(--w-mu);cursor:pointer;font-size:14px;opacity:0;transition:.15s}.wa-nt:hover .nt-cl{opacity:1}
.wa-nt .nt-bar{position:absolute;left:5px;right:0;bottom:0;height:3px;background:linear-gradient(90deg,var(--w-p),var(--w-p2));transform-origin:left;animation:waBar 8s linear forwards}
@keyframes waIn{from{opacity:0;transform:translateX(40px) scale(.96)}}@keyframes waBar{to{transform:scaleX(0)}}
.wa-nb{position:absolute;top:2px;right:6px;background:linear-gradient(135deg,#f43f5e,#d946ef);color:#fff;font-size:11px;font-weight:800;border-radius:99px;min-width:19px;height:19px;padding:0 5px;display:grid;place-items:center;box-shadow:0 2px 8px rgba(244,63,94,.5);pointer-events:none}
.it[data-t="wa"]{position:relative}
.wa-back{display:none}
@media(min-width:861px){
 .lay.wa-full{max-width:none!important;height:100vh;height:100dvh;padding:10px;gap:10px;grid-template-columns:78px 1fr!important;align-items:stretch}
 .lay.wa-full .sb{height:calc(100dvh - 20px);top:10px;padding:12px 8px;align-items:center}
 .lay.wa-full .brand{width:100%;justify-content:center;padding-bottom:12px;margin-bottom:6px}.lay.wa-full .brand .lg,.lay.wa-full .brand-text,.lay.wa-full .it-text,.lay.wa-full .who-text{display:none}
 .lay.wa-full .mn{width:100%;align-items:center}.lay.wa-full .it{width:48px;height:48px;padding:0;gap:0;justify-content:center}.lay.wa-full .it:hover{transform:none}.lay.wa-full .it .ic{width:auto}
 .lay.wa-full .me{width:100%;align-items:center;gap:10px;padding-top:12px}.lay.wa-full .who{justify-content:center}.lay.wa-full .ac{flex-direction:column;width:100%;align-items:center;gap:8px}.lay.wa-full .ac .b{flex:none;width:48px;height:44px;padding:0}.lay.wa-full .ac .it-text{display:none}
 .lay.wa-full.wa-focus{grid-template-columns:1fr!important}.lay.wa-full.wa-focus .sb{display:none}
}
.lay.wa-full main{height:100%;min-height:0;display:flex;flex-direction:column}
.lay.wa-full #wa_root{flex:1;min-height:0}
.lay.wa-full .wa-box{flex:1;height:auto;min-height:0}
@media(max-width:860px){
 .lay.wa-full{display:flex!important;flex-direction:column;height:100vh;height:100dvh;padding:8px;gap:8px}
 .lay.wa-full main{flex:1;min-height:0}.lay.wa-full.wa-focus .sb{display:none}
 .lay.wa-full .sb{padding:8px 10px}.lay.wa-full .sb .brand,.lay.wa-full .sb .me{display:none}
}
@media(max-width:800px){.wa-cfgm{display:inline-block}.wa-box{grid-template-columns:1fr;height:calc(100dvh - 90px)}.wa-box.chat .wa-l{display:none}.wa-box:not(.chat) .wa-r{display:none}.wa-back{display:inline-block}.wa-m{padding:12px 3%}.wa-b{max-width:88%}.wa-nts{top:8px;right:8px}}
`;

function html(){
 if(!$('#wa_css')){const s=document.createElement('style');s.id='wa_css';s.textContent=css;document.head.appendChild(s)}
 return '<div id="wa_root" class="wa-v">'+
  '<div class="wa-box" id="wa_box"><div class="wa-l"><div class="wa-lh"><input id="wa_q" placeholder="Pesquisar contato ou número…" autocomplete="off">'+(adm()?CFGM+'<select id="wa_op"><option value="">Todos os operadores</option></select><input id="wa_de" type="date" title="De"><input id="wa_ate" type="date" title="Até">':'<button class="wa-ib" data-wa="novo" title="Nova conversa">＋</button>')+CFGM+
  '</div><div class="wa-lh" id="wa_novo" style="display:none;padding-top:0"><input id="wa_nn" placeholder="Número com DDD (ex.: 41 99999-9999)" inputmode="tel"><button class="wa-ib" data-wa="abrir" title="Abrir conversa" style="width:auto;padding:0 14px;font-size:14px;font-weight:700">Abrir</button></div>'+
  '<div class="wa-tabs"><button data-wa="aba" data-a="ativas" class="on">Conversas</button><button data-wa="aba" data-a="arq">Arquivadas</button></div><div class="wa-chips" id="wa_chips"></div><div class="wa-list" id="wa_list"></div></div>'+
  '<div class="wa-r" id="wa_chat">'+vazio()+'</div></div></div>';
}
const CFGB='<button class="wa-ab" data-wa="cfg" title="Configurações do WhatsApp">⚙️<i class="wa-cfgdot"></i></button>',CFGM='<button class="wa-ib wa-cfgm" data-wa="cfg" title="Configurações do WhatsApp">⚙️<i class="wa-cfgdot"></i></button>';
const vazio=()=>'<button class="wa-ab wa-cfgf" data-wa="cfg" title="Configurações do WhatsApp">⚙️<i class="wa-cfgdot"></i></button><div class="wa-ph"><div class="big">💬</div><h3>WhatsApp Business</h3><p>Selecione uma conversa ao lado para começar. Você pode arrastar arquivos para a conversa, colar imagens e usar <b>/</b> para respostas rápidas.</p></div>';
function estadoGeral(){
 const L=adm()?S.sess:S.sess.filter(x=>x.login===me.login);
 if(L.some(x=>x.status==='conectado'))return 'ok';
 if(L.some(x=>x.desejada||x.status==='aguardando'||x.status==='aguardando_qr'||x.status==='iniciando_servico'))return 'wait';
 return L.some(x=>x.status==='erro')?'bad':'';
}
function cfgHtml(){
 const p=pref(),perm='Notification' in window?Notification.permission:'unsupported',solo=window.WA_SOLO,
  lay=document.querySelector('.lay'),focus=solo?!!document.fullscreenElement:!!(lay&&lay.classList.contains('wa-focus'));
 let h=S.sess.map(s=>{const [k,t]=ST[s.status]||ST.desconectado,pode=adm()||s.login===me.login;
  return '<div class="wa-cs"><div class="wa-cl"><span class="wa-ld2 '+k+'"></span><b>'+(adm()?esc(s.nome)+' · ':'')+t+'</b></div>'+(s.numero?'<div class="mu">📱 +'+esc(s.numero)+'</div>':'')+
   (s.erro?'<div class="err">'+esc(s.erro)+'</div>':'')+
   (pode&&s.status==='aguardando'&&Date.now()-s.atualizado_em>30000?'<div class="err">⚠ O serviço do WhatsApp (whatsapp-service/app.py) não respondeu. Confira se ele está rodando e se está dentro do expediente.</div>':'')+
   '<div class="wa-cb">'+(pode?'<button class="wa-btn pri" data-k="connect" data-op="'+esc(s.login)+'">'+(s.desejada?'🔄 Reconectar':'🔗 Conectar número')+'</button>':'')+
   (pode&&(s.desejada||s.status==='conectado')?'<button class="wa-btn dg" data-k="off" data-op="'+esc(s.login)+'">⏻ Desconectar</button>':'')+'</div></div>'}).join('')||'<div class="wa-cs"><span style="color:var(--w-mu)">Nenhum operador cadastrado.</span></div>';
 if(adm())h+='<button class="wa-mi" data-k="admin">🗄️ Arquivamento e erros</button>';
 else{
  h+='<div class="wa-sep"></div><label class="wa-sw"><input type="checkbox" data-p="som" '+(p.som?'checked':'')+'><span>Som ao chegar mensagem</span></label>'+
   '<label class="wa-sw"><input type="checkbox" data-p="previa" '+(p.previa?'checked':'')+'><span>Mostrar o texto da mensagem nas notificações<small>Desligado: aparece só o nome do cliente e o tipo da mensagem (mais privado).</small></span></label>'+
   '<div class="wa-sw" style="cursor:default"><span>Avisos do navegador: <b>'+(perm==='granted'?'ativados':perm==='denied'?'bloqueados no navegador':perm==='default'?'desativados':'indisponíveis')+'</b></span></div>'+
   (perm==='default'?'<button class="wa-mi" data-k="notif">🔔 Ativar notificações</button>':'')+'<button class="wa-mi" data-k="teste">🔊 Testar notificação</button>';
 }
 h+='<div class="wa-sep"></div><button class="wa-mi" data-k="full">'+(focus?'⤡ Sair da tela cheia':'⛶ Tela cheia')+'</button>';
 if(!adm()&&!solo)h+='<a class="wa-mi" href="/whats" target="_blank" rel="noopener">↗ Abrir WhatsApp em página própria</a>';
 if(solo)h+='<button class="wa-mi" data-k="tema">🌓 Trocar tema</button><a class="wa-mi" href="/operador">📝 Ir para a Área do Operador</a><button class="wa-mi" data-k="sair">🚪 Sair</button>';
 return h;
}
function cfgFechar(){const m=$('#wa_cfg');if(m)m.remove()}
function cfgMenu(btn){
 if($('#wa_cfg')){cfgFechar();return}
 fechaMenu();
 const r=btn.getBoundingClientRect(),m=document.createElement('div');m.id='wa_cfg';m.className='wa-cfg wa-v';
 m.style.top=Math.min(r.bottom+6,innerHeight-120)+'px';m.style.left=Math.max(8,Math.min(r.right-340,innerWidth-348))+'px';
 m.innerHTML=cfgHtml();
 m.onclick=async e=>{
  const k=e.target.closest('[data-k]');if(!k)return;const a=k.dataset.k;
  try{
   if(a==='connect'){await api('wa_connect',{op:k.dataset.op});S.popOp=k.dataset.op;S.pop=true;S.popQr='';cfgFechar();carregar()}
   else if(a==='off'){if(confirm('Desconectar esta sessão do WhatsApp?')){await api('wa_disconnect',{op:k.dataset.op});S.pop=false;cfgFechar();carregar()}}
   else if(a==='admin'){cfgFechar();painelAdmin()}
   else if(a==='notif'){pedirNotif();setTimeout(()=>{const x=$('#wa_cfg');if(x)x.innerHTML=cfgHtml()},800)}
   else if(a==='teste'){cfgFechar();avisar([{chat:'teste',n:1,ultimo_tipo:'texto',ultima:'Esta é uma notificação de teste.',nome_custom:'Notificação de teste'}],true)}
   else if(a==='full'){cfgFechar();telaCheia()}
   else if(a==='tema'){if(window.WA_SOLO)window.WA_SOLO.tema()}
   else if(a==='sair'){cfgFechar();if(window.WA_SOLO)window.WA_SOLO.sair()}
  }catch(x){toast(x.message,true)}};
 m.onchange=e=>{const k=e.target.dataset.p;if(k)setPref({[k]:e.target.checked})};
 document.body.appendChild(m);
}
document.addEventListener('click',e=>{if($('#wa_cfg')&&!e.target.closest('#wa_cfg,[data-wa="cfg"]'))cfgFechar()});
addEventListener('keydown',e=>{if(e.key==='Escape')cfgFechar()});
function dots(){const g=estadoGeral();document.querySelectorAll('.wa-cfgdot').forEach(d=>{const c='wa-cfgdot '+g;if(d.className!==c){d.className=c;d.title=g==='ok'?'WhatsApp conectado':g==='wait'?'Conectando…':'WhatsApp desconectado'}})}
let sesSig='';
function ses(){
 const sig=JSON.stringify(S.sess)+(S.srv?Math.floor((S.srv.agora-S.srv.ts)/20000):'');
 if(sig!==sesSig){sesSig=sig;
  const m=$('#wa_cfg');if(m)m.innerHTML=cfgHtml();
 }
 dots();
 const sel=$('#wa_op');if(sel&&sel.options.length!==S.sess.length+1){sel.innerHTML='<option value="">Todos os operadores</option>'+S.sess.map(s=>'<option value="'+esc(s.login)+'">'+esc(s.nome)+'</option>').join('');sel.value=S.op}
}
function pop(){
 let el=$('#wa_pop');
 if(!S.pop){if(el)el.remove();return}
 const alvo=S.popOp||me.login,o=S.sess.find(x=>x.login===alvo)||{},sv=S.srv||{},on=sv.ts&&(sv.agora-sv.ts)<20000;
 if(!el){el=document.createElement('div');el.id='wa_pop';el.className='wa-v';el.style.cssText='position:fixed;right:18px;bottom:18px;z-index:99999;width:310px;max-width:calc(100vw - 36px);background:var(--w-pn);color:var(--w-tx);border:1px solid var(--w-bd);border-radius:20px;box-shadow:var(--w-sh);padding:16px;font-size:14px';
  el.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><b id="wa_pop_t">💬 Conectar WhatsApp</b><button id="wa_pop_x" style="background:none;border:0;color:var(--w-tx);font-size:18px;cursor:pointer">✕</button></div><div id="wa_pop_b" style="text-align:center"></div>';
  document.body.appendChild(el);el.querySelector('#wa_pop_x').onclick=()=>{S.pop=false;pop()}}
 const tt=el.querySelector('#wa_pop_t');if(tt)tt.textContent='💬 Conectar WhatsApp'+(alvo!==me.login&&o.nome?' — '+o.nome:'');
 const b=el.querySelector('#wa_pop_b');let h='';
 if(o.status==='conectado')h='<div style="font-size:40px">✅</div><p><b>Conectado!</b>'+(o.numero?'<br>+'+esc(o.numero):'')+'</p>';
 else if(!o.desejada&&o.status!=='aguardando')h='<p>Desconectado.<br>Clique em <b>Conectar número</b> para gerar o QR Code.</p>';
 else if(!on)h='<div style="font-size:34px">🔌</div><p style="color:var(--w-bad)"><b>O serviço do WhatsApp está desligado.</b></p><p style="opacity:.8;font-size:12px">O QR Code só é gerado quando o <code>app.py</code> está rodando no computador/servidor. Abra o terminal na pasta <code>whatsapp-service</code> e rode:<br><code>python app.py</code><br>Esta janela atualiza sozinha.</p>';
 else if(sv.det==='fechado')h='<div style="font-size:34px">🌙</div><p>Fora do expediente (07h–18h30).<br>O QR será gerado quando abrir.</p>';
 else if(o.qr&&o.status==='aguardando_qr')h='<div id="wa_pq" style="display:inline-block;background:#fff;padding:10px;border-radius:12px"></div><p style="margin:8px 0 0;font-size:12px;opacity:.85">WhatsApp → Aparelhos conectados → Conectar um aparelho → aponte a câmera</p>';
 else h='<div style="font-size:34px">⏳</div><p>Serviço online. Gerando QR Code…</p>';
 if(o.erro)h+='<p style="color:var(--w-bad);font-size:12px">'+esc(o.erro)+'</p>';
 const k=h.indexOf('wa_pq')>-1?'qr:'+o.qr:h;
 if(b.dataset.k!==k){b.dataset.k=k;b.innerHTML=h;S.popQr=''}
 if(o.qr&&o.status==='aguardando_qr'){const q=$('#wa_pq');if(q&&(S.popQr!==o.qr||!q.firstChild)&&window.QRCode){S.popQr=o.qr;q.innerHTML='';new QRCode(q,{text:o.qr,width:220,height:220})}else if(q&&!window.QRCode)q.textContent='Carregando QR…'}
}
function lista(){
 const l=$('#wa_list');if(!l)return;
 const ab=$('#wa_box .wa-tabs');if(ab){ab.children[0].classList.toggle('on',S.aba==='ativas');ab.children[1].classList.toggle('on',S.aba==='arq');ab.children[1].textContent='Arquivadas'+(S.arqN?' ('+S.arqN+')':'')}
 const ch=$('#wa_chips'),mine=S.etq.filter(e=>e.op===me.login);
 if(ch){ch.style.display=!adm()?'':'none';const h=!adm()?'<button class="wa-chip'+(S.fEtq?'':' on')+'" data-wa="fetq" data-n="">Todas</button><button class="wa-chip'+(S.fEtq==='@nao'?' on':'')+'" data-wa="fetq" data-n="@nao">Não lidas</button><button class="wa-chip'+(S.fEtq==='@fav'?' on':'')+'" data-wa="fetq" data-n="@fav">⭐ Favoritas</button>'+mine.map(e=>'<button class="wa-chip'+(S.fEtq===e.nome?' on':'')+'" data-wa="fetq" data-n="'+esc(e.nome)+'">'+esc(e.nome)+'</button>').join(''):'';if(ch.dataset.h!==h){ch.dataset.h=h;ch.innerHTML=h}}
 const v=todas().filter(c=>!S.fEtq||(S.fEtq==='@nao'?(c.nao_lidas||c.forcar_nao_lida):S.fEtq==='@fav'?c.favorito:(c.etiquetas||[]).includes(S.fEtq)));
 const sig=JSON.stringify([v.map(c=>[c.op,c.chat,c.ts,c.ultima,c.ultimo_tipo,c.nao_lidas,c.forcar_nao_lida,c.fixada,c.favorito,c.etiquetas,c.nome_custom,c.contato,fotoUrl(c.op,c.chat).length]),S.chat,S.chatOp,S.aba,S.fEtq,S.etq]);
 if(l.dataset.sig===sig)return;l.dataset.sig=sig;
 l.innerHTML=v.map(c=>{const nl=c.nao_lidas||c.forcar_nao_lida;
  return '<div class="wa-c'+(S.chat===c.chat&&S.chatOp===c.op?' on':'')+'" data-chat="'+esc(c.chat)+'" data-op="'+esc(c.op)+'">'+avatar(c)+'<div class="wa-cb"><div class="wa-r1"><b>'+(c.favorito?'⭐ ':'')+esc(nome(c))+(c.fixada?'<span class="wa-pin">📌</span>':'')+(adm()?' <small>· '+esc(c.op)+'</small>':'')+'</b><small class="'+(nl?'un':'')+'">'+(c.ultima||c.ultimo_tipo?hm(c.ts):'')+'</small></div><div class="wa-r2"><span class="wa-pv">'+esc(prev(c))+'</span>'+(c.nao_lidas?'<span class="wa-n">'+c.nao_lidas+'</span>':c.forcar_nao_lida?'<span class="wa-dot" title="Marcada como não lida"></span>':'')+'</div>'+
   (c.etiquetas||[]).map(n=>'<span class="wa-tg" style="background:'+esc(cor(c.op,n))+'">'+esc(n)+'</span>').join('')+'</div>'+(c.op===me.login&&!c.novo?'<button class="wa-x" data-wa="row-menu" title="Opções">⌄</button>':'')+'</div>'}).join('')||'<div class="wa-vazio">'+(S.aba==='arq'?'Nenhuma conversa arquivada.':S.fEtq?'Nenhuma conversa neste filtro.':'Nenhuma conversa ainda.<br>As mensagens dos clientes aparecem aqui.')+'</div>';
}
function etqPop(c){
 const el=$('#wa_etqp');if(!el)return;
 el.style.display=S.etqPop?'block':'none';if(!S.etqPop)return;
 const mine=S.etq.filter(e=>e.op===me.login),sel=c.etiquetas||[],k=JSON.stringify([mine,sel]);
 if(el.dataset.k===k)return;el.dataset.k=k;
 el.innerHTML='<b style="font-size:13px">Etiquetas</b>'+(mine.map(e=>'<label class="wa-ol"><input type="checkbox" data-etq="'+esc(e.nome)+'"'+(sel.includes(e.nome)?' checked':'')+'><i style="background:'+esc(e.cor)+'"></i><span>'+esc(e.nome)+'</span><button data-wa="etq-del" data-n="'+esc(e.nome)+'" title="Apagar etiqueta">✕</button></label>').join('')||'<p style="color:var(--w-mu);font-size:13px;margin:6px 0">Nenhuma etiqueta ainda.</p>')+
  '<div class="wa-new"><input type="text" id="wa_en" placeholder="Nova etiqueta" maxlength="24"><input type="color" id="wa_ec" value="#8b5cf6"><button class="wa-ib" data-wa="etq-add" style="width:34px">＋</button></div>';
}

const kmsg=x=>x.status+'|'+(x.midia_status||'')+'|'+x.tipo+'|'+(x.revogar?1:0)+'|'+(x.reacao||'')+'|'+(x.midia_erro||'')+'|'+(x.refazer?1:0);
const CK1='<svg class="wa-tk" viewBox="0 0 16 15" aria-label="Enviada"><path fill="currentColor" d="M11.1 3.316l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"/></svg>';
const CK2=l=>'<svg class="wa-tk'+(l?' lido':'')+'" viewBox="0 0 16 15" aria-label="'+(l?'Visualizada':'Entregue')+'"><path fill="currentColor" d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"/></svg>';
const TICK={pendente:'<span title="Enviando…">🕐</span>',enviando:'<span title="Enviando…">🕐</span>',enviada:CK1,entregue:CK2(0),visualizada:CK2(1),falhou:'<span class="fl">⚠ falhou</span>'};
function bolha(x){
 const k=kmsg(x),eid=esc(x.id);let md='';
 const hr='<span class="wa-meta">'+hora(x.ts)+(x.direcao==='out'?(TICK[x.status]||''):'')+'</span>';
 if(x.tipo==='apagada')return '<div class="wa-b '+x.direcao+'" data-id="'+esc(eid)+'" data-ts="'+esc(x.ts)+'" data-k="'+esc(k)+'"><span class="wa-apg">🚫 '+(x.direcao==='out'?'Você apagou esta mensagem':'Esta mensagem foi apagada')+'</span>'+hr+'</div>';
 if(x.midia_status==='pendente'||x.midia_status==='refazer')md='<div class="wa-md wa-load"><i class="wa-sp2"></i>'+(x.direcao==='out'?'Enviando arquivo…':'Baixando arquivo…')+'</div>';
 else if(x.midia_status==='erro'){
  const ent=x.direcao==='in';
  md='<div class="wa-md wa-bad"><b>⚠ '+(ent?'Não foi possível baixar este arquivo':x.status==='falhou'?'Falha ao enviar o arquivo':'Cópia do arquivo indisponível')+'</b><small>'+(ent?'O WhatsApp não entregou o arquivo ou ele expirou.':'O arquivo foi enviado ao cliente, mas a cópia no sistema não foi salva.')+'</small>'+(x.midia_erro?'<small>Motivo: '+esc(x.midia_erro)+'</small>':'')+(ent&&S.chatOp===me.login&&!x.hist&&x.refazer?'<button data-wa="refazer" data-id="'+esc(x.id)+'">↻ Tentar baixar de novo</button>':'')+'</div>'}
 else if(x.midia_status==='ok')md='<div class="wa-md" data-mid="'+esc(eid)+'" data-tp="'+esc(x.tipo)+'" data-tam="'+(x.midia_tam||'')+'" data-voz="'+(x.voz?1:'')+'" data-seg="'+(x.midia_seg||'')+'" data-ts="'+esc(x.ts)+'" data-mime="'+esc(x.midia_mime||'')+'" data-nome="'+esc(x.midia_nome||'')+'"'+(x.hist?' data-ref="'+esc(x.ref)+'" data-drive="'+esc(x.mid)+'"':'')+'><div class="wa-load"><i class="wa-sp2"></i>Carregando…</div></div>';
 const tx=x.texto?(md?'<div class="wa-cap">'+linkar(x.texto)+'</div>':linkar(x.texto)):'';
 return '<div class="wa-b '+x.direcao+'" data-id="'+esc(eid)+'" data-ts="'+esc(x.ts)+'" data-k="'+esc(k)+'">'+(S.chatOp===me.login&&!x.hist?'<button class="wa-bm" data-wa="msg-menu" data-id="'+esc(x.id)+'" title="Opções">⌄</button>':'')+md+tx+hr+(x.reacao?'<span class="wa-rx">'+esc(x.reacao)+'</span>':'')+(x.revogar?'<div class="wa-apg">apagando para todos…</div>':'')+'</div>';
}
function crescer(t){if(!t)return;t.style.height='auto';t.style.height=Math.min(t.scrollHeight,140)+'px'}
function fabAtualizar(){const m=$('#wa_msgs'),f=$('#wa_fab');if(!m||!f)return;const longe=m.scrollHeight-m.scrollTop-m.clientHeight>260;if(!longe)S.abaixo=0;f.classList.toggle('on',longe);f.innerHTML='⌄'+(S.abaixo?'<i>'+S.abaixo+'</i>':'')}
function guardarRascunho(){const t=$('#wa_txt');if(t&&S.chat)S.drafts[S.chatOp+'|'+S.chat]=t.value}
function chat(){
 const el=$('#wa_chat');if(!el||!S.chat)return;
 const c=achar(),own=S.chatOp===me.login,key=S.chatOp+'|'+S.chat;let primeira=false;
 if(!$('#wa_msgs')||el.dataset.k!==key){primeira=true;el.dataset.k=key;el.dataset.h='';S.etqPop=false;S.abaixo=0;
  el.innerHTML='<div class="wa-ch"><button class="wa-ab wa-back" data-wa="back" title="Voltar">←</button><div class="wa-hid" id="wa_hid" data-wa="info" title="Dados do contato"></div>'+
   '<button class="wa-ab" data-wa="busca" title="Buscar na conversa">🔍</button>'+CFGB+(own?'<button class="wa-ab" data-wa="etq" title="Etiquetas">🏷️</button>':'')+'<button class="wa-ab" data-wa="chat-menu" title="Mais opções">⋮</button><div class="wa-pp" id="wa_etqp" style="display:none"></div></div>'+
   '<div id="wa_sb" style="display:none;padding:8px 14px;background:var(--w-hd);border-bottom:1px solid var(--w-bd)"><input id="wa_bq" placeholder="Buscar nas mensagens carregadas…" style="width:100%;box-sizing:border-box;background:var(--w-inp);border:0;color:var(--w-tx);border-radius:10px;padding:9px 13px;font:inherit;outline:0"></div>'+
   '<div class="wa-mw"><div class="wa-m" id="wa_msgs"></div><button class="wa-fab" id="wa_fab" data-wa="fim" title="Ir para a última mensagem">⌄</button><div class="wa-drop" id="wa_drop">📎 Solte o arquivo para enviar</div></div>'+
   (own?'<div class="wa-f"><button class="wa-ab" data-wa="emoji" title="Emojis">😊</button><button class="wa-ab" data-wa="anexar" title="Enviar arquivo">📎</button><button class="wa-ab" data-wa="resp" title="Respostas rápidas (digite /)">⚡</button><input type="file" id="wa_file" multiple style="display:none"><textarea id="wa_txt" rows="1" placeholder="Digite uma mensagem" maxlength="4000" autocomplete="off"></textarea><button class="wa-send" data-wa="send" title="Enviar (Enter)">➤</button></div>':'<div class="wa-f"><span class="wa-ro">Somente leitura (conversa de outro operador)</span></div>');
  const t=$('#wa_txt');if(t&&S.drafts[key]){t.value=S.drafts[key];crescer(t)}
  dots();
 }
 etqPop(c);
 {const hs=nome(c)+'|'+tel(S.chat)+'|'+(c.nome_custom||c.contato||'')+'|'+fotoUrl(S.chatOp,S.chat).length+'|'+(adm()?S.chatOp:''),hid=$('#wa_hid');
  if(hid&&el.dataset.h!==hs){el.dataset.h=hs;hid.innerHTML=avatar(Object.assign({},c,{op:S.chatOp}),'m')+'<div class="wa-ht"><b>'+esc(nome(c))+'</b><small>'+(tel(S.chat)&&(c.nome_custom||c.contato)?esc(tel(S.chat)):'Clique para ver os dados do contato')+(adm()?' · operador '+esc(S.chatOp):'')+'</small></div>'}}
 const m=$('#wa_msgs');if(primeira)m.dataset.day='';
 const fim=primeira||m.scrollTop+m.clientHeight>=m.scrollHeight-80;let ins=0;
 for(const x of S.msgs){
  const k=kmsg(x),b=m.querySelector('[data-id="'+esc(x.id)+'"]');
  if(!b){const d=dia(x.ts);if(d!==m.dataset.day){m.dataset.day=d;m.insertAdjacentHTML('beforeend','<div class="wa-day">'+esc(d)+'</div>')}m.insertAdjacentHTML('beforeend',bolha(x));if(x.direcao==='in'&&!primeira)ins++}
  else if(b.dataset.k!==k)b.outerHTML=bolha(x);
 }
 const ids=new Set(S.msgs.map(x=>String(x.id))),min=S.msgs.length?S.msgs[0].id:Infinity;
 m.querySelectorAll('.wa-b[data-id]').forEach(e=>{if(!ids.has(e.dataset.id)&&(+e.dataset.id>=min||!S.msgs.length))e.remove()});
 if(fim){m.scrollTop=m.scrollHeight;S.abaixo=0}else if(ins)S.abaixo+=ins;
 fabAtualizar();hidratar();
}
const icone=(m,n)=>{const z=((m||'')+(n||'')).toLowerCase();return z.includes('pdf')?'📕':/sheet|excel|\.xlsx?|\.csv|text\/csv/.test(z)?'📗':/word|\.docx?/.test(z)?'📘':/zip|rar|7z/.test(z)?'🗜️':/text|\.txt/.test(z)?'📝':'📄'};
function tag(t,d,el){
 const ds=el.dataset,m=d.mime||ds.mime||'',nome=d.nome||ds.nome||'arquivo',url=d.url;
 if(d.grande)return '<a href="'+(urlDrive(d.url)?esc(d.url):'#')+'" target="_blank" rel="noopener noreferrer">☁ Arquivo grande — abrir no Google Drive</a>';
 if(!url)return '<div class="wa-bad"><b>⚠ Arquivo vazio ou indisponível</b></div>';
 if(t==='imagem'||t==='sticker'||m.startsWith('image/'))return '<img src="'+esc(url)+'" data-wa="zoom" data-n="'+esc(nome)+'" alt="'+esc(nome)+'">';
 if(t==='audio'||m.startsWith('audio/')){
  const base=(m||'audio/ogg').split(';')[0],ok=!!document.createElement('audio').canPlayType(base+(/ogg|opus/.test(base)?'; codecs=opus':''));
  return '<div class="wa-au">'+(ok?'<button class="pl" data-wa="play" title="Reproduzir">▶</button><input type="range" class="sk" min="0" max="100" value="0" step="0.1" aria-label="Progresso"><span class="tm">'+mmss(+ds.seg)+'</span>':'<span style="flex:1">⚠ Este navegador não reproduz '+esc(base)+'. Baixe o áudio.</span>')+'<a href="'+esc(url)+'" download="'+esc(nome)+'" title="Baixar áudio">⬇</a><audio preload="metadata" src="'+esc(url)+'"></audio></div>';
 }
 if(t==='video'||m.startsWith('video/'))return '<video controls preload="metadata" src="'+esc(url)+'"></video><a href="'+esc(url)+'" download="'+esc(nome)+'">⬇ Baixar vídeo</a>';
 return '<div class="wa-doc"><span class="ic">'+icone(m,nome)+'</span><div class="nm"><b title="'+esc(nome)+'">'+esc(nome)+'</b><small>'+esc([tam(+ds.tam),ds.ts?hm(+ds.ts):''].filter(Boolean).join(' · '))+'</small></div>'+(/pdf/i.test(m+nome)?'<button data-wa="pdf" data-u="'+esc(url)+'" title="Visualizar">👁</button>':'')+'<a href="'+esc(url)+'" download="'+esc(nome)+'" title="Baixar">⬇</a></div>';
}
function ligarAudio(root){
 root.querySelectorAll('.wa-au:not([data-l])').forEach(w=>{w.dataset.l=1;const a=w.querySelector('audio'),pl=w.querySelector('.pl'),sk=w.querySelector('.sk'),tm=w.querySelector('.tm');if(!a||!pl)return;
  pl.onclick=()=>{if(a.paused){document.querySelectorAll('.wa-au audio').forEach(o=>{if(o!==a)o.pause()});a.play().catch(()=>toast('Não foi possível reproduzir este áudio',true))}else a.pause()};
  a.onplay=()=>{pl.textContent='⏸'};a.onpause=a.onended=()=>{pl.textContent='▶'};
  a.onloadedmetadata=()=>{if(isFinite(a.duration))tm.textContent=mmss(a.duration)};
  a.ontimeupdate=()=>{if(a.duration)sk.value=a.currentTime/a.duration*100;tm.textContent=mmss(a.currentTime)};
  sk.oninput=()=>{if(a.duration)a.currentTime=sk.value/100*a.duration};
  a.onerror=()=>{tm.textContent='erro'}});
}
const PARTE_CACHE=2400000;
async function obterMidia(x,op){
 const key=String(x.id);let d=S.media[key];if(d)return d;
 const pedido=off=>x.hist?{ref:x.ref,mid:x.mid,op,mime:x.midia_mime||'',nome:x.midia_nome||''}:{id:+x.id,op,off};
 const bytes=[],add=b=>{if(b){const bin=atob(b),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);bytes.push(u)}};
 let r=await api('wa_midia',pedido(0));const base=r;add(r.b64);
 while(r.parcial){r=await api('wa_midia',pedido((r.off||0)+PARTE_CACHE));add(r.b64)}
 d=Object.assign({},base,{b64:''});
 if(bytes.length)d.url=URL.createObjectURL(new Blob(bytes,{type:base.mime||'application/octet-stream'}));
 return S.media[key]=d;
}
async function hidratar(){
 if(S.hid)return;S.hid=true;
 try{
  for(const el of document.querySelectorAll('#wa_msgs [data-mid]:not([data-ok])')){
   try{const x=el.dataset.ref?{id:el.dataset.mid,hist:true,ref:el.dataset.ref,mid:el.dataset.drive,midia_mime:el.dataset.mime,midia_nome:el.dataset.nome}:{id:el.dataset.mid};
    const d=await obterMidia(x,S.chatOp);if(!el.isConnected)continue;el.dataset.ok=1;el.innerHTML=tag(el.dataset.tp,d,el);ligarAudio(el);
   }catch(e){el.dataset.ok=1;el.innerHTML='<div class="wa-bad"><b>⚠ '+esc(e.message||'Falha ao carregar a mídia')+'</b></div>'}
  }
 }finally{S.hid=false}
}

async function carregar(){
 if(!$('#wa_root')){clearTimeout(S.t);S.t=null;S.pop=false;pop();return}
 try{
  const a=await api('wa_sessoes',{op:S.op,alvo:S.pop?S.popOp:''});S.sess=a.sessoes;S.srv=a.servico;ses();pop();
  const dt=v=>v?new Date(v+'T00:00:00').getTime():0;
  const c=await api('wa_conversas',{op:S.op,q:S.busca,de:dt(S.de),ate:S.ate?dt(S.ate)+864e5-1:0,arq:S.aba==='arq'});S.conv=c.conversas;S.arqN=c.arq_n||0;S.etq=c.etq||[];
  if(S.novo&&S.conv.some(x=>x.chat===S.novo.chat&&x.op===S.novo.op))S.novo=null;
  lista();carregarFotos();aplicarAbrir(true);notificar();
  if(S.chat){const m=await api('wa_msgs',{op:S.chatOp,chat:S.chat});S.msgs=m.msgs;const kk=S.chatOp+'|'+S.chat;if(S.oldKey!==kk){S.oldKey=kk;S.moreDb=m.mais;S.moreHist=undefined}chat();if(S.chatOp===me.login&&S.conv.find(x=>x.chat===S.chat&&x.op===S.chatOp&&x.nao_lidas))api('wa_read',{chat:S.chat})}
 }catch(e){if(window.toast)toast(e.message||'Erro no WhatsApp',true)}
}
function selecionar(chat,op){
 guardarRascunho();
 if(S.novo&&S.novo.chat!==chat)S.novo=null;
 S.chat=chat;S.chatOp=op;S.msgs=[];S.etqPop=false;fecharResp();
 const w=$('#wa_chat');if(w)w.dataset.k='';const bx=$('#wa_box');if(bx)bx.classList.add('chat');lista();
}
function fechar(){guardarRascunho();S.novo=null;S.chat=null;S.etqPop=false;fecharResp();$('#wa_box').classList.remove('chat');const c=$('#wa_chat');c.dataset.k='';c.innerHTML=vazio();dots();const l=$('#wa_list');if(l)l.dataset.sig='';lista()}
function canonBR(num){
 let u=String(num||'').replace(/\D/g,'');
 if((u.length===11&&u[2]==='9')||(u.length===10&&'6789'.includes(u[2])))u='55'+u;
 if(!u.startsWith('55'))return u;
 const ddd=Number(u.slice(2,4));
 if(u.length===13&&u[4]==='9'&&ddd>=31)return u.slice(0,4)+u.slice(5);
 if(u.length===12&&'6789'.includes(u[4])&&ddd<31)return u.slice(0,4)+'9'+u.slice(4);
 return u;
}
async function abrirNumero(){
 const i=$('#wa_nn');let d=String(i.value||'').replace(/\D/g,'');
 if(d.length<10||d.length>15)return toast('Informe o número com DDD (ex.: 41 99999-9999)',true);
 d=canonBR(d.length<=11?'55'+d:d);
 if(S.checando)return;S.checando=true;
 const btn=document.querySelector('[data-wa="abrir"]');if(btn)btn.disabled=true;
 toast('Verificando se o número tem WhatsApp…');
 try{
  const c=await api('wa_checar',{numero:d});
  let res=null;
  for(let t=0;t<20&&!res;t++){
   await new Promise(ok=>setTimeout(ok,1000));
   const r=await api('wa_checar_res',{id:c.id});
   if(r.status==='ok'||r.status==='erro')res=r;
  }
  if(res&&res.status==='ok'&&res.existe===false)return toast('❌ Este número NÃO tem WhatsApp: '+d,true);
  if(res&&res.status==='ok'&&res.existe){d=res.numero||d;toast('✅ Este número tem WhatsApp')}
  else if(!confirm('Não foi possível confirmar se o número tem WhatsApp'+(res&&res.erro?' ('+res.erro+')':'')+'. Abrir a conversa mesmo assim?'))return;
  const chatId=d+'@s.whatsapp.net';
  S.aba='ativas';
  if(!S.conv.some(x=>x.chat===chatId))S.novo={chat:chatId,op:me.login,contato:'',ts:Date.now(),ultima:'',ultimo_tipo:'',nao_lidas:0,etiquetas:[],arquivada:false,novo:true};
  selecionar(chatId,me.login);i.value='';$('#wa_novo').style.display='none';carregar();
  setTimeout(()=>{const t=$('#wa_txt');if(t)t.focus()},50);
 }catch(e){toast(e.message||'Erro ao verificar o número',true)}
 finally{S.checando=false;if(btn)btn.disabled=false}
}
function abrir(chat){
 if(!chat||chat==='teste')return;
 S.abrirDepois=chat;
 if(emWA())aplicarAbrir(false);else if(typeof go==='function')go('wa');
}
function aplicarAbrir(dentro){
 const ch=S.abrirDepois;if(!ch||!emWA())return;S.abrirDepois='';
 S.aba='ativas';selecionar(ch,me.login);if(!dentro)carregar();
}
function layout(on){
 const l=document.querySelector('.lay');if(!l)return;
 l.classList.toggle('wa-full',!!on);if(!on)l.classList.remove('wa-focus');
}
function telaCheia(){
 const solo=!!window.WA_SOLO,l=document.querySelector('.lay');
 if(solo){try{if(!document.fullscreenElement&&document.documentElement.requestFullscreen)document.documentElement.requestFullscreen().catch(()=>{});else if(document.fullscreenElement)document.exitFullscreen().catch(()=>{})}catch(e){}return}
 if(!l)return;
 const f=!l.classList.contains('wa-focus');l.classList.toggle('wa-focus',f);
 try{if(f&&document.documentElement.requestFullscreen&&!document.fullscreenElement)document.documentElement.requestFullscreen().catch(()=>{});else if(!f&&document.fullscreenElement)document.exitFullscreen().catch(()=>{})}catch(e){}
}
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&!window.WA_SOLO){const l=document.querySelector('.lay');if(l)l.classList.remove('wa-focus')}});

function init(){
 const r=$('#wa_root');if(!r)return;
 layout(true);
 S.popOp='';S.chat=null;S.msgs=[];S.qrTxt='';S.novo=null;S.aba='ativas';S.fEtq='';S.etqPop=false;sesSig='';
 r.addEventListener('input',e=>{
  if(e.target.id==='wa_q'){S.busca=e.target.value;clearTimeout(S.dq);S.dq=setTimeout(carregar,300)}
  if(e.target.id==='wa_bq')filtrarMsgs(e.target.value);
  if(e.target.id==='wa_txt'){crescer(e.target);const v=e.target.value;if(/^\/[^\n]*$/.test(v))abrirResp(v.slice(1));else fecharResp()}});
 r.addEventListener('change',async e=>{
  if(e.target.id==='wa_file'&&e.target.files.length){prepararEnvio(e.target.files);e.target.value='';return}
  if(e.target.id==='wa_op'){S.op=e.target.value;carregar()}if(e.target.id==='wa_de'){S.de=e.target.value;carregar()}if(e.target.id==='wa_ate'){S.ate=e.target.value;carregar()}
  if(e.target.dataset&&e.target.dataset.etq!==undefined){const n=[...document.querySelectorAll('#wa_etqp [data-etq]:checked')].map(x=>x.dataset.etq);
   try{await api('wa_chat_etq',{chat:S.chat,etiquetas:n});carregar()}catch(x){toast(x.message,true)}}});
 r.addEventListener('scroll',e=>{if(e.target&&e.target.id==='wa_msgs'){fabAtualizar();if(e.target.scrollTop<80)antigas()}},true);
 r.addEventListener('contextmenu',e=>{const c=e.target.closest('.wa-c[data-chat]');if(c&&c.dataset.op===me.login){e.preventDefault();menuConversa(c.dataset.chat,e.clientX,e.clientY)}});
 r.addEventListener('paste',e=>{if(e.target.id==='wa_txt'&&e.clipboardData&&e.clipboardData.files&&e.clipboardData.files.length){e.preventDefault();prepararEnvio(e.clipboardData.files)}});
 const arrasta=e=>S.chat&&S.chatOp===me.login&&e.dataTransfer&&[...(e.dataTransfer.types||[])].includes('Files');
 r.addEventListener('dragover',e=>{if(!arrasta(e))return;e.preventDefault();const d=$('#wa_drop');if(d)d.classList.add('on')});
 r.addEventListener('dragleave',e=>{if(e.target.id==='wa_drop'||!r.contains(e.relatedTarget)){const d=$('#wa_drop');if(d)d.classList.remove('on')}});
 r.addEventListener('drop',e=>{const d=$('#wa_drop');if(d)d.classList.remove('on');if(!arrasta(e))return;e.preventDefault();if(e.dataTransfer.files.length)prepararEnvio(e.dataTransfer.files)});
 r.addEventListener('keydown',e=>{
  const rp=$('#wa_rp');
  if(e.target.id==='wa_txt'&&rp){
   const its=[...rp.querySelectorAll('.it2')],ix=its.findIndex(x=>x.classList.contains('on'));
   if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(its.length){its.forEach(x=>x.classList.remove('on'));const n=(ix+(e.key==='ArrowDown'?1:-1)+its.length)%its.length;its[n].classList.add('on');its[n].scrollIntoView({block:'nearest'})}return}
   if(e.key==='Enter'&&!e.shiftKey&&its.length){e.preventDefault();inserirResp(+its[Math.max(0,ix)].dataset.id);return}
   if(e.key==='Escape'){e.preventDefault();fecharResp();return}}
  if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&e.target.id==='wa_txt'){e.preventDefault();enviar()}
  if(e.key==='Enter'&&e.target.id==='wa_nn'){e.preventDefault();abrirNumero()}
  if(e.key==='Enter'&&e.target.id==='wa_en'){e.preventDefault();const b=document.querySelector('#wa_etqp [data-wa="etq-add"]');if(b)b.click()}
  if(e.key==='Escape'&&!rp&&!document.querySelector('.wa-mod')){if($('#wa_emo'))$('#wa_emo').remove();else if(S.chat&&e.target.id!=='wa_bq'&&innerWidth<=800)fechar()}});
 r.addEventListener('click',async e=>{
  const b=e.target.closest('[data-wa]');
  if(b){const a=b.dataset.wa;
   try{
    if(a==='back')fechar();
    else if(a==='cfg')cfgMenu(b);
    else if(a==='send')enviar();
    else if(a==='novo'){const n=$('#wa_novo');n.style.display=n.style.display==='none'?'flex':'none';if(n.style.display==='flex')$('#wa_nn').focus()}
    else if(a==='abrir')abrirNumero();
    else if(a==='aba'){S.aba=b.dataset.a;S.chat=null;fechar();carregar()}
    else if(a==='fetq'){S.fEtq=b.dataset.n;lista()}
    else if(a==='etq'){S.etqPop=!S.etqPop;const p=$('#wa_etqp');if(p)p.dataset.k='';etqPop(achar())}
    else if(a==='etq-add'){const n=($('#wa_en').value||'').trim();if(!n)return;await api('wa_etiqueta_salvar',{nome:n,cor:$('#wa_ec').value});const c=achar(),sel=[...(c.etiquetas||[]),n].filter((v,i,z)=>z.indexOf(v)===i);await api('wa_chat_etq',{chat:S.chat,etiquetas:sel});$('#wa_etqp').dataset.k='';carregar()}
    else if(a==='etq-del'){if(confirm('Apagar a etiqueta "'+b.dataset.n+'" de todas as conversas?')){await api('wa_etiqueta_del',{nome:b.dataset.n});if(S.fEtq===b.dataset.n)S.fEtq='';$('#wa_etqp').dataset.k='';carregar()}}
    else if(a==='arq'){const c=achar();await api('wa_arquivar',{chat:S.chat,arq:!c.arquivada});toast(c.arquivada?'Conversa desarquivada':'Conversa arquivada');fechar();carregar()}
    else if(a==='arq-row'){const row=b.closest('.wa-c');await api('wa_arquivar',{chat:row.dataset.chat,arq:S.aba!=='arq'});if(S.chat===row.dataset.chat)fechar();carregar()}
    else if(a==='anexar'){const f=$('#wa_file');if(f){f.value='';f.click()}}
    else if(a==='msg-menu')menuMsg(b);
    else if(a==='apg-conv'){if(confirm('Apagar esta conversa para você?\n\nAs mensagens somem só da sua tela. Se o contato escrever de novo, a conversa volta.')){await api('wa_apagar_conversa',{chat:S.chat});toast('Conversa apagada');fechar();carregar()}}
    else if(a==='zoom'){const z=document.createElement('div');z.className='wa-zoom';z.innerHTML='<img src="'+esc(b.src)+'"><a class="bt" href="'+esc(b.src)+'" download="'+esc(b.dataset.n||'imagem')+'" style="position:fixed;top:14px;right:18px;background:#8b5cf6;color:#fff;border-radius:99px;padding:8px 16px;text-decoration:none;font-weight:700">⬇ Baixar</a>';z.onclick=ev=>{if(!ev.target.closest('a'))z.remove()};document.body.appendChild(z)}
    else if(a==='info')abrirInfo(S.chat,S.chatOp);
    else if(a==='busca'){const sb=$('#wa_sb');sb.style.display=sb.style.display==='none'?'block':'none';const i=$('#wa_bq');i.value='';filtrarMsgs('');if(sb.style.display==='block')i.focus()}
    else if(a==='chat-menu'||a==='row-menu'){const row=b.closest('.wa-c'),r2=b.getBoundingClientRect();menuConversa(row?row.dataset.chat:S.chat,r2.left-150,r2.bottom+4)}
    else if(a==='pdf')verPdf(b.dataset.u);
    else if(a==='emoji')emojis();
    else if(a==='admin')painelAdmin();
    else if(a==='notif')pedirNotif();
    else if(a==='prefs')prefsMenu(b);
    else if(a==='full')telaCheia();
    else if(a==='resp'){if($('#wa_rp'))fecharResp();else abrirResp('')}
    else if(a==='resp-pick')inserirResp(+b.dataset.id);
    else if(a==='resp-man'){fecharResp();gerenciarResp()}
    else if(a==='fim'){const m=$('#wa_msgs');if(m){m.scrollTo({top:m.scrollHeight,behavior:'smooth'});S.abaixo=0}}
    else if(a==='refazer'){await api('wa_midia_refazer',{id:+b.dataset.id});toast('Baixando de novo…');carregar()}
   }catch(x){toast(x.message,true)}
   return}
  const c=e.target.closest('.wa-c[data-chat]');
  if(c){const cv=S.conv.find(x=>x.chat===c.dataset.chat&&x.op===c.dataset.op);if(cv&&cv.forcar_nao_lida&&c.dataset.op===me.login)api('wa_read',{chat:c.dataset.chat}).catch(()=>{});selecionar(c.dataset.chat,c.dataset.op);carregar()}
  else{if(S.etqPop&&!e.target.closest('#wa_etqp')){S.etqPop=false;etqPop(achar())}if($('#wa_rp')&&!e.target.closest('#wa_rp')&&e.target.id!=='wa_txt')fecharResp()}
 });
 const tick=async()=>{await carregar();if(!$('#wa_root'))return;const o=S.sess.find(x=>x.login===me.login);S.t=setTimeout(tick,o&&/^aguardando/.test(o.status)||o&&o.status==='iniciando_servico'?2000:(S.chat&&!document.hidden?3000:6000))};clearTimeout(S.t);tick();
}
function fechaMenu(){const m=$('#wa_menu');if(m)m.remove()}
function menuMsg(btn){
 fechaMenu();const id=+btn.dataset.id,x=S.msgs.find(m=>m.id===id);if(!x)return;
 const todos=x.direcao==='out'&&x.tipo!=='apagada'&&['enviada','entregue','visualizada'].includes(x.status)&&Date.now()-x.ts<2*864e5;
 const r=btn.getBoundingClientRect(),m=document.createElement('div');
 m.id='wa_menu';m.className='wa-pp wa-v';
 m.style.cssText='position:fixed;top:'+Math.min(r.bottom+4,innerHeight-120)+'px;left:'+Math.max(8,Math.min(r.right-210,innerWidth-226))+'px;width:210px;z-index:100001;right:auto;padding:6px';
 m.innerHTML='<button class="wa-mi" data-m="copiar">📋 Copiar texto</button><button class="wa-mi" data-m="mim">🗑️ Apagar para mim</button>'+(todos?'<button class="wa-mi" data-m="todos">🚫 Apagar para todos</button>':'');
 m.onclick=async e=>{const b=e.target.closest('[data-m]');if(!b)return;const modo=b.dataset.m;fechaMenu();
  if(modo==='copiar'){try{await navigator.clipboard.writeText(x.texto||'');toast('Texto copiado')}catch(_){toast('Não foi possível copiar',true)}return}
  if(!confirm(modo==='todos'?'Apagar para todos? A pessoa verá "Esta mensagem foi apagada".':'Apagar esta mensagem só para você?'))return;
  try{await api('wa_apagar',{ids:[id],modo});if(modo==='mim')S.msgs=S.msgs.filter(z=>z.id!==id);carregar()}catch(x2){toast(x2.message,true)}};
 document.body.appendChild(m);setTimeout(()=>document.addEventListener('click',fechaMenu,{once:true}),0);
}

async function enviarArquivo(f,legenda){
 const CH=2200000,partes=Math.ceil(f.size/CH)||1,up=(Date.now().toString(36)+Math.random().toString(36).slice(2,10)).replace(/[^0-9a-z]/g,'');
 toast('Enviando '+f.name+'…');
 try{
  for(let i=0;i<partes;i++){
   const buf=new Uint8Array(await f.slice(i*CH,(i+1)*CH).arrayBuffer());let bin='';
   for(let j=0;j<buf.length;j+=0x8000)bin+=String.fromCharCode.apply(null,buf.subarray(j,j+0x8000));
   await api('wa_arq_parte',{up,n:i,b64:btoa(bin)});
  }
  await api('wa_send_arq',{chat:S.chat,up,partes,nome:f.name,mime:f.type||'application/octet-stream',texto:legenda||'',cid:up});
  return true;
 }catch(x){toast(x.message||'Falha ao enviar o arquivo',true);return false}
}
function prepararEnvio(lista){
 if(!S.chat||S.chatOp!==me.login)return;
 let arr=[...lista];
 const grandes=arr.filter(f=>f.size>25*1048576);if(grandes.length){toast('"'+grandes[0].name+'" é maior que 25 MB e não será enviado',true);arr=arr.filter(f=>f.size<=25*1048576)}
 arr=arr.slice(0,10);if(!arr.length)return;
 const txt=$('#wa_txt'),urls=[],el=document.createElement('div');el.className='wa-mod wa-v';
 const prevf=f=>{const t=f.type||'';if(t.startsWith('image/')){const u=URL.createObjectURL(f);urls.push(u);return '<img src="'+esc(u)+'" alt="">'}
  if(t.startsWith('video/')){const u=URL.createObjectURL(f);urls.push(u);return '<video src="'+esc(u)+'" controls></video>'}
  return '<div class="arq"><span class="ic">'+icone(t,f.name)+'</span><div class="nm"><b>'+esc(f.name)+'</b><small>'+esc(tam(f.size))+'</small></div></div>'};
 el.innerHTML='<div class="wa-card"><h3>Enviar '+(arr.length>1?arr.length+' arquivos':'arquivo')+' para '+esc(nome(achar()))+'</h3><div class="wa-pv2">'+arr.map(prevf).join('')+'</div><label>Legenda (opcional'+(arr.length>1?', vai no primeiro arquivo':'')+')</label><textarea id="pv_leg" maxlength="1000">'+esc(txt?txt.value:'')+'</textarea><div class="row"><button class="sec" data-x="1">Cancelar</button><button data-ok="1">➤ Enviar</button></div></div>';
 const fecha=()=>{urls.forEach(u=>URL.revokeObjectURL(u));el.remove()};
 el.onclick=async e=>{
  if(e.target===el||e.target.closest('[data-x]')){fecha();return}
  if(e.target.closest('[data-ok]')){
   const leg=$('#pv_leg').value.trim(),usouTexto=txt&&leg&&leg===txt.value.trim();fecha();
   if(usouTexto){txt.value='';crescer(txt);delete S.drafts[S.chatOp+'|'+S.chat]}
   for(let i=0;i<arr.length;i++)await enviarArquivo(arr[i],i===0?leg:'');
   carregar()}};
 document.body.appendChild(el);const l=$('#pv_leg');if(l)l.focus();
}
async function enviar(){
 const i=$('#wa_txt');if(!i||!i.value.trim())return;const t=i.value;i.value='';crescer(i);fecharResp();delete S.drafts[S.chatOp+'|'+S.chat];
 try{await api('wa_send',{chat:S.chat,texto:t,cid:Date.now().toString(36)+Math.random().toString(36).slice(2,8)});carregar()}catch(x){i.value=t;crescer(i);toast(x.message,true)}
}

const aplicarVars=(t,c)=>{const n=(c.nome_custom||c.contato||'').trim(),p=n.split(/\s+/)[0]||'';
 return String(t).replace(/\{saudacao\}/gi,saud()).replace(/\{nome_completo\}/gi,n).replace(/\{nome\}/gi,p).replace(/\{operador\}/gi,String(me.nome||'').split(/\s+/)[0]||'').replace(/\s+([,.!?;:])/g,'$1').replace(/,\s*([!.?])/g,'$1')};
async function respostas(forcar){if(S.resp&&!forcar)return S.resp;try{S.resp=(await api('wa_resp_list')).respostas}catch(e){S.resp=S.resp||[]}return S.resp}
function fecharResp(){const e=$('#wa_rp');if(e)e.remove()}
async function abrirResp(filtro){
 const f=document.querySelector('#wa_chat .wa-f');if(!f||!$('#wa_txt'))return;
 const lst=await respostas();let el=$('#wa_rp');
 if(!el){el=document.createElement('div');el.className='wa-rp';el.id='wa_rp';f.appendChild(el)}
 const q=(filtro||'').toLowerCase().trim(),v=lst.filter(r=>!q||(r.titulo+' '+r.texto).toLowerCase().includes(q));
 el.innerHTML='<div class="hd"><b>⚡ Respostas rápidas</b><button class="lap" data-wa="resp-man" title="Adicionar, editar ou remover respostas">✏️</button></div><div class="lst">'+(v.map((r,i)=>'<button class="it2'+(i===0?' on':'')+'" data-wa="resp-pick" data-id="'+esc(r.id)+'"><b>⚡ '+esc(r.titulo)+'</b><span>'+esc(r.texto)+'</span></button>').join('')||'<div class="wa-vazio" style="padding:20px">'+(lst.length?'Nenhuma resposta encontrada.':'Você ainda não tem respostas rápidas.')+'</div>')+'</div><div class="ft"><span>↑↓ escolher · Enter inserir · Esc fechar</span><button data-wa="resp-man">✎ Gerenciar</button></div>';
}
function inserirResp(id){
 const r=(S.resp||[]).find(x=>x.id===id),t=$('#wa_txt');if(!r||!t)return;
 const txt=aplicarVars(r.texto,achar());
 if(/^\/[^\n]*$/.test(t.value))t.value=txt;
 else{const i=t.selectionStart??t.value.length,j=t.selectionEnd??i;t.value=t.value.slice(0,i)+txt+t.value.slice(j)}
 t.focus();t.setSelectionRange(t.value.length,t.value.length);crescer(t);fecharResp();
}
async function gerenciarResp(){
 await respostas(true);
 const el=document.createElement('div');el.className='wa-mod wa-v';let ed=0;
 const pinta=()=>{
  const l=S.resp||[],e=l.find(x=>x.id===ed);
  el.innerHTML='<div class="wa-card"><h3>⚡ Respostas rápidas</h3><p style="color:var(--w-mu);font-size:13px;margin:0 0 6px">No chat, digite <b>/</b> ou use o botão ⚡. Variáveis: <code>{nome}</code> (primeiro nome do cliente), <code>{nome_completo}</code>, <code>{saudacao}</code> (bom dia/boa tarde/boa noite) e <code>{operador}</code> (seu nome).</p>'+
   (l.map(x=>'<div class="wa-fl"><span><b>'+esc(x.titulo)+'</b> — '+esc(x.texto)+'</span><button data-ed="'+esc(x.id)+'">Editar</button><button data-del="'+esc(x.id)+'">🗑</button></div>').join('')||'<div class="wa-vazio" style="padding:16px">Nenhuma resposta ainda.<br><button class="wa-btn pri" data-ex="1" style="margin-top:10px">Adicionar exemplos</button></div>')+
   '<label>'+(e?'Editando resposta':'Nova resposta')+'</label><input id="rq_t" maxlength="40" placeholder="Título (ex.: Enviar boleto)"><label>Texto</label><textarea id="rq_x" maxlength="1000" placeholder="{saudacao}, {nome}! …"></textarea><div class="row"><button class="sec" data-x="1">Fechar</button>'+(e?'<button class="sec" data-nv="1">Cancelar edição</button>':'')+'<button data-sv="1">'+(e?'Salvar':'Adicionar')+'</button></div></div>';
  if(e){$('#rq_t',el).value=e.titulo;$('#rq_x',el).value=e.texto}};
 const EX=[['Saudação','{saudacao}, {nome}! Aqui é {operador}, da Ailos. Tudo bem?'],['Enviar boleto','{nome}, segue o boleto atualizado para pagamento. Qualquer dúvida estou à disposição.'],['Confirmar acordo','{nome}, confirmando nosso acordo conforme combinado. Vou te enviar os detalhes por aqui.'],['Pedir comprovante','{nome}, poderia me enviar o comprovante de pagamento por aqui, por favor?']];
 el.onclick=async e=>{
  if(e.target===el||e.target.closest('[data-x]')){el.remove();return}
  try{
   const d=e.target.closest('[data-del]'),ex=e.target.closest('[data-ed]');
   if(d){if(!confirm('Apagar esta resposta?'))return;await api('wa_resp_del',{id:+d.dataset.del});await respostas(true);ed=0;pinta()}
   else if(ex){ed=+ex.dataset.ed;pinta()}
   else if(e.target.closest('[data-nv]')){ed=0;pinta()}
   else if(e.target.closest('[data-ex]')){for(const [t,x] of EX)await api('wa_resp_save',{titulo:t,texto:x});await respostas(true);pinta()}
   else if(e.target.closest('[data-sv]')){await api('wa_resp_save',{id:ed,titulo:$('#rq_t',el).value,texto:$('#rq_x',el).value});await respostas(true);ed=0;pinta();toast('Resposta salva')}
  }catch(x){toast(x.message,true)}};
 pinta();document.body.appendChild(el);
}

async function antigas(){
 const m=$('#wa_msgs');if(S.loadOld||!S.chat||!m||(S.moreDb===false&&S.moreHist===false))return;
 S.loadOld=true;const ld=document.createElement('div');ld.className='wa-load wa-ld';ld.innerHTML='<i class="wa-sp2"></i>Carregando mensagens anteriores…';m.prepend(ld);
 const sh=m.scrollHeight,top=m.scrollTop;let lote=[];
 try{
  if(S.moreDb!==false){const ids=[...m.querySelectorAll('.wa-b[data-id]')].map(e=>+e.dataset.id).filter(n=>n>0);
   if(ids.length){const d=await api('wa_msgs',{op:S.chatOp,chat:S.chat,antes:Math.min(...ids)});lote=d.msgs||[];S.moreDb=d.mais}else S.moreDb=false}
  if(!lote.length&&S.moreDb===false&&S.moreHist!==false){const f=m.querySelector('.wa-b[data-ts]');const d=await api('wa_msgs_hist',{op:S.chatOp,chat:S.chat,antes_ts:f?+f.dataset.ts:0});lote=d.msgs||[];S.moreHist=d.mais}
 }catch(e){S.moreHist=false;if(!/não configurado/.test(e.message||''))toast(e.message||'Falha ao carregar o histórico',true)}
 ld.remove();
 if(lote.length){let h='',dd='';for(const x of lote){const d=dia(x.ts);if(d!==dd){dd=d;h+='<div class="wa-day">'+esc(d)+'</div>'}h+=bolha(x)}
  const pd=m.querySelector('.wa-day');if(pd&&pd.textContent===dd)pd.remove();
  m.insertAdjacentHTML('afterbegin',h);m.scrollTop=top+(m.scrollHeight-sh);hidratar()}
 S.loadOld=false;
}
function filtrarMsgs(q){q=(q||'').toLowerCase().trim();document.querySelectorAll('#wa_msgs .wa-b').forEach(e=>{e.style.display=!q||e.textContent.toLowerCase().includes(q)?'':'none'})}

function menuPop(itens,x,y){
 fechaMenu();const m=document.createElement('div');m.id='wa_menu';m.className='wa-pp wa-v';
 m.style.cssText='position:fixed;top:'+Math.max(8,Math.min(y,innerHeight-itens.length*40-16))+'px;left:'+Math.max(8,Math.min(x,innerWidth-226))+'px;width:224px;z-index:100001;right:auto;padding:6px';
 m.innerHTML=itens.map((it,i)=>'<button class="wa-mi" data-i="'+esc(i)+'">'+esc(it[0])+'</button>').join('');
 m.onclick=async e=>{const b=e.target.closest('[data-i]');if(!b)return;fechaMenu();try{await itens[+b.dataset.i][1]()}catch(x){toast(x.message,true)}};
 document.body.appendChild(m);setTimeout(()=>document.addEventListener('click',fechaMenu,{once:true}),0);
}
function menuConversa(chat,x,y){
 const op0=adm()?S.chatOp:me.login,c=todas().find(v=>v.chat===chat&&v.op===op0)||{},op=op0,own=op===me.login,it=[['👤 Dados do contato',()=>abrirInfo(chat,op)]];
 if(own){const nl=c.nao_lidas||c.forcar_nao_lida;
  it.push([c.fixada?'📌 Desafixar':'📌 Fixar no topo',async()=>{await api('wa_chat_flag',{chat,campo:'fixada',valor:!c.fixada});carregar()}],
   [c.favorito?'⭐ Remover dos favoritos':'⭐ Favoritar',async()=>{await api('wa_chat_flag',{chat,campo:'favorito',valor:!c.favorito});carregar()}],
   [nl?'✔ Marcar como lida':'● Marcar como não lida',async()=>{if(nl)await api('wa_read',{chat});else await api('wa_chat_flag',{chat,campo:'forcar_nao_lida',valor:true});carregar()}],
   [S.aba==='arq'?'📤 Desarquivar':'📦 Arquivar',async()=>{await api('wa_arquivar',{chat,arq:S.aba!=='arq'});if(S.chat===chat)fechar();carregar()}],
   ['🗑️ Apagar conversa',async()=>{if(confirm('Apagar esta conversa para você?\n\nAs mensagens somem só da sua tela; o histórico arquivado e os arquivos continuam guardados. Se o contato escrever de novo, a conversa volta.')){await api('wa_apagar_conversa',{chat});toast('Conversa apagada');if(S.chat===chat)fechar();carregar()}}]);}
 menuPop(it,x,y);
}

async function abrirInfo(chat,op){
 if(!chat)return;
 try{
  const d=await api('wa_contato_get',{chat,op}),c=d.contato,ro=adm()||op!==me.login;S.cp={chat,op,arqs:d.arquivos};
  const campo=(id,rot,v,extra)=>'<label>'+rot+'</label><input id="cp_'+id+'" value="'+esc(v||'')+'" '+(ro?'disabled':'')+' '+(extra||'')+'>';
  const cv=Object.assign({},todas().find(x=>x.chat===chat&&x.op===op)||{},{chat,op,nome_custom:c.nome_custom,contato:c.nome_wa});
  const el=document.createElement('div');el.className='wa-mod wa-v';el.id='wa_cp';
  el.innerHTML='<div class="wa-card"><div class="wa-perfil">'+avatar(cv,'g')+'<b>'+esc(nome(cv))+'</b><small>'+(c.telefone?'+'+esc(c.telefone):'')+'</small>'+(!ro&&window.waAcordo?'<button class="wa-btn pri" data-ac="1" style="margin-top:8px">📝 Registrar acordo deste cliente</button>':'')+'</div><h3>Dados do contato</h3>'+
   campo('nome','Nome de exibição (aparece em toda a interface)',c.nome_custom,'maxlength="80" placeholder="'+esc(c.nome_wa||'Nome do cliente')+'"')+
   '<label>Telefone (identificador do WhatsApp — não editável)</label><input value="+'+esc(c.telefone)+'" disabled>'+
   (c.nome_wa?'<label>Nome informado pelo WhatsApp</label><input value="'+esc(c.nome_wa)+'" disabled>':'')+
   campo('empresa','Empresa',c.empresa,'maxlength="120"')+campo('email','E-mail',c.email,'maxlength="120" type="email"')+
   campo('doc','CPF ou CNPJ (opcional)',c.doc,'maxlength="18" inputmode="numeric" placeholder="Pode ficar em branco"')+
   campo('end','Endereço',c.endereco,'maxlength="250"')+
   '<label>Observação interna (o cliente não vê)</label><textarea id="cp_obs" maxlength="2000" '+(ro?'disabled':'')+'>'+esc(c.obs||'')+'</textarea>'+
   '<label style="display:flex;gap:8px;align-items:center;text-transform:none;font-size:13px;color:var(--w-tx)"><input type="checkbox" id="cp_fav" style="width:auto" '+(c.favorito?'checked ':'')+(ro?'disabled':'')+'> ⭐ Contato favorito</label>'+
   '<label>Etiquetas</label><div>'+((c.etiquetas||[]).map(n=>'<span class="wa-tg" style="background:'+esc(cor(op,n))+'">'+esc(n)+'</span>').join('')||'<small style="color:var(--w-mu)">Nenhuma (use o botão 🏷️ da conversa)</small>')+'</div>'+
   '<label>Arquivos e documentos desta conversa ('+d.arquivos.length+')</label><div>'+(d.arquivos.map((x,i)=>'<div class="wa-fl"><span>'+icone(x.midia_mime,x.midia_nome)+' '+esc(x.midia_nome||x.tipo)+'</span><small style="color:var(--w-mu)">'+esc([tam(x.midia_tam),hm(x.ts)].filter(Boolean).join(' · '))+'</small><button data-i="'+esc(i)+'">Abrir</button></div>').join('')||'<small style="color:var(--w-mu)">Nenhum arquivo.</small>')+'</div>'+
   (ro?'<p style="color:var(--w-mu);font-size:12px">Somente leitura: apenas o operador dono do número edita contatos.'+(adm()?' O CPF/CNPJ é exibido mascarado.':'')+'</p>':'')+
   '<div class="row"><button class="sec" data-x="1">Fechar</button>'+(ro?'':'<button data-s="1">Salvar</button>')+'</div></div>';
  el.onclick=async e=>{
   if(e.target===el||e.target.closest('[data-x]')){el.remove();S.cp=null;return}
   const fb=e.target.closest('.wa-fl button');if(fb){try{await abrirArq(S.cp.arqs[+fb.dataset.i],op)}catch(x){toast(x.message,true)}return}
   if(e.target.closest('[data-ac]')){const dd=String(($('#cp_doc',el)||{}).value||'').replace(/\D/g,''),t=String(c.telefone||'').replace(/^55(?=\d{10,11}$)/,'');el.remove();S.cp=null;window.waAcordo(($('#cp_nome',el)||{}).value||c.nome_wa||'',t,dd.length===11?dd:'');return}
   if(e.target.closest('[data-s]')){
    try{await api('wa_contato_salvar',{chat,nome_custom:$('#cp_nome').value,empresa:$('#cp_empresa').value,email:$('#cp_email').value,doc:$('#cp_doc').value,endereco:$('#cp_end').value,obs:$('#cp_obs').value,favorito:$('#cp_fav').checked});
     toast('Contato salvo');el.remove();S.cp=null;carregar()}catch(x){toast(x.message,true)}}};
  document.body.appendChild(el);
 }catch(x){toast(x.message,true)}
}
async function abrirArq(x,op){
 const d=await obterMidia(x,op);
 if(d.grande){if(urlDrive(d.url))window.open(d.url,'_blank','noopener,noreferrer');return}
 const m=(d.mime||x.midia_mime||'')+(x.midia_nome||'');
 if(/pdf/i.test(m))return verPdf(d.url);
 const a=document.createElement('a');a.href=d.url;a.download=x.midia_nome||'arquivo';document.body.appendChild(a);a.click();a.remove();
}
function verPdf(url){
 const el=document.createElement('div');el.className='wa-mod wa-v';
 el.innerHTML='<div class="wa-card" style="width:min(900px,100%);height:90vh;display:flex;flex-direction:column"><div style="display:flex;gap:8px;margin-bottom:8px;align-items:center"><b style="flex:1">Visualização do PDF</b><a class="bt" href="'+esc(url)+'" download="documento.pdf" style="text-decoration:none">⬇ Baixar</a><button class="bt" data-x="1" style="background:var(--w-inp);color:var(--w-tx)">✕</button></div><iframe src="'+esc(url)+'" style="flex:1;width:100%;border:0;background:#fff;border-radius:10px" title="PDF"></iframe></div>';
 el.onclick=e=>{if(e.target===el||e.target.closest('[data-x]'))el.remove()};document.body.appendChild(el);
}

const EMO=[['😀','sorriso feliz alegre'],['😃','feliz'],['😄','rir'],['😁','sorrir'],['😅','suor alivio'],['😂','rir chorando haha'],['🤣','gargalhada'],['🙂','sorriso'],['😉','piscar'],['😊','corado feliz'],['😍','apaixonado amor'],['😘','beijo'],['😎','oculos legal'],['🤔','pensando duvida'],['😐','neutro'],['😴','sono'],['😢','triste chorar'],['😭','chorando'],['😡','raiva bravo'],['😱','susto'],['🙏','obrigado por favor rezar'],['👍','joia ok positivo'],['👎','negativo'],['👏','palmas parabens'],['🙌','celebrar'],['🤝','acordo aperto de mao'],['💪','forca'],['👋','ola tchau'],['✅','certo confirmado pago'],['❌','erro cancelado'],['⚠️','atencao aviso'],['❗','importante'],['❓','duvida pergunta'],['⏰','horario relogio'],['📅','data calendario'],['📞','telefone ligar'],['📱','celular'],['💬','mensagem conversa'],['📧','email'],['📎','anexo'],['📄','documento'],['📷','foto camera'],['💰','dinheiro pagamento'],['💳','cartao'],['💵','valor reais'],['🏦','banco cooperativa'],['🧾','recibo boleto'],['📝','anotacao'],['📌','fixar'],['🔔','notificacao'],['🔒','seguro'],['🎉','festa parabens'],['🎁','presente'],['❤️','coracao amor'],['💚','verde coracao'],['⭐','estrela favorito'],['🔥','fogo'],['☀️','sol dia'],['🌙','noite'],['🚀','rapido foguete'],['🏠','casa'],['🚗','carro'],['☕','cafe'],['🍕','pizza'],['🎂','bolo aniversario'],['👩','mulher'],['👨','homem'],['🤷','nao sei'],['🙄','revirar olhos'],['😬','constrangido'],['🤗','abraco'],['😇','anjo'],['🥳','comemorar'],['😜','brincadeira'],['🤞','torcer sorte'],['✌️','paz'],['👌','perfeito'],['👀','olhar ver'],['💡','ideia'],['📊','grafico relatorio'],['🔗','link'],['⏳','aguardando espera'],['✔️','check'],['➡️','seta'],['📍','local endereco'],['🕐','hora']];
function recentes(){try{return JSON.parse(localStorage.getItem('wa_emo_rec')||'[]')}catch(e){return[]}}
function emojis(){
 const f=document.querySelector('#wa_chat .wa-f');if(!f)return;const ja=$('#wa_emo');if(ja){ja.remove();return}
 const el=document.createElement('div');el.className='wa-emo';el.id='wa_emo';
 const pinta=q=>{q=(q||'').toLowerCase().trim();const rec=recentes().map(e=>[e,'']);const lista=q?EMO.filter(x=>x[1].includes(q)||x[0]===q):[...rec,...EMO.filter(x=>!rec.some(r=>r[0]===x[0]))];
  el.querySelector('.g').innerHTML=lista.map(x=>'<button type="button" data-e="'+esc(x[0])+'" title="'+esc(x[1])+'">'+x[0]+'</button>').join('')||'<small style="color:#8696a0;grid-column:1/-1">Nada encontrado.</small>'};
 el.innerHTML='<input placeholder="Buscar emoji (ex.: feliz, dinheiro)"><div class="g"></div>';f.appendChild(el);pinta('');
 el.querySelector('input').oninput=e=>pinta(e.target.value);
 el.onmousedown=e=>{if(e.target.closest('[data-e]'))e.preventDefault()};
 el.onclick=e=>{const b=e.target.closest('[data-e]');if(!b)return;const t=$('#wa_txt');if(!t)return;const em=b.dataset.e,i=t.selectionStart??t.value.length,j=t.selectionEnd??i;
  if((t.value.length-(j-i)+em.length)>t.maxLength&&t.maxLength>0)return;
  t.value=t.value.slice(0,i)+em+t.value.slice(j);const pos=i+em.length;t.focus();t.setSelectionRange(pos,pos);
  try{localStorage.setItem('wa_emo_rec',JSON.stringify([em,...recentes().filter(x=>x!==em)].slice(0,16)))}catch(x){}};
 setTimeout(()=>document.addEventListener('click',function h(e){if(!e.target.closest('#wa_emo')&&!e.target.closest('[data-wa="emoji"]')){const x=$('#wa_emo');if(x)x.remove();document.removeEventListener('click',h)}}),0);
}

const ROTULO={imagem:'📷 Enviou uma foto',video:'🎥 Enviou um vídeo',audio:'🎤 Enviou um áudio',documento:'📄 Enviou um documento',sticker:'🏷️ Enviou uma figurinha',localizacao:'📍 Enviou uma localização',contato:'👤 Compartilhou um contato'};
const corpoAviso=(c,p)=>(ROTULO[c.ultimo_tipo]||(p.previa&&c.ultima?String(c.ultima).slice(0,90):'Enviou uma mensagem'))+(c.n>1?' · '+c.n+' mensagens':'');
function somAviso(){
 try{const A=window.AudioContext||window.webkitAudioContext;if(!A)return;const ctx=S.ac||(S.ac=new A());if(ctx.state==='suspended')ctx.resume();
  const t=ctx.currentTime;[[880,0],[1175,.14]].forEach(([f,d])=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=f;o.connect(g);g.connect(ctx.destination);g.gain.setValueAtTime(0,t+d);g.gain.linearRampToValueAtTime(.12,t+d+.02);g.gain.exponentialRampToValueAtTime(.0001,t+d+.35);o.start(t+d);o.stop(t+d+.4)})}catch(e){}
}
function cartao(c,p){
 let box=$('#wa_nts');if(!box){box=document.createElement('div');box.id='wa_nts';box.className='wa-nts wa-v';document.body.appendChild(box)}
 [...box.children].forEach(x=>{if(x.dataset.chat===c.chat)x.remove()});
 const el=document.createElement('div');el.className='wa-nt';el.dataset.chat=c.chat;
 el.innerHTML=avatar(Object.assign({},c,{op:me.login}),'m')+'<div class="nt-x"><div class="nt-t"><b>'+esc(nome(c))+'</b><small>agora</small></div><p>'+esc(corpoAviso(c,p))+'</p></div><button class="nt-cl" title="Fechar">✕</button><span class="nt-bar"></span>';
 el.onclick=e=>{if(e.target.closest('.nt-cl')){el.remove();return}el.remove();abrir(c.chat)};
 box.prepend(el);while(box.children.length>3)box.lastChild.remove();
 setTimeout(()=>el.remove(),8200);
}
async function avisar(lista,teste){
 const p=pref();if(p.som)somAviso();
 if(!teste){try{await carregarFotos(lista)}catch(e){}}
 if(!document.hidden||teste)lista.slice(0,3).forEach(c=>cartao(c,p));
 const fora=document.hidden||!document.hasFocus();
 if('Notification' in window&&Notification.permission==='granted'&&(fora||teste)){
  try{
   if(lista.length===1){const c=lista[0],n=new Notification(nome(c),{body:corpoAviso(c,p),icon:fotoUrl(me.login,c.chat)||'/favicon.png',badge:'/favicon.png',tag:'wa-'+c.chat,renotify:true,silent:true});n.onclick=()=>{window.focus();abrir(c.chat);n.close()}}
   else{const tot=lista.reduce((s,c)=>s+(c.n||1),0),n=new Notification('Novas mensagens no WhatsApp',{body:tot+' mensagens em '+lista.length+' conversas: '+lista.slice(0,3).map(nome).join(', ')+(lista.length>3?'…':''),icon:'/favicon.png',badge:'/favicon.png',tag:'wa-varias',renotify:true,silent:true});n.onclick=()=>{window.focus();abrir(lista[0].chat);n.close()}}
  }catch(e){}
 }
}
function pedirNotif(){
 if(!('Notification' in window))return toast('Este navegador não suporta notificações',true);
 Notification.requestPermission().then(p=>{toast(p==='granted'?'Notificações ativadas':'Notificações bloqueadas no navegador',p!=='granted');notificar();if(p==='granted')avisar([{chat:'teste',n:1,ultimo_tipo:'texto',ultima:'Pronto! Você será avisado quando chegar mensagem.',nome_custom:'Notificações ativadas'}],true)})
}
function notificar(){
 if(adm())return;const b=$('#wa_notif');if(b)b.style.display=('Notification' in window&&Notification.permission==='default')?'':'none';
}
function badge(msgs,conv){
 if(!S.titulo)S.titulo=document.title.replace(/^\(\d+\+?\) /,'');
 document.title=(msgs?'('+(msgs>99?'99+':msgs)+') ':'')+S.titulo;
 document.querySelectorAll('.it[data-t="wa"]').forEach(b=>{let n=b.querySelector('.wa-nb');if(!conv){if(n)n.remove();return}if(!n){n=document.createElement('span');n.className='wa-nb';b.appendChild(n)}n.textContent=conv>99?'99+':conv});
}
async function checarNovas(){
 const d=await api('wa_novas');
 if(S.vistoLogin!==me.login){S.vistoLogin=me.login;S.visto=null}
 const base=S.visto===null;if(base)S.visto={};
 const novas=[];
 for(const c of d.conversas){const ant=S.visto[c.chat];
  if(!base&&(ant===undefined||c.ultimo_id>ant)&&!(emWA()&&S.chat===c.chat&&!document.hidden))novas.push(c);
  S.visto[c.chat]=c.ultimo_id}
 badge(d.conversas.reduce((s,c)=>s+c.n,0),d.total);
 if(novas.length)await avisar(novas);
}
function watch(){
 if(S.w)return;S.w=true;
 const tick=async()=>{
  if(typeof me==='undefined'||!me||me.role!=='op'){S.w=false;S.visto=null;badge(0,0);return}
  try{await checarNovas()}catch(e){}
  S.wt=setTimeout(tick,document.hidden?15000:7000)};
 tick();
}
function prefsMenu(btn){
 fechaMenu();const p=pref(),r=btn.getBoundingClientRect(),m=document.createElement('div');m.id='wa_menu';m.className='wa-pp wa-v';
 const perm='Notification' in window?Notification.permission:'unsupported';
 m.style.cssText='position:fixed;top:'+(r.bottom+6)+'px;left:'+Math.max(8,Math.min(r.left,innerWidth-304))+'px;width:296px;z-index:100001;right:auto;padding:8px';
 m.innerHTML='<label class="wa-sw"><input type="checkbox" data-p="som" '+(p.som?'checked':'')+'><span>Som ao chegar mensagem</span></label>'+
  '<label class="wa-sw"><input type="checkbox" data-p="previa" '+(p.previa?'checked':'')+'><span>Mostrar o texto da mensagem nas notificações<small>Desligado: aparece só o nome do cliente e o tipo da mensagem (mais privado).</small></span></label>'+
  '<div class="wa-sw" style="cursor:default"><span>Avisos do navegador: <b>'+(perm==='granted'?'ativados':perm==='denied'?'bloqueados no navegador':perm==='default'?'desativados':'indisponíveis')+'</b></span></div>'+
  (perm==='default'?'<button class="wa-mi" data-k="notif">🔔 Ativar avisos do navegador</button>':'')+'<button class="wa-mi" data-k="teste">🔊 Testar notificação</button>';
 m.onclick=e=>{e.stopPropagation();const k=e.target.closest('[data-k]');if(!k)return;fechaMenu();if(k.dataset.k==='notif')pedirNotif();else avisar([{chat:'teste',n:1,ultimo_tipo:'texto',ultima:'Esta é uma notificação de teste.',nome_custom:'Notificação de teste'}],true)};
 m.onchange=e=>{const k=e.target.dataset.p;if(k)setPref({[k]:e.target.checked})};
 document.body.appendChild(m);setTimeout(()=>document.addEventListener('click',fechaMenu,{once:true}),0);
}

async function painelAdmin(){
 try{
  const [a,e]=await Promise.all([api('wa_arquivo_status'),api('wa_erros')]),dt=v=>v?new Date(v).toLocaleString('pt-BR'):'nunca';
  const el=document.createElement('div');el.className='wa-mod wa-v';
  el.innerHTML='<div class="wa-card" style="width:min(720px,100%)"><h3>Arquivamento e erros</h3>'+
   '<div class="wa-fl"><span>Uso do banco (Neon)</span><b>'+a.banco_mb+' MB de ~'+a.limite_mb+' MB</b></div>'+
   '<div class="wa-fl"><span>Mensagens recentes no banco</span><b>'+a.recentes+'</b></div>'+
   '<div class="wa-fl"><span>Aguardando arquivamento (mais de 7 dias)</span><b>'+a.aguardando+'</b></div>'+
   '<div class="wa-fl"><span>Arquivadas no Google Sheets'+(a.sheets_erro?' (Sheets indisponível: '+esc(a.sheets_erro)+')':'')+'</span><b>'+(a.sheets?a.sheets.mensagens:'—')+'</b></div>'+
   '<div class="wa-fl"><span>Arquivos indexados no Sheets</span><b>'+(a.sheets?a.sheets.arquivos:'—')+'</b></div>'+
   '<div class="wa-fl"><span>Mídias com erro de download</span><b>'+a.erros_midia+'</b></div>'+
   '<div class="wa-fl"><span>Última execução / último sucesso</span><b>'+dt(a.estado&&a.estado.ultima_exec)+' / '+dt(a.estado&&a.estado.ultimo_ok)+'</b></div>'+
   (a.estado&&a.estado.ultimo_erro?'<div class="wa-fl" style="color:var(--w-bad)"><span>Último erro</span><b>'+esc(a.estado.ultimo_erro)+'</b></div>':'')+
   '<h3 style="margin-top:16px">Erros em aberto ('+a.erros_abertos+')</h3>'+
   (e.erros.filter(x=>!x.resolvido).map(x=>'<div class="wa-fl"><span>'+esc(hm(x.ts))+' · '+esc(x.origem)+' · '+esc(x.detalhe||'')+'</span><button data-r="'+esc(x.id)+'">Resolver</button></div>').join('')||'<small style="color:var(--w-mu)">Nenhum erro em aberto.</small>')+
   '<div class="row"><button class="sec" data-a="1">⟳ Arquivar agora</button><button class="sec" data-x="1">Fechar</button></div></div>';
  el.onclick=async ev=>{
   if(ev.target===el||ev.target.closest('[data-x]')){el.remove();return}
   const r=ev.target.closest('[data-r]');if(r){try{await api('wa_erro_resolver',{id:+r.dataset.r});r.closest('.wa-fl').remove()}catch(x){toast(x.message,true)}return}
   if(ev.target.closest('[data-a]')){try{await api('wa_arquivo_forcar');toast('Pedido enviado: o serviço arquiva em até 5 minutos')}catch(x){toast(x.message,true)}}};
  document.body.appendChild(el);
 }catch(x){toast(x.message,true)}
}
window.WA={html,init,abrir,watch,layout};
})();
