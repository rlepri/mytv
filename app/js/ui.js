/* MyTV — interface: escala, foco, navegação, trilhos, carrosséis, painéis */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const stage = $('#stage'), content = $('#content');
  let S = 1, cur = null, off = 0, maxOff = 0;
  const layers = [];               // painéis abertos (detalhe, edição, todos os apps)
  const scope = () => layers.length ? layers[layers.length - 1].el : stage;
  const nav = { firstItem: null, onActivity: null, keyTrap: null, sound: null };

  function fit() { S = window.innerWidth / 1920; stage.style.transform = 'scale(' + S + ')'; }
  window.addEventListener('resize', fit); fit();
  function rectOf(el) { const r = el.getBoundingClientRect(), s = stage.getBoundingClientRect(); return { x: (r.left - s.left) / S, y: (r.top - s.top) / S, w: r.width / S, h: r.height / S }; }

  /* ---------- anel de foco (um só, gira por transform) ---------- */
  const ring = document.createElement('div'); ring.id = 'ring'; ring.innerHTML = '<i></i>';
  function placeRing(el) {
    if (!el || !document.body.contains(el)) { ring.classList.remove('show'); return; }
    let host = el, sc = 1.07, x, y, w, h, z;
    if (el.classList.contains('flow')) {
      const c = el.querySelector('.card.c0'); if (!c) { ring.classList.remove('show'); return; }
      host = c; sc = 1; w = c.offsetWidth; h = c.offsetHeight; x = el.offsetWidth / 2 - w / 2; y = 0; z = 9;
      if (ring.parentNode !== el) el.appendChild(ring);
    } else {
      const par = el.offsetParent; if (!par) return;
      if (el.id === 'hero' || el.classList.contains('row')) sc = 1;
      if (el.classList.contains('game')) sc = 1.03;
      w = el.offsetWidth; h = el.offsetHeight; x = el.offsetLeft; y = el.offsetTop;
      z = el.classList.contains('game') ? 7 : 4;
      if (ring.parentNode !== par) par.appendChild(ring);
    }
    const W = w * sc + 10, H = h * sc + 10, rad = parseFloat(getComputedStyle(host).borderTopLeftRadius) || 0, clip = getComputedStyle(el).getPropertyValue('--clip').trim();
    ring.style.cssText = 'left:' + (x - (W - w) / 2) + 'px;top:' + (y - (H - h) / 2) + 'px;width:' + W + 'px;height:' + H + 'px;border-radius:' + (rad ? rad * sc + 5 : 0) + 'px;z-index:' + z + ';clip-path:' + (clip || 'none');
    const d = Math.ceil(Math.hypot(W, H)); ring.firstChild.style.width = ring.firstChild.style.height = d + 'px';
    ring.classList.add('show');
  }

  /* sons: Web Audio (baixa latência); cai pro <audio> se não houver */
  const SFX = {}; let actx = null;
  function loadSfx(name, url) {
    try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; }
    if (actx) { SFX[name] = url; try { const x = new XMLHttpRequest(); x.open('GET', url, true); x.responseType = 'arraybuffer'; x.onload = () => { try { actx.decodeAudioData(x.response, b => SFX[name] = b, () => { }); } catch (e) { } }; x.send(); } catch (e) { } }
    else SFX[name] = url;
  }
  function sfx(name) {
    if (!nav.sound || !nav.sound()) return; const b = SFX[name]; if (!b) return;
    try {
      if (actx && typeof b !== 'string') { if (actx.state === 'suspended') actx.resume(); const s = actx.createBufferSource(), g = actx.createGain(); g.gain.value = name === 'ok' ? .55 : .35; s.buffer = b; s.connect(g); g.connect(actx.destination); s.start(0); }
      else { const a = new Audio(b); a.volume = .4; a.play(); }
    } catch (e) { }
  }
  loadSfx('move', (window.MYTV_BASE || '') + 'sfx/move.wav'); loadSfx('ok', (window.MYTV_BASE || '') + 'sfx/ok.wav');

  /* imagens só quando chegam perto da tela */
  let hyT = 0;
  function hydrate() {
    if (hyT) return; hyT = requestAnimationFrame(() => {
      hyT = 0; const sr = stage.getBoundingClientRect();
      document.querySelectorAll('[data-bg]').forEach(e => {
        if (e.closest('[hidden]')) return; const r = e.getBoundingClientRect(), y = (r.top - sr.top) / S, x = (r.left - sr.left) / S;
        if (y < 1080 + 700 && y + r.height / S > -500 && x < 1920 + 900 && x + r.width / S > -900) { e.style.backgroundImage = 'url(' + e.getAttribute('data-bg') + ')'; e.removeAttribute('data-bg'); }
      });
    });
  }
  // trilhos fora da tela não são desenhados
  function cull() { document.querySelectorAll('#rails > .rail, #rails > .flow').forEach(b => { if (b.hidden) return; const t = parseFloat(b.style.top) - off, h = b.offsetHeight; b.classList.toggle('far', t > 1080 + 400 || t + h < -400); }); }

  function setFocus(el, scroll) {
    if (!el) return;
    if (cur) cur.classList.remove('on');
    cur = el; el.classList.add('on'); placeRing(el);
    if (scroll) follow(el);
  }

  function setOff(v) {
    off = Math.max(0, Math.min(maxOff, v));
    content.style.transform = 'translateY(' + (-off) + 'px)';
    const sc = off > 60; $('#hero').classList.toggle('scrolled', sc); $('#side').classList.toggle('scrolled', sc);
    $('#top').style.setProperty('--hdr', off > 10 ? 1 : 0);
    cull(); hydrate();
  }

  // listas verticais com rolagem própria (Acontecendo hoje, painel de edição)
  function keepInView(el) {
    const box = el.closest('.vs'); if (!box) return;
    if (el === box.querySelector('.f')) { box.scrollTop = 0; return; }
    const top = el.offsetTop - 8, bot = el.offsetTop + el.offsetHeight + 8;
    if (top < box.scrollTop) box.scrollTop = top; else if (bot > box.scrollTop + box.clientHeight) box.scrollTop = bot - box.clientHeight;
  }

  function follow(el) {
    keepInView(el);
    const tr = el.closest('.track');
    if (tr && tr._rail) { const r = rectOf(el); let ox = tr._rail.ox; if (r.x + r.w > 1824) ox += r.x + r.w - 1824; else if (r.x < 96) ox -= 96 - r.x; tr._rail.shift(ox); }
    if (layers.length) return;
    if (el.id === 'hero' || el.closest('#side') || el.closest('#top')) { setOff(0); return; }
    const first = nav.firstItem && nav.firstItem();
    if (first && first.closest('.rail') && first.closest('.rail') === el.closest('.rail')) { setOff(0); return; }
    const r = rectOf(el); let o = off;
    if (r.y + r.h > 1040) o += r.y + r.h - 1040; else if (r.y < 150) o -= 150 - r.y;
    setOff(o);
  }

  // um item é candidato se está visível: dentro da própria lista com rolagem (a menos que o foco esteja nela) e na largura da tela
  function candidates(dx) {
    const curBox = cur && cur.closest('.vs');
    return [...scope().querySelectorAll('.f')].filter(e => {
      if (e.offsetParent === null || e.closest('[hidden]')) return false;
      if (!layers.length && e.closest('.ov,#ss')) return false;
      const box = e.closest('.vs');
      if (box && box !== curBox) { const b = rectOf(box), r = rectOf(e); if (r.y < b.y - 4 || r.y + r.h > b.y + b.h + 4) return false; }
      if (!dx && e.closest('.track')) { const r = rectOf(e); if (r.x + r.w < 0 || r.x > 1920) return false; }
      return true;
    });
  }

  function nearest(list, dx, dy) {
    const a = rectOf(cur), ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 }; let best = null, bs = 1e9;
    list.forEach(el => {
      if (el === cur) return; const b = rectOf(el), bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 }, ddx = bc.x - ac.x, ddy = bc.y - ac.y;
      if (dx && (Math.sign(ddx) !== dx || Math.abs(ddx) < 10 || b.y >= a.y + a.h || b.y + b.h <= a.y)) return;
      if (dy && (Math.sign(ddy) !== dy || (dy < 0 ? b.y + b.h > a.y + 14 : b.y < a.y + a.h - 14))) return;
      const sc = dx ? Math.abs(ddx) + Math.abs(ddy) * 2.2 : Math.abs(ddy) + Math.abs(ddx) * .7;
      if (sc < bs) { bs = sc; best = el; }
    });
    return best;
  }

  function move(dx, dy) {
    if (!cur || !scope().contains(cur)) { setFocus(candidates()[0], true); return; }
    // destaque: só a seta esquerda troca o slide; a direita vai pro Acontecendo hoje
    if (cur.id === 'hero' && dx === -1) { cur.slide(-1); return; }
    // destaque → direita: sempre o primeiro jogo da lista
    if (cur.id === 'hero' && dx === 1) { const g = $('#games'), f = g.querySelector('.f'); if (f) { g.scrollTop = 0; setFocus(f, true); return; } }
    if (cur.slide && dx && cur.id !== 'hero') { cur.slide(dx); return; }
    // descer do destaque ou do fim do Acontecendo hoje leva sempre ao primeiro item (Continuar)
    if (dy === 1 && !layers.length && nav.firstItem) {
      const inSide = cur.closest('#side'), lastGame = inSide && !nearest([...cur.parentNode.querySelectorAll('.game')], 0, 1);
      if (cur.id === 'hero' || lastGame) { setFocus(nav.firstItem(), true); return; }
    }
    // horizontal dentro de um trilho: não sai dele; no fim, volta pro começo
    const tr = cur.closest('.track');
    if (tr && dx) {
      const items = [...tr.children].filter(e => e.classList.contains('f'));
      const best = nearest(items, dx, 0);
      setFocus(best || (dx > 0 ? items[0] : items[items.length - 1]), true); return;
    }
    const best = nearest(candidates(dx), dx, dy);
    if (best) setFocus(best, true);
  }
  function moveS(dx, dy) { const before = cur; move(dx, dy); if (cur !== before || (cur && cur.slide && dx)) sfx('move'); }

  function press() {
    if (!cur) return; sfx('ok');
    cur.animate([{ transform: 'scale(1.07)' }, { transform: 'scale(.96)' }, { transform: 'scale(1.07)' }], { duration: 260 });
    if (cur._act) cur._act();
  }

  function back() {
    if (layers.length) { closeOverlay(); return; }
    if (off > 0) { setOff(0); setFocus(nav.firstItem && nav.firstItem(), false); }
  }

  // OK: toque curto = abrir; segurar (0,6 s) = menu do item, quando ele tiver um
  let holdT = null, held = false, okDown = false;
  document.addEventListener('keydown', e => {
    if (nav.onActivity) nav.onActivity();
    const k = e.keyCode;
    if (k === 13) {
      e.preventDefault();
      if (okDown) return; okDown = true; held = false;
      if (nav.keyTrap && nav.keyTrap(e)) { held = true; return; }
      if (cur && cur._long) holdT = setTimeout(() => { held = true; cur._long(); }, 600);
      return;
    }
    if (nav.keyTrap && nav.keyTrap(e)) { e.preventDefault(); return; }
    if (k === 37) moveS(-1, 0); else if (k === 39) moveS(1, 0); else if (k === 38) moveS(0, -1); else if (k === 40) moveS(0, 1);
    else if (k === 10009 || k === 27 || k === 8) back(); else return;
    e.preventDefault();
  });
  document.addEventListener('keyup', e => {
    if (e.keyCode !== 13) return; e.preventDefault();
    clearTimeout(holdT); const wasHeld = held; okDown = false; held = false;
    if (!wasHeld) press();
  });
  stage.addEventListener('contextmenu', e => { const f = e.target.closest('.f'); if (f && f._long) { e.preventDefault(); setFocus(f, false); f._long(); } });
  ['mousemove', 'wheel', 'click'].forEach(t => document.addEventListener(t, () => nav.onActivity && nav.onActivity(), true));
  stage.addEventListener('mouseover', e => { const f = e.target.closest('.f'); if (f && f !== cur && scope().contains(f) && (layers.length || !f.closest('.ov'))) setFocus(f, false); });
  stage.addEventListener('click', e => { if (e.target.closest('.arr,.arr2')) return; const f = e.target.closest('.f'); if (f && scope().contains(f)) { setFocus(f, true); press(); } });
  stage.addEventListener('wheel', e => {
    const vs = e.target.closest('.vs'); if (vs) { vs.scrollTop += e.deltaY; return; }
    if (layers.length || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; setOff(off + e.deltaY * .8);
  });

  /* ---------- trilho com rolagem lateral ---------- */
  function Rail(rail) {
    const tr = rail.querySelector('.track'); const R = { rail: rail, track: tr, ox: 0, max: 0 };
    tr._rail = R;
    const mk = (d, path, side) => { const a = document.createElement('div'); a.className = 'arr2'; a.style[side] = '24px'; a.innerHTML = '<svg viewBox="0 0 24 24"><path d="' + path + '"/></svg>'; a.onclick = ev => { ev.stopPropagation(); R.shift(R.ox + d * 800); }; rail.appendChild(a); return a; };
    const al = mk(-1, 'M15 5l-7 7 7 7', 'left'), ar = mk(1, 'M9 5l7 7-7 7', 'right');
    R.shift = ox => { R.ox = Math.max(0, Math.min(R.max, ox)); tr.style.transform = 'translateX(' + (-R.ox) + 'px)'; al.hidden = R.ox <= 0; ar.hidden = R.ox >= R.max; setTimeout(hydrate, 60); };
    R.set = (nodes, gap) => {
      const keep = cur && tr.contains(cur) ? [...tr.children].indexOf(cur) : -1;
      tr.innerHTML = ''; let x = 96; const H = parseInt(rail.style.height, 10) || rail.offsetHeight;
      nodes.forEach(n => { tr.appendChild(n); const w = n.offsetWidth, h = n.offsetHeight; n.style.left = x + 'px'; n.style.top = Math.round((H - h) / 2 + 14) + 'px'; x += w + (gap || 30); });
      R.max = Math.max(0, x - (gap || 30) - 1824); R.shift(Math.min(R.ox, R.max));
      if (keep >= 0 && nodes.length) setFocus(nodes[Math.min(keep, nodes.length - 1)], false);
      hydrate();
    };
    rail.addEventListener('wheel', e => { if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; e.preventDefault(); e.stopPropagation(); R.shift(R.ox + e.deltaX); }, { passive: false });
    return R;
  }

  /* ---------- carrossel de tamanhos ---------- */
  function Flow(box, step) {
    let items = [], i = 0;
    const lay = () => {
      const n = items.length;[...box.querySelectorAll('.card')].forEach((el, k) => {
        let o = ((k - i) % n + n) % n; if (o > n / 2) o -= n; const a = Math.abs(o), sc = [1, .78, .6, .46][a] || .4;
        el.style.transform = 'translateX(' + (o * step + (o ? Math.sign(o) * step * .2 : 0)) + 'px) scale(' + sc + ')';
        el.style.zIndex = 10 - a; el.style.opacity = a > 3 ? 0 : 1; const dm = el.querySelector('.dim'); if (dm) dm.style.opacity = a * .22; el.className = 'card' + (a === 0 ? ' c0' : '');
      });
    };
    box.slide = d => { if (!items.length) return; i = (i + d + items.length) % items.length; lay(); if (cur === box) placeRing(box); };
    box._act = () => { if (items[i] && items[i].act) items[i].act(); };
    box.set = list => {
      items = list; i = 0; box.querySelectorAll('.card').forEach(c => c.remove());
      list.forEach((c, k) => {
        const d = document.createElement('div'); d.className = 'card';
        d.innerHTML = '<div class="img" data-bg="' + c.img + '"></div>' + (c.src ? '<span class="src">' + c.src + '</span>' : '') + (c.rate ? '<span class="rate">' + c.rate + '</span>' : '') + '<div class="nm">' + esc(c.title) + '</div><div class="dim"></div>';
        d.addEventListener('click', ev => { ev.stopPropagation(); let o = ((k - i) % items.length + items.length) % items.length; if (o > items.length / 2) o -= items.length; setFocus(box, true); if (o) box.slide(o); else box._act(); });
        box.appendChild(d);
      });
      lay(); hydrate();
    };
    [[-1, 'M15 5l-7 7 7 7', 'left'], [1, 'M9 5l7 7-7 7', 'right']].forEach(([d, p, side]) => { const a = document.createElement('div'); a.className = 'arr'; a.style[side] = '300px'; a.innerHTML = '<svg viewBox="0 0 24 24"><path d="' + p + '"/></svg>'; a.onclick = ev => { ev.stopPropagation(); box.slide(d); }; box.appendChild(a); });
    box.addEventListener('wheel', e => { if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; e.preventDefault(); e.stopPropagation(); const t = Date.now(); if (t - (box._w || 0) < 350) return; box._w = t; box.slide(e.deltaX > 0 ? 1 : -1); }, { passive: false });
    setInterval(() => { if (cur !== box && !layers.length && !document.hidden) box.slide(1); }, 4500);
    return box;
  }

  /* ---------- painéis por cima da tela ---------- */
  function openOverlay(el, focusEl) {
    layers.push({ el: el, back: cur }); el.classList.add('open'); setFocus(focusEl || el.querySelector('.f'), true);
  }
  function closeOverlay() {
    const l = layers.pop(); if (!l) return; l.el.classList.remove('open'); if (l.el.onclose) l.el.onclose();
    setFocus(l.back && document.body.contains(l.back) ? l.back : (nav.firstItem && nav.firstItem()), false);
  }
  function openDetail(d) {
    $('#dbg').style.backgroundImage = d.img ? 'url(' + d.img + ')' : '';
    $('#dm').innerHTML = d.meta || ''; $('#dt').textContent = d.title; $('#dp').textContent = d.text || 'Sem sinopse em português.';
    const bx = $('#dbtns'); bx.innerHTML = '';
    (d.buttons || []).forEach(b => { const e = document.createElement('div'); e.className = 'f btn'; e.textContent = b.label; e._act = b.act; bx.appendChild(e); });
    openOverlay($('#det'), bx.firstChild);
  }

  let tt; function toast(t, ms) { const e = $('#toast'); e.textContent = t; e.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => e.classList.remove('show'), ms || 3500); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  window.addEventListener('resize', () => placeRing(cur));

  window.UI = {
    $, setFocus, Rail, hydrate, sfx, cull, Flow, openDetail, openOverlay, closeOverlay, closeDetail: closeOverlay, toast, esc, placeRing, setOff, nav,
    get off() { return off; }, get cur() { return cur; }, get layers() { return layers.length; }, setMax(v) { maxOff = Math.max(0, v); if (off > maxOff) setOff(maxOff); }
  };
})();
