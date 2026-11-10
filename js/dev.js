// 개발자 화면: 메인 로고를 5번 연속 탭 → 비밀번호 입력 → 패치 이력 / 앱 정보 / 저장 데이터 / 도구
// 주의: 코드가 공개되어 있으므로 이 비밀번호는 "일반 사용자에게 숨기는" 용도이지 강력한 보안은 아니다.
// 비밀번호 변경: node tools/dev-password.js 새비밀번호  → 출력된 값을 DEV_HASH에 넣는다.
'use strict';

(() => {
  const DEV_HASH = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';
  const TAPS_NEEDED = 5;
  const $ = (s) => document.querySelector(s);
  const A = window.Arcade;

  // SHA-256 (http/파일 환경에서도 동작하도록 직접 구현)
  function sha256(str) {
    const ror = (x, n) => (x >>> n) | (x << (32 - n));
    const K = [], H = [];
    for (let n = 2, c = 0; c < 64; n++) {
      let prime = true;
      for (let i = 2; i * i <= n; i++) if (n % i === 0) { prime = false; break; }
      if (!prime) continue;
      if (c < 8) H[c] = (Math.pow(n, 1 / 2) * 4294967296) | 0;
      K[c++] = (Math.pow(n, 1 / 3) * 4294967296) | 0;
    }
    const bytes = new TextEncoder().encode(str);
    const total = Math.ceil((bytes.length + 9) / 64) * 64;
    const m = new Uint8Array(total);
    m.set(bytes);
    m[bytes.length] = 0x80;
    const dv = new DataView(m.buffer);
    dv.setUint32(total - 4, (bytes.length * 8) >>> 0);
    dv.setUint32(total - 8, Math.floor((bytes.length * 8) / 4294967296));
    const w = new Array(64);
    for (let off = 0; off < total; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4) | 0;
      for (let i = 16; i < 64; i++) {
        const a = w[i - 15], b = w[i - 2];
        const s0 = ror(a, 7) ^ ror(a, 18) ^ (a >>> 3);
        const s1 = ror(b, 17) ^ ror(b, 19) ^ (b >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (ror(e, 6) ^ ror(e, 11) ^ ror(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const t2 = ((ror(a, 2) ^ ror(a, 13) ^ ror(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
  }

  if (typeof document === 'undefined') { module.exports = { sha256 }; return; }

  // ----- 비밀 탭 -----
  let unlocked = false, taps = 0, tapTimer = 0;
  $('#secret-logo').addEventListener('click', () => {
    taps++;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => { taps = 0; }, 1500);
    if (taps < TAPS_NEEDED) return;
    taps = 0;
    if (unlocked) openDev();
    else askPassword();
  });

  function askPassword() {
    const panel = A.showOverlay({
      title: '개발자 모드',
      html: '비밀번호를 입력하세요.<input id="dev-pw" class="text-input" type="password" autocomplete="off" inputmode="text">',
      buttons: [
        { label: '확인', primary: true, onClick: check },
        { label: '취소', onClick: A.hideOverlay },
      ],
    });
    const input = panel.querySelector('#dev-pw');
    setTimeout(() => input.focus(), 50);
    function check() {
      if (sha256(input.value) === DEV_HASH) {
        unlocked = true;
        A.hideOverlay();
        openDev();
      } else {
        input.value = '';
        A.toast('비밀번호가 틀렸어요', '#ef4444');
      }
    }
  }

  // ----- 개발자 화면 -----
  function openDev() {
    A.showScreen('dev');
    history.pushState({ screen: 'dev' }, '');
    render();
  }

  function row(k, v) { return `<dt>${k}</dt><dd id="${'dv-' + k.replace(/\s/g, '')}">${v}</dd>`; }

  function render() {
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    const sw = navigator.serviceWorker && navigator.serviceWorker.controller ? '활성 (오프라인 가능)' : '비활성';
    const p = A.Profile.get();
    $('#dev-info').innerHTML =
      row('현재 버전', 'v' + APP.version) +
      row('서버 최신 버전', '확인 중...') +
      row('실행 방식', standalone ? '앱 (홈 화면)' : '브라우저') +
      row('오프라인', sw) +
      row('저장 용량', (A.Store.size() / 1024).toFixed(1) + ' KB') +
      row('화면', `${innerWidth} x ${innerHeight} @${devicePixelRatio}x`) +
      row('캐릭터', `${A.escapeHtml(p.name)} · Lv.${p.level} · 누적 EXP ${p.xp}`);

    $('#dev-log').innerHTML = APP.changelog.map((c) =>
      `<div class="log-entry"><div class="log-head"><b>v${c.version}</b><span>${c.date}</span></div>` +
      `<ul>${c.items.map((i) => `<li>${A.escapeHtml(i)}</li>`).join('')}</ul></div>`
    ).join('');

    $('#dev-save').textContent = JSON.stringify(A.Store.all(), null, 2);
    checkRemote();
  }

  // 서버에 올라간 최신 버전 확인 (?fresh 는 서비스워커 캐시를 건너뛴다)
  function checkRemote() {
    const out = $('#dv-서버최신버전');
    fetch('js/version.js?fresh=' + Date.now(), { cache: 'no-store' })
      .then((r) => r.text())
      .then((t) => {
        const m = t.match(/version:\s*'([^']+)'/);
        if (!m) throw new Error();
        out.textContent = 'v' + m[1] + (m[1] === APP.version ? ' (최신)' : ' → 새 버전이 있어요');
      })
      .catch(() => { out.textContent = '확인 불가 (오프라인)'; });
  }

  $('#dev-back').onclick = A.back;

  $('#dev-update').onclick = async () => {
    A.toast('최신 버전을 받는 중...');
    try {
      if (navigator.serviceWorker) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (e) { /* 무시 */ }
    location.reload();
  };

  $('#dev-xp').onclick = () => {
    const r = A.Profile.addXp(100);
    A.toast(r.leveledUp ? `레벨 업! Lv.${r.level}` : 'EXP +100', '#facc15');
    render();
  };

  $('#dev-reset').onclick = () => {
    A.showOverlay({
      title: '저장 데이터 초기화',
      html: '캐릭터, 레벨, 점수 등 <b>모든 저장 데이터가 삭제</b>돼요. 되돌릴 수 없어요.',
      buttons: [
        { label: '삭제하기', danger: true, onClick: () => { A.Store.reset(); location.reload(); } },
        { label: '취소', primary: true, onClick: A.hideOverlay },
      ],
    });
  };

  $('#dev-lock').onclick = () => {
    unlocked = false;
    A.toast('개발자 모드를 잠갔어요');
    A.back();
  };
})();
