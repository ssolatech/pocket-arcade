// 포켓 아케이드 공통 엔진: 저장, 캐릭터/육성, 입력, 화면 전환, 게임 루프
// 새 미니게임은 js/games/ 에 파일을 만들고 Arcade.register({...}) 로 등록하면 허브에 나타난다.
'use strict';

window.Arcade = (() => {
  const $ = (s) => document.querySelector(s);
  const SAVE_KEY = 'pocket-arcade-v1';

  // ---------- 저장 (기기 브라우저의 localStorage, 서버/DB 불필요) ----------
  // 저장 데이터 검증: 조작된 백업 코드로 HTML/스크립트가 끼어들지 못하게
  // 점수류는 숫자만, 꾸미기는 정해진 목록의 값만, 이름은 8글자 문자열만 받는다.
  const BAD_KEYS = ['__proto__', 'constructor', 'prototype'];
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const num = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(1e13, Math.floor(Number(v)))) : 0);   // 1e13: 시각(ms)도 저장 가능
  function sanitize(src) {
    const out = {};
    if (!isObj(src)) return out;
    if (isObj(src.profile)) {
      const p = src.profile, o = {};
      if (isObj(p.look)) {
        o.look = {};
        for (const g of Object.keys(Avatar.OPTIONS)) {
          if (Avatar.OPTIONS[g].some((x) => x.id === p.look[g])) o.look[g] = p.look[g];
        }
      }
      if (typeof p.name === 'string') o.name = p.name.slice(0, 8);
      if (p.xp !== undefined) o.xp = num(p.xp);
      out.profile = o;
    }
    if (isObj(src.settings)) out.settings = { vibrate: src.settings.vibrate !== false };
    for (const ns of Object.keys(src)) {                     // 게임별 기록: 숫자 또는 숫자 묶음만
      if (ns === 'profile' || ns === 'settings' || BAD_KEYS.includes(ns) || !/^[a-z0-9_-]{1,24}$/.test(ns) || !isObj(src[ns])) continue;
      const o = {};
      for (const k of Object.keys(src[ns])) {
        if (BAD_KEYS.includes(k)) continue;
        const v = src[ns][k];
        if (isObj(v)) {
          o[k] = {};
          for (const ik of Object.keys(v)) if (!BAD_KEYS.includes(ik)) o[k][ik] = num(v[ik]);
        } else if (typeof v === 'number' || typeof v === 'string') {
          o[k] = num(v);
        }
      }
      out[ns] = o;
    }
    return out;
  }

  let data = {};
  try { data = sanitize(JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) { data = {}; }
  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* 저장 불가 환경 */ }
  }
  const Store = {
    get(ns, key, def) { const v = data[ns] && data[ns][key]; return v === undefined ? def : v; },
    set(ns, key, val) { (data[ns] = data[ns] || {})[key] = val; persist(); },
    del(ns, key) { if (data[ns]) { delete data[ns][key]; persist(); } },
    all() { return data; },
    size() { try { return (localStorage.getItem(SAVE_KEY) || '').length; } catch (e) { return 0; } },
    reset() { data = {}; try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 무시 */ } },
    exportCode() {
      let bin = '';
      new TextEncoder().encode(JSON.stringify(data)).forEach((b) => { bin += String.fromCharCode(b); });
      return btoa(bin);
    },
    importCode(code) {
      const bin = atob(code.replace(/\s/g, ''));
      const obj = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
      if (!isObj(obj)) throw new Error('invalid');
      data = sanitize(obj);
      persist();
    },
  };
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  // ---------- 캐릭터 / 육성 ----------
  const xpNeeded = (lv) => 100 + (lv - 1) * 60;   // lv → lv+1 에 필요한 경험치
  function levelInfo(xp) {
    let level = 1, cur = xp;
    while (cur >= xpNeeded(level)) { cur -= xpNeeded(level); level++; }
    return { level, cur, need: xpNeeded(level) };
  }
  const Profile = {
    exists: () => !!Store.get('profile', 'look', null),
    get() {
      const xp = Store.get('profile', 'xp', 0);
      return Object.assign({
        look: Object.assign({}, Avatar.DEFAULT, Store.get('profile', 'look', {})),
        name: Store.get('profile', 'name', '모험가'),
        xp,
      }, levelInfo(xp));
    },
    startHp: (level) => Math.min(5, 3 + Math.floor((level - 1) / 3)),
    addXp(n) {
      n = Math.max(0, Math.round(n));
      const before = levelInfo(Store.get('profile', 'xp', 0)).level;
      Store.set('profile', 'xp', Store.get('profile', 'xp', 0) + n);
      const after = levelInfo(Store.get('profile', 'xp', 0)).level;
      return { gained: n, level: after, leveledUp: after > before, unlocked: Avatar.unlocksBetween(before, after) };
    },
  };

  // ---------- 요소 / 화면 ----------
  const el = {
    hub: $('#hub'), game: $('#game'), creator: $('#creator'), dev: $('#dev'),
    list: $('#game-list'), hero: $('#hero'),
    title: $('#game-title'), hud: $('#hud'), canvas: $('#canvas'), wrap: $('#canvas-wrap'),
    overlay: $('#overlay'), toast: $('#toast'),
  };
  const SCREENS = ['hub', 'game', 'creator', 'dev'];
  function showScreen(name) {
    for (const s of SCREENS) el[s].hidden = s !== name;
    window.scrollTo(0, 0);
  }

  const games = [];
  const UPCOMING = [];
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
      btn.className = 'btn' + (b.primary ? ' primary' : '') + (b.danger ? ' danger' : '');
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
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 1700);
  }

  function drawAvatarTo(canvas, look, cssSize) {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const px = Math.round(cssSize * dpr);
    canvas.width = canvas.height = px;
    canvas.style.width = canvas.style.height = cssSize + 'px';
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(Avatar.render(look, px), 0, 0);
  }

  // ---------- 허브 ----------
  function renderHub() {
    const p = Profile.get();
    const item = Avatar.find('item', p.look.item);
    el.hero.innerHTML =
      `<canvas class="hero-avatar"></canvas>` +
      `<div class="hero-info">` +
      `<div class="hero-name"><b>${escapeHtml(p.name)}</b><span class="lv">Lv.${p.level}</span></div>` +
      `<div class="xp-bar"><i style="width:${Math.round((p.cur / p.need) * 100)}%"></i></div>` +
      `<div class="hero-sub">EXP ${p.cur} / ${p.need} · 시작 HP ${Profile.startHp(p.level)} · ${item.label}</div>` +
      `</div>` +
      `<button class="btn small" id="btn-customize">꾸미기</button>`;
    drawAvatarTo(el.hero.querySelector('canvas'), p.look, 64);
    $('#btn-customize').onclick = () => openCreator(false);

    el.list.innerHTML = '';
    for (const g of games) {
      const card = document.createElement('button');
      card.className = 'card';
      card.innerHTML =
        `<canvas class="card-icon" width="64" height="64"></canvas>` +
        `<div class="card-text"><b>${g.title}</b><span>${g.desc}</span>` +
        `<small>${g.bestLabel || '최고 점수'} ${Store.get(g.id, 'best', 0)}</small></div>`;
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
    $('#app-version').textContent = 'v' + APP.version;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (standalone) $('#install-hint').hidden = true;

  // ---------- 캐릭터 만들기 / 꾸미기 ----------
  let draft = null, creatorFirst = false;

  function openCreator(first) {
    creatorFirst = first;
    const p = Profile.get();
    draft = Object.assign({}, p.look);
    $('#creator-name').value = Profile.exists() ? p.name : '';
    $('#creator-title').textContent = first ? '내 캐릭터 만들기' : '캐릭터 꾸미기';
    $('#creator-save').textContent = first ? '모험 시작!' : '저장';
    $('#creator-cancel').hidden = first;
    showScreen('creator');
    if (!first) history.pushState({ screen: 'creator' }, '');
    renderCreator();
  }

  function renderCreator() {
    const level = Profile.get().level;
    drawAvatarTo($('#creator-preview'), draft, 128);
    $('#creator-level').textContent = `Lv.${level}`;
    const box = $('#creator-opts');
    box.innerHTML = '';
    for (const group of ['gender', 'skin', 'hairStyle', 'hairColor', 'clothes', 'item']) {
      const sec = document.createElement('div');
      sec.className = 'opt-group';
      const h = document.createElement('h4');
      h.textContent = Avatar.GROUP_LABEL[group];
      sec.appendChild(h);
      const row = document.createElement('div');
      row.className = 'opt-row';
      const genderFixed = group === 'gender' && !creatorFirst;   // 성별은 처음 만들 때만 선택
      for (const o of Avatar.OPTIONS[group]) {
        if (genderFixed && draft.gender !== o.id) continue;
        const locked = o.lv && o.lv > level;
        const b = document.createElement('button');
        b.className = 'opt' + (o.color ? ' swatch' : '') + (draft[group] === o.id ? ' on' : '') + (locked ? ' locked' : '');
        b.setAttribute('aria-label', o.label);
        if (o.color) {
          b.style.setProperty('--c', o.color);
          if (locked) b.innerHTML = `<small>Lv${o.lv}</small>`;
        } else {
          b.innerHTML = escapeHtml(o.label) + (locked ? ` <small>🔒Lv${o.lv}</small>` : '');
        }
        b.onclick = () => {
          if (genderFixed) { toast('성별은 처음 만들 때만 정할 수 있어요'); return; }
          if (locked) { toast(`Lv.${o.lv}부터 쓸 수 있어요`, '#facc15'); return; }
          // 성별을 바꾸면 기본 머리 모양으로 변경: 여자 → 단발, 남자 → 짧은 머리 (이후 자유롭게 다시 선택 가능)
          if (group === 'gender' && draft.gender !== o.id) draft.hairStyle = o.id === 'girl' ? 'bob' : 'short';
          draft[group] = o.id;
          renderCreator();
        };
        row.appendChild(b);
      }
      sec.appendChild(row);
      if (group === 'gender') {
        const d = document.createElement('p');
        d.className = 'opt-desc';
        d.textContent = creatorFirst ? '⚠ 성별은 지금만 정할 수 있고, 나중에 바꿀 수 없어요' : '성별은 처음 만들 때만 정할 수 있어요';
        sec.appendChild(d);
      }
      if (group === 'item') {
        const d = document.createElement('p');
        d.className = 'opt-desc';
        d.textContent = Avatar.find('item', draft.item).desc;
        sec.appendChild(d);
      }
      box.appendChild(sec);
    }
  }

  $('#creator-save').onclick = () => {
    const name = $('#creator-name').value.trim().slice(0, 8) || '모험가';
    Store.set('profile', 'look', draft);
    Store.set('profile', 'name', name);
    if (creatorFirst) {
      toast(`${name}의 모험이 시작돼요!`, '#facc15');
      goHub();
    } else {
      toast('저장했어요', '#22c55e');
      back();
    }
  };
  $('#creator-cancel').onclick = back;

  // ---------- 게임 열기/닫기 ----------
  function makeCtx(def) {
    return {
      canvas: el.canvas,
      store: {
        get: (k, d) => Store.get(def.id, k, d),
        set: (k, v) => Store.set(def.id, k, v),
        del: (k) => Store.del(def.id, k),
      },
      profile: () => Profile.get(),
      startHp: () => Profile.startHp(Profile.get().level),
      addXp: (n) => Profile.addXp(n),
      // 경험치 지급 + 결과 화면용 HTML (점수 10점 = 경험치 1)
      xpReport(score) {
        const r = Profile.addXp(score / 10);
        let html = `<div class="level-up">경험치 <b>+${r.gained} EXP</b>`;
        if (r.leveledUp) {
          html += `<br>🎉 <b>레벨 업! Lv.${r.level}</b>`;
          if (r.unlocked.length) html += `<small>새로 열림: ${r.unlocked.join(', ')}</small>`;
        }
        return html + '</div>';
      },
      held: () => Hold.d,   // 지금 누르고 있는 방향 [dx, dy] 또는 null
      setButton,            // 게임 전용 버튼 글자/강조 바꾸기
      setHud: (html) => { el.hud.innerHTML = html; },
      overlay: showOverlay,
      hideOverlay,
      toast,
      vibrate: (p) => { if (Store.get('settings', 'vibrate', true) && navigator.vibrate) navigator.vibrate(p); },
      exit: back,
    };
  }

  function openGame(def) {
    showScreen('game');
    el.game.classList.toggle('lr', def.controls === 'lr');   // 좌우만 쓰는 게임은 위/아래 버튼 숨김
    $('#btn-pause').style.visibility = def.noPause ? 'hidden' : '';   // 실시간 게임은 일시정지 없음
    renderGameButtons(def);
    el.title.textContent = def.title;
    el.hud.innerHTML = '';
    paused = false;
    hideOverlay();
    resizeCanvas();
    current = { def, inst: def.create(makeCtx(def)) };
    history.pushState({ screen: 'game' }, '');   // 안드로이드 뒤로가기 = 메뉴로
  }

  // 게임 전용 버튼 (예: A 행동, 🔨 만들기). def.buttons = [{ id, label, key, primary }]
  function renderGameButtons(def) {
    const box = $('#game-btns');
    box.innerHTML = '';
    const list = def.buttons || [];
    $('.pad-area').classList.toggle('has-btns', list.length > 0);
    for (const b of list) {
      const btn = document.createElement('button');
      btn.className = 'game-btn' + (b.primary ? ' primary' : '');
      btn.dataset.id = b.id;
      btn.textContent = b.label;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (current && !paused && el.overlay.hidden && current.inst.onButton) current.inst.onButton(b.id);
      });
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
      box.appendChild(btn);
    }
  }
  function setButton(id, label, active) {
    const btn = document.querySelector(`#game-btns [data-id="${id}"]`);
    if (!btn) return;
    if (label !== undefined) btn.textContent = label;
    btn.classList.toggle('active', !!active);
  }

  // 어떤 화면이든 허브로 돌아가기
  function goHub() {
    if (current) {
      if (current.inst.destroy) current.inst.destroy();
      current = null;
    }
    paused = false;
    Hold.stop();
    hideOverlay();
    showScreen('hub');
    renderHub();
  }
  function back() {
    if (history.state && history.state.screen) history.back();
    else goHub();
  }
  window.addEventListener('popstate', goHub);
  $('#btn-back').onclick = back;

  // ---------- 일시정지 ----------
  function pause() {
    if (!current || paused || !current.inst.isPlaying()) return;
    paused = true;
    Hold.stop();
    showOverlay({
      title: '일시정지',
      buttons: [
        { label: '계속하기', primary: true, onClick: resume },
        { label: '메뉴로', onClick: back },
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

  // ---------- 입력 ----------
  function dir(dx, dy) {
    if (!current || paused || !el.overlay.hidden) return;
    if (current.inst.onDir) current.inst.onDir(dx, dy);
  }

  // 길게 누르면 반복 이동 (가상 패드, 키보드 공용)
  const HOLD_DELAY = 150, HOLD_REPEAT = 85;
  const Hold = {
    d: null, t1: 0, t2: 0,
    start(d) {
      if (this.d && this.d[0] === d[0] && this.d[1] === d[1]) return;
      this.stop();
      this.d = d;
      dir(d[0], d[1]);
      this.t1 = setTimeout(() => { this.t2 = setInterval(() => this.d && dir(this.d[0], this.d[1]), HOLD_REPEAT); }, HOLD_DELAY);
    },
    stop() { clearTimeout(this.t1); clearInterval(this.t2); this.d = null; },
  };

  const KEYS = {
    ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
    ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
  };
  const heldKeys = [];
  window.addEventListener('keydown', (e) => {
    const tag = e.target.tagName;
    if (!el.overlay.hidden) {
      if (tag === 'TEXTAREA') return;
      if (tag === 'INPUT' && e.code !== 'Enter') return;
      if ((e.code === 'Enter' || e.code === 'Space') && overlayPrimary) {
        e.preventDefault();
        overlayPrimary();
      } else if (e.code === 'Escape' && paused) {
        resume();
      }
      return;
    }
    if (!current || tag === 'INPUT') return;
    if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); pause(); return; }
    const gb = (current.def.buttons || []).find((b) => b.key === e.code);    // 게임 전용 버튼 단축키
    if (gb && current.inst.onButton) {
      e.preventDefault();
      if (!e.repeat && !paused) current.inst.onButton(gb.id);
      return;
    }
    if ((e.code === 'Enter' || e.code === 'Space') && current.inst.onAction) {   // 실행 키 (농장 등)
      e.preventDefault();
      if (!e.repeat && !paused) current.inst.onAction();
      return;
    }
    const d = KEYS[e.code];
    if (!d) return;
    e.preventDefault();
    if (e.repeat) return;                       // OS 키 반복 대신 자체 반복 사용 (더 빠르고 일정함)
    if (!heldKeys.includes(e.code)) heldKeys.push(e.code);
    Hold.start(d);
  });
  window.addEventListener('keyup', (e) => {
    const i = heldKeys.indexOf(e.code);
    if (i < 0) return;
    heldKeys.splice(i, 1);
    if (heldKeys.length) Hold.start(KEYS[heldKeys[heldKeys.length - 1]]);
    else Hold.stop();
  });
  window.addEventListener('blur', () => { heldKeys.length = 0; Hold.stop(); });

  // 가상 방향 패드: 누른 채로 손가락을 밀면 방향이 바뀐다
  const pad = $('.dpad');
  const padBtns = {};
  pad.querySelectorAll('[data-dir]').forEach((b) => { padBtns[b.dataset.dir] = b; });
  function padDir(e) {
    const r = pad.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 14) return null;
    return Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
  }
  function padHighlight(d) {
    for (const k in padBtns) padBtns[k].classList.toggle('down-state', !!d && k === d.join(','));
  }
  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    pad.setPointerCapture(e.pointerId);
    const d = padDir(e);
    padHighlight(d);
    if (d) Hold.start(d);
  });
  pad.addEventListener('pointermove', (e) => {
    if (!pad.hasPointerCapture(e.pointerId)) return;
    const d = padDir(e);
    if (!d) return;
    padHighlight(d);
    Hold.start(d);
  });
  const padEnd = () => { padHighlight(null); Hold.stop(); };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => pad.addEventListener(ev, padEnd));
  pad.addEventListener('contextmenu', (e) => e.preventDefault());

  // 캔버스 위를 드래그하면 그 방향으로 한 칸씩 이동
  let swipe = null;
  const STEP = 22;
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

  // 손가락/마우스 위치를 게임에 전달 (onPointer 를 가진 게임만). 좌표는 캔버스 기준 0~1
  function pointer(e) {
    if (!current || !current.inst.onPointer) return;
    const release = e.type !== 'pointerdown' && e.type !== 'pointermove';
    if (!release && (paused || !el.overlay.hidden)) return;
    const r = el.canvas.getBoundingClientRect();
    current.inst.onPointer(e.type, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  }
  ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => el.wrap.addEventListener(ev, pointer));

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
    if (!Profile.exists()) openCreator(true);
    requestAnimationFrame(frame);
  });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }

  return {
    register(def) { games.push(def); },
    // 개발자 화면 등 내부 도구용
    Store, Profile, showScreen, showOverlay, hideOverlay, toast, renderHub, back, goHub, escapeHtml,
  };
})();
