/* MyTV — monta a tela com os dados reais */
(function () {
  const B = window.MYTV_BASE || '', C = window.MYTV_CONFIG, U = window.UI, D = window.DATA, $ = U.$, esc = U.esc;
  const hasTizen = typeof tizen !== 'undefined' && tizen.application;
  const store = { get: (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  if (typeof tizen !== 'undefined' && tizen.tvinputdevice) { try { ['MediaPlayPause', 'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue'].forEach(k => tizen.tvinputdevice.registerKey(k)); } catch (e) { } }

  /* ---------- relógio, clima e tom do horário ---------- */
  let WXD = null;
  const hhmm = d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  function clock() { const t = hhmm(new Date()); $('#clock').textContent = t; $('#ssclock').textContent = t; }
  function tod() { const h = new Date().getHours(); $('#tod').style.background = h >= 6 && h < 17 ? 'rgba(255,214,170,.10)' : h >= 17 && h < 19 ? 'rgba(255,120,60,.12)' : 'rgba(16,12,48,.35)'; }
  function wx() { D.weather().then(w => { WXD = w; $('#wx').textContent = w.temp + '° ' + w.desc + ' · amanhã ' + w.amanha.max + '°/' + w.amanha.min + '°'; $('#sswx').textContent = C.local.nome + ' · ' + w.temp + '° ' + w.desc; }).catch(() => { }); }
  clock(); tod(); wx(); setInterval(clock, 10000); setInterval(tod, 600000); setInterval(wx, 1200000);

  /* ---------- trilhos (ordem e visibilidade editáveis) ---------- */
  const RAILS = [
    { id: 'apps', label: 'Continuar e seus apps', h: 290 },
    { id: 'cw', label: 'Continue assistindo', h: 300 },
    { id: 'nba', label: 'NBA hoje', h: 238 },
    { id: 'netflix', label: 'Lançamentos na Netflix', h: 338 },
    { id: 'cine', label: 'Em cartaz nos cinemas', h: 338 },
    { id: 'flow', label: 'Em alta nos streamings', h: 540, kind: 'flow' },
    { id: 'prime', label: 'Novidades no Prime Video', h: 448 },
    { id: 'max', label: 'Novidades na Max', h: 448 },
    { id: 'disney', label: 'Novidades no Disney+', h: 300 },
    { id: 'apple', label: 'Novidades na Apple TV+', h: 300 },
    { id: 'top', label: 'Bem avaliados', h: 448 },
    { id: 'yt', label: 'Em alta no YouTube', h: 300 },
    { id: 'games', label: 'Games na Steam', h: 300 }
  ];
  const R = {}; RAILS.forEach(r => R[r.id] = r);
  let railMoving = null;
  let layout = store.get('layout', null);
  function layoutFix() {
    layout = layout && layout.order ? layout : { order: [], hidden: [] };
    RAILS.forEach(r => { if (layout.order.indexOf(r.id) < 0) layout.order.push(r.id); });
    layout.order = layout.order.filter(id => R[id]);
  }
  layoutFix();
  const railsBox = $('#rails');
  const totop = el('div', 'f totop', '<div class="img"><svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>Voltar para o início</div>');
  totop._act = () => { U.setOff(0); U.setFocus($('#hero'), false); };
  RAILS.forEach(r => {
    r.lbl = el('div', 'abs lbl', esc(r.label)); railsBox.appendChild(r.lbl);
    if (r.kind === 'flow') { r.box = el('div', 'f flow'); r.box.style.height = '440px'; railsBox.appendChild(r.box); r.ctl = U.Flow(r.box, 250); }
    else { r.box = el('div', 'rail', '<div class="track"></div>'); r.box.style.height = r.h + 'px'; railsBox.appendChild(r.box); r.ctl = U.Rail(r.box); }
    r.empty = r.id !== 'apps';
    r.lbl.appendChild(el('span', 'mvr', '▲ ▼ mover trilho'));
    if (r.kind === 'flow') r.box._long = () => startRailMove(r.id);
  });
  railsBox.appendChild(totop);
  function relayout() {
    let y = 796;
    layout.order.forEach(id => {
      const r = R[id], show = layout.hidden.indexOf(id) < 0 && !r.empty;
      r.lbl.hidden = r.box.hidden = !show; if (!show) return;
      if (r.pending) { const p = r.pending; r.pending = null; setTimeout(() => r.ctl.set(p[0], p[1]), 0); }
      r.lbl.style.top = y + 'px';
      if (r.kind === 'flow') { r.box.style.top = (y + 58) + 'px'; y += 570; } else { r.box.style.top = (y - 10) + 'px'; y += r.h + 26; }
    });
    totop.style.top = (y + 10) + 'px'; y += 140;
    U.setMax(y - 1080 + 40); U.cull(); U.hydrate();
    if (U.cur && U.cur.closest('[hidden]')) U.setFocus(firstItem(), false); else U.placeRing(U.cur);
  }
  function fill(id, nodes, gap) { const r = R[id]; nodes.forEach(n => { if (!n._long) n._long = () => startRailMove(id); }); r.empty = !nodes.length; relayout(); if (nodes.length && !r.box.hidden) { r.ctl.set(nodes, gap); r.pending = null; } else r.pending = nodes.length ? [nodes, gap] : null; }
  function firstItem() {
    for (const id of layout.order) { const r = R[id]; if (r.box.hidden) continue; return r.kind === 'flow' ? r.box : r.box.querySelector('.track .f'); }
    return $('#hero');
  }
  U.nav.firstItem = firstItem;

  /* ---------- apps instalados ---------- */
  const STORE_ID = /^[A-Za-z0-9]{10}\.[A-Za-z0-9_-]+$/, NUMERIC_ID = /^\d{9,13}$/;
  const PRELOADED = ['org.tizen.netflix-app', 'org.tizen.primevideo', 'org.tizen.browser', 'com.samsung.tv.aria-video', 'org.tizen.apple.apple-music'];
  const INTERNAL = ['adplatform.ADPlayer', 'WykOS4t4F0.cmsWebApp', '25emanual3.emanual', 'd0m1lV1nt2.emanual', '2022ePop01.SmartTV', 'ZODRT12q2l.WebAccountExtension', 'ByJlgt0XeD.CastSettingsApp', 'tv6pbVMQFF.PrivacyChoices', 'w2VwCK465D.OTApp', 'J9fZJDMi1v.SecurityCenter', 'com.samsung.tv.cobalt-yt'];
  const NOISE = /service|worker|preview|promotion|plugin|launcher|test|sdk|^ep[ -]|factory|daemon|dummy|agent|e-?manual|account|adplayer|privacy|security/i;
  let ALL = [], APPS = [];
  const appKey = a => C.ordemApps.find(f => a.name.toLowerCase().indexOf(f) >= 0) || '';
  const iconUrl = p => !p ? '' : (p.charAt(0) === '/' ? 'file://' + p : p);
  function loadApps() {
    return new Promise(ok => {
      if (!hasTizen) { ok(['YouTube', 'Netflix', 'Globoplay', 'Quick', 'Ultra Player', 'Stremio', 'NBA', 'Prime Video', 'Disney+', 'Max', 'Apple TV', 'Spotify', 'Internet', 'Gaming Hub', 'SmartThings'].map((n, i) => ({ id: 'demo' + i, name: n, icon: '' }))); return; }
      tizen.application.getAppsInfo(list => {
        let me = ''; try { me = tizen.application.getCurrentApplication().appInfo.id; } catch (e) { }
        const seen = {};
        ok(list.filter(a => {
          if (!a.name || a.id === me || seen[a.id] || INTERNAL.indexOf(a.id) >= 0) return false;
          const pre = PRELOADED.indexOf(a.id) >= 0;
          if (!pre && (!a.show || (!STORE_ID.test(a.id) && !NUMERIC_ID.test(a.id)) || NOISE.test(a.name + ' ' + a.id))) return false;
          if (C.esconderApps.some(h => a.name.toLowerCase().indexOf(h) >= 0)) return false;
          return (seen[a.id] = true);
        }).map(a => ({ id: a.id, name: a.name, icon: iconUrl(a.iconPath) })));
      }, () => ok([]));
    }).then(list => {
      const rank = a => { const i = C.ordemApps.indexOf(appKey(a)); return i < 0 ? 999 : i; };
      ALL = list.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
      ALL.forEach(a => a.key = appKey(a));
      applyAppPrefs(); return APPS;
    });
  }
  let appPrefs = store.get('apps', { order: [], show: {}, size: 'm' });
  function applyAppPrefs() {
    const pos = id => { const i = appPrefs.order.indexOf(id); return i < 0 ? 9999 : i; };
    const ordered = ALL.slice().sort((a, b) => pos(a.id) - pos(b.id) || ALL.indexOf(a) - ALL.indexOf(b));
    APPS = ordered.filter(a => appPrefs.show[a.id] === undefined ? !!a.key : appPrefs.show[a.id]);
    ALL = ordered;
  }
  const findApp = frag => ALL.find(a => a.name.toLowerCase().indexOf((frag || '').toLowerCase()) >= 0);

  // ícone: primeiro uma imagem sua em img/apps/<nome>.png, depois o ícone oficial da TV, por fim o nome
  function iconImg(a, cls) {
    const box = el('div', 'img' + (cls ? ' ' + cls : ''));
    const tries = (a.key ? [B + 'img/apps/' + a.key.replace(/\s+/g, '-') + '.png'] : []).concat(a.icon ? [a.icon] : []);
    const next = () => { const src = tries.shift(); if (!src) { box.classList.add('txt'); box.innerHTML = esc(a.name); return; } const im = new Image(); im.onload = () => { box.innerHTML = ''; box.appendChild(im); }; im.onerror = next; im.src = src; };
    next(); return box;
  }

  // arte pro Continuar quando o app foi aberto direto (sem um título)
  const ART = {};
  function artFor(app) { const k = app && app.key; return (k && ART[k]) || ART._any || ''; }

  function launch(app, ctx, payload) {
    if (!app) { U.toast('Não encontrei esse app instalado na TV'); return; }
    store.set('last', { id: app.id, title: ctx && ctx.title || '', img: ctx && ctx.img || '', t: Date.now() });
    if (ctx && ctx.title && ctx.hist !== false) { const h = store.get('hist', []).filter(x => x.title !== ctx.title); h.unshift({ title: ctx.title, img: ctx.img || '', app: app.name, t: Date.now() }); store.set('hist', h.slice(0, 12)); }
    setTimeout(() => { renderApps(); renderCW(); }, 300);
    if (!hasTizen) { U.toast('Abrindo ' + app.name + (ctx && ctx.title ? ' · ' + ctx.title : '') + ' (modo navegador)'); return; }
    const plain = () => tizen.application.launch(app.id, null, () => U.toast('Não consegui abrir o ' + app.name));
    if (payload) {
      try { tizen.application.launchAppControl(new tizen.ApplicationControl('http://tizen.org/appcontrol/operation/view', null, null, null, [new tizen.ApplicationControlData('PAYLOAD', [payload])]), app.id, null, plain); } catch (e) { plain(); }
    } else plain();
  }
  const ytPayload = id => JSON.stringify({ values: 'v=' + id });

  function appTile(a, inRow) {
    const d = el('div', 'f app'); d.appendChild(iconImg(a)); d._act = () => launch(a); d.dataset.app = a.id;
    if (inRow) { d._long = () => appMenu(a, d); if (moving === a.id) { d.classList.add('moving'); d.appendChild(el('i', 'mv l', '‹')); d.appendChild(el('i', 'mv r', '›')); } }
    return d;
  }
  /* segurar OK num app: Mover / Remover, igual à tela da Samsung */
  let moving = null;
  function appMenu(a, tile) {
    const m = $('#menu'), box = m.querySelector('.mbox'); box.innerHTML = '';
    [['Mover', () => { U.closeOverlay(); moving = a.id; renderApps(); focusApp(a.id); }],
     ['Remover da fileira', () => { appPrefs.show[a.id] = false; U.closeOverlay(); saveApps(); U.toast(a.name + ' saiu da fileira. Dá pra trazer de volta pela engrenagem.'); }],
     ['Cancelar', () => U.closeOverlay()]].forEach(([l, f]) => { const b = el('div', 'f eb', esc(l)); b._act = f; box.appendChild(b); });
    const r = tile.getBoundingClientRect(), s = $('#stage').getBoundingClientRect(), S = s.width / 1920, bottom = (r.bottom - s.top) / S, need = Math.max(0, bottom + 18 + 240 - 1060);
    if (need) U.setOff(U.off + need);
    box.style.left = Math.max(40, Math.min(1500, (r.left - s.left) / S)) + 'px'; box.style.top = (bottom - need + 18) + 'px';
    U.openOverlay(m, box.firstChild);
  }
  function focusApp(id) { const t = R.apps.box.querySelector('[data-app="' + id + '"]'); if (t) U.setFocus(t, true); }
  function moveApp(d) {
    const ids = APPS.map(x => x.id), i = ids.indexOf(moving), j = i + d;
    if (i < 0 || j < 0 || j >= ids.length) return;
    ids[i] = ids[j]; ids[j] = moving;
    appPrefs.order = ids.concat(ALL.filter(x => ids.indexOf(x.id) < 0).map(x => x.id));
    store.set('apps', appPrefs); applyAppPrefs(); renderApps(); focusApp(moving);
  }
  function renderApps() {
    const last = store.get('last', null), lastApp = last && ALL.find(a => a.id === last.id), nodes = [];
    if (lastApp) {
      const c = el('div', 'f cont'), img = last.img || artFor(lastApp), box = el('div', 'img');
      if (img) box.style.backgroundImage = 'url(' + img + ')'; else box.style.background = 'linear-gradient(135deg,#2a2433,#120f17)';
      box.appendChild(el('div', 'sheen'));
      if (!last.img) { const ic = iconImg(lastApp); const im = ic.querySelector('img'); const badge = new Image(); badge.className = 'badge'; badge.onerror = () => badge.remove(); badge.src = (im && im.src) || (lastApp.key ? B + 'img/apps/' + lastApp.key.replace(/\s+/g, '-') + '.png' : lastApp.icon); if (badge.src) box.appendChild(badge); }
      c.appendChild(box); c.appendChild(el('div', 'txt', '<small>CONTINUAR · ' + esc(lastApp.name.toUpperCase()) + '</small><b>' + esc(last.title || 'Voltar pro ' + lastApp.name) + '</b>'));
      c._act = () => launch(lastApp, { title: last.title, img: last.img, hist: false }); nodes.push(c);
    }
    APPS.forEach(a => nodes.push(appTile(a, true)));
    const all = el('div', 'f app all', '<div class="img">Todos os<br>apps</div>'); all._act = openAll; nodes.push(all);
    R.apps.box.classList.remove('sz-p', 'sz-m', 'sz-g'); R.apps.box.classList.add('sz-' + (appPrefs.size || 'm'));
    fill('apps', nodes, 20);
    if (!U.cur || !document.body.contains(U.cur)) U.setFocus(firstItem(), false);
  }
  function openAll() {
    const box = $('#alist'); box.innerHTML = '';
    ALL.forEach(a => { const t = appTile(a); t.appendChild(el('div', 'an', esc(a.name))); box.appendChild(t); });
    U.openOverlay($('#all'));
  }

  /* ---------- detalhes e destino ---------- */
  function openItem(it, via) {
    Promise.all([D.providers(it), D.trailer(it), D.genres(), D.imdb(it)]).then(([prov, yt, gen, im]) => {
      const nf = prov.some(p => /netflix/i.test(p));
      const watchApp = via === 'stremio' ? findApp(C.destino.padraoFilmes) : (nf || via === 'netflix') ? findApp(C.destino.netflix) : findApp(C.destino.padraoFilmes);
      const g = (it.genres || []).map(id => gen[id]).filter(Boolean).slice(0, 2).join(' · ');
      const nota = im ? '<span class="imdb">IMDb ' + im + '</span>' : (it.vote ? '<span class="imdb">TMDB ' + it.vote + '</span>' : '');
      const btns = [];
      if (watchApp) btns.push({ label: 'Assistir no ' + watchApp.name, act: () => launch(watchApp, { title: it.title, img: it.backdropM || it.backdrop }) });
      if (yt) btns.push({ label: 'Ver trailer', act: () => launch(findApp(C.destino.trailer), { title: 'Trailer · ' + it.title, img: it.backdropM || it.backdrop, hist: false }, ytPayload(yt)) });
      btns.push({ label: 'Fechar', act: U.closeOverlay });
      U.openDetail({ img: it.backdrop, title: it.title, text: it.text, meta: (it.type === 'tv' ? 'Série' : 'Filme') + (it.year ? ' · ' + it.year : '') + (g ? ' · ' + g : '') + ' ' + nota + (prov.length ? ' · ' + esc(prov.slice(0, 3).join(', ')) : ''), buttons: btns });
    });
  }

  /* ---------- destaque ---------- */
  const hero = $('#hero'); let HS = [], hi = 0, htimer;
  function heroSet(items) {
    HS = items.slice(0, 6); const hf = $('#hframe'), bw = $('#bw'), hd = $('#hdots'); hf.innerHTML = ''; bw.innerHTML = ''; hd.innerHTML = '';
    HS.forEach(h => { const a = el('i'); a.style.backgroundImage = 'url(' + h.backdrop + ')'; hf.appendChild(a); const b = el('i'); b.style.backgroundImage = 'url(' + (h.backdropS || h.backdrop) + ')'; bw.appendChild(b); hd.appendChild(el('i')); });
    HS.forEach(h => { if (h.logoP === undefined) h.logoP = D.logo(h).then(l => (h.logo = l)); });
    if (HS[0]) ART._any = HS[0].backdropM || HS[0].backdrop;
    heroTo(0);
  }
  function heroTo(n) {
    if (!HS.length) return; hi = (n + HS.length) % HS.length; const h = HS[hi]; hero.classList.add('swap');
    [$('#hframe'), $('#bw'), $('#hdots')].forEach(b => [...b.children].forEach((c, i) => { c.classList.remove('on'); if (i === hi) { void c.offsetWidth; c.classList.add('on'); } }));
    D.genres().then(gen => setTimeout(() => {
      const g = (h.genres || []).map(id => gen[id]).filter(Boolean).slice(0, 2);
      $('#hchip').innerHTML = '<span>' + (h.chip || 'EM ALTA') + '</span><em>' + esc(h.chipText || 'Em alta no mundo esta semana') + '</em>';
      $('#hmeta').innerHTML = [h.type === 'tv' ? 'Série' : 'Filme'].concat(g, h.year ? [h.year] : []).map(t => '<span>' + esc(t) + '</span><span>·</span>').join('') + (h.vote ? '<span class="imdb">TMDB ' + h.vote + '</span>' : '');
      $('#hsyn').textContent = h.text || '';
      hero.classList.remove('swap');
    }, 350));
    const box = $('#htitlebox'); box.innerHTML = '';
    const showText = () => { const t = el('div', 'title'); t.style.fontSize = h.title.length > 18 ? '120px' : h.title.length > 11 ? '150px' : '180px'; [...h.title.toUpperCase()].forEach((c, i) => { const s = el('span'); s.textContent = c === ' ' ? ' ' : c; s.style.animationDelay = (.15 + i * .04) + 's'; t.appendChild(s); }); box.appendChild(t); };
    (h.logoP || Promise.resolve('')).then(l => { if (HS[hi] !== h) return; box.innerHTML = ''; if (l) { const im = new Image(); im.className = 'tlogo'; im.onerror = () => { box.innerHTML = ''; showText(); }; im.src = l; box.appendChild(im); } else showText(); });
    clearInterval(htimer); htimer = setInterval(() => { if (!hero.classList.contains('scrolled') && !ssOn) heroTo(hi + 1); }, 7000);
  }
  hero.slide = d => heroTo(hi + d);
  hero._act = () => { if (HS[hi]) openItem(HS[hi]); };

  /* ---------- acontecendo hoje ---------- */
  const BALL = '<svg viewBox="0 0 24 24" width="30" height="30"><circle cx="12" cy="12" r="11" fill="#fff"/><path d="M12 6.5l4 2.9-1.5 4.7h-5L8 9.4z" fill="#15131c"/><path d="M12 1v5.5M16 9.4l5.6-1.8M14.5 14.1l3.4 4.7M9.5 14.1l-3.4 4.7M8 9.4L2.4 7.6" stroke="#15131c" stroke-width="1.4"/></svg>';
  function fx(row, html, cls, ms) { const d = el('div', cls, html); row.appendChild(d); setTimeout(() => d.remove(), ms); }
  function bump(n, val) { const old = n.textContent; if (old == val) return; n.innerHTML = '<span class="roll2"><i>' + old + '</i><i>' + val + '</i></span>'; void n.offsetWidth; n.firstChild.classList.add('go'); setTimeout(() => n.textContent = val, 800); }
  function when(g) { const d = g.date, now = new Date(), tm = new Date(now); tm.setDate(now.getDate() + 1); if (d.toDateString() === now.toDateString()) return hhmm(d); if (d.toDateString() === tm.toDateString()) return 'amanhã ' + hhmm(d); return d.toLocaleDateString('pt-BR', { weekday: 'short' }) + ' ' + hhmm(d); }
  function ptDetail(g) {
    if (g.state === 'post') return 'encerrado';
    if (g.state === 'pre') return 'hoje ' + when(g);
    return (g.detail || '').replace(/Halftime|HT/i, 'intervalo').replace(/End of (\d)(st|nd|rd|th) Quarter/i, 'fim do $1º quarto').replace(/(\d)(st|nd|rd|th) Quarter/i, '$1º quarto').replace(/(\d)(st|nd|rd|th)/i, '$1º').replace(/OT/, 'prorrogação');
  }
  function gameAct(g) { const dest = g.liga.liga === 'nba' ? C.destino.nba : g.liga.liga === 'nfl' ? C.destino.nfl : C.destino.aoVivo; return () => launch(findApp(dest) || findApp(C.destino.aoVivo), { title: g.teams.map(t => t.name).join(' x '), hist: false }); }

  let shown = {};
  function renderGames(all) {
    const today = new Date().toDateString(), rank = g => g.liga.peso + (g.big ? 4 : 0);
    const day = all.filter(g => g.date.toDateString() === today || g.state === 'in');
    const live = day.filter(g => g.state === 'in').sort((a, b) => rank(b) - rank(a));
    const soon = day.filter(g => g.state === 'pre').sort((a, b) => a.date - b.date || rank(b) - rank(a));
    const done = day.filter(g => g.state === 'post').sort((a, b) => rank(b) - rank(a) || b.date - a.date);
    const pick = live.concat(soon, done).slice(0, 14);
    const box = $('#games');
    if (!pick.length) { box.innerHTML = '<div class="empty">Sem jogos das suas ligas hoje.</div>'; box.dataset.ids = ''; shown = {}; return; }
    const ids = pick.map(g => g.id).join(',');
    if (box.dataset.ids !== ids) {
      const focusId = U.cur && U.cur.closest('#games') && U.cur.dataset.id;
      box.dataset.ids = ids; box.innerHTML = '';
      pick.forEach(g => { const r = el('div', 'f game', '<div class="img"><span class="live"></span><div class="who"><b>' + esc(g.teams.map(t => t.name).join(' x ')) + '</b><small></small></div><div class="right"></div></div>'); r.dataset.id = g.id; r._act = gameAct(g); box.appendChild(r); });
      if (focusId) U.setFocus(box.querySelector('[data-id="' + focusId + '"]') || box.firstChild, true);
    }
    pick.forEach(g => {
      const r = box.querySelector('[data-id="' + g.id + '"]'); if (!r) return; const right = r.querySelector('.right'), row = r.querySelector('.img');
      r.querySelector('.live').hidden = g.state !== 'in';
      r.querySelector('small').textContent = g.liga.nome + ' · ' + ptDetail(g) + (g.tv && g.state !== 'post' ? ' · ' + g.tv : '');
      if (g.state === 'pre') { right.innerHTML = '<div class="sc time tab">' + hhmm(g.date) + '</div>'; return; }
      if (g.spoiler) { right.innerHTML = '<div class="hide">placar oculto</div>'; return; }
      const sc = g.teams.map(t => t.score == null ? '0' : String(t.score));
      let ns = right.querySelectorAll('.n');
      if (ns.length !== 2) { right.innerHTML = '<div class="sc tab"><span class="n">' + sc[0] + '</span>–<span class="n">' + sc[1] + '</span></div>'; ns = right.querySelectorAll('.n'); }
      const prev = shown[g.id];
      if (prev) sc.forEach((v, i) => {
        const diff = (+v) - (+prev[i]); if (diff <= 0) return;
        if (g.liga.esporte === 'soccer') { fx(row, BALL, 'ballrun', 1500); setTimeout(() => { bump(ns[i], v); fx(row, 'GOL', 'golbadge', 1800); row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash'); }, 650); }
        else { bump(ns[i], v); fx(row, '+' + diff, 'plus', 1300); }
      });
      shown[g.id] = sc;
    });
  }

  function renderNba(all) {
    const nba = all.filter(g => g.liga.liga === 'nba').sort((a, b) => a.date - b.date);
    fill('nba', nba.map(g => {
      const d = el('div', 'f nba'), hide = g.spoiler && g.state !== 'pre';
      const rows = g.teams.map(t => '<div class="row' + (g.state === 'post' && t.winner && !hide ? ' w' : '') + '"><span>' + (t.logo ? '<img src="' + t.logo + '" alt="">' : '') + esc(t.abbr || t.name) + '</span><span class="s tab">' + (g.state === 'pre' || hide ? '' : esc(t.score)) + '</span></div>').join('');
      const st = g.state === 'in' ? '<span class="live"></span> ' + esc(ptDetail(g)) : g.state === 'pre' ? esc(when(g)) : 'encerrado';
      d.innerHTML = '<div class="img">' + rows + '<div class="st">' + st + (hide ? ' · placar oculto' : '') + '</div></div>';
      d._act = gameAct(g); return d;
    }), 24);
  }
  function refreshGames() {
    D.allGames().then(all => { renderGames(all); renderNba(all); const live = all.some(g => g.state === 'in'); clearTimeout(refreshGames.t); refreshGames.t = setTimeout(refreshGames, live ? 30000 : 300000); })
      .catch(() => { clearTimeout(refreshGames.t); refreshGames.t = setTimeout(refreshGames, 60000); });
  }

  /* ---------- cards ---------- */
  function para(it, label, act) {
    const d = el('div', 'f para', '<div class="img" data-bg="' + (it.backdropM || it.backdrop) + '"></div><div class="cap"><small>' + esc(label) + '</small><b>' + esc(it.title) + '</b></div>'); d._act = act; return d;
  }
  function poster(it, act) {
    const d = el('div', 'f poster', '<div class="img" data-bg="' + it.poster.replace('/w500/', '/w342/') + '"></div>' + (it.vote ? '<span class="rate">' + it.vote + '</span>' : '') + '<div class="cap"><b>' + esc(it.title) + '</b></div>'); d._act = act; return d;
  }
  function wide(o) {
    const d = el('div', 'f wide', '<div class="img" data-bg="' + o.img + '"></div>' + (o.src ? '<span class="src2">' + esc(o.src) + '</span>' : '') + '<div class="cap"><small>' + esc(o.small || '') + '</small><b>' + esc(o.title) + '</b></div>' + (o.progress ? '<div class="pg"><i style="width:' + Math.round(o.progress * 100) + '%"></i></div>' : ''));
    d._act = o.act; return d;
  }

  /* ---------- continue assistindo (Stremio + o que você abriu pelo MyTV) ---------- */
  let STREMIO = [];
  function renderCW() {
    const hist = store.get('hist', []).map(h => ({ title: h.title, img: h.img, src: h.app, small: 'aberto pelo MyTV', t: h.t, act: () => launch(findApp(h.app), { title: h.title, img: h.img }) }));
    const st = STREMIO.filter(i => i.inProgress).map(i => ({ title: i.title, img: i.img, src: 'STREMIO', small: i.ep || (i.type === 'series' ? 'série' : 'filme'), progress: i.progress, t: i.last, act: () => launch(findApp('stremio'), { title: i.title, img: i.img, hist: false }) }));
    const seen = {}, list = st.concat(hist).sort((a, b) => b.t - a.t).filter(x => !seen[x.title] && (seen[x.title] = true)).slice(0, 16);
    if (st[0]) ART.stremio = st[0].img;
    fill('cw', list.map(wide), 26);
  }
  function loadStremio() { D.stremio().then(l => { STREMIO = l; renderCW(); }).catch(() => renderCW()); }

  /* ---------- filmes, séries e vitrines ---------- */
  function renderMovies() {
    if (!C.tmdbToken) { heroSet([{ id: 0, type: 'movie', title: 'MyTV', text: 'Coloque a chave do TMDB no arquivo de configuração.', backdrop: B + 'img/fallback.jpg', chip: 'CONFIGURAR', chipText: 'Falta a chave do TMDB', logoP: Promise.resolve('') }]); return; }
    D.genres().then(gen => {
      const g1 = it => (it.genres || []).map(id => gen[id]).filter(Boolean)[0] || '';
      D.trending().then(l => heroSet(l.filter(x => x.backdrop))).catch(() => { });
      D.nowPlaying().then(l => fill('cine', l.filter(x => x.backdrop).slice(0, 16).map(it => para(it, 'CINEMA' + (g1(it) ? ' · ' + g1(it).toUpperCase() : ''), () => openItem(it, 'stremio'))), 34)).catch(() => fill('cine', []));
      const P = C.provedores;
      D.provider(P.netflix, 150).then(l => { const k = l.filter(x => x.backdrop).slice(0, 18); if (k[0]) ART.netflix = k[0].backdropM; fill('netflix', k.map(it => para(it, 'NETFLIX · ' + (it.type === 'tv' ? 'SÉRIE' : 'FILME'), () => openItem(it, 'netflix'))), 34); }).catch(() => fill('netflix', []));
      D.provider(P.prime, 365).then(l => { const k = l.filter(x => x.poster).slice(0, 18); if (k[0]) ART.prime = k[0].backdropM; fill('prime', k.map(it => poster(it, () => openItem(it, 'stremio'))), 30); }).catch(() => fill('prime', []));
      D.provider(P.max, 365).then(l => { const k = l.filter(x => x.poster).slice(0, 18); if (k[0]) ART.max = k[0].backdropM; fill('max', k.map(it => poster(it, () => openItem(it, 'stremio'))), 30); }).catch(() => fill('max', []));
      D.provider(P.disney, 365).then(l => { const k = l.filter(x => x.backdrop).slice(0, 18); if (k[0]) ART.disney = k[0].backdropM; fill('disney', k.map(it => wide({ img: it.backdropM, title: it.title, small: (it.type === 'tv' ? 'série' : 'filme') + (g1(it) ? ' · ' + g1(it) : ''), act: () => openItem(it, 'stremio') })), 26); }).catch(() => fill('disney', []));
      D.provider(P.apple, 365).then(l => { const k = l.filter(x => x.backdrop).slice(0, 18); if (k[0]) ART['apple tv'] = k[0].backdropM; fill('apple', k.map(it => wide({ img: it.backdropM, title: it.title, small: (it.type === 'tv' ? 'série' : 'filme') + (g1(it) ? ' · ' + g1(it) : ''), act: () => openItem(it, 'stremio') })), 26); }).catch(() => fill('apple', []));
      D.streamingHot().then(l => {
        const items = l.filter(x => x.poster).slice(0, 14).map(it => ({ img: it.poster, title: it.title, src: it.type === 'tv' ? 'SÉRIE' : 'FILME', rate: it.vote ? 'TMDB ' + it.vote : '', act: () => openItem(it), it: it }));
        R.flow.ctl.set(items); R.flow.empty = !items.length; relayout();
        items.slice(0, 10).forEach((c, k) => D.providers(c.it).then(p => { if (p[0]) { const e = R.flow.box.querySelectorAll('.card')[k]; const s = e && e.querySelector('.src'); if (s) s.textContent = p[0].toUpperCase().slice(0, 18); } }));
      }).catch(() => { });
      D.topRated().then(l => fill('top', l.filter(x => x.poster).slice(0, 18).map(it => { const d = poster(it, () => openItem(it)); D.imdb(it).then(r => { if (r) d.querySelector('.rate').textContent = 'IMDb ' + r; }); return d; }), 30)).catch(() => fill('top', []));
    });
    D.youtube().then(l => { if (l[0]) ART.youtube = l[0].img; fill('yt', l.map(v => wide({ img: v.img, title: v.title, small: v.channel, act: () => launch(findApp('youtube'), { title: v.title, img: v.img }, ytPayload(v.id)) })), 26); }).catch(() => fill('yt', []));
    D.games().then(l => fill('games', l.slice(0, 20).map(g => wide({ img: g.img, title: g.title, src: g.tag, small: g.price, act: () => D.gameInfo(g.id).then(x => {
      const btns = [], sl = findApp('steam'); if (sl) btns.push({ label: 'Abrir o ' + sl.name, act: () => launch(sl, { title: g.title, img: g.img, hist: false }) });
      btns.push({ label: 'Fechar', act: U.closeOverlay });
      U.openDetail({ img: g.big, title: g.title, meta: [g.tag, x.date, x.genres.join(' · '), g.price, x.meta ? '<span class="imdb">Metacritic ' + x.meta + '</span>' : ''].filter(Boolean).join(' · '), text: x.text, buttons: btns });
    }) })), 26)).catch(() => fill('games', []));
  }

  /* ---------- segurar OK num card: mover o trilho pra cima/baixo ---------- */
  function startRailMove(id) { railMoving = id; R[id].lbl.classList.add('moving'); R[id].box.classList.add('moving'); U.toast('Setas pra cima e pra baixo movem o trilho. OK salva.'); }
  function stopRailMove() { const r = R[railMoving]; railMoving = null; r.lbl.classList.remove('moving'); r.box.classList.remove('moving'); U.toast('Posição salva'); }
  function moveRail(d) {
    const vis = layout.order.filter(id => !R[id].box.hidden), i = vis.indexOf(railMoving), j = i + d;
    if (i < 0 || j < 0 || j >= vis.length) return;
    const a = layout.order.indexOf(railMoving), b = layout.order.indexOf(vis[j]); layout.order[a] = vis[j]; layout.order[b] = railMoving;
    store.set('layout', layout); relayout(); if (U.cur) U.setFocus(U.cur, true); U.sfx('move');
  }

  /* ---------- modo edição (engrenagem) ---------- */
  function saveLayout() { store.set('layout', layout); relayout(); }
  function saveApps() { store.set('apps', appPrefs); applyAppPrefs(); renderApps(); }
  function openEdit(keepKey) {
    const list = $('#elist'), prevTop = list.scrollTop; list.innerHTML = '';
    const btn = (label, key, act, sel, keep) => { const b = el('div', 'f eb' + (sel ? ' sel' : ''), esc(label)); b.dataset.k = key; b._act = () => { act(); if (!keep) openEdit(key); }; return b; };
    const row = (name, off, btns, icon) => { const r = el('div', 'erow' + (off ? ' off' : '')); if (icon) r.appendChild(icon); r.appendChild(el('div', 'nm', esc(name))); btns.forEach(b => r.appendChild(b)); list.appendChild(r); };
    const mv = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; const t = arr[i]; arr[i] = arr[j]; arr[j] = t; };

    list.appendChild(el('div', 'esec', 'Trilhos da tela inicial'));
    layout.order.forEach((id, i) => {
      const r = R[id], hid = layout.hidden.indexOf(id) >= 0;
      row(r.label + (r.empty && !hid ? ' (sem conteúdo agora)' : ''), hid, [
        btn('Subir', 'up:' + id, () => { mv(layout.order, i, -1); saveLayout(); }),
        btn('Descer', 'dn:' + id, () => { mv(layout.order, i, 1); saveLayout(); }),
        btn(hid ? 'Mostrar' : 'Ocultar', 'vis:' + id, () => { if (hid) layout.hidden = layout.hidden.filter(x => x !== id); else layout.hidden.push(id); saveLayout(); })
      ]);
    });
    list.appendChild(el('div', 'esec', 'Tamanho dos apps'));
    const sz = el('div', 'erow btnrow');[['p', 'Pequeno'], ['m', 'Médio'], ['g', 'Grande']].forEach(([k, l]) => sz.appendChild(btn(l, 'sz:' + k, () => { appPrefs.size = k; saveApps(); }, (appPrefs.size || 'm') === k))); list.appendChild(sz);
    list.appendChild(el('div', 'esec', 'Apps na fileira'));
    const ids = ALL.map(a => a.id);
    ALL.forEach((a, i) => {
      const on = APPS.indexOf(a) >= 0, im = iconImg(a, 'ic');
      row(a.name, !on, [
        btn('Subir', 'aup:' + a.id, () => { appPrefs.order = ids.slice(); mv(appPrefs.order, i, -1); saveApps(); }),
        btn('Descer', 'adn:' + a.id, () => { appPrefs.order = ids.slice(); mv(appPrefs.order, i, 1); saveApps(); }),
        btn(on ? 'Ocultar' : 'Mostrar', 'avis:' + a.id, () => { appPrefs.show[a.id] = !on; saveApps(); })
      ], im);
    });
    list.appendChild(el('div', 'esec', 'Outros'));
    list.appendChild(el('div', 'hint', 'Versão ' + (window.MYTV_VERSION || '?') + ' · ' + (window.MYTV_REMOTE ? 'carregada do site' : 'cópia instalada na TV')));
    const other = el('div', 'erow btnrow');
    other.appendChild(btn('Restaurar padrão', 'reset', () => { layout = null; layoutFix(); appPrefs = { order: [], show: {}, size: 'm' }; saveLayout(); saveApps(); }));
    other.appendChild(btn(soundOn() ? 'Sons: ligados' : 'Sons: desligados', 'snd', () => store.set('sons', !soundOn()), soundOn()));
    other.appendChild(btn('Testar protetor de tela', 'ss', () => { U.closeOverlay(); setTimeout(ssStart, 400); }, false, true));
    list.appendChild(other);

    const target = keepKey && list.querySelector('[data-k="' + keepKey + '"]');
    if ($('#edit').classList.contains('open')) { list.scrollTop = prevTop; U.setFocus(target || list.querySelector('.f'), true); }
    else U.openOverlay($('#edit'), list.querySelector('.f'));
  }
  $('#gear')._act = () => openEdit();
  const soundOn = () => store.get('sons', C.sons !== false);
  U.nav.sound = soundOn;

  /* ---------- protetor de tela ---------- */
  let ssOn = false, idleT, ssT, ssI = 0, ytP = null;
  function ssImages() {
    const s = new Set(); HS.forEach(h => h.backdrop && s.add(h.backdrop));
    document.querySelectorAll('#rails .para .img, #rails .wide .img').forEach(e => { const m = /url\("?([^")]+)/.exec(e.style.backgroundImage), u = e.getAttribute('data-bg') || (m && m[1]); if (u && /tmdb/.test(u)) s.add(u.replace(/w780|w300/, 'w1280')); });
    const a = [...s]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a.length ? a : [B + 'img/fallback.jpg'];
  }
  function ssSlides() {
    const box = $('#ssimg'), imgs = ssImages(); box.innerHTML = ''; ssI = 0;
    const show = () => { const src = imgs[ssI++ % imgs.length], i = el('i'); const pre = new Image(); pre.onload = () => { i.style.backgroundImage = 'url(' + src + ')'; box.appendChild(i); void i.offsetWidth; i.classList.add('on'); const old = box.children; if (old.length > 2) old[0].remove(); else if (old.length === 2) setTimeout(() => old[0] && old[0] !== i && old[0].classList.remove('on'), 50); }; pre.src = src; };
    show(); ssT = setInterval(show, 12000);
  }
  // vídeos do YouTube: sorteia entre as playlists/mixes e os vídeos avulsos, começa num ponto aleatório
  // e pula vídeos cujo título ou canal tenha alguma palavra bloqueada
  // com um endereço de player hospedado (https), o vídeo toca por ele: o YouTube recusa tocar direto num app instalado
  function ssHosted() {
    const P = C.protetor || {}; if (!P.player || !((P.listas || []).length || (P.videos || []).length)) return false;
    const box = $('#ssvid'), f = document.createElement('iframe');
    f.allow = 'autoplay; encrypted-media'; f.setAttribute('allowfullscreen', '');
    f.src = P.player + '?l=' + encodeURIComponent((P.listas || []).join(',')) + '&v=' + encodeURIComponent((P.videos || []).join(',')) + '&b=' + encodeURIComponent((P.bloquear || []).join(','));
    f.style.opacity = 0; f.style.transition = 'opacity 1.5s';
    box.innerHTML = ''; box.appendChild(f);
    let ok = false;
    const fail = () => { if (!ssOn) return; box.innerHTML = ''; };
    ssMsg = e => { const m = String(e.data || ''); if (m.indexOf('mytv:playing:') === 0) { ok = true; f.style.opacity = 1; $('#sscap').textContent = m.slice(13); } else if (m === 'mytv:fail') fail(); };
    setTimeout(() => { if (ssOn && !ok) fail(); }, 20000);
    return true;
  }
  let ssMsg = null; window.addEventListener('message', e => { if (ssMsg) ssMsg(e); });
  function ssVideo() {
    const P = C.protetor || {}, src = (P.listas || []).map(l => ({ list: l })).concat((P.videos || []).map(v => ({ video: v })));
    if (!src.length) return false;
    const block = (P.bloquear || []).map(b => b.toLowerCase());
    const box = $('#ssvid'); box.innerHTML = '<div id="ytp"></div>';
    let tries = 0, seeked = false;
    const fail = () => { if (!ssOn) return; box.innerHTML = ''; ytP = null; if (!$('#ssimg').children.length) ssSlides(); };
    const pick = () => src[Math.floor(Math.random() * src.length)];
    const load = p => { seeked = false; const s = pick(); if (s.list) p.loadPlaylist({ list: s.list, listType: 'playlist', index: Math.floor(Math.random() * 15) }); else p.loadVideoById(s.video); try { p.setLoop(true); } catch (e) { } };
    const start = () => {
      if (!ssOn) return;
      try {
        ytP = new YT.Player('ytp', {
          width: 1920, height: 1080, playerVars: { autoplay: 1, controls: 0, modestbranding: 1, rel: 0, iv_load_policy: 3, playsinline: 1, disablekb: 1 },
          events: {
            onReady: e => { load(e.target); setTimeout(() => { try { if (ssOn && e.target.getPlayerState() !== 1) { e.target.mute(); e.target.playVideo(); } } catch (x) { } }, 4000); },
            onStateChange: e => {
              const p = e.target;
              if (e.data === 1) {
                const v = p.getVideoData() || {}, t = ((v.title || '') + ' ' + (v.author || '')).toLowerCase();
                if (block.some(b => t.indexOf(b) >= 0)) { if (++tries > 12) return fail(); try { p.nextVideo(); } catch (x) { load(p); } return; }
                if (!seeked) { seeked = true; const d = p.getDuration(); if (d > 240) p.seekTo(Math.floor(d * (.05 + Math.random() * .75)), true); }
                $('#sscap').textContent = v.title || '';
              }
              if (e.data === 0) load(p);
            },
            onError: () => { if (++tries > 6) return fail(); try { ytP.nextVideo(); } catch (x) { fail(); } }
          }
        });
      } catch (e) { fail(); }
    };
    if (window.YT && YT.Player) start(); else { window.onYouTubeIframeAPIReady = start; const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.onerror = fail; document.head.appendChild(s); }
    setTimeout(() => { try { if (ssOn && (!ytP || !ytP.getPlayerState || ytP.getPlayerState() !== 1)) fail(); } catch (x) { fail(); } }, 15000);
    return true;
  }
  /* ---------- Spotify no protetor: toca uma playlist sua no app do Spotify da TV ---------- */
  let ssMusic = false, spTok = null;
  function spReq(method, url, body, headers) {
    return new Promise((ok, fail) => {
      const x = new XMLHttpRequest(); x.open(method, url, true); x.timeout = 10000;
      Object.keys(headers || {}).forEach(k => x.setRequestHeader(k, headers[k]));
      x.onload = () => { let j = null; try { j = x.responseText ? JSON.parse(x.responseText) : null; } catch (e) { } (x.status >= 200 && x.status < 300) ? ok(j) : fail(new Error('Spotify ' + x.status + ' ' + (j && j.error && (j.error.message || j.error) || ''))); };
      x.onerror = x.ontimeout = () => fail(new Error('Spotify sem conexão')); x.send(body || null);
    });
  }
  function spToken() {
    const S = C.spotify || {}; if (!S.clientId || !S.refreshToken) return Promise.reject(new Error('Spotify não configurado'));
    if (spTok && spTok.exp > Date.now()) return Promise.resolve(spTok.v);
    const rt = store.get('sp-rt', '') || S.refreshToken;
    return spReq('POST', 'https://accounts.spotify.com/api/token', 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(rt), { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + btoa(S.clientId + ':' + S.clientSecret) })
      .then(t => { if (t.refresh_token) store.set('sp-rt', t.refresh_token); spTok = { v: t.access_token, exp: Date.now() + (t.expires_in - 60) * 1000 }; return spTok.v; });
  }
  const spApi = (method, path, body) => spToken().then(t => spReq(method, 'https://api.spotify.com/v1' + path, body ? JSON.stringify(body) : null, { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }));
  const plId = s => { const m = /playlist[/:]([A-Za-z0-9]+)/.exec(s || ''); return m ? m[1] : (/^[A-Za-z0-9]{22}$/.test(s || '') ? s : ''); };
  function spStart() {
    const S = C.spotify || {}, lists = (S.playlists || []).map(plId).filter(Boolean);
    if (!S.refreshToken || !lists.length) return Promise.resolve(false);
    const want = (S.dispositivo || '').toLowerCase();
    return spApi('GET', '/me/player/devices').then(d => {
      const ds = (d && d.devices) || [];
      const dev = ds.find(x => want && x.name.toLowerCase().indexOf(want) >= 0) || ds.find(x => /tv/i.test(x.type) || /samsung|tv/i.test(x.name));
      if (!dev) { console.log('[MyTV] Spotify: TV não aparece como dispositivo', ds.map(x => x.name)); return false; }
      const pl = lists[Math.floor(Math.random() * lists.length)];
      return spApi('GET', '/playlists/' + pl + '?fields=tracks.total').catch(() => ({ tracks: { total: 1 } })).then(info => {
        const n = (info && info.tracks && info.tracks.total) || 1;
        return spApi('PUT', '/me/player/shuffle?state=true&device_id=' + dev.id).catch(() => { })
          .then(() => spApi('PUT', '/me/player/play?device_id=' + dev.id, { context_uri: 'spotify:playlist:' + pl, offset: { position: Math.floor(Math.random() * n) } }))
          .then(() => true);
      });
    }).catch(e => { console.log('[MyTV] Spotify:', e.message); return false; });
  }
  function spStop() { if (!ssMusic) return; ssMusic = false; spApi('PUT', '/me/player/pause').catch(() => { }); }

  function ssStart() {
    if (ssOn || U.layers) return; ssOn = true; $('#ss').classList.add('open');
    $('#sscap').textContent = '';
    ssSlides();
    ssLocal().then(ok => { if (!ok && ssOn) ssHosted(); });
    spStart().then(ok => { if (!ok || !ssOn) return; ssMusic = true; const b = $('#ssvid'); if (b._mute) b._mute(); });
  }
  // vídeos guardados no pacote da TV (pasta videos/, com a lista em videos/lista.json)
  let ssList = null;
  function ssLocal() {
    const got = ssList ? Promise.resolve(ssList) : new Promise(ok => { const x = new XMLHttpRequest(); x.open('GET', 'videos/lista.json', true); x.timeout = 3000; x.onload = () => { try { ok(JSON.parse(x.responseText)); } catch (e) { ok([]); } }; x.onerror = x.ontimeout = () => ok([]); try { x.send(); } catch (e) { ok([]); } }).then(l => (ssList = Array.isArray(l) ? l : []));
    return got.then(list => {
      if (!ssOn || !list.length) return false;
      // cada cena começa do início e repete até dar ~10 min; a ordem é embaralhada sem repetir
      // até passar por todas; a troca é um fade de imagem e som (dois players alternando)
      const P = C.protetor || {}, segMs = (+P.minutosPorVideo || 10) * 60000, FADE = 2500;
      const box = $('#ssvid'); box.innerHTML = '';
      const mk = () => { const v = document.createElement('video'); v.setAttribute('playsinline', ''); v.preload = 'auto'; v.loop = true; v.style.opacity = 0; v.style.transition = 'opacity ' + FADE + 'ms ease'; v.volume = 0; box.appendChild(v); return v; };
      const players = [mk(), mk()]; let cur = 0, bag = [], segT = null, onAir = null;
      const nextIndex = () => { if (!bag.length) { bag = list.map((_, k) => k); for (let k = bag.length - 1; k > 0; k--) { const r = Math.floor(Math.random() * (k + 1)); const t = bag[k]; bag[k] = bag[r]; bag[r] = t; } if (onAir != null && bag.length > 1 && bag[0] === onAir) bag.push(bag.shift()); } return bag.shift(); };
      const ramp = (v, to) => { clearInterval(v._r); const from = v.volume, t0 = Date.now(); v._r = setInterval(() => { const k = Math.min(1, (Date.now() - t0) / FADE); try { v.volume = from + (to - from) * k; } catch (e) { } if (k >= 1) clearInterval(v._r); }, 80); };
      const show = () => {
        if (!ssOn) return;
        const idx = nextIndex(), it = list[idx], v = players[cur], old = players[1 - cur]; onAir = idx;
        v.src = 'videos/' + (it.file || it); v.currentTime = 0; v.volume = 0;
        v.onplaying = () => { v.onplaying = null; v.style.opacity = 1; old.style.opacity = 0; ramp(v, (P.semSomDosVideos || ssMusic) ? 0 : 1); ramp(old, 0); setTimeout(() => { try { old.pause(); old.removeAttribute('src'); old.load(); } catch (e) { } }, FADE + 200); $('#sscap').textContent = it.title || ''; };
        v.onerror = () => { if (list.length > 1) { cur = 1 - cur; setTimeout(show, 300); } };
        const p = v.play(); if (p && p.catch) p.catch(() => { v.muted = true; v.play().catch(() => { }); });
        cur = 1 - cur;
        clearTimeout(segT); segT = setTimeout(show, segMs);
      };
      box._stop = () => { clearTimeout(segT); players.forEach(v => clearInterval(v._r)); };
      box._mute = () => players.forEach(v => ramp(v, 0));
      show();
      return true;
    });
  }
  function ssStop() { spStop(); ssOn = false; $('#ss').classList.remove('open'); clearInterval(ssT); if ($('#ssvid')._stop) $('#ssvid')._stop(); $('#ssvid').innerHTML = ''; ytP = null; setTimeout(() => { if (!ssOn) $('#ssimg').innerHTML = ''; }, 1300); idle(); }
  function idle() { clearTimeout(idleT); const m = +C.protetorMinutos || 0; if (m > 0 && !document.hidden) idleT = setTimeout(ssStart, m * 60000); }
  U.nav.onActivity = () => { if (!ssOn) idle(); };
  U.nav.keyTrap = e => {
    // volume (+, − e mudo) não tira do protetor: a TV ajusta o som e a música continua
    if (ssOn && [447, 448, 449, 175, 174, 173].indexOf(e.keyCode) >= 0) return true;
    if (ssOn) { ssStop(); return true; }
    if (railMoving) {
      const k = e.keyCode;
      if (k === 38 || k === 40) { moveRail(k === 38 ? -1 : 1); return true; }
      if ([13, 10009, 27, 8, 37, 39].indexOf(k) >= 0) { stopRailMove(); return true; }
    }
    if (moving) {
      const k = e.keyCode;
      if (k === 37 || k === 39) { moveApp(k === 37 ? -1 : 1); return true; }
      if ([13, 10009, 27, 8, 38, 40].indexOf(k) >= 0) { const id = moving; moving = null; renderApps(); focusApp(id); U.toast('Posição salva'); return true; }
    }
    return false;
  };
  ['mousemove', 'click'].forEach(t => document.addEventListener(t, () => { if (ssOn) ssStop(); }, true));
  idle();

  /* ---------- início ---------- */
  loadApps().then(() => { renderApps(); renderCW(); U.setFocus(firstItem(), false); });
  refreshGames(); renderMovies(); loadStremio(); setInterval(renderMovies, 3 * 3600e3);
  document.addEventListener('visibilitychange', () => {
    // saiu da tela (abriu outro app, Home etc.): fecha de verdade pra devolver a memória pra TV.
    // Na próxima abertura ele carrega de novo e lembra tudo (Continuar, ordem, preferências).
    if (document.hidden) { clearTimeout(idleT); if (ssOn) ssStop(); try { if (hasTizen) tizen.application.getCurrentApplication().exit(); } catch (e) { } return; }
    loadApps().then(() => { renderApps(); renderCW(); }); refreshGames(); loadStremio(); idle();
  });
})();
