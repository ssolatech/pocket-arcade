// 포켓 아케이드 공통 엔진: 저장, 입력, 화면 전환, 게임 루프
// 새 미니게임은 js/games/ 에 파일을 만들고 Arcade.register({...}) 로 등록하면 허브에 나타난다.
'use strict';

window.Arcade = (() => {
  const $ = (s) => document.querySelector(s);
  const SAVE_KEY = 'pocket-arcade-v1';

  // ---------- 저장 (기기 브라우저의 localStorage, 서버/DB 불필요) ----------
  let data = {};
  try { data = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') || {}; } catch (e) { data = {}; }
  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* 저장 불가 환경 */ }
  }
  const Store = {
    get(ns, key, def) { const v = data[ns] && data[ns][key]; return v === undefined ? def : v; },
    set(ns, key, val) { (data[ns] = data[ns] || {})[key] = val; persist(); },
    del(ns, key) { if (data[ns]) { delete data[ns][key]; persist(); } },
    exportCode() {
      let bin = '';
      new TextEncoder().encode(JSON.stringify(data)).forEach((b) => { bin += String.fromCharCode(b); });
      return btoa(bin);
    },
    importCode(code) {
      const bin = atob(code.replace(/\s/g, ''));
      const obj = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('invalid');
      data = obj;
      persist();
    },
  };
  // 브라우저가 저장 데이터를 임의로 지우지 않도록 요청
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  // ---------- 요소 ----------
  const el = {
    hub: $('#hub'), game: $('#game'), list: $('#game-list'),
    title: $('#game-title'), hud: $('#hud'), canvas: $('#canvas'), wrap: $('#canvas-wrap'),
    overlay: $('#overlay'), toast: $('#toast'),
  };

  const games = [];
  const UPCOMING = [
    { title: '탄막 피하기', desc: '쏟아지는 장애물을 피해 오래 버티기' },
    { title: '점프 플랫폼', desc: '발판을 건너며 코인 모으기' },
    { title: '농장 키우기', desc: '씨앗을 심고 수확하는 힐링 게임' },
  ];
  let current = null;   // { def, inst }
  let paused = false;

  // ---------- 오버레이 / 토스트 ----------
  let overlayPrimary = null;
  function showOverlay({ title, html = '', buttons = [] }) {
    el.overlay.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `<h2>${title}</h2><div class="panel-body">${html}</div>`;
    const row = document.createElement('div');
    row.className = 'btn-row';
    overlayPrimary = null;
    for (const b of buttons) {
      const btn = document.createElement('button');
      btn.className = 'btn' + (b.primary ? ' primary' : '');
      btn.textContent = b.label;
      btn.onclick = b.onClick;
      row.appendChild(btn);
      if (b.primary && !overlayPrimary) overlayPrimary = b.onClick;
    }
    if (!overlayPrimary && buttons[0]) overlayPrimary = buttons[0].onClick;
    panel.appendChild(row);
    el.overlay.appendChild(panel);
    el.overlay.hidden = false;
    return panel;
  }
  function hideOverlay() { el.overlay.hidden = true; overlayPrimary = null; }

  let toastTimer = 0;
  function toast(text, color) {
    el.toast.textContent = text;
    el.toast.style.color = color || '';
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 1600);
  }

  // ---------- 허브 ----------
  function renderHub() {
    el.list.innerHTML = '';
    for (const g of games) {
      const card = document.createElement('button');
      card.className = 'card';
      card.innerHTML =
        `<canvas class="card-icon" width="64" height="64"></canvas>` +
        `<div class="card-text"><b>${g.title}</b><span>${g.desc}</span>` +
        `<small>최고 점수 ${Store.get(g.id, 'best', 0)}</small></div>`;
      g.drawIcon(card.querySelector('canvas').getContext('2d'), 64);
      card.onclick = () => openGame(g);
      el.list.appendChild(card);
    }
    for (const u of UPCOMING) {
      const card = document.createElement('button');
      card.className = 'card';
      card.disabled = true;
      card.innerHTML =
        `<div class="card-icon">?</div>` +
        `<div class="card-text"><b>${u.title}</b><span>${u.desc}</span><small>준비 중</small></div>`;
      el.list.appendChild(card);
    }
    $('#btn-vibrate').textContent = '진동: ' + (Store.get('settings', 'vibrate', true) ? '켜짐' : '꺼짐');
  }

  $('#btn-vibrate').onclick = () => {
    Store.set('settings', 'vibrate', !Store.get('settings', 'vibrate', true));
    renderHub();
  };

  $('#btn-export').onclick = () => {
    const code = Store.exportCode();
    const panel = showOverlay({
      title: '저장 백업',
      html: '아래 코드를 메모장이나 카톡 나와의 채팅 등에 보관하세요. 다른 기기에서 <b>저장 불러오기</b>에 붙여넣으면 복원돼요.' +
        `<textarea readonly>${code}</textarea>`,
      buttons: [
        { label: '코드 복사', primary: true, onClick: () => copy(code, panel.querySelector('textarea')) },
        { label: '닫기', onClick: hideOverlay },
      ],
    });
  };

  function copy(text, ta) {
    const done = () => toast('복사했어요!', '#22c55e');
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, () => fallback());
    } else fallback();
    function fallback() {
      ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('길게 눌러 직접 복사해 주세요'); }
    }
  }

  $('#btn-import').onclick = () => {
    const panel = showOverlay({
      title: '저장 불러오기',
      html: '백업해 둔 코드를 붙여넣으세요. <b>지금 기기의 저장 데이터는 덮어써져요.</b><textarea placeholder="여기에 붙여넣기"></textarea>',
      buttons: [
        {
          label: '불러오기', primary: true, onClick: () => {
            try {
              Store.importCode(panel.querySelector('textarea').value);
              hideOverlay();
              renderHub();
              toast('불러오기 완료!', '#22c55e');
            } catch (e) {
              toast('코드가 올바르지 않아요', '#ef4444');
            }
          },
        },
        { label: '취소', onClick: hideOverlay },
      ],
    });
  };

  // 앱 설치 (안드로이드 크롬 등에서 지원)
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvt = e;
    $('#btn-install').hidden = false;
  });
  $('#btn-install').onclick = async () => {
    if (!installEvt) return;
    installEvt.prompt();
    await installEvt.userChoice.catch(() => {});
    installEvt = null;
    $('#btn-install').hidden = true;
  };
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone) $('#install-hint').hidden = true;

  // ---------- 게임 열기/닫기 ----------
  function makeCtx(def) {
    return {
      canvas: el.canvas,
      store: {
        get: (k, d) => Store.get(def.id, k, d),
        set: (k, v) => Store.set(def.id, k, v),
        del: (k) => Store.del(def.id, k),
      },
      setHud: (html) => { el.hud.innerHTML = html; },
      overlay: showOverlay,
      hideOverlay,
      toast,
      vibrate: (p) => { if (Store.get('settings', 'vibrate', true) && navigator.vibrate) navigator.vibrate(p); },
      exit: exitGame,
    };
  }

  function openGame(def) {
    el.hub.hidden = true;
    el.game.hidden = false;
    el.title.textContent = def.title;
    el.hud.innerHTML = '';
    paused = false;
    hideOverlay();
    resizeCanvas();
    current = { def, inst: def.create(makeCtx(def)) };
    history.pushState({ game: def.id }, '');   // 안드로이드 뒤로가기 = 메뉴로
  }

  function closeGame() {
    if (!current) return;
    if (current.inst.destroy) current.inst.destroy();
    current = null;
    paused = false;
    hideOverlay();
    el.game.hidden = true;
    el.hub.hidden = false;
    renderHub();
  }

  function exitGame() {
    if (history.state && history.state.game) history.back();
    else closeGame();
  }
  window.addEventListener('popstate', closeGame);
  $('#btn-back').onclick = exitGame;

  // ---------- 일시정지 ----------
  function pause() {
    if (!current || paused || !current.inst.isPlaying()) return;
    paused = true;
    showOverlay({
      title: '일시정지',
      buttons: [
        { label: '계속하기', primary: true, onClick: resume },
        { label: '메뉴로', onClick: exitGame },
      ],
    });
  }
  function resume() { paused = false; hideOverlay(); }
  $('#btn-pause').onclick = () => (paused ? resume() : pause());
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  // ---------- 캔버스 ----------
  function resizeCanvas() {
    const r = el.wrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    el.canvas.width = Math.max(1, Math.round(r.width * dpr));
    el.canvas.height = Math.max(1, Math.round(r.height * dpr));
    el.canvas.style.width = r.width + 'px';
    el.canvas.style.height = r.height + 'px';
    if (current && current.inst.resize) current.inst.resize();
  }
  new ResizeObserver(resizeCanvas).observe(el.wrap);

  // ---------- 입력: 키보드 / 가상 패드 / 스와이프 ----------
  function dir(dx, dy) {
    if (!current || paused || !el.overlay.hidden) return;
    if (current.inst.onDir) current.inst.onDir(dx, dy);
  }

  const KEYS = {
    ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
    ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
  };
  window.addEventListener('keydown', (e) => {
    if (!el.overlay.hidden) {
      if (e.target.tagName === 'TEXTAREA') return;
      if ((e.code === 'Enter' || e.code === 'Space') && overlayPrimary) {
        e.preventDefault();
        overlayPrimary();
      } else if (e.code === 'Escape' && paused) {
        resume();
      }
      return;
    }
    if (!current) return;
    if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); pause(); return; }
    const d = KEYS[e.code];
    if (d) { e.preventDefault(); dir(d[0], d[1]); }
  });

  document.querySelectorAll('[data-dir]').forEach((btn) => {
    const [dx, dy] = btn.dataset.dir.split(',').map(Number);
    let delay = 0, repeat = 0;
    const stop = () => {
      clearTimeout(delay);
      clearInterval(repeat);
      btn.classList.remove('down-state');
    };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      stop();
      btn.setPointerCapture(e.pointerId);
      btn.classList.add('down-state');
      dir(dx, dy);
      delay = setTimeout(() => { repeat = setInterval(() => dir(dx, dy), 110); }, 220);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => btn.addEventListener(ev, stop));
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  // 캔버스 위를 드래그하면 그 방향으로 한 칸씩 이동
  let swipe = null;
  const STEP = 28;
  el.wrap.addEventListener('pointerdown', (e) => { swipe = { x: e.clientX, y: e.clientY }; });
  el.wrap.addEventListener('pointermove', (e) => {
    if (!swipe) return;
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < STEP) return;
    if (Math.abs(dx) > Math.abs(dy)) dir(Math.sign(dx), 0);
    else dir(0, Math.sign(dy));
    swipe = { x: e.clientX, y: e.clientY };
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => el.wrap.addEventListener(ev, () => { swipe = null; }));

  // ---------- 게임 루프 ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (current) {
      if (!paused) current.inst.update(dt);
      current.inst.draw();
    }
    requestAnimationFrame(frame);
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderHub();
    requestAnimationFrame(frame);
  });

  // 오프라인 지원 (https 또는 localhost에서만 동작)
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }

  return { register(def) { games.push(def); } };
})();
