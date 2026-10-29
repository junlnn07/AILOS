
(() => {
  'use strict';
  const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } };
  const REDIR = location.origin + location.pathname.replace(/index\.html$/, '').replace(/\/?$/, '/');
  const SCOPES = 'streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state';
  const RESERVADOS = ['nome', 'som', 'mais', 'menos', 'pausa', 'spotify'];
  let player = null, pronto = null, painel = null, painelTimer = null;


  function parse(txt) {
    const m = String(txt || '').trim().replace(/^\/+/, '').trim();
    const [w = '', ...resto] = m.split(/\s+/);
    const cmd = w.toLowerCase(), arg = resto.join(' ').trim();
    if (RESERVADOS.includes(cmd)) return { cmd, arg, busca: cmd === 'nome' ? arg : '' };
    return { cmd: 'nome', arg: m, busca: m }; 
  }

 
  function toast(msg) {
    let t = document.getElementById('spk_t');
    if (!t) {
      t = document.createElement('div'); t.id = 'spk_t';
      t.style.cssText = 'position:fixed;left:12px;bottom:10px;z-index:99999;max-width:60vw;font:11px/1.4 system-ui,sans-serif;color:#cfc3ea;background:rgba(20,10,38,.85);border:1px solid rgba(168,85,247,.35);padding:5px 9px;border-radius:8px;opacity:.85;pointer-events:none;transition:opacity .3s';
      document.body.append(t);
    }
    t.textContent = msg; t.style.opacity = '.85';
    clearTimeout(t._h); t._h = setTimeout(() => { t.style.opacity = '0'; }, 3000);
  }


  function pedirCid() {
    return new Promise(ok => {
      const o = document.createElement('div');
      o.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font:13px/1.45 system-ui,sans-serif';
      o.innerHTML = '<div style="background:#1c0f32;color:#f5edff;border:1px solid rgba(168,85,247,.45);border-radius:12px;padding:16px;width:min(420px,92vw)">' +
        '<b>Spotify</b><p style="margin:8px 0;color:#b8a5dc">Cole o <b>Client ID</b> do seu app (developer.spotify.com/dashboard). No app, em <i>Redirect URIs</i>, cadastre exatamente este endereço:</p>' +
        '<input id="spk_r" readonly style="width:100%;margin-bottom:8px;padding:7px;border-radius:8px;border:1px solid #5b3b8c;background:#120a24;color:#f5edff">' +
        '<input id="spk_c" placeholder="Client ID" autocomplete="off" style="width:100%;padding:7px;border-radius:8px;border:1px solid #5b3b8c;background:#120a24;color:#f5edff">' +
        '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button id="spk_n" style="padding:6px 12px;border-radius:8px;border:1px solid #5b3b8c;background:none;color:#cfc3ea;cursor:pointer">Cancelar</button><button id="spk_s" style="padding:6px 12px;border-radius:8px;border:0;background:#8b5cf6;color:#fff;cursor:pointer">Salvar</button></div></div>';
      document.body.append(o);
      const r = o.querySelector('#spk_r'), c = o.querySelector('#spk_c');
      r.value = REDIR; r.onclick = () => r.select(); c.focus();
      const fim = v => { o.remove(); ok(v); };
      o.querySelector('#spk_n').onclick = () => fim(null);
      o.querySelector('#spk_s').onclick = () => fim(c.value.trim() || null);
      c.onkeydown = e => { if (e.key === 'Enter') fim(c.value.trim() || null); if (e.key === 'Escape') fim(null); };
    });
  }


  const b64 = a => btoa(String.fromCharCode(...new Uint8Array(a))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  async function login(cid) {
    const v = b64(crypto.getRandomValues(new Uint8Array(48))), st = b64(crypto.getRandomValues(new Uint8Array(12)));
    const ch = b64(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)));
    LS('spk_v', v); LS('spk_st', st);
    location.href = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({ client_id: cid, response_type: 'code', redirect_uri: REDIR, code_challenge_method: 'S256', code_challenge: ch, state: st, scope: SCOPES });
  }
  async function pedirToken(corpo) {
    const r = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(corpo) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error_description || j.error || 'login recusado');
    return j;
  }
  const lerTok = () => { try { return JSON.parse(LS('spk_tok')); } catch (e) { return null; } };
  function guardar(j) { const a = lerTok(); LS('spk_tok', JSON.stringify({ a: j.access_token, r: j.refresh_token || (a && a.r), e: Date.now() + j.expires_in * 1000 })); }
  function sair() { LS('spk_tok', null); }
  async function token() {
    const t = lerTok(); if (!t) return null;
    if (t.e - Date.now() > 60000) return t.a;
    try { guardar(await pedirToken({ grant_type: 'refresh_token', refresh_token: t.r, client_id: LS('spk_cid') })); return lerTok().a; }
    catch (e) { sair(); return null; }
  }
  async function voltaDoLogin() {
    const p = new URLSearchParams(location.search);
    if (!p.has('state') || !(p.has('code') || p.has('error')) || p.get('state') !== LS('spk_st')) return;
    history.replaceState(null, '', location.pathname + location.hash); LS('spk_st', null);
    if (p.get('error')) return toast('Spotify: acesso negado');
    try { guardar(await pedirToken({ grant_type: 'authorization_code', code: p.get('code'), redirect_uri: REDIR, client_id: LS('spk_cid'), code_verifier: LS('spk_v') })); LS('spk_v', null); toast('Spotify conectado'); }
    catch (e) { toast('Spotify: ' + e.message); }
  }
  async function garantir() {
    let cid = LS('spk_cid');
    if (!cid) { cid = await pedirCid(); if (!cid) return false; LS('spk_cid', cid); }
    if (await token()) return true;
    toast('Abrindo o login do Spotify…'); await login(cid); return false;
  }

 
  const vol = () => { const v = parseFloat(LS('spk_vol')); return isNaN(v) ? 0.5 : Math.min(1, Math.max(0, v)); };
  const carregarSDK = () => new Promise((ok, er) => {
    if (window.Spotify) return ok();
    window.onSpotifyWebPlaybackSDKReady = ok;
    const s = document.createElement('script'); s.src = 'https://sdk.scdn.co/spotify-player.js';
    s.onerror = () => er(new Error('não carregou o player')); document.head.append(s);
  });
  function iniciarPlayer() {
    if (pronto) return pronto;
    pronto = (async () => {
      await carregarSDK();
      player = new window.Spotify.Player({ name: 'Painel', volume: vol(), getOAuthToken: async cb => { const t = await token(); if (t) cb(t); } });
      player.addListener('authentication_error', () => { sair(); pronto = null; toast('Spotify: entre de novo (use /spotify)'); });
      player.addListener('account_error', () => toast('Spotify: é preciso conta Premium'));
      player.addListener('initialization_error', e => toast('Spotify: ' + e.message));
      return await new Promise((ok, er) => {
        player.addListener('ready', ({ device_id }) => ok(device_id));
        setTimeout(() => er(new Error('o player não ficou pronto')), 15000);
        player.connect().then(s => { if (!s) er(new Error('não conectou')); });
      });
    })();
    pronto.catch(() => { pronto = null; });
    return pronto;
  }
  async function api(path, opt = {}) {
    const t = await token(); if (!t) throw new Error('faça login de novo');
    const r = await fetch('https://api.spotify.com/v1' + path, { ...opt, headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' } });
    if (r.status === 204) return null;
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error((j && j.error && j.error.message) || r.status);
    return j;
  }
  const embaralhar = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
 
  const normaliza = s => String(s || '').toLowerCase().replace(/\s*[-(\[].*$/, '').trim();

  async function montarFila(t) {
    const art = t.artists[0];
    const vistos = new Set([normaliza(t.name)]), fila = [];
    const juntar = lista => (lista || []).forEach(x => {
      if (!x || !x.uri || x.uri === t.uri) return;
      const k = normaliza(x.name);
      if (!vistos.has(k)) { vistos.add(k); fila.push(x.uri); }
    });
    try {
      const al = await api('/artists/' + art.id + '/albums?include_groups=album,single&limit=50');
      const ids = embaralhar(((al && al.items) || []).map(a => a.id)).slice(0, 6);
      const faixas = await Promise.all(ids.map(id => api('/albums/' + id + '/tracks?limit=50').catch(() => null)));
      faixas.forEach(f => juntar(f && f.items));
    } catch (e) { /* ok */ }
    if (fila.length < 10) { // plano B: busca pelo nome do artista
      const q = encodeURIComponent('artist:"' + art.name + '"');
      const rs = await Promise.all([0, 10, 20].map(o => api('/search?type=track&limit=10&offset=' + o + '&q=' + q).catch(() => null)));
      rs.forEach(r => juntar(((r && r.tracks && r.tracks.items) || []).filter(x => x.artists.some(a => a.id === art.id))));
    }
    return embaralhar(fila).slice(0, 50);
  }
  async function tocar(busca) {
    const id = await iniciarPlayer();
    try { player.activateElement(); } catch (e) { /* ok */ }
    const b = await api('/search?type=track&limit=1&q=' + encodeURIComponent(busca));
    const t = b && b.tracks && b.tracks.items[0];
    if (!t) return toast('Spotify: nada encontrado para "' + busca + '"');
    const fila = await montarFila(t).catch(() => []);
    await api('/me/player/play?device_id=' + id, { method: 'PUT', body: JSON.stringify({ uris: [t.uri].concat(fila) }) });
    try { player.setVolume(vol()); } catch (e) { /* ok */ }
    toast('▶ ' + t.name + ' — ' + t.artists.map(a => a.name).join(', '));
  }

  // ---------- painel de volume (/som) ----------
  function fecharPainel() { clearTimeout(painelTimer); if (painel) { painel.remove(); painel = null; } }
  function painelSom(input) {
    fecharPainel();
    const r = input.getBoundingClientRect();
    painel = document.createElement('div');
    painel.style.cssText = 'position:fixed;z-index:99997;left:' + Math.max(8, r.left) + 'px;top:' + (r.bottom + 6) + 'px;display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:10px;background:rgba(20,10,38,.92);border:1px solid rgba(168,85,247,.35);color:#cfc3ea;font:12px system-ui,sans-serif';
    painel.innerHTML = '<span>🔈</span><input type="range" min="0" max="100" style="width:150px;accent-color:#8b5cf6"><b style="min-width:34px;text-align:right"></b>';
    const s = painel.querySelector('input'), n = painel.querySelector('b');
    s.value = Math.round(vol() * 100); n.textContent = s.value + '%';
    const fecharEm = () => { clearTimeout(painelTimer); painelTimer = setTimeout(fecharPainel, 8000); };
    s.oninput = () => { const v = s.value / 100; LS('spk_vol', String(v)); n.textContent = s.value + '%'; try { if (player) player.setVolume(v); } catch (e) { /* ok */ } fecharEm(); };
    document.body.append(painel); fecharEm();
    if (LS('spk_tok')) iniciarPlayer().catch(() => {});
  }

 
  async function comando(txt) {
    const { cmd, busca } = parse(txt);
    if (cmd === 'spotify') { fecharPainel(); LS('spk_cid', null); sair(); return garantir(); }
    if (!(await garantir())) return;
    try {
      if (cmd === 'som') return painelSom(document.getElementById('pqb') || document.body);
      if (cmd === 'mais') { await iniciarPlayer(); return player.nextTrack(); }
      if (cmd === 'menos') { await iniciarPlayer(); return player.previousTrack(); }
      if (cmd === 'pausa') { await iniciarPlayer(); return player.togglePlay(); }
      if (!busca) return toast('Use: /nome e o nome da música');
      await tocar(busca);
    } catch (e) { toast('Spotify: ' + e.message); }
  }

  
  document.addEventListener('input', e => {
    const el = e.target; if (!el || el.id !== 'pqb') return;
    const v = el.value.trim();
    if (!v.startsWith('/')) return;
    e.stopImmediatePropagation(); 
    if (/^\/som$/i.test(v)) { if (LS('spk_cid') && LS('spk_tok')) painelSom(el); } else fecharPainel();
  }, true);
  document.addEventListener('keydown', e => {
    const el = e.target; if (!el || el.id !== 'pqb') return;
    if (e.key === 'Escape') return fecharPainel();
    if (e.key !== 'Enter') return;
    const v = el.value.trim(); if (!v.startsWith('/')) return;
    e.preventDefault(); e.stopImmediatePropagation();
    el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true }));
    comando(v);
  }, true);
  document.addEventListener('click', e => { if (painel && !painel.contains(e.target) && !(e.target && e.target.id === 'pqb')) fecharPainel(); }, true);

  window.SpotifyMini = { parse, comando };
  voltaDoLogin();
})();
