// 임시 진단용: 폰에서 먹통(메인스레드 정지) 원인 추적. 원인 확인 후 제거 예정.
const KEY = 'debug_log';

export function dbg(msg) {
  try {
    const a = JSON.parse(localStorage.getItem(KEY) || '[]');
    a.push(new Date().toISOString().slice(11, 23) + ' ' + msg);
    localStorage.setItem(KEY, JSON.stringify(a.slice(-120)));
  } catch { /* ignore */ }
}

export function readDbg() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

export function clearDbg() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

// 렌더 폭주 감지: 컴포넌트 본문에서 매 렌더마다 호출
const counters = {};
export function renderTick(name) {
  const now = Date.now();
  const c = counters[name] || (counters[name] = { n: 0, t: now, logged: false });
  c.n++;
  if (now - c.t > 1000) {
    if (c.n > 200) dbg(`RENDER-LOOP ${name}: ${c.n}/s`);
    c.n = 0; c.t = now; c.logged = false;
  } else if (c.n === 500 && !c.logged) {
    // 1초 안에 500회면 루프 확정 — 정지 전에 즉시 기록
    c.logged = true;
    dbg(`RENDER-LOOP(즉시) ${name}: 500회/1초 미만`);
  }
}

export function installGlobalDebug() {
  window.addEventListener('error', e => dbg('ERROR ' + (e.message || '') + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno));
  window.addEventListener('unhandledrejection', e => dbg('REJECT ' + (e.reason?.message || String(e.reason).slice(0, 120))));
  dbg('APP-START ' + location.pathname);
}
