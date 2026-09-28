/* Hooks & Threads — "Book" view of the catalogue.

   Pages are built from the .collection sections already on the page, so the
   grid and the book can never disagree. The turning leaf is a chain of nested
   strips, each showing a slice of the page, whose angles sweep through an arc
   so the sheet curves as it turns instead of swinging like a flat door. */
(function () {
  const PER_PAGE = 4;
  const ASPECT = 0.72;        // page width / height
  const N = 14;               // strips in the turning leaf
  const CURL = 0.55;          // peak bend of the leaf, radians
  const SPREAD_MIN = 860;     // narrower than this, the book shows one page at a time
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const root = document.getElementById('book-view');
  if (!root) return;
  const stage = root.querySelector('.bk-stage');
  const tilt = root.querySelector('.bk-tilt');
  const book = root.querySelector('.bk-book');
  const capTitle = root.querySelector('.bk-cap-title');
  const capPage = root.querySelector('.bk-cap-page');
  const prevBtn = root.querySelector('.bk-prev');
  const nextBtn = root.querySelector('.bk-next');
  const hint = root.querySelector('.bk-hint');
  const toggles = document.querySelectorAll('.view-toggle [data-view]');
  const chips = document.querySelectorAll('.chip');

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const div = cls => { const d = document.createElement('div'); d.className = cls; return d; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const catName = {};
  chips.forEach(c => { catName[c.dataset.filter] = c.textContent.trim(); });

  const collections = [...document.querySelectorAll('.collection')].map(sec => ({
    cat: sec.dataset.cat,
    title: sec.querySelector('.cat-title').innerHTML,
    sub: (sec.querySelector('.cat-sub') || {}).textContent || '',
    items: [...sec.querySelectorAll('.prod')].map(p => ({
      src: p.querySelector('img').getAttribute('src'),
      name: p.querySelector('h3').textContent.trim(),
      price: (p.querySelector('.price') || {}).textContent || ''
    }))
  }));

  /* ------------------------------------------------------------ pages */
  let spread = true, pages = [], firstPage = {}, titleIdx = 0, lastNumbered = 0;
  let htmlCache = [];

  function buildPages(isSpread) {
    const list = [];
    if (isSpread) list.push({ kind: 'endpaper', id: 'end-front', logo: true });
    list.push({ kind: 'title', id: 'title' });
    list.push({ kind: 'contents', id: 'contents' });
    for (const col of collections) {
      for (let k = 0; k < col.items.length; k += PER_PAGE) {
        list.push({ kind: 'products', id: col.cat + ':' + k, col, first: k === 0, items: col.items.slice(k, k + PER_PAGE) });
      }
    }
    list.push({ kind: 'order', id: 'order' });
    if (isSpread) {
      if (list.length % 2 === 0) list.push({ kind: 'blank', id: 'blank-end' });
      list.push({ kind: 'endpaper', id: 'end-back' });
    }
    return list;
  }

  const printed = i => i - titleIdx + 1;

  function pageHTML(i) {
    if (htmlCache[i] != null) return htmlCache[i];
    const pg = pages[i];
    let h = '';
    if (!pg || pg.kind === 'blank') h = '';
    else if (pg.kind === 'endpaper') {
      h = pg.logo ? '<div class="pg-end"><img src="assets/logo-inverted.webp" alt=""></div>' : '';
    } else if (pg.kind === 'title') {
      h = '<div class="pg-title">' +
        '<p class="pg-kicker">Product Catalogue · 2026</p>' +
        '<img class="pg-logo" src="assets/logo.webp" alt="Hooks &amp; Threads">' +
        '<p class="pg-tag">Handmade elegance,<br><em>stitch by stitch.</em></p>' +
        '<p class="pg-by">A crochet studio by Hetvi Shah</p>' +
        '<p class="pg-turn">Turn the page &rarr;</p>' +
        '</div>';
    } else if (pg.kind === 'contents') {
      h = '<header class="pg-run is-first"><h3 class="pg-cat">Contents</h3>' +
        '<p class="pg-sub">' + collections.length + ' collections, all handmade to order.</p></header>' +
        '<ol class="pg-toc">' + collections.map(c =>
          '<li><button type="button" data-goto="' + firstPage[c.cat] + '">' +
          '<span class="t">' + esc(catName[c.cat] || c.cat) + '</span><span class="dots"></span>' +
          '<span class="n">' + printed(firstPage[c.cat]) + '</span></button></li>').join('') +
        '</ol><footer class="pg-num">' + printed(i) + '</footer>';
    } else if (pg.kind === 'products') {
      const c = pg.col;
      h = (pg.first
        ? '<header class="pg-run is-first"><h3 class="pg-cat">' + c.title + '</h3>' +
          (c.sub ? '<p class="pg-sub">' + esc(c.sub.trim()) + '</p>' : '') + '</header>'
        : '<header class="pg-run"><span>' + esc(catName[c.cat] || '') + '</span><span>Hooks &amp; Threads</span></header>') +
        '<div class="pg-grid">' + pg.items.map(it =>
          '<figure class="pg-item"><div class="pg-thumb"><img src="' + esc(it.src) + '" alt="' + esc(it.name) + '" decoding="async"></div>' +
          '<figcaption><span class="nm">' + esc(it.name) + '</span><span class="pr">' + esc(it.price.trim()) + '</span></figcaption></figure>'
        ).join('') + '</div>' +
        '<footer class="pg-num">' + printed(i) + '</footer>';
    } else if (pg.kind === 'order') {
      h = '<header class="pg-run is-first"><h3 class="pg-cat">How to <em>order</em></h3>' +
        '<p class="pg-sub">Every piece is made by hand, in the colours you pick.</p></header>' +
        '<ol class="pg-steps">' +
        '<li><span class="sn">01</span><h4>Choose</h4><p>Note the pieces you love and the colours you want — yarn shades can be matched on request.</p></li>' +
        '<li><span class="sn">02</span><h4>Message</h4><p>DM @hooksnthreads_official on Instagram or WhatsApp with the product, quantity and colours.</p></li>' +
        '<li><span class="sn">03</span><h4>Receive</h4><p>We confirm timing, you pay, and your piece reaches you wrapped and ready in 1–2 weeks.</p></li>' +
        '</ol>' +
        '<div class="pg-contact"><p class="lbl">Get in touch</p><p>+91 6359069699</p><p>hooksnthreads2024@gmail.com</p><p>hooksnthreads.shop</p></div>' +
        '<footer class="pg-num">' + printed(i) + '</footer>';
    }
    return (htmlCache[i] = h);
  }

  function pageEl(i, side) {
    const pg = pages[i];
    const el = div('bk-page ' + side + ' is-' + (pg ? pg.kind : 'blank'));
    el.innerHTML = '<div class="pg-in">' + (i >= 0 ? pageHTML(i) : '') + '</div>';
    return el;
  }

  /* ----------------------------------------------------------- layout */
  let idx = 0;          // spread index in spread mode, page index otherwise
  let turn = null;      // {curl, under, front, back, frontSide, backSide, goal, dest, p}
  let strips = [], leafEl = null;
  let W = 0, H = 0, PW = 0;
  let wantCat = null;

  const count = () => spread ? pages.length / 2 : pages.length;
  const visible = at => spread ? [2 * at, 2 * at + 1] : [at];
  const chromeH = () =>
    (document.querySelector('.site-header') || {}).offsetHeight + (document.querySelector('.cat-nav') || {}).offsetHeight || 0;

  function setup() {
    const anchor = pages.length ? (pages[visible(idx)[spread ? 1 : 0]] || {}).id : null;
    spread = innerWidth >= SPREAD_MIN;
    pages = buildPages(spread);
    htmlCache = [];
    firstPage = {};
    pages.forEach((p, i) => { if (p.kind === 'products' && p.first) firstPage[p.col.cat] = i; });
    titleIdx = pages.findIndex(p => p.kind === 'title');
    lastNumbered = pages.findIndex(p => p.kind === 'order');
    const at = anchor ? Math.max(0, pages.findIndex(p => p.id === anchor)) : 0;
    idx = spread ? Math.floor(at / 2) : at;
    turn = null; anim = null;
    tilt.classList.toggle('is-single', !spread);
    layout();
    paint();
  }

  function layout() {
    const avW = stage.clientWidth - (spread ? 40 : 16);
    const avH = Math.max(340, innerHeight - chromeH() - 170);
    const perW = spread ? 2 * ASPECT : ASPECT;
    W = Math.floor(Math.min(avW, avH * perW, spread ? 1180 : 540));
    H = Math.round(W / perW);
    PW = spread ? W / 2 : W;
    book.style.width = W + 'px';
    book.style.height = H + 'px';
    const s = root.style;
    s.setProperty('--pw', PW + 'px');
    s.setProperty('--ph', H + 'px');
    s.setProperty('--sw', (PW / N) + 'px');
    s.setProperty('--hinge', (spread ? PW : 0) + 'px');
  }

  /* ------------------------------------------------------------ paint */
  function half(side, i) {
    const h = div('bk-half ' + side);
    h.appendChild(pageEl(i, side));
    if (turn) h.appendChild(div('bk-under-shade ' + (side === 'left' ? 'from-right' : 'from-left')));
    return h;
  }

  function paint(jump) {
    book.textContent = '';
    leafEl = null;
    const u = turn ? turn.under : visible(idx);
    if (spread) { book.appendChild(half('left', u[0])); book.appendChild(half('right', u[1])); }
    else book.appendChild(half('single', u[0]));
    if (turn) { leafEl = buildLeaf(); book.appendChild(leafEl); applyTurn(); }
    else root.style.setProperty('--lift', '0');
    book.classList.toggle('is-jump', !!jump);
    if (jump) { void book.offsetWidth; }
    stackEdges();
    caption(turn ? turn.dest : idx);
    preload(turn ? turn.dest : idx);
  }

  function buildLeaf() {
    const next = turn.curl === 'next';
    const c = div('bk-leaf ' + turn.curl);
    const front = pageEl(turn.front, turn.frontSide);
    const back = pageEl(turn.back, turn.backSide);
    const sw = PW / N;
    strips = [];
    let host = c;
    for (let i = 0; i < N; i++) {
      const s = div('bk-strip');
      s.appendChild(face('front', front, next ? i * sw : PW - (i + 1) * sw));
      s.appendChild(face('back', back, next ? PW - (i + 1) * sw : i * sw));
      host.appendChild(s);
      host = s;
      strips.push(s);
    }
    return c;
  }

  function face(which, page, offset) {
    const f = div('bk-face ' + which);
    const p = page.cloneNode(true);
    p.style.left = (-offset) + 'px';
    f.appendChild(p);
    f.appendChild(div('bk-shade'));
    return f;
  }

  function applyTurn() {
    const p = clamp(turn.p, 0, 1);
    const t = turn.goal ? p : 1 - p;
    const bend = CURL * Math.sin(Math.PI * t);
    const tt = Math.PI * t + bend, td = 2 * bend / N;
    const D = 180 / Math.PI;
    const s = root.style;
    s.setProperty('--tt', (tt * D).toFixed(2) + 'deg');
    s.setProperty('--td', (td * D).toFixed(3) + 'deg');
    s.setProperty('--lift', Math.sin(Math.PI * t).toFixed(3));
    for (let i = 0; i < strips.length; i++) {
      const l1 = Math.abs(Math.cos(tt - i * td));
      const l2 = Math.abs(Math.cos(tt - (i + 1) * td));
      strips[i].style.setProperty('--a1', ((1 - l1) * 0.5).toFixed(3));
      strips[i].style.setProperty('--a2', ((1 - l2) * 0.5).toFixed(3));
    }
    // one page at a time: the turned sheet has nowhere to land, so it fades as it goes
    if (!spread && leafEl) leafEl.style.opacity = t < 0.55 ? '1' : Math.max(0, 1 - (t - 0.55) / 0.35).toFixed(3);
  }

  function stackEdges() {
    const n = count();
    const at = turn ? turn.dest : idx;
    const f = n > 1 ? at / (n - 1) : 0;
    const max = Math.max(3, Math.round(W / 190));
    root.style.setProperty('--stack-l', (spread ? Math.round(max * f) : 0) + 'px');
    root.style.setProperty('--stack-r', Math.round(max * (1 - f)) + 'px');
  }

  function caption(at) {
    const vis = visible(at).filter(i => i >= 0 && i < pages.length);
    const withCol = vis.map(i => pages[i]).filter(p => p.col);
    // a spread can hold the end of one collection and the start of the next;
    // name the one that was asked for, else the one the spread opens with
    const pg = withCol.find(p => p.col.cat === wantCat) || withCol[0] || pages[vis[vis.length - 1]] || {};
    wantCat = null;
    const label = { title: 'Hooks & Threads', contents: 'Contents', order: 'How to order', endpaper: 'Hooks & Threads', blank: 'Hooks & Threads' };
    capTitle.textContent = pg.col ? (catName[pg.col.cat] || '') : (label[pg.kind] || '');
    const nums = vis.filter(i => i >= titleIdx && i <= lastNumbered).map(printed);
    const total = printed(lastNumbered);
    capPage.textContent = nums.length
      ? (nums.length > 1 ? 'Pages ' + nums[0] + '–' + nums[1] : 'Page ' + nums[0]) + ' of ' + total
      : total + ' pages';
    prevBtn.disabled = at <= 0;
    nextBtn.disabled = at >= count() - 1;
    syncChips(pg.col ? pg.col.cat : null);
  }

  function syncChips(cat) {
    chips.forEach(c => c.classList.toggle('is-active', c.dataset.filter === cat));
    const chip = cat && document.querySelector('.chip[data-filter="' + cat + '"]');
    const rail = document.querySelector('.cat-rail');
    if (!chip || !rail) return;
    const cr = chip.getBoundingClientRect(), rr = rail.getBoundingClientRect();
    if (cr.left < rr.left + 20) rail.scrollBy({ left: cr.left - rr.left - 24, behavior: 'smooth' });
    else if (cr.right > rr.right - 20) rail.scrollBy({ left: cr.right - rr.right + 24, behavior: 'smooth' });
  }

  const warmed = new Set();
  function preload(at) {
    const span = spread ? 2 : 1;
    for (let k = (at - 2) * span; k < (at + 3) * span; k++) {
      const pg = pages[k];
      if (!pg || !pg.items || warmed.has(pg.id)) continue;
      warmed.add(pg.id);
      pg.items.forEach(it => { const im = new Image(); im.src = it.src; });
    }
  }

  /* ------------------------------------------------------------ turns */
  function makeTurn(dir) {
    const n = count();
    if (dir === 'next' && idx >= n - 1) return null;
    if (dir === 'prev' && idx <= 0) return null;
    if (spread) {
      const L = 2 * idx, R = L + 1;
      return dir === 'next'
        ? { curl: 'next', under: [L, R + 2], front: R, back: R + 1, frontSide: 'right', backSide: 'left', goal: 1, dest: idx + 1, p: 0 }
        : { curl: 'prev', under: [L - 2, R], front: L, back: L - 1, frontSide: 'left', backSide: 'right', goal: 1, dest: idx - 1, p: 0 };
    }
    // single page: going back means the previous sheet swinging back over this one
    return dir === 'next'
      ? { curl: 'next', under: [idx + 1], front: idx, back: -1, frontSide: 'single', backSide: 'single', goal: 1, dest: idx + 1, p: 0 }
      : { curl: 'next', under: [idx], front: idx - 1, back: -1, frontSide: 'single', backSide: 'single', goal: 0, dest: idx - 1, p: 0 };
  }

  let anim = null, raf = 0, last = 0;
  function animate(target, v0, done) { anim = { target, v: v0 || 0, done }; kick(); }
  function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }
  function tick(now) {
    raf = 0;
    const dt = Math.min(0.032, (now - last) / 1000 || 0.016);
    last = now;
    let more = false;
    if (anim && turn) {
      const x = turn.p - anim.target;
      anim.v += (-170 * x - 26 * anim.v) * dt;
      turn.p += anim.v * dt;
      if (Math.abs(turn.p - anim.target) < 0.002 && Math.abs(anim.v) < 0.03) {
        turn.p = anim.target;
        applyTurn();
        const d = anim.done; anim = null; d();
      } else { applyTurn(); more = true; }
    }
    if (easeTilt()) more = true;
    if (more && !raf) raf = requestAnimationFrame(tick);
  }

  function finish(ok) { if (ok) idx = turn.dest; turn = null; anim = null; paint(); }
  function commit(v) { if (!turn) return; if (REDUCED) return finish(true); animate(1, v, () => finish(true)); }
  function cancel(v) { if (!turn) return; if (REDUCED) return finish(false); animate(0, v, () => finish(false)); }
  /* snap whatever is in flight to where it was heading */
  function settle() { if (turn) finish(anim ? anim.target === 1 : turn.p > 0.5); }

  function step(dir) {
    settle();
    turn = makeTurn(dir);
    if (!turn) return;
    hideHint();
    paint();
    commit();
  }
  function goTo(at) {
    settle();
    at = clamp(at, 0, count() - 1);
    if (at === idx) return;
    if (Math.abs(at - idx) === 1) return step(at > idx ? 'next' : 'prev');
    idx = at;
    paint(true);
  }
  function goToPage(i) {
    if (pages[i] && pages[i].col) wantCat = pages[i].col.cat;
    goTo(spread ? Math.floor(i / 2) : i);
    if (wantCat) caption(idx);      // already on that spread, nothing repainted
  }

  prevBtn.addEventListener('click', () => step('prev'));
  nextBtn.addEventListener('click', () => step('next'));

  /* ---------------------------------------------------------- pointer */
  let drag = null;
  const hideHint = () => hint.classList.add('gone');
  if (matchMedia('(pointer: coarse)').matches) hint.textContent = 'Swipe or tap a page to turn it';

  book.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    if (e.pointerType === 'mouse') e.preventDefault();
    settle();
    const r = book.getBoundingClientRect();
    drag = {
      x0: e.clientX, id: e.pointerId, w: spread ? r.width / 2 : r.width,
      side: (e.clientX - r.left) / r.width > 0.5 ? 'next' : 'prev',
      goto: e.target.closest('[data-goto]'),
      started: false, dir: null, vel: 0, tPrev: performance.now()
    };
  });
  book.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0;
    if (!drag.started) {
      if (Math.abs(dx) < 6) return;
      drag.dir = dx < 0 ? 'next' : 'prev';
      turn = makeTurn(drag.dir);
      if (!turn) { drag = null; return; }
      drag.started = true;
      try { book.setPointerCapture(drag.id); } catch (_) {}
      hideHint();
      paint();
    }
    const p = clamp((drag.dir === 'next' ? -dx : dx) / drag.w, 0, 1);
    const now = performance.now();
    drag.vel = (p - turn.p) / Math.max(0.001, (now - drag.tPrev) / 1000);
    drag.tPrev = now;
    turn.p = p;
    applyTurn();
  });
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (!d.started) {
      if (e.type === 'pointercancel') return;
      if (d.goto) return goToPage(parseInt(d.goto.dataset.goto, 10));
      return step(d.side);
    }
    if (!turn) return;
    const v = clamp(d.vel, -6, 6);
    if (turn.p > 0.35 || v > 1.2) commit(Math.max(0, v)); else cancel(Math.min(0, v));
  }
  book.addEventListener('pointerup', endDrag);
  book.addEventListener('pointercancel', endDrag);
  book.addEventListener('dragstart', e => e.preventDefault());

  addEventListener('keydown', e => {
    if (!isOn() || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const r = book.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    e.preventDefault();
    step(e.key === 'ArrowRight' ? 'next' : 'prev');
  });

  /* ------------------------------------------- the book leans toward the cursor */
  const view = { rx: 0, ry: 0, trx: 0, try_: 0 };
  function easeTilt() {
    let moved = false;
    for (const [k, t] of [['rx', 'trx'], ['ry', 'try_']]) {
      const d = view[t] - view[k];
      if (Math.abs(d) > 0.005) { view[k] += d * 0.12; moved = true; } else view[k] = view[t];
    }
    tilt.style.setProperty('--rx', view.rx.toFixed(2) + 'deg');
    tilt.style.setProperty('--ry', view.ry.toFixed(2) + 'deg');
    return moved;
  }
  if (!REDUCED) {
    addEventListener('pointermove', e => {
      if (!isOn() || e.pointerType !== 'mouse' || drag) return;
      const r = book.getBoundingClientRect();
      if (!r.width) return;
      const nx = clamp((e.clientX - (r.left + r.width / 2)) / (r.width * 0.65), -1, 1);
      const ny = clamp((e.clientY - (r.top + r.height / 2)) / (r.height * 0.9), -1, 1);
      view.trx = -ny * 3.5; view.try_ = nx * 5;
      kick();
    }, { passive: true });
    document.addEventListener('pointerleave', () => { view.trx = view.try_ = 0; kick(); });
  }

  /* ------------------------------------------------------ grid ↔ book */
  const isOn = () => document.body.classList.contains('is-book');

  function scrollToBook() {
    const y = root.getBoundingClientRect().top + scrollY - chromeH() - 4;
    scrollTo({ top: y, behavior: REDUCED ? 'auto' : 'smooth' });
  }

  function setView(v, scroll) {
    const on = v === 'book';
    document.body.classList.toggle('is-book', on);
    root.hidden = !on;
    toggles.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
    try { localStorage.setItem('ht-view', v); } catch (_) {}
    if (on) { setup(); if (scroll) scrollToBook(); }
    else {
      settle();
      dispatchEvent(new Event('scroll'));
      if (scroll) document.getElementById('catalogue').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
    }
  }
  toggles.forEach(b => b.addEventListener('click', () => {
    if ((b.dataset.view === 'book') !== isOn()) setView(b.dataset.view, true);
  }));

  let resizeT = 0;
  addEventListener('resize', () => {
    if (!isOn()) return;
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      if ((innerWidth >= SPREAD_MIN) !== spread) setup();
      else { settle(); layout(); paint(); }
    }, 120);
  });

  window.HTBook = {
    isOn,
    goToCat(cat) {
      if (!isOn() || firstPage[cat] == null) return false;
      goToPage(firstPage[cat]);
      scrollToBook();
      return true;
    }
  };

  let saved = null;
  try { saved = localStorage.getItem('ht-view'); } catch (_) {}
  if (new URLSearchParams(location.search).get('view') === 'book' || saved === 'book') setView('book', false);
})();
