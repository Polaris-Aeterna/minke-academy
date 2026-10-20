(() => {
'use strict';

/* ================= 工具 ================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pick = a => a[Math.floor(Math.random() * a.length)];
const rnd = (a, b) => a + Math.random() * (b - a);
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const byId = Object.fromEntries(THEORIES.map(t => [t.id, t]));
const body = document.body;
const BASE_TITLE = document.title;
const NOW = new Date();
const DATE_CN = `${NOW.getFullYear()} 年 ${NOW.getMonth() + 1} 月 ${NOW.getDate()} 日`;
const DAYKEY = `${NOW.getFullYear()}-${NOW.getMonth() + 1}-${NOW.getDate()}`;
const seeded = seed => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const hash = str => { let h = 2166136261; for (const ch of str) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const DAYSEED = NOW.getFullYear() * 10000 + (NOW.getMonth() + 1) * 100 + NOW.getDate();
const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
const mkNo = t => 'MK-' + String(THEORIES.indexOf(t) + 1).padStart(3, '0');

/* ================= 状态 ================= */
const KEY = 'minke-academy-v1';
const DEF = {merit:0, ach:{}, visited:{}, flipped:{}, drafts:[], tombs:[], lost:[], flowers:{}, vend:0, classify:0, urge:0, mode:'std', danmaku:true, sound:true, name:'', drink:0, drinkDay:''};
let S;
try { S = Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { S = Object.assign({}, DEF); }
let storageOk = true;
let saveT;
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); storageOk = true; } catch (e) { storageOk = false; } }, 150);
}
const T = {labBase:null, retirePick:'', hybridA:null, deanBack:0};

/* ================= 声音：电子木鱼 ================= */
let actx;
function knock(pitch = 1) {
  if (!S.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(760 * pitch, t);
    o.frequency.exponentialRampToValueAtTime(380 * pitch, t + 0.09);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.45, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g).connect(actx.destination);
    o.start(t); o.stop(t + 0.25);
  } catch (e) {}
}

/* ================= toast / 成就 / 功德 ================= */
function pushToast(el, ms) {
  const box = $('#toasts');
  box.appendChild(el);
  const all = $$('.toast', box);
  if (all.length > 3) all[0].remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, ms);
}
function toast(msg, opts = {}) {
  if (!opts.raw) {
    if (body.classList.contains('mode-queshi')) msg = '确实。';
    else if (body.classList.contains('mode-work')) msg = '好的收到。' + msg + ' 辛苦了。';
  }
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  pushToast(el, opts.ms || 2800);
}
function unlock(id) {
  if (S.ach[id]) return;
  const a = ACH.find(x => x[0] === id);
  if (!a) return;
  S.ach[id] = Date.now();
  save();
  updateAchNum();
  const el = document.createElement('div');
  el.className = 'toast ach-t';
  el.innerHTML = `<span class="medal">成就</span><div><b>成就解锁：${esc(a[1])}</b><br><small>${esc(a[2])}</small></div>`;
  pushToast(el, 3800);
  knock(1.5);
}
function updateAchNum() { $('#achNum').textContent = `${Object.keys(S.ach).length}/${ACH.length}`; }
function floatText(text, x, y) {
  if (RM) return;
  const el = document.createElement('span');
  el.className = 'floater';
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top = (y - 10) + 'px';
  el.style.transform = 'translate(-50%,0)';
  $('#floaters').appendChild(el);
  setTimeout(() => el.remove(), 1000);
}
function addMerit(n, x, y, text) {
  S.merit += n;
  $('#meritNum').textContent = S.merit;
  save();
  if (x != null) floatText(text || `功德+${n}`, x, y);
  if (S.merit >= 100) unlock('merit100');
  if (S.merit >= 500) unlock('merit500');
}
function copyText(text) {
  const done = () => toast('已复制，可以粘贴给朋友了。', {raw:true});
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    ta.remove();
    ok ? done() : toast('复制没有成功。可以手动选中文字再复制。', {raw:true});
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
  else fallback();
}

/* ================= 世界观 ================= */
let modeTimers = [];
const FX = {};
function clearModeFx() {
  modeTimers.forEach(clearInterval);
  modeTimers = [];
  $('#fx').innerHTML = '';
  $$('.wake,.bottle-w').forEach(e => e.remove());
}
function setMode(m, opts = {}) {
  clearModeFx();
  body.classList.remove(...Object.keys(MODES).map(k => 'mode-' + k));
  const list = Array.isArray(m) ? m : [m];
  list.forEach(k => body.classList.add('mode-' + k));
  S.mode = list[0];
  save();
  $('#modeName').textContent = list.map(k => MODES[k].name).join(' + ');
  list.forEach(k => FX[k] && FX[k]());
  if (!opts.silent) {
    list.forEach(k => unlock('m_' + k));
    if (MODES[list[0]] && list.length === 1) toast(`世界观已切换：${MODES[list[0]].name}。${MODES[list[0]].desc}`, {raw:true});
  }
  document.title = body.classList.contains('mode-sleep') ? '（大睡中）' + BASE_TITLE : BASE_TITLE;
  renderModeGrid();
}
FX.sleep = () => {
  const fx = $('#fx');
  fx.insertAdjacentHTML('beforeend', '<div class="moon"></div>');
  if (!RM) modeTimers.push(setInterval(() => {
    const z = document.createElement('span');
    z.className = 'zzz';
    z.textContent = pick(['z', 'Z', 'zZ', 'zzZ', '呼…']);
    z.style.left = rnd(4, 90) + 'vw';
    z.style.top = rnd(30, 92) + 'vh';
    fx.appendChild(z);
    setTimeout(() => z.remove(), 4000);
  }, 650));
  const b = document.createElement('button');
  b.className = 'btn yellow small wake';
  b.textContent = '大睡中 · 点这里醒来';
  b.addEventListener('click', () => { idleSlept = false; setMode('std', {silent:true}); toast('早上好。你睡了一小会儿。', {raw:true}); });
  body.appendChild(b);
};
FX.water = () => {
  const fx = $('#fx');
  const wave = cls => `<svg class="${cls}" viewBox="0 0 1200 30" preserveAspectRatio="none" aria-hidden="true"><path d="M0 15 Q 75 0 150 15 T 300 15 T 450 15 T 600 15 T 750 15 T 900 15 T 1050 15 T 1200 15 V30 H0Z"/></svg>`;
  if (S.drinkDay !== DAYKEY) { S.drink = 0; S.drinkDay = DAYKEY; }
  const lvl = () => (14 + Math.min(S.drink, 3000) / 3000 * 26) + 'vh';
  fx.insertAdjacentHTML('beforeend', `<div class="water" id="waterEl" style="--lvl:${lvl()}">${wave('w1')}${wave('w2')}<div class="body"></div></div>`);
  if (!RM) modeTimers.push(setInterval(() => {
    const b = document.createElement('span');
    const s = rnd(6, 16);
    b.className = 'bubble';
    b.style.cssText = `width:${s}px;height:${s}px;left:${rnd(2, 98)}vw;bottom:${rnd(0, 10)}vh`;
    fx.appendChild(b);
    setTimeout(() => b.remove(), 5000);
  }, 420));
  const w = document.createElement('div');
  w.className = 'bottle-w';
  const pct = () => Math.min(100, S.drink / 2000 * 100);
  w.innerHTML = `<div class="bottle" aria-hidden="true"><i style="height:${pct()}%"></i></div><div><b>今日大水</b><br><span id="drinkTxt" style="font-variant-numeric:tabular-nums">${S.drink} / 2000 ml</span><br><button class="btn small" id="drinkBtn" style="margin-top:4px">喝一口（250ml）</button></div>`;
  body.appendChild(w);
  let sips = [];
  $('#drinkBtn', w).addEventListener('click', e => {
    e.stopPropagation();
    const now = Date.now();
    sips = sips.filter(t => now - t < 5000);
    sips.push(now);
    S.drink += 250;
    save();
    $('i', w).style.height = pct() + '%';
    $('#drinkTxt').textContent = `${S.drink} / 2000 ml`;
    const we = $('#waterEl'); if (we) we.style.setProperty('--lvl', lvl());
    knock(0.6);
    if (sips.length >= 5) {
      sips = [];
      unlock('overdrink');
      toast('医生提醒：短时间大口猛灌可能稀释血钠。强者也要少量多次。本院已暂停供水 3 秒。', {raw:true, ms:4200});
      const btn = $('#drinkBtn'); btn.disabled = true; setTimeout(() => { btn.disabled = false; }, 3000);
    } else if (S.drink === 2000) toast('今日 2000ml 已达成。强者喝大水，也知道什么时候停。', {raw:true});
    else toast(pick(['咕咚。', '强者已饮。', '又省下一杯奶茶钱。', '水位上涨中。']));
  });
};
FX.pink = () => {
  const fx = $('#fx');
  let fans = 1024 + Math.floor(Math.random() * 400);
  const hud = document.createElement('div');
  hud.className = 'fanhud';
  const draw = () => { hud.innerHTML = `<span>粉丝 <b>${fans.toLocaleString('zh-CN')}</b> ↑</span><span>引用 <b>0</b> →</span>`; };
  draw();
  fx.appendChild(hud);
  modeTimers.push(setInterval(() => { fans += Math.floor(rnd(3, 60)); draw(); }, 600));
  if (RM) return;
  modeTimers.push(setInterval(() => {
    const n = document.createElement('span');
    n.className = 'noodle';
    n.textContent = pick(['❤️', '👤', '📈', '➕', '粉']);
    n.style.left = rnd(0, 98) + 'vw';
    n.style.setProperty('--spin', rnd(-200, 200) + 'deg');
    n.style.animationDuration = rnd(4, 8) + 's';
    fx.appendChild(n);
    setTimeout(() => n.remove(), 8200);
  }, 420));
};
FX.crazy = () => {
  if (RM) return;
  const m = $('main');
  m.classList.remove('shake'); void m.offsetWidth; m.classList.add('shake');
  const fx = $('#fx');
  const say = () => {
    const l = document.createElement('div');
    l.className = 'crazyline';
    l.textContent = pick(CRAZY_LINES);
    l.style.left = rnd(2, 40) + 'vw';
    l.style.top = rnd(18, 75) + 'vh';
    fx.appendChild(l);
    setTimeout(() => l.remove(), 2700);
  };
  say();
  modeTimers.push(setInterval(say, 3600));
};
FX.work = () => {
  const fx = $('#fx');
  const notes = ['周报？', '收到', '这个需求很简单', '对齐一下颗粒度', '下班前给我'];
  notes.slice(0, window.innerWidth < 600 ? 2 : 4).forEach((t, i) => {
    const p = document.createElement('div');
    p.className = 'postit';
    p.textContent = t;
    p.style.cssText = `top:${18 + i * 19}vh;${i % 2 ? 'right' : 'left'}:${rnd(1, 4)}vw;transform:rotate(${rnd(-8, 8)}deg)`;
    p.addEventListener('click', () => { p.remove(); toast('已阅，已转发，已忘记。', {raw:true}); });
    fx.appendChild(p);
  });
};
FX.queshi = () => { $('#fx').insertAdjacentHTML('beforeend', '<div class="queshi-wm" aria-hidden="true">确实</div>'); };

function renderModeGrid() {
  const g = $('#modeGrid');
  if (!g) return;
  g.innerHTML = Object.entries(MODES).map(([k, m]) =>
    `<button class="mode-card" data-mode="${k}" aria-pressed="${body.classList.contains('mode-' + k)}"><b>${m.name}</b><span>${m.desc}</span></button>`).join('');
}

/* ================= 弹幕 ================= */
function spawnDanmaku() {
  if (!S.danmaku || RM || document.hidden || body.classList.contains('mode-normal')) return;
  const d = document.createElement('span');
  d.className = 'dm';
  d.textContent = pick(DANMAKU);
  d.style.top = rnd(14, 64) + 'vh';
  const dur = rnd(10, 16);
  d.style.animationDuration = dur + 's';
  d.style.color = pick(['var(--ink)', 'var(--red)', 'var(--blue)', 'var(--green)']);
  d.title = '院内 NPC 弹幕（虚构）。点一下举报。';
  d.addEventListener('click', e => {
    e.stopPropagation();
    d.textContent = '已举报（并没有）';
    d.style.color = 'var(--muted)';
    unlock('danmaku');
  });
  $('#danmaku').appendChild(d);
  setTimeout(() => d.remove(), dur * 1000 + 300);
}

/* ================= 闲置 / 切屏 / 键盘彩蛋 ================= */
let lastAct = Date.now(), idleSlept = false;
function activity() {
  lastAct = Date.now();
  if (idleSlept) {
    idleSlept = false;
    setMode('std', {silent:true});
    toast('你醒了。刚才睡着的那一小会儿，本院替你记下了。', {raw:true});
  }
}
['pointermove', 'keydown', 'scroll', 'touchstart', 'wheel'].forEach(ev => addEventListener(ev, activity, {passive:true}));
setInterval(() => {
  if (!idleSlept && S.mode === 'std' && Date.now() - lastAct > 45000 && !document.hidden && !document.querySelector('dialog[open]')) {
    idleSlept = true;
    setMode('sleep', {silent:true});
    unlock('idle');
    toast('检测到你已经 45 秒没有动静。本院已为你关灯。动一下就能醒来。', {raw:true, ms:4500});
  }
}, 3000);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) document.title = pick(['（大睡中）互联网民间科学院', '院长在找你', '你的大水还没喝完', '确实。', '你去哪了？']);
  else {
    document.title = body.classList.contains('mode-sleep') ? '（大睡中）' + BASE_TITLE : BASE_TITLE;
    if (!body.classList.contains('mode-normal')) { addMerit(1); toast('你回来了。学术功德 +1。'); }
  }
});

function flash(text) {
  const f = document.createElement('div');
  f.className = 'flash';
  f.textContent = text;
  body.appendChild(f);
  setTimeout(() => f.remove(), 2000);
}
function rainSix() {
  if (RM) { toast('666', {raw:true}); return; }
  for (let i = 0; i < 36; i++) {
    const s = document.createElement('span');
    s.className = 'six';
    s.textContent = '6';
    s.style.left = rnd(0, 98) + 'vw';
    s.style.fontSize = rnd(20, 64) + 'px';
    s.style.setProperty('--spin', rnd(-180, 180) + 'deg');
    s.style.animationDuration = rnd(1.6, 3.4) + 's';
    s.style.animationDelay = rnd(0, 0.8) + 's';
    $('#floaters').appendChild(s);
    setTimeout(() => s.remove(), 4400);
  }
}
function deanReturns() {
  unlock('konami');
  T.deanBack = Date.now();
  const cat = $('#officeCat');
  if (cat) { cat.classList.add('in'); $('#officeMsg').textContent = '院长回来了。院长是一只猫。院长压住了论文，然后睡着了。'; }
  else toast('院长回来了。院长是一只猫。它现在在天台的院长办公室，90 秒后会再出门。', {raw:true, ms:4500});
}
const KON = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let kpos = 0, kbuf = '';
document.addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input,textarea,select,[contenteditable]')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k === KON[kpos]) { kpos++; if (kpos === KON.length) { kpos = 0; deanReturns(); } }
  else kpos = k === KON[0] ? 1 : 0;
  if (e.key.length !== 1) return;
  kbuf = (kbuf + e.key.toLowerCase()).slice(-12);
  const hit = w => { if (kbuf.endsWith(w)) { kbuf = ''; return true; } return false; };
  if (hit('dashui')) {
    unlock('dashui');
    toast('检测到拼音歧义：dashui 是大睡还是大水？本院以两种偏好并列执行。', {raw:true, ms:4500});
    setMode(['sleep', 'water'], {silent:true});
  } else if (hit('yuanshen')) { unlock('yuanshen'); flash('原神，启动！'); }
  else if (hit('v50')) {
    unlock('v50');
    const d = NOW.getDay();
    if (d === 4) { flash('疯狂星期四'); toast('今天确实是星期四。本院没有 50，但有一大瓶水。', {raw:true, ms:4000}); }
    else toast(`今天是星期${'日一二三四五六'[d]}。本院允许你提前疯狂，但不允许提前收钱。`, {raw:true, ms:4000});
  }
  else if (hit('666')) { unlock('six'); rainSix(); }
  else if (hit('boji')) setMode('thin');
  else if (hit('dafen')) setMode('pink');
  else if (hit('queshi')) setMode('queshi');
  else if (hit('fafeng')) setMode('crazy');
});

/* 点哪都有反应 */
let lastFloat = 0;
document.addEventListener('click', e => {
  if (e.target.closest('button,a,input,textarea,select,label,summary,dialog,.dm,.sticker,.postit,.face,.seal,.chou,[data-noflt]')) return;
  if (body.classList.contains('mode-normal')) return;
  const now = Date.now();
  if (now - lastFloat < 110) return;
  lastFloat = now;
  const c = body.classList;
  const t = c.contains('mode-queshi') ? '确实'
    : c.contains('mode-sleep') ? pick(['嘘——', 'zzz', '睡意+1'])
    : c.contains('mode-water') ? pick(['咕咚', '大水+1', '波'])
    : c.contains('mode-pink') ? pick(['粉丝+1', '涨粉', '引用+0'])
    : c.contains('mode-thin') ? '线条+1'
    : c.contains('mode-work') ? pick(['收到', '已阅', '好的'])
    : c.contains('mode-crazy') ? pick(['啊！', '啊啊！', '？！'])
    : pick(FLOATS);
  addMerit(1, e.clientX, e.clientY, t);
});

/* ================= 共用片段 ================= */
function roomHead(id, lede) {
  const r = ROOMS.find(x => x.id === id);
  return `<div class="room-head"><nav class="crumb" aria-label="位置"><a href="#home">大厅</a><span>/</span><span>${r.floor}</span><span>/</span><span>${r.name}</span></nav><h1 class="plaque">${r.name}</h1><p class="room-lede">${lede}</p></div>`;
}
function foot() {
  const others = ROOMS.filter(r => r.id !== 'home' && r.id !== current);
  const un = others.filter(r => !S.visited[r.id]);
  const nxt = pick(un.length ? un : others);
  return `<div class="btn-row" style="justify-content:space-between;margin-top:8px"><a class="btn ghost small" href="#home">← 回大厅</a><a class="btn yellow small" href="#${nxt.id}">随便推开一扇门：${nxt.name} →</a></div>`;
}
function cardHtml(t) {
  const s = SRC[t.src];
  return `<div class="card" data-id="${t.id}">
  <div class="card-in">
    <div class="face front" tabindex="0" role="button" aria-label="${esc(t.name)}，翻到背面">
      <div class="card-top"><span>档案 ${mkNo(t)}</span><span>${esc(t.when)}</span></div>
      <h3><span>${esc(t.name)}</span><span class="emo" aria-hidden="true">${t.emoji}</span></h3>
      <p class="slogan"><span>${esc(t.slogan)}</span></p>
      <p>${esc(t.thesis)}</p>
      <div class="tags"><span class="chip ${s.cls}">${s.label}</span><span class="chip mute">${t.fam}</span><span class="stars" title="确实指数">${stars(t.cred)}</span></div>
    </div>
    <div class="face back">
      <div class="back-h">不负责解决什么</div><p>${esc(t.notFor)}</p>
      <div class="back-h">什么时候有用</div><p>${esc(t.useful)}</p>
      <div class="back-h">院内物件</div><p>${esc(t.item)}</p>
      <div class="btn-row" style="margin-top:auto;padding-top:6px"><button class="btn small" data-act="detail">档案详情</button><button class="btn small ghost" data-act="lab">给它一个反例</button></div>
    </div>
  </div></div>`;
}
const SRC_EXPLAIN = {
  net:'网络收录：依据 2026 年的公开报道与网友整理转述。文字是本院的概括，不是原话；本院不收录提出者姓名。',
  pend:'待核实：本院只见到这个名称，主张是按字面推测的。',
  classic:'网络古典：流传已久的说法，出处众多，本院不追溯首创者。',
  orig:'本院戏仿：原创玩笑，不是网络流行语。'
};
function openTheory(id) {
  const t = byId[id];
  if (!t) return;
  $('#theoryBody').innerHTML = `
    <div class="card-top"><span>档案 ${mkNo(t)}</span><span>${SRC[t.src].label} · ${t.fam}</span></div>
    <h2 style="font-family:var(--f-display);font-weight:900;font-size:clamp(24px,5vw,32px);margin:0;line-height:1.25;padding-right:40px">${t.emoji} ${esc(t.name)}</h2>
    <p class="slogan"><span>${esc(t.slogan)}</span></p>
    <dl class="dl">
      <dt>主张</dt><dd>${esc(t.thesis)}</dd>
      <dt>什么时候有用</dt><dd>${esc(t.useful)}</dd>
      <dt>不负责解决</dt><dd>${esc(t.notFor)}</dd>
      <dt>院内物件</dt><dd>${esc(t.item)}</dd>
      <dt>出现时间</dt><dd>${esc(t.when)}</dd>
      <dt>内容身份</dt><dd>${SRC_EXPLAIN[t.src]}</dd>
      <dt>确实指数</dt><dd><span class="stars">${stars(t.cred)}</span></dd>
    </dl>
    <div class="btn-row"><button class="btn" data-go="lab" data-tid="${t.id}">送去反例实验室</button><button class="btn ghost" data-go="hybrid" data-tid="${t.id}">放进培养皿</button><button class="btn ghost" data-go="garden" data-tid="${t.id}">我已经不信了</button></div>`;
  const d = $('#dlgTheory');
  if (!d.open) d.showModal();
}

/* ================= 视图 ================= */
const V = {};
let current = 'home';

/* ---------- 大厅 ---------- */
function buildingHtml() {
  const floors = ['天台', '7F', '6F', '5F', '4F', '3F', '2F', '1F', 'B1'];
  let h = '<div class="building"><div class="roof"><div class="flag"><span>筹</span></div></div><div class="floors">';
  for (const f of floors) {
    const rs = ROOMS.filter(r => r.floor === f);
    h += `<div class="floor"><div class="floor-no">${f}</div>`;
    rs.forEach(r => {
      if (r.id === 'home') h += `<div class="room here"><span class="chip solid">你在这里</span><b>大厅</b></div>`;
      else h += `<a class="room${S.visited[r.id] ? ' visited' : ''}" href="#${r.id}"><span class="door" aria-hidden="true"></span><span class="chip mute">${r.status}</span><b>${r.name}</b></a>`;
    });
    if (f === '天台') h += `<button class="room" type="button" data-wind style="text-align:left;border-top:none;border-right:none;border-bottom:none;font:inherit"><span class="chip mute">风很大</span><b>天台</b></button>`;
    h += '</div>';
  }
  return h + '</div><div class="ground"></div></div>';
}
V.home = {
  html() {
    const dr = seeded(DAYSEED);
    const dpick = a => a[Math.floor(dr() * a.length)];
    const w = [dpick(WEATHER), dpick(WEATHER), dpick(WEATHER)];
    const yi = [...YI].sort(() => dr() - 0.5).slice(0, 2);
    const ji = [...JI].sort(() => dr() - 0.5).slice(0, 2);
    const picks = [...THEORIES].sort(() => dr() - 0.5).slice(0, 3);
    const emo = Math.floor(dr() * 70) + 20;
    const qs = 1 + Math.floor(dr() * 5), wind = 1 + Math.floor(dr() * 9);
    return `<div class="wrap">
    <article class="doc" id="mainDoc">
      <span class="sticker" style="--rot:-6deg;left:-8px;top:-16px" data-sticker="note">看不懂？那就对了</span>
      <span class="sticker round" style="--rot:8deg;right:-12px;top:150px" data-sticker="emo" aria-label="流汗黄豆贴纸">😅</span>
      <h1 class="redhead">互联网民间科学院<span class="chou" id="chou" title="试试把它摘掉">（筹）</span>文件</h1>
      <p class="docno">民科院发〔2026〕250 号</p>
      <div class="redline" aria-hidden="true"><span>★</span></div>
      <h2 class="doc-title">关于让一句歪理<br>拥有一间办公室的通知</h2>
      <div class="doc-body">
        <p class="noindent">各位网友、各学派、各"大×理论"研究小组：</p>
        <p>近期，薄肌、大水、大睡等理论相继出现，中文互联网进入"大理论时代"。为妥善安置这些理论，本院决定（筹）成立。现将有关事项通知如下：</p>
        <ol>
          <li>一、凡来访者，均可在<a href="#archive">理论档案馆</a>查阅 ${THEORIES.length} 份理论档案，并翻到背面，查看它们不负责解决的问题。</li>
          <li>二、对任何理论有意见的，请前往<a href="#lab">反例实验室</a>给它一个具体的"但是"，或在<a href="#hybrid">学说杂交器</a>里让它和别的理论生一个孩子。</li>
          <li>三、有烦恼的，可投入<a href="#vending">理论自动售货机</a>，兑换一张理论收据。本机只收烦恼，不收钱。</li>
          <li>四、尚未加入学派的，请到<a href="#exam">学派分配处</a>免试入学，领取工牌。</li>
          <li>五、对用"苹果安卓"给人分类有疑问的，请咨询<a href="#relativity">相对论研究所</a>。本所只研究手机，不研究人。</li>
          <li>六、不再相信的旧观点，可送往<a href="#garden">退休理论花园</a>安葬，允许申请复活。</li>
          <li>七、本院世界观可随时切换。点顶栏的"世界观"，或者直接在键盘上打出某些拼音。</li>
        </ol>
        <p>特此通知。</p>
      </div>
      <div class="doc-sign">
        <svg class="seal" id="seal" viewBox="0 0 200 200" role="img" aria-label="公章：互联网民间科学院（筹），学术专用章，非权威">
          <defs><path id="sealArc" d="M 30 104 A 70 70 0 1 1 170 104"/></defs>
          <circle cx="100" cy="100" r="92" fill="none" style="stroke:var(--red)" stroke-width="7"/>
          <text font-size="18"><textPath href="#sealArc" startOffset="50%" text-anchor="middle">互联网民间科学院（筹）</textPath></text>
          <text x="100" y="122" font-size="54" text-anchor="middle">★</text>
          <text x="100" y="160" font-size="14" text-anchor="middle">学术专用章·非权威</text>
        </svg>
        <div>互联网民间科学院（筹）</div>
        <div>${DATE_CN}</div>
      </div>
      <div class="doc-foot">
        <div><span>抄送：各位的大睡搭子、饮水搭子，院长（不在）。</span></div>
        <div><span>互联网民间科学院（筹）办公室</span><span>${DATE_CN}印发</span></div>
      </div>
    </article>

    <section>
      <div class="sec-h"><h2>附件一：楼层导览</h2><span class="note">每扇门都能推开。去过的房间会打勾。</span></div>
      ${buildingHtml()}
    </section>

    <section>
      <div class="sec-h"><h2>附件二：院内天气与院历</h2><span class="note">按日期生成，每天不同</span></div>
      <div class="almanac">
        <div>
          <div class="eyebrow">院内天气 · ${DATE_CN}</div>
          <div class="big">上午${w[0]}，午后转${w[1]}，傍晚局部${w[2]}。</div>
          <div class="small muted ui">降 emo 概率 ${emo}% · 确实指数 <span class="stars">${stars(qs)}</span> · 大站风 ${wind} 级</div>
          <div class="small muted ui" style="margin-top:6px">本预报不观测你的情绪，也不观测全网。</div>
        </div>
        <div>
          <div class="eyebrow">院历</div>
          <div class="yiji" style="margin-top:8px"><span class="y">宜</span><span>${yi.join('<br>')}</span><span class="j">忌</span><span>${ji.join('<br>')}</span></div>
        </div>
      </div>
    </section>

    <section>
      <div class="sec-h"><h2>附件三：本日精选档案</h2><span class="note">不以热度排名 · 点卡片翻面</span></div>
      <div class="cards">${picks.map(cardHtml).join('')}</div>
      <div class="btn-row" style="margin-top:14px"><a class="btn" href="#archive">进档案馆看全部 ${THEORIES.length} 份</a><button class="btn ghost" type="button" data-random-room>随便推开一扇门</button></div>
    </section>

    <section class="sources">
      <p><b>本院非权威机构。</b>标"网络收录"的条目依据公开讨论转述，文字为本院概括；标"待核实"的只见过名称；标"本院戏仿"的是原创玩笑。本院只收理论，不收提出者姓名。所有内容都不构成健康、投资或人生建议。喝水请少量多次。</p>
      <p>资料线索：<a href="https://www.huxiu.com/article/4897592.html" target="_blank" rel="noopener">虎嗅《薄肌和大水理论崛起后，中文互联网的"大理论时代"开始了》</a> · <a href="https://baike.baidu.com/item/%E5%A4%A7%E6%B0%B4%E7%90%86%E8%AE%BA/69315070" target="_blank" rel="noopener">百度百科"大水理论"</a> · <a href="https://m.21jingji.com/article/20261020/herald/9bb9d7bc1132e9c761e43e5884bf17b4.html" target="_blank" rel="noopener">21 财经：大水理论走红</a> · <a href="https://github.com/grokkkkkk/cn-theories" target="_blank" rel="noopener">网友整理的"××理论"演变档案</a></p>
      <p>本院源码：<a href="https://github.com/Polaris-Aeterna/minke-academy" target="_blank" rel="noopener">github.com/Polaris-Aeterna/minke-academy</a>。院长不在，欢迎提交新的大×理论。</p>
    </section>

    <div class="endzone" id="endzone">
      <span class="ch" id="endChair" role="button" tabindex="0" aria-label="一把椅子">🪑</span>
      <span>你已到达互联网的尽头。这里只有一把椅子。</span>
    </div>
  </div>`;
  },
  mount(root) {
    let sealClicks = [];
    $('#seal', root).addEventListener('click', e => {
      const now = Date.now();
      sealClicks = sealClicks.filter(t => now - t < 2500);
      sealClicks.push(now);
      knock(0.8);
      floatText(pick(['盖章', '啪', '非权威', '已盖']), e.clientX, e.clientY);
      if (sealClicks.length >= 5) {
        sealClicks = [];
        const s = $('#seal');
        s.classList.add('drop');
        unlock('seal');
        toast('公章掉了。本院已失去最后一点权威。', {raw:true});
        setTimeout(() => { s.classList.remove('drop'); toast('公章已找回。本院重新获得了一点点权威（非权威）。', {raw:true}); }, 2600);
      }
    });
    $('#chou', root).addEventListener('click', () => {
      const c = $('#chou');
      c.classList.add('falling');
      unlock('chou');
      setTimeout(() => { c.classList.remove('falling'); toast('"筹"字永远不摘。已用胶水粘回。', {raw:true}); }, 900);
    });
    $$('[data-sticker]', root).forEach(st => st.addEventListener('click', () => {
      if (st.dataset.sticker === 'note') {
        st.classList.toggle('peeled');
        toast(st.classList.contains('peeled') ? '贴纸已撕下。' : '……又贴回去了。', {raw:true});
      } else {
        const seq = [['😅', '流汗黄豆：尴尬，但保持体面。'], ['🫠', '融化了：班味入骨。'], ['🙂', '微笑：我很平静（我很生气）。'], ['💀', '骷髅：笑死。'], ['😭', '大哭：太好笑了。']];
        const i = (seq.findIndex(x => x[0] === st.textContent) + 1) % seq.length;
        st.textContent = seq[i][0];
        toast(seq[i][1], {raw:true});
      }
    }));
    const end = $('#endzone', root);
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) { unlock('end'); io.disconnect(); } }, {threshold:0.6});
      io.observe(end);
    }
    const sit = () => toast('你坐下了。"马上起来"开始变成一个弹性单位。', {raw:true});
    $('#endChair', root).addEventListener('click', sit);
    $('#endChair', root).addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sit(); } });
  }
};

/* ---------- 档案馆 ---------- */
V.archive = {
  html() {
    return `<div class="wrap">${roomHead('archive', `收录 ${THEORIES.length} 份理论档案。正面是主张，<em>背面是它不负责解决的事</em>。点卡片翻面。`)}
    <div class="panel">
      <div class="field" style="margin-bottom:12px"><label for="arcQ">搜索名称、口号或主张</label><input id="arcQ" type="text" placeholder="例：水、睡、确实、周一" autocomplete="off"></div>
      <div class="filters" role="group" aria-label="按家族筛选">
        <button class="fbtn" data-fam="" aria-pressed="true">全部</button>
        ${FAMS.map(f => `<button class="fbtn" data-fam="${f}" aria-pressed="false">${f}</button>`).join('')}
        <span class="ui small muted" id="arcCount" style="margin-left:auto"></span>
      </div>
    </div>
    <div class="cards" id="arcCards"></div>
    ${foot()}</div>`;
  },
  mount(root) {
    let fam = '', q = '';
    const draw = () => {
      const list = THEORIES.filter(t => (!fam || t.fam === fam) && (!q || (t.name + t.slogan + t.thesis + t.short).toLowerCase().includes(q.toLowerCase())));
      $('#arcCount').textContent = `共 ${list.length} 份`;
      $('#arcCards').innerHTML = list.length ? list.map(cardHtml).join('')
        : `<div class="empty" style="grid-column:1/-1"><b style="font-family:var(--f-display);font-size:18px;color:var(--ink)">本院暂未建立这个学科。</b><span>可以清空筛选，或者去售货机现做一个。</span><div class="btn-row"><button class="btn small ghost" id="arcClear">清空筛选</button><a class="btn small" href="#vending">去售货机</a></div></div>`;
      const c = $('#arcClear');
      if (c) c.addEventListener('click', () => { q = ''; fam = ''; $('#arcQ').value = ''; $$('.fbtn').forEach(b => b.setAttribute('aria-pressed', b.dataset.fam === '')); draw(); });
    };
    $('#arcQ', root).addEventListener('input', e => { q = e.target.value.trim(); draw(); });
    $$('.fbtn', root).forEach(b => b.addEventListener('click', () => {
      fam = b.dataset.fam;
      $$('.fbtn', root).forEach(x => x.setAttribute('aria-pressed', x === b));
      draw();
    }));
    draw();
  }
};

/* ---------- 反例实验室 ---------- */
V.lab = {
  html() {
    const base = T.labBase || 'water';
    return `<div class="wrap">${roomHead('lab', '给一个理论一个具体的"但是"。它不会因此认输，只会长出一个<em>更精确的新版本</em>。原版本永远保留。')}
    <div class="panel bold">
      <div class="grid2">
        <div class="field"><label for="labSel">选一个理论</label><select id="labSel">${THEORIES.map(t => `<option value="${t.id}"${t.id === base ? ' selected' : ''}>${t.emoji} ${esc(t.name)}</option>`).join('')}</select></div>
        <div class="field"><label>当前版本</label><div id="labCur"></div></div>
      </div>
    </div>
    <section><div class="sec-h"><h2>选一个具体的反例</h2><span class="note">不问宏大的哲学问题，只问一个具体场景</span></div>
      <div class="cases" id="labConds">${CONDS.map(c => `<button class="case-btn" data-cond="${c.id}"><b>${c.icon} ${c.label}</b><small>挑战类型：${c.kind}</small></button>`).join('')}</div>
    </section>
    <section id="labOut"></section>
    <section><div class="sec-h"><h2>版本记录</h2><span class="note">每次修改都保留父版本</span></div><div id="labHist"></div></section>
    <section><div class="sec-h"><h2>我的临时抽屉</h2><span class="note">只存在这台设备的浏览器里</span></div><div id="drawer"></div></section>
    ${foot()}</div>`;
  },
  mount(root) {
    let L;
    const reset = id => {
      const t = byId[id];
      L = {t, versions:[{v:1, name:t.name, thesis:t.thesis, cond:null}]};
      $('#labOut').innerHTML = '';
      drawCur(); drawHist();
    };
    const last = () => L.versions[L.versions.length - 1];
    const drawCur = () => {
      const l = last();
      $('#labCur').innerHTML = `<div style="border:1px solid var(--line);padding:8px 12px"><span class="chip red">v${l.v}</span> <b style="font-family:var(--f-display)">${esc(l.name)}</b><div class="small" style="margin-top:4px">${esc(l.thesis)}</div></div>`;
    };
    const drawHist = () => {
      $('#labHist').innerHTML = `<div class="hist">${L.versions.map(v => `<div><span class="vno">v${v.v}${v.cond ? ' · 反例：' + esc(v.cond) : ' · 原版'}</span><b>${esc(v.name)}</b><span class="small">${esc(v.thesis)}</span></div>`).join('')}</div>
        <div class="btn-row" style="margin-top:12px"><button class="btn small" id="labSave"${L.versions.length < 2 ? ' disabled' : ''}>把最新版本存进抽屉</button><button class="btn small ghost" id="labCopy">复制最新版本</button></div>`;
      $('#labSave').addEventListener('click', () => {
        const l = last();
        S.drafts.unshift({id:Date.now(), base:L.t.name, name:l.name, thesis:l.thesis, v:l.v, time:new Date().toLocaleString('zh-CN', {hour12:false})});
        S.drafts = S.drafts.slice(0, 30);
        save();
        drawDrawer();
        setTimeout(() => toast(storageOk ? '已存进抽屉。只保存在这台设备的浏览器里。' : '这个浏览器不让本院保存。可以先复制文字带走。', {raw:true}), 200);
      });
      $('#labCopy').addEventListener('click', () => { const l = last(); copyText(`【${l.name}】v${l.v}\n${l.thesis}\n——互联网民间科学院（筹）反例实验室 · 本院允许你明天改变主意`); });
    };
    const drawDrawer = () => {
      const d = $('#drawer');
      if (!S.drafts.length) { d.innerHTML = '<div class="empty">办公室还没放桌子。<span>在上面确认一个新版本，再点"存进抽屉"。</span></div>'; return; }
      d.innerHTML = `<div class="drafts">${S.drafts.map(x => `<div class="draft"><span class="chip mute" style="align-self:flex-start">源自 ${esc(x.base)} · v${x.v}</span><b>${esc(x.name)}</b><span class="small">${esc(x.thesis)}</span><span class="ui small muted">${esc(x.time)}</span><div class="btn-row"><button class="btn small ghost" data-copy="${x.id}">复制</button><button class="btn small ghost" data-del="${x.id}">删除</button></div></div>`).join('')}</div>`;
      $$('[data-copy]', d).forEach(b => b.addEventListener('click', () => { const x = S.drafts.find(y => String(y.id) === b.dataset.copy); if (x) copyText(`【${x.name}】\n${x.thesis}\n——互联网民间科学院（筹）`); }));
      $$('[data-del]', d).forEach(b => b.addEventListener('click', () => {
        if (b.dataset.armed) { S.drafts = S.drafts.filter(y => String(y.id) !== b.dataset.del); save(); drawDrawer(); toast('已从抽屉里拿走。', {raw:true}); }
        else { b.dataset.armed = '1'; b.textContent = '再点一次确认删除'; setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = '删除'; } }, 3000); }
      }));
    };
    $('#labSel', root).addEventListener('change', e => { T.labBase = e.target.value; reset(e.target.value); });
    $$('[data-cond]', root).forEach(b => b.addEventListener('click', () => {
      const c = CONDS.find(x => x.id === b.dataset.cond);
      const t = L.t, l = last(), n = l.v + 1;
      const sp = LAB_SPECIAL[`${t.id}|${c.id}`];
      const first = L.versions.length === 1;
      const lead = first ? `${t.a}，${t.b}` : l.thesis.replace(/[。！]$/, '');
      const tail = sp ? `当${c.label}时：${sp}` : `当${c.label}时，${c.patch}。`;
      const thesis = first ? `${lead}。但${tail}` : `${lead}。另外，${tail}`;
      const name = (l.name.includes(c.prefix) ? '再' : '') + c.prefix + '·' + l.name;
      $('#labOut').innerHTML = `<div class="panel bold">
        <div class="eyebrow" style="margin-bottom:8px">候选 v${n} · 模板辅助草稿 · 还没确认</div>
        <p class="small muted" style="margin:0 0 10px"><s>${esc(l.thesis)}</s></p>
        <div class="grid2">
          <div class="field"><label for="labName">新名称（最多 24 字）</label><input id="labName" type="text" maxlength="24" value="${esc(name.slice(0, 24))}"></div>
          <div class="field"><label>修改理由</label><div class="small" style="padding-top:8px">加入了"${c.kind}"这个前提，缩小了原来的适用范围。</div></div>
        </div>
        <div class="field" style="margin-top:12px"><label for="labText">新主张（每个字都可以改）</label><textarea id="labText" maxlength="400" rows="4">${esc(thesis)}</textarea></div>
        <div class="btn-row" style="margin-top:12px"><button class="btn" id="labOk">确认为 v${n}</button><button class="btn ghost" id="labDrop">算了，不改</button></div>
      </div>`;
      $('#labOut').scrollIntoView({behavior: RM ? 'auto' : 'smooth', block:'center'});
      $('#labDrop').addEventListener('click', () => { $('#labOut').innerHTML = ''; toast('原版本保持不变。', {raw:true}); });
      $('#labOk').addEventListener('click', () => {
        const nt = $('#labText').value.trim(), nn = $('#labName').value.trim() || name;
        if (!nt) { toast('新主张不能是空的。至少写一句"它在什么时候不对"。', {raw:true}); return; }
        if (nt === l.thesis) { toast('只改了名字，主张没变。可以保存为创作，但不算一次观点修订。', {raw:true, ms:3600}); return; }
        L.versions.push({v:n, name:nn, thesis:nt, cond:c.label});
        $('#labOut').innerHTML = '';
        drawCur(); drawHist();
        unlock('lab1');
        if (n >= 5) unlock('lab5');
        toast(`v${n} 已生成。原句没有被擦掉，只是留下了修改的痕迹。`, {raw:true});
      });
    }));
    reset(T.labBase || 'water');
    drawDrawer();
  }
};

/* ---------- 学说杂交器 ---------- */
V.hybrid = {
  html() {
    const opts = sel => THEORIES.map(t => `<option value="${t.id}"${t.id === sel ? ' selected' : ''}>${t.emoji} ${esc(t.name)}</option>`).join('');
    const a = T.hybridA || 'water';
    const b = a === 'boji' ? 'sleep' : 'boji';
    return `<div class="wrap">${roomHead('hybrid', '把两个理论放进同一个培养皿。它们会先确定关系，再<em>生出一个新学派</em>。产物默认只属于你。')}
    <div class="panel bold">
      <div class="dish-zone">
        <div class="field"><label for="hyA">亲本 A</label><select id="hyA">${opts(a)}</select></div>
        <div class="btn-row" style="justify-content:center"><button class="btn small ghost" id="hyRand">随机配对</button></div>
        <div class="field"><label for="hyB">亲本 B</label><select id="hyB">${opts(b)}</select></div>
      </div>
      <div class="dish" id="dish" style="margin-top:18px"><span class="ea" id="dEa">${byId[a].emoji}</span><span class="eb" id="dEb">${byId[b].emoji}</span></div>
      <div class="btn-row" style="justify-content:center;margin-top:12px"><button class="btn" id="hyGo">开始培养</button></div>
    </div>
    <section id="hyOut"></section>
    ${foot()}</div>`;
  },
  mount(root) {
    const A = () => byId[$('#hyA').value], B = () => byId[$('#hyB').value];
    const syncDish = () => { $('#dEa').textContent = A().emoji; $('#dEb').textContent = B().emoji; $('#dish').classList.remove('merge'); };
    $('#hyA', root).addEventListener('change', syncDish);
    $('#hyB', root).addEventListener('change', syncDish);
    $('#hyRand', root).addEventListener('click', () => {
      const x = pick(THEORIES); let y = pick(THEORIES);
      while (y === x) y = pick(THEORIES);
      $('#hyA').value = x.id; $('#hyB').value = y.id; syncDish();
    });
    const result = (a, b, example) => {
      const seed = hash(a.id + '|' + b.id);
      const r = RELS[seed % RELS.length];
      const names = [`${a.short}${b.short}主义`, `${a.short}系${b.short}学派`, `新${a.short}${b.short}理论`, `${a.short}×${b.short}联合研究所`];
      const nm = names[(seed >>> 3) % names.length];
      const beast = `${a.short.slice(-1)}${b.short.slice(-1)}兽`;
      $('#hyOut').innerHTML = `<div class="result-card">
        <div class="eyebrow">${example ? '示例产物 · ' : ''}培养完成 · 本院杂交产物，非网络流行理论</div>
        <h3>${esc(nm)}</h3>
        <p class="slogan"><span>${esc(a.a)}，${esc(b.b)}。</span></p>
        <dl class="kv">
          <dt>两者关系</dt><dd><span class="chip red">${r.k}</span> ${esc(r.t(a, b))}</dd>
          <dt>继承了</dt><dd>${esc(a.name)}的院内物件：${esc(a.item)}</dd>
          <dt>抛弃了</dt><dd>${esc(b.name)}的顾虑：${esc(b.notFor)}</dd>
          <dt>理论生物</dt><dd><span style="font-size:28px">${a.emoji}${b.emoji}</span> ${esc(beast)}（幼年期）</dd>
          <dt>父母</dt><dd>${esc(a.name)} ${mkNo(a)} × ${esc(b.name)} ${mkNo(b)}</dd>
        </dl>
        <div class="btn-row"><button class="btn small ghost" id="hyCopy">复制这个新学派</button></div>
      </div>`;
      $('#hyCopy').addEventListener('click', () => copyText(`【${nm}】\n${a.a}，${b.b}。\n关系：${r.k}。${r.t(a, b)}\n理论生物：${beast}\n——互联网民间科学院（筹）学说杂交器`));
    };
    $('#hyGo', root).addEventListener('click', () => {
      const a = A(), b = B();
      if (a === b) { toast('同一个理论没法和自己杂交。建议它先去反例实验室长出一个分支。', {raw:true}); return; }
      const d = $('#dish');
      d.classList.remove('merge'); void d.offsetWidth; d.classList.add('merge');
      $('#hyGo').disabled = true;
      setTimeout(() => { result(a, b); $('#hyGo').disabled = false; unlock('hybrid'); knock(1.2); }, RM ? 0 : 1250);
    });
    result(A(), B(), true);
  }
};

/* ---------- 售货机 ---------- */
const WORRY = ['上班','加班','周一','考试','减肥','失眠','熬夜','对象','恋爱','分手','前任','工资','房租','老板','同事','论文','毕业','找工作','面试','催婚','结婚','脱发','头发','焦虑','内耗','拖延','作业','开会','早起','外卖','奶茶','社恐','孤独','无聊','迷茫','deadline','ddl','emo','穷','胖','累','困','钱','班','学习','实习','导师','室友','相亲','体重','睡不着','起不来'];
function worryKey(s) {
  const low = s.toLowerCase();
  const hit = WORRY.filter(w => low.includes(w)).sort((a, b) => b.length - a.length)[0];
  if (hit) return hit;
  let t = s.replace(/[\s，。！？、,.!?~…"“”'‘’（）()【】\[\]:：;；\-—]/g, '');
  [...V_STOP].sort((a, b) => b.length - a.length).forEach(w => { t = t.split(w).join(''); });
  return t.slice(0, 4) || '人生';
}
function receiptHtml(worry, example) {
  const k = worryKey(worry);
  const name = pick(V_PRE) + k + pick(V_SUF);
  const no = 'MK-V-' + String(Math.floor(rnd(1000, 9999)));
  const tm = new Date().toLocaleTimeString('zh-CN', {hour:'2-digit', minute:'2-digit', hour12:false});
  const it = pick(THEORIES).item;
  const lines = {
    slogan:`弱者为${k}烦恼，强者${pick(V_STRONG)}再说。`,
    thesis:`${k}不是问题，${k}的${pick(V_ASPECT)}才是问题。`,
    change:`仅在${pick(V_COND)}有效。`
  };
  const shown = worry.length > 40 ? worry.slice(0, 40) + '…' : worry;
  const text = `互联网民间科学院（筹）理论收据 ${no}\n投入：${shown}\n出货：${name}\n口号：${lines.slogan}\n主张：${lines.thesis}\n找零：${lines.change}\n院内物件：${it}\n本院允许你明天改变主意。`;
  return {text, html:`<div class="receipt" role="document" aria-label="理论收据">
    <div class="c">互联网民间科学院（筹）<br>理论自动售货机 · 3F 第 1 号机</div>
    <hr>
    <div class="row"><span>单号 ${no}</span><span>${tm}</span></div>
    <div>投入：一个烦恼</div>
    <div>「${esc(shown)}」</div>
    <hr>
    <div class="c">【出货】</div>
    <h4>${esc(name)}</h4>
    <div>口号：${esc(lines.slogan)}</div>
    <div>主张：${esc(lines.thesis)}</div>
    <hr>
    <div>找零（适用条件）：</div>
    <div>${esc(lines.change)}</div>
    <hr>
    <div>附赠院内物件：${esc(it)}</div>
    <div>收银员：无（院长出去了）</div>
    <div class="c" style="margin-top:8px">本院允许你明天改变主意。</div>
    <span class="stamp">${example ? '示例' : '已出货'}·非权威</span>
  </div>`};
}
V.vending = {
  html() {
    const slots = THEORIES.filter((t, i) => i % 4 === 0).slice(0, 8);
    const ex = receiptHtml('周一不想上班', true);
    return `<div class="wrap">${roomHead('vending', '投入一个烦恼，吐出一张理论收据。<em>找零永远是一个适用条件</em>。本机只收烦恼，不收钱。')}
    <div class="vend">
      <div class="machine">
        <div class="machine-title">理论自动售货机</div>
        <div class="glass" id="glass">${slots.map(t => `<div class="slot"><span class="e">${t.emoji}</span><small>${esc(t.short)}<br>1 个烦恼</small></div>`).join('')}</div>
        <form class="coin-in" id="vForm">
          <label for="vIn" class="ui small">投币口（请投入一个烦恼）</label>
          <input id="vIn" type="text" maxlength="60" placeholder="例：周一不想上班 / 对象不回消息 / 论文写不完" autocomplete="off">
          <div class="btn-row"><button class="btn yellow" type="submit">投入烦恼</button><button class="btn small ghost" type="button" id="vLucky" style="color:var(--on-red);border-color:var(--on-red);box-shadow:none">帮我想一个烦恼</button></div>
        </form>
        <div class="tray" aria-hidden="true"></div>
      </div>
      <div>
        <div id="vOut">${ex.html}<div class="example-tag">↑ 示例收据。投入你自己的烦恼，会出一张新的。</div></div>
        <div class="btn-row" style="justify-content:center;margin-top:14px"><button class="btn small ghost" id="vCopy">复制收据文字</button></div>
      </div>
    </div>
    ${foot()}</div>`;
  },
  mount(root) {
    let lastText = receiptHtml('周一不想上班', true).text;
    const sample = ['周一不想上班', '对象不回消息', '论文写不完', '又熬夜了', '工资花完了', '老板又开会', '减肥失败', '早上起不来', '外卖吃腻了', '头发越来越少'];
    $('#vLucky', root).addEventListener('click', () => { $('#vIn').value = pick(sample); $('#vIn').focus(); });
    $('#vForm', root).addEventListener('submit', e => {
      e.preventDefault();
      const v = $('#vIn').value.trim();
      if (!v) { toast('投币口是空的。本机只收烦恼，至少投一个小的。', {raw:true}); $('#vIn').focus(); return; }
      const slots = $$('.slot', root);
      const s = pick(slots);
      s.classList.remove('drop'); void s.offsetWidth; s.classList.add('drop');
      setTimeout(() => s.classList.remove('drop'), 900);
      knock(0.9);
      const r = receiptHtml(v);
      lastText = r.text;
      setTimeout(() => {
        $('#vOut').innerHTML = r.html;
        S.vend++; save();
        if (S.vend >= 3) unlock('vending3');
      }, RM ? 0 : 600);
    });
    $('#vCopy', root).addEventListener('click', () => copyText(lastText));
  }
};

/* ---------- 苹果安卓相对论 ---------- */
function classify(thing) {
  const s = thing.trim();
  if (REFUSE.some(w => s.includes(w))) return {refuse:true};
  const h = hash(s);
  const os = OS[h % OS.length];
  const others = OS.filter(o => o !== os);
  return {os, why: os.why[(h >>> 4) % os.why.length], obs: OBSERVERS[(h >>> 8) % OBSERVERS.length], other: others[(h >>> 12) % others.length].k};
}
V.relativity = {
  html() {
    const sel = (id, v) => `<select id="${id}">${['苹果', '安卓', '鸿蒙', '诺基亚'].map(o => `<option${o === v ? ' selected' : ''}>${o}</option>`).join('')}</select>`;
    return `<div class="wrap">${roomHead('relativity', '原说法把万物分成苹果和安卓两类，从手机一路分到学历、房子和人。本所在相对论框架下复核后认为：<em>同一样东西在不同参考系里结论相反</em>。本所只研究手机，不研究人。')}
    <section class="panel bold">
      <div class="sec-h"><h2>万物苹果安卓分类器</h2><span class="note">同一个输入永远得到同一个结论，换一个观察者就相反</span></div>
      <form id="clsForm" class="btn-row" style="align-items:stretch">
        <label for="clsIn" class="sr-only">输入任何东西</label>
        <input id="clsIn" type="text" maxlength="30" placeholder="输入任何东西，例：煎饼果子" style="flex:1;min-width:200px" autocomplete="off">
        <button class="btn" type="submit">分类</button>
      </form>
      <div class="chips" style="margin-top:10px">${CLASSIFY_CHIPS.map(c => `<button type="button" data-cls="${c}">${c}</button>`).join('')}</div>
      <div id="clsOut" style="margin-top:18px"></div>
    </section>
    <section class="panel">
      <div class="sec-h"><h2>洛伦兹聊天换算器</h2><span class="note">电量越低，焦虑速度越接近光速</span></div>
      <div class="formula">γ = 1 / √(1 − <i>v</i>² / <i>c</i>²)，<i>v</i> = 焦虑速度 = (1 − 电量) · <i>c</i></div>
      <div class="grid2" style="margin-top:14px">
        <div class="field"><label for="phMe">我的手机</label>${sel('phMe', '安卓')}</div>
        <div class="field"><label for="phThey">对方的手机</label>${sel('phThey', '苹果')}</div>
      </div>
      <div class="field" style="margin-top:12px"><label for="bat">我的电量：<b id="batV" style="font-variant-numeric:tabular-nums">20%</b></label><input type="range" id="bat" min="1" max="100" value="20"></div>
      <div class="calc-out" id="calcOut" style="margin-top:14px"></div>
      <p id="calcNote" style="margin:14px 0 0"></p>
    </section>
    ${foot()}</div>`;
  },
  mount(root) {
    let count = 0;
    const show = (thing, example) => {
      const r = classify(thing);
      const o = $('#clsOut');
      if (r.refuse) {
        o.innerHTML = `<div class="osbadge" style="background:var(--sheet);color:var(--ink)">本所拒绝</div><p style="margin:14px 0 0;font-size:17px">「${esc(thing)}」涉及人和人的生活。人不是机型，本所不给它分类。</p><p class="muted" style="margin:6px 0 0">相对论结论：在任何参考系中，它都只是它自己。</p>`;
        unlock('refuse');
      } else {
        o.innerHTML = `<div class="osbadge">${r.os.k}</div><p style="margin:14px 0 0;font-size:17px">${example ? '示例：' : ''}「${esc(thing)}」属于 <b>${r.os.k}</b>，因为它${r.why}。</p><p class="muted" style="margin:6px 0 0">相对论修正：在${r.obs}的参考系中，它是<b style="color:var(--red)">${r.other}</b>。因此本分类在任何参考系下都不成立。</p>`;
      }
      if (!example) { count++; S.classify++; save(); if (S.classify >= 5) unlock('classify'); }
    };
    $('#clsForm', root).addEventListener('submit', e => {
      e.preventDefault();
      const v = $('#clsIn').value.trim();
      if (!v) { toast('先输入一样东西。什么都行，人除外。', {raw:true}); return; }
      show(v);
    });
    $$('[data-cls]', root).forEach(b => b.addEventListener('click', () => { $('#clsIn').value = b.dataset.cls; show(b.dataset.cls); }));
    show('煎饼果子', true);

    const TX = (a, b) => {
      if (b === '诺基亚' && a !== '诺基亚') return '对方只能收到一条短信：[图片]。';
      if (a === '诺基亚' && b !== '诺基亚') return '你的消息以短信形式抵达。对方以为你是银行。';
      if (a === b) return '同系统传输，无损。但你们可能聊不出新东西。';
      if (a === '鸿蒙') return '消息已自动流转到对方家的冰箱屏幕上。';
      if (b === '鸿蒙') return '对方的手表、平板和车机同时响了。';
      if (a === '苹果') return '你发的视频，在对方那里会变成一种马赛克艺术。';
      return '你发的表情包，在对方那里可能变成一个问号方框。';
    };
    const calc = () => {
      const bat = +$('#bat').value;
      $('#batV').textContent = bat + '%';
      const v = Math.min(0.9995, (1 - bat / 100) * 0.9995);
      const g = 1 / Math.sqrt(1 - v * v);
      const a = $('#phMe').value, b = $('#phThey').value;
      $('#calcOut').innerHTML = `
        <div><small>焦虑速度 v</small><b>${v.toFixed(3)} c</b></div>
        <div><small>洛伦兹因子 γ</small><b>${g.toFixed(2)}</b></div>
        <div><small>对方的 1 分钟，你感觉像</small><b>${g.toFixed(1)} 分钟</b></div>
        <div><small>你发出的一条语音，对方听到的时长</small><b>${(60 / g).toFixed(0)} 秒</b></div>`;
      const verdict = g < 1.2 ? '参考系基本重合，可以正常聊天。' : g < 3 ? '参考系轻微偏离，建议少发语音。' : g < 10 ? '参考系严重偏离。你们之间隔着一整个电量焦虑。' : '你已经接近光速焦虑。请立刻充电，本所不对任何结论负责。';
      $('#calcNote').innerHTML = `<b>传输效应：</b>${TX(a, b)}<br><b>结论：</b>${verdict}`;
    };
    ['input', 'change'].forEach(ev => { $('#bat', root).addEventListener(ev, calc); });
    $('#phMe', root).addEventListener('change', calc);
    $('#phThey', root).addEventListener('change', calc);
    calc();
  }
};

/* ---------- 大理论家谱 + 老虎机 ---------- */
V.family = {
  html() {
    const n = (id, note, cls = '') => `<button class="node ${cls}" data-open="${id}">${esc(byId[id].name)}<small>${note}</small></button>`;
    return `<div class="wrap">${roomHead('family', '大理论家族的演变图。一切从一层薄薄的线条开始，<em>然后有人拎来了一大瓶水</em>。点节点可以查看档案。')}
    <section class="panel bold">
      <ul class="tree">
        <li><span class="node root">2025 · "三大理论"时期<small>大理论时代的前传</small></span>
          <ul><li>${n('freud', '约 2025 · 民间弗洛伊德')}</li><li>${n('ligong', '约 2025')}</li><li>${n('applerel', '约 2025 · 本院修正版')}</li></ul></li>
        <li>${n('boji', '约 2026.08 · 一切的起点')}
          <ul>
            <li>${n('huangmao', '约 2026.09')}</li>
            <li>${n('water', '2026.10.05 前后 · 起源于对薄肌的戏仿')}
              <ul>
                <li>${n('smallwater', '反方')}</li>
                <li>${n('bigcup', '蹭水派')}</li>
                <li>${n('veg', '营养补丁')}<ul><li>${n('pepper', '2026.10.14 前后')}</li></ul></li>
                <li>${n('sleep', '与薄肌、大水并称"三件套"')}</li>
                <li>${n('stand', '2026.10.13 前后')}</li>
                <li>${n('poop', '网友排的"家族第四席"')}</li>
                <li>${n('egg', '与大氧、大走一样：仅见名称', 'pend')}</li>
              </ul></li>
          </ul></li>
        <li><span class="node root">同期思维派<small>2026.10</small></span>
          <ul><li>${n('dafen', '2026.10.11 前后 · 学术圈分支')}</li><li>${n('queshi', '2026.10.14 前后')}</li><li>${n('nostudent', '2026.10')}</li><li>${n('americano', '2026.10')}</li><li>${n('shuaqi', '川渝分部')}</li></ul></li>
        <li><span class="node root">下一个大×理论<small>可能就是你</small></span>
          <ul><li><a class="node" href="#slotm" data-noflt>去楼下老虎机抽一个 ↓</a></li></ul></li>
      </ul>
      <p class="small muted ui" style="margin:16px 0 0">时间线依据公开报道与网友整理，可能不完整，日期多为"前后"。本院只研究理论，不收录提出者姓名。</p>
    </section>
    <section>
      <div class="sec-h"><h2>大理论老虎机</h2><span class="note">每拉一次杆，诞生一条强者语录</span></div>
      <div class="slotm" id="slotm">
        <div class="reels"><div class="reel" id="r1"><div class="strip"><div>大</div></div></div><div class="reel" id="r2"><div class="strip"><div>水</div></div></div><div class="reel" id="r3"><div class="strip"><div>理论</div></div></div></div>
        <div class="slot-out" id="slotOut" aria-live="polite">大水理论：弱者喝饮料，强者喝大水。</div>
        <div class="btn-row" style="justify-content:center"><button class="btn yellow" id="pull">拉杆！</button><button class="btn small ghost" id="slotCopy" style="color:var(--sheet);border-color:var(--sheet);box-shadow:none">复制这条强者语录</button></div>
      </div>
    </section>
    ${foot()}</div>`;
  },
  mount(root) {
    let last = '大水理论：弱者喝饮料，强者喝大水。';
    const nouns = Object.keys(SLOT_NOUN);
    const spin = (el, items, final, delay) => new Promise(res => {
      const strip = $('.strip', el);
      if (RM) { strip.innerHTML = `<div>${final}</div>`; res(); return; }
      strip.innerHTML = [0, 1, 2, 3, 0].map(() => `<div>${pick(items)}</div>`).join('');
      el.classList.add('spin');
      setTimeout(() => { el.classList.remove('spin'); strip.innerHTML = `<div>${final}</div>`; knock(1.1); res(); }, delay);
    });
    $('#pull', root).addEventListener('click', async () => {
      const btn = $('#pull');
      btn.disabled = true;
      let p = pick(SLOT_PRE), n = pick(nouns), s = pick(SLOT_SUF);
      if (Math.random() < 0.08) { p = '大'; n = '水'; s = '理论'; }
      await Promise.all([spin($('#r1'), SLOT_PRE, p, 700), spin($('#r2'), nouns, n, 1050), spin($('#r3'), SLOT_SUF, s, 1400)]);
      const [weak, strongT] = SLOT_NOUN[n];
      const strong = strongT.replace('{X}', p + n);
      const slogan = p === '反' ? `弱者${strong.replace('反', '大')}，强者${weak}。` : `弱者${weak}，强者${strong}。`;
      const name = p + n + s;
      last = `${name}：${slogan}`;
      let extra = '';
      if (p === '大' && n === '水' && s === '理论') { extra = '<br><small style="font-family:var(--f-ui);font-size:14px">头奖！你抽中了大水理论本体。强者不需要抽奖。</small>'; unlock('jackpot'); rainSix(); }
      else if (p === '大' && (n === '睡' || n === '站' || n === '菜' || n === '粉')) extra = '<br><small style="font-family:var(--f-ui);font-size:14px">正统！这一条在网上真的存在。</small>';
      else if (p === '反') extra = '<br><small style="font-family:var(--f-ui);font-size:14px">"反"字会把强者和弱者对调。另外，"反水"本身就是另一个意思。</small>';
      $('#slotOut').innerHTML = `${esc(name)}：${esc(slogan)}${extra}`;
      unlock('slot');
      btn.disabled = false;
    });
    $('#slotCopy', root).addEventListener('click', () => copyText(last + '\n——互联网民间科学院（筹）大理论老虎机'));
  }
};

/* ---------- 学派分配处 ---------- */
V.exam = {
  html() {
    return `<div class="wrap">${roomHead('exam', '八道题，免试入学。结果只决定<em>你领到哪一张工牌</em>，不决定你是什么样的人。可以随时退出任何学派。')}
    <section class="panel bold" id="examBox"></section>
    ${foot()}</div>`;
  },
  mount() {
    let i = 0, score = {};
    const box = $('#examBox');
    const ask = () => {
      const q = QUIZ[i];
      box.innerHTML = `<div class="q">
        <div class="eyebrow">第 ${i + 1} / ${QUIZ.length} 题</div>
        <div class="progress" aria-hidden="true"><i style="width:${i / QUIZ.length * 100}%"></i></div>
        <h3>${esc(q.q)}</h3>
        <div class="opts">${q.o.map((o, k) => `<button class="opt" data-k="${k}"${q.q.includes('表情') ? ' style="font-size:30px;text-align:center"' : ''}>${esc(o[0])}</button>`).join('')}</div>
      </div>`;
      $$('.opt', box).forEach(b => b.addEventListener('click', () => {
        const key = q.o[+b.dataset.k][1];
        score[key] = (score[key] || 0) + 1;
        i++;
        knock(1 + i * 0.05);
        i < QUIZ.length ? ask() : done();
      }));
    };
    const done = () => {
      const max = Math.max(...Object.values(score));
      const top = Object.keys(score).filter(k => score[k] === max);
      const key = top[Math.floor(Math.random() * top.length)];
      const sc = SCHOOLS[key];
      const no = 'MK-2026-' + String(hash(key + Date.now()) % 10000).padStart(4, '0');
      unlock('exam');
      const render = () => {
        const nm = S.name || '无名民科';
        box.innerHTML = `
          <div class="field" style="max-width:380px;margin:0 auto 16px"><label for="exName">工牌上的称呼（不要填真实姓名）</label><input id="exName" type="text" maxlength="12" value="${esc(S.name)}" placeholder="无名民科"></div>
          <div class="badge-card">
            <div class="hd"><span>互联网民间科学院（筹）</span><span class="hole" aria-hidden="true"></span></div>
            <div class="bd">
              <div class="photo" aria-hidden="true">${sc.emoji}</div>
              <div>
                <div class="nm" id="bdName">${esc(nm)}</div>
                <div class="sch">${sc.name}</div>
                <div class="meta">职称：（筹）研究员<br>工号：${no}<br>天敌：${esc(sc.enemy)}<br>象征物：${esc(sc.symbol)}</div>
              </div>
            </div>
            <div class="ft">院训：<b>${esc(sc.motto)}</b><br>${esc(sc.desc)}</div>
            <svg class="mini" viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="88" fill="none" style="stroke:var(--red)" stroke-width="8"/><text x="100" y="92" text-anchor="middle" font-size="30" style="fill:var(--red);font-family:var(--f-display);font-weight:900">民科院</text><text x="100" y="134" text-anchor="middle" font-size="26" style="fill:var(--red);font-family:var(--f-display);font-weight:900">（筹）</text></svg>
          </div>
          <p class="example-tag">请截图保存。本院没有打印机。</p>
          <div class="btn-row" style="justify-content:center;margin-top:8px">
            <button class="btn small" id="exCopy">复制工牌文字</button>
            ${sc.mode ? `<button class="btn small ghost" id="exMode">切换到本学派世界观</button>` : ''}
            <button class="btn small ghost" id="exAgain">重新考一次</button>
          </div>`;
        $('#exName').addEventListener('input', e => { S.name = e.target.value.trim(); save(); $('#bdName').textContent = S.name || '无名民科'; });
        $('#exCopy').addEventListener('click', () => copyText(`【互联网民间科学院（筹）工牌】\n${S.name || '无名民科'} · ${sc.name}\n工号：${no}\n院训：${sc.motto}\n${sc.desc}\n——可以随时退出任何学派。`));
        const m = $('#exMode'); if (m) m.addEventListener('click', () => setMode(sc.mode));
        $('#exAgain').addEventListener('click', () => { i = 0; score = {}; ask(); });
      };
      render();
    };
    ask();
  }
};

/* ---------- 代际翻译局 ---------- */
function hahaLevel(n) {
  if (n === 0) return ['零哈', '没有笑。这是一句陈述，或者一次威胁。'];
  if (n === 1) return ['单哈', '冷漠。或者打字时有人在看你的屏幕。'];
  if (n === 2) return ['双哈', '礼貌性回应，"已读"的文字版。'];
  if (n === 3) return ['三哈', '标准社交剂量，不多不少。'];
  if (n <= 6) return ['真哈', '是真的有点好笑。'];
  if (n <= 12) return ['爆哈', '笑出声了，大概率在被窝里。'];
  if (n < 30) return ['哈到打鸣', '已经笑出了鸡叫。'];
  return ['纯粹的哈', '已脱离语言，进入纯粹的哈。哈学通胀已失控。'];
}
V.emoji = {
  html() {
    const max = Math.max(...ZAIMA.map(z => z[1]));
    return `<div class="wrap">${roomHead('emoji', '同一个表情，长辈和年轻人读出来的意思可能完全相反。本局负责翻译，<em>不负责调解家庭矛盾</em>。')}
    <section class="panel bold">
      <div class="sec-h"><h2>哈学通胀计</h2><span class="note">"哈"越多，单个"哈"越不值钱</span></div>
      <div class="haha-meter">
        <label for="haIn" class="ui small muted">输入你要发出去的笑</label>
        <textarea id="haIn" rows="2" maxlength="300">哈哈哈</textarea>
        <div class="bar2" aria-hidden="true"><i id="haBar"></i></div>
        <div class="haha-verdict" id="haV"></div>
        <div class="small muted ui" id="haX"></div>
      </div>
    </section>
    <section class="panel">
      <div class="sec-h"><h2>表情包代际翻译</h2><span class="note">点一个表情</span></div>
      <div class="emo-grid" id="emoGrid">${EMOJI.map((x, i) => `<button data-i="${i}" aria-pressed="${x.e === '😭'}" aria-label="翻译 ${x.e}">${x.e}</button>`).join('')}</div>
      <div id="emoOut" style="margin-top:14px"></div>
    </section>
    <section class="panel">
      <div class="sec-h"><h2>"在吗"后续内容分析</h2><span class="note">数据来源：本院编造，仅供心理准备</span></div>
      <div class="hbars">${ZAIMA.map(z => `<div class="hbar${z[1] < 1 ? ' hi' : ''}"><span class="lab">${z[0]}</span><span class="track"><i style="width:0" data-w="${Math.max(0.6, z[1] / max * 100)}"></i></span><span class="v">${z[1]}%</span></div>`).join('')}</div>
      <div class="btn-row" style="margin-top:14px"><button class="btn small" id="zaiNo">回复"不在"</button><button class="btn small ghost" id="zaiYes">回复"在"</button></div>
    </section>
    ${foot()}</div>`;
  },
  mount(root) {
    const ha = () => {
      const s = $('#haIn').value;
      const n = (s.match(/[哈hH]/g) || []).length;
      const [lv, d] = hahaLevel(n);
      $('#haBar').style.width = Math.min(100, n / 30 * 100) + '%';
      $('#haV').textContent = `${lv}（${n} 哈）：${d}`;
      const extras = [];
      if (s.includes('笑死')) extras.push('检测到"笑死"：实际没死，请放心。');
      if (s.includes('😂')) extras.push('检测到 😂：长辈的真诚，或者年轻人的反讽。');
      if (s.includes('😭')) extras.push('检测到 😭：在年轻人那里，这通常表示太好笑了。');
      if (/[?？]/.test(s)) extras.push('检测到问号：对方可能并没有在笑。');
      if (/^(h+|H+)$/.test(s.trim()) && n >= 3) extras.push('检测到纯字母哈：键盘没切中文，但心意到了。');
      $('#haX').textContent = extras.join(' ') || `哈 CPI：${(n * 1.37).toFixed(2)}（以"三哈"为基期 = 4.11）`;
      if (n >= 30) unlock('haha');
    };
    $('#haIn', root).addEventListener('input', ha);
    ha();
    const showEmo = i => {
      const x = EMOJI[i];
      $$('#emoGrid button').forEach(b => b.setAttribute('aria-pressed', b.dataset.i == i));
      $('#emoOut').innerHTML = `<div class="gen-table"><div class="k">表情</div><div style="font-size:30px;line-height:1.2">${x.e}</div><div class="k">长辈读作</div><div>${esc(x.old)}</div><div class="k">年轻人读作</div><div>${esc(x.young)}</div><div class="k">本局注</div><div class="muted">${esc(x.note)}</div></div>`;
    };
    $$('#emoGrid button', root).forEach(b => b.addEventListener('click', () => { showEmo(+b.dataset.i); knock(1.3); }));
    showEmo(EMOJI.findIndex(x => x.e === '😭'));
    requestAnimationFrame(() => setTimeout(() => $$('.hbar i', root).forEach(i => { i.style.width = i.dataset.w + '%'; }), 60));
    $('#zaiNo', root).addEventListener('click', () => toast('对方："那你回什么。"', {raw:true}));
    $('#zaiYes', root).addEventListener('click', () => toast(`对方："${pick(['能借我 200 吗', '帮我砍一刀', '帮我投个票', '你会员能借我用一下吗', '没事了'])}"`, {raw:true}));
  }
};

/* ---------- 理论法院 ---------- */
V.court = {
  html() {
    return `<div class="wrap">${roomHead('court', '每次只审一句话。判决不给任何一方盖"错误"的章，而是写出<em>两条带条件的条款</em>。允许以两种偏好并列结案。')}
    <section><div class="cases" id="caseSel">${CASES.map((c, k) => `<button class="case-btn" data-c="${k}" aria-pressed="${k === 0}"><b>${esc(c.title)}</b><small>案由：${esc(c.cause)}</small></button>`).join('')}</div></section>
    <section class="panel bold">
      <div class="eyebrow" id="caseNo" style="margin-bottom:10px"></div>
      <div class="transcript" id="trans" aria-live="polite"></div>
      <div class="btn-row" style="margin-top:16px"><button class="btn" id="nextLine">下一句</button><button class="btn ghost small" id="skipLine">直接宣判</button></div>
    </section>
    <section id="verdict"></section>
    ${foot()}</div>`;
  },
  mount(root) {
    let c, k;
    const line = l => `<div class="line${l[2] ? ' sys' : ''}"><span class="who">${esc(l[0])}</span><span>${esc(l[1])}</span></div>`;
    const start = idx => {
      c = CASES[idx]; k = 2;
      $$('.case-btn', root).forEach(b => b.setAttribute('aria-pressed', +b.dataset.c === idx));
      $('#caseNo').textContent = `（2026）民科法民初字第 ${250 + idx} 号 · 案由：${c.cause}`;
      $('#trans').innerHTML = c.lines.slice(0, k).map(line).join('');
      $('#verdict').innerHTML = '';
      $('#nextLine').disabled = false; $('#skipLine').disabled = false;
      $('#nextLine').textContent = '下一句';
    };
    const verdict = () => {
      $('#trans').innerHTML = c.lines.map(line).join('');
      $('#nextLine').disabled = true; $('#skipLine').disabled = true;
      $('#verdict').innerHTML = `<div class="verdict">
        <h3>判决书</h3>
        <p class="ui small muted" style="text-align:center;margin:0">${esc(c.title)}</p>
        <p style="margin:14px 0 0">本院认为，双方均有其适用的场景。现判决如下：</p>
        <ol>${c.verdict.map(v => `<li>${esc(v)}</li>`).join('')}</ol>
        <p style="margin:16px 0 0;text-align:right;padding-right:110px">互联网民间科学院（筹）理论法院<br>${DATE_CN}</p>
        <svg class="stampin" viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="86" fill="none" style="stroke:var(--red)" stroke-width="8"/><text x="100" y="92" text-anchor="middle" font-size="34" style="fill:var(--red);font-family:var(--f-display);font-weight:900">并列</text><text x="100" y="136" text-anchor="middle" font-size="34" style="fill:var(--red);font-family:var(--f-display);font-weight:900">结案</text></svg>
        ${c.after === 'pink' ? '<div class="btn-row" style="margin-top:14px"><button class="btn small" id="courtPink">允许法庭变成粉色</button></div>' : ''}
      </div>`;
      knock(0.5);
      unlock('court');
      const p = $('#courtPink'); if (p) p.addEventListener('click', () => setMode('pink'));
    };
    $('#nextLine', root).addEventListener('click', () => {
      if (k < c.lines.length) {
        $('#trans').insertAdjacentHTML('beforeend', line(c.lines[k]));
        k++;
        knock(1.2);
        if (k >= c.lines.length) $('#nextLine').textContent = '宣判';
      } else verdict();
    });
    $('#skipLine', root).addEventListener('click', verdict);
    $$('.case-btn', root).forEach(b => b.addEventListener('click', () => start(+b.dataset.c)));
    start(0);
  }
};

/* ---------- 退休理论花园 ---------- */
V.garden = {
  html() {
    return `<div class="wrap">${roomHead('garden', '过气的梗、不再相信的观点，都葬在这里。可以献花，<em>也可以申请复活</em>，但复活的结果本院不保证。')}
    <section class="panel bold">
      <div class="sec-h"><h2>亲手退休一个观点</h2><span class="note">只保存在这台设备的浏览器里</span></div>
      <form id="retForm" class="grid2">
        <div class="field"><label for="retName">不再相信的观点</label><input id="retName" type="text" maxlength="24" placeholder="例：等一切准备好了再开始" value="${esc(T.retirePick)}"></div>
        <div class="field"><label for="retWhy">它曾经为什么对你有用（会刻在碑上）</label><input id="retWhy" type="text" maxlength="40" placeholder="例：它让我少犯了一些错"></div>
        <div class="btn-row"><button class="btn" type="submit">安葬</button></div>
      </form>
    </section>
    <div class="tombs" id="tombs"></div>
    ${foot()}</div>`;
  },
  mount(root) {
    T.retirePick = '';
    const all = () => [...S.tombs.map(t => ({...t, mine:true})), ...TOMBS.map(t => ({name:t[0], yr:t[1], epi:t[2]}))];
    const draw = () => {
      $('#tombs').innerHTML = all().map(t => {
        const f = S.flowers[t.name] || 0;
        return `<div class="tomb${t.mine ? ' mine' : ''}" data-name="${esc(t.name)}">
          <span class="yr">${esc(t.yr)}</span>
          <h3>${esc(t.name)}</h3>
          <p>${esc(t.epi)}</p>
          <div class="flowers" aria-label="${f} 朵花">${f > 10 ? '🌼'.repeat(10) + ' ×' + f : '🌼'.repeat(f)}</div>
          <div class="res-line"></div>
          <div class="acts"><button data-fl>献花</button><button data-rv>申请复活</button>${t.mine ? '<button data-rm>移除</button>' : ''}</div>
        </div>`;
      }).join('');
      $$('.tomb').forEach(el => {
        const name = el.dataset.name;
        $('[data-fl]', el).addEventListener('click', () => {
          S.flowers[name] = (S.flowers[name] || 0) + 1; save();
          const f = S.flowers[name];
          $('.flowers', el).textContent = f > 10 ? '🌼'.repeat(10) + ' ×' + f : '🌼'.repeat(f);
          unlock('flower');
        });
        $('[data-rv]', el).addEventListener('click', () => {
          el.classList.remove('alive'); void el.offsetWidth; el.classList.add('alive');
          $('.res-line', el).textContent = pick(REVIVE);
          unlock('revive');
        });
        const rm = $('[data-rm]', el);
        if (rm) rm.addEventListener('click', () => {
          if (rm.dataset.armed) { S.tombs = S.tombs.filter(t => t.name !== name); save(); draw(); }
          else { rm.dataset.armed = '1'; rm.textContent = '确认移除'; }
        });
      });
    };
    $('#retForm', root).addEventListener('submit', e => {
      e.preventDefault();
      const n = $('#retName').value.trim(), w = $('#retWhy').value.trim();
      if (!n) { toast('先写下要退休的观点。', {raw:true}); return; }
      if (S.tombs.some(t => t.name === n) || TOMBS.some(t => t[0] === n)) { toast('花园里已经有一块同名的碑了。', {raw:true}); return; }
      S.tombs.unshift({name:n, yr:`退休于 ${NOW.getFullYear()}.${NOW.getMonth() + 1}.${NOW.getDate()}`, epi: w ? `它曾经让我：${w}` : '它曾经有用过。'});
      save(); draw();
      $('#retName').value = ''; $('#retWhy').value = '';
      unlock('retire');
      toast('已安葬。改变主意不是输了，是版本更新。', {raw:true});
    });
    draw();
  }
};

/* ---------- 失物招领处 ---------- */
V.lost = {
  html() {
    return `<div class="wrap">${roomHead('lost', '本院拾获的物品都在这里。<em>认领前请准备好证明你曾经拥有过它的材料</em>。若发现疑似终极结论，也请交到本处。')}
    <div class="lost" id="lostList"></div>
    <section class="panel">
      <div class="sec-h"><h2>登记一件失物</h2><span class="note">只保存在这台设备的浏览器里</span></div>
      <form id="lostForm" class="btn-row" style="align-items:stretch">
        <label for="lostIn" class="sr-only">丢了什么</label>
        <input id="lostIn" type="text" maxlength="30" placeholder="例：上周的我" style="flex:1;min-width:200px" autocomplete="off">
        <button class="btn" type="submit">登记</button>
      </form>
    </section>
    ${foot()}</div>`;
  },
  mount(root) {
    const draw = () => {
      const items = [...S.lost.map(x => [x, '拾获于：刚刚，你自己交来的']), ...LOST];
      $('#lostList').innerHTML = items.map((x, i) => `<div class="lost-row"><span class="no">No.${String(i + 1).padStart(3, '0')}</span><div><b>${esc(x[0])}</b><small>${esc(x[1])}</small></div><button class="btn small ghost" data-claim="${i}">认领</button><div class="res" aria-live="polite"></div></div>`).join('');
      $$('[data-claim]').forEach(b => b.addEventListener('click', () => {
        b.closest('.lost-row').querySelector('.res').textContent = pick(CLAIM);
        unlock('claim');
        knock(0.7);
      }));
    };
    $('#lostForm', root).addEventListener('submit', e => {
      e.preventDefault();
      const v = $('#lostIn').value.trim();
      if (!v) { toast('先写下你丢了什么。', {raw:true}); return; }
      S.lost.unshift(v); S.lost = S.lost.slice(0, 20); save();
      $('#lostIn').value = '';
      draw();
      toast('已登记。本处会妥善保管，但不保证它会回来。', {raw:true});
    });
    draw();
  }
};

/* ---------- 长期主义研究室 ---------- */
let renoTimer;
V.longterm = {
  html() {
    const tm = new Date(NOW.getTime() + 86400000);
    return `<div class="wrap">${roomHead('longterm', '本研究室尚未装修，但<em>认为时间站在自己这边</em>。')}
    <div class="tape" aria-hidden="true"></div>
    <section class="panel bold" style="text-align:center">
      <div class="eyebrow">装修进度（实时）</div>
      <div class="reno" id="reno">0%</div>
      <p style="margin:6px 0 0">预计完工：<b>明天</b>（${tm.getMonth() + 1} 月 ${tm.getDate()} 日）</p>
      <p class="small muted ui" style="margin:2px 0 0">明天到来时，预计完工日期会自动顺延到下一个明天。</p>
      <div class="btn-row" style="justify-content:center;margin-top:16px"><button class="btn" id="urge">催一下</button></div>
      <p id="urgeMsg" class="res-line" style="margin-top:12px" aria-live="polite"></p>
    </section>
    <div class="tape" aria-hidden="true"></div>
    ${foot()}</div>`;
  },
  mount(root) {
    const start = new Date(2019, 0, 1).getTime();
    const tick = () => { const el = $('#reno'); if (!el) { clearInterval(renoTimer); return; } el.textContent = ((Date.now() - start) / 1000 * 1e-10).toFixed(9) + '%'; };
    clearInterval(renoTimer);
    renoTimer = setInterval(tick, 80);
    tick();
    let n = 0;
    const msgs = ['已收到。长期主义不接受催促。', '研究室回复：时间站在我们这边。', '装修队表示在路上了。2019 年就在路上了。', '已为你记录催促一次。催促本身也是一种长期主义。', '本研究室正在开会，讨论装修方案的装修方案。', '进度 +0.0000000001%。感谢你的催促。', '研究室已把你的催促存进明天仓库。'];
    $('#urge', root).addEventListener('click', () => {
      n++; S.urge++; save();
      $('#urgeMsg').textContent = `（第 ${S.urge} 次）${msgs[(S.urge - 1) % msgs.length]}`;
      if (S.urge >= 10) unlock('urge');
    });
  }
};

/* ---------- 反内耗委员会 ---------- */
V.meeting = {
  html() {
    return `<div class="wrap">${roomHead('meeting', '今日会议已取消，因为<em>开会只是为了讨论是否需要开会</em>。')}
    <section class="panel bold" id="meetBox">
      <p style="margin:0 0 14px;font-size:17px">委员会成员已经回家了。如果你坚持，可以自己开。</p>
      <button class="btn" id="meetGo">我坚持要开会</button>
    </section>
    ${foot()}</div>`;
  },
  mount(root) {
    let depth = 0;
    const qText = d => {
      let q = '是否需要开会';
      for (let i = 0; i < d; i++) q = `是否需要开会讨论<span class="p">（</span>${q}<span class="p">）</span>`;
      return q + '？';
    };
    const draw = () => {
      $('#meetBox').innerHTML = `<div class="eyebrow">第 ${depth + 1} 次会议 · 出席：你</div>
        <div class="meet-q" style="margin:10px 0 16px">议题：${qText(depth)}</div>
        <div class="btn-row"><button class="btn" data-a="y">需要</button><button class="btn ghost" data-a="n">不需要</button><button class="btn yellow" data-a="x">我决定先不解释自己</button></div>
        ${depth ? `<p class="small muted ui" style="margin:12px 0 0">会议纪要第 ${depth} 条：${depth % 2 ? '与会者认为需要。因此需要开会讨论。' : '与会者认为不需要。是否需要开会讨论"不需要"？需要。'}</p>` : ''}`;
      $$('[data-a]').forEach(b => b.addEventListener('click', () => {
        if (b.dataset.a === 'x') {
          $('#meetBox').innerHTML = `<div class="eyebrow">会议纪要</div><p style="font-size:18px;margin:10px 0">本次会议共嵌套 ${depth + 1} 层。决议：下次再开。散会。</p><p class="muted" style="margin:0">你没有解释自己，这很好。</p><div class="btn-row" style="margin-top:14px"><button class="btn small ghost" id="meetAgain">再开一次</button></div>`;
          $('#meetAgain').addEventListener('click', () => { depth = 0; draw(); });
          return;
        }
        depth++;
        knock(1 - Math.min(depth, 8) * 0.06);
        if (depth >= 5) unlock('meeting');
        draw();
      }));
    };
    $('#meetGo', root).addEventListener('click', draw);
  }
};

/* ---------- 院长办公室 ---------- */
V.dean = {
  html() {
    const back = Date.now() - T.deanBack < 90000;
    return `<div class="wrap">${roomHead('dean', '院长出去看看世界了。<em>你也可以</em>。办公室里的东西都能点。')}
    <div class="office" id="office">
      <button class="it win" id="oWin" aria-label="窗户"></button>
      <button class="it chair" id="oChair" aria-label="院长的椅子">🪑</button>
      <div class="desk" aria-hidden="true"></div>
      <button class="it note" id="oNote">院长出去看看世界了</button>
      <button class="it drawer" id="oDrawer">抽屉</button>
      <button class="it plant" id="oPlant" aria-label="绿萝">🪴</button>
      <span class="cat${back ? ' in' : ''}" id="officeCat" aria-hidden="true">🐈</span>
    </div>
    <p class="office-msg" id="officeMsg" aria-live="polite">${back ? '院长回来了。院长是一只猫。院长压住了论文，然后睡着了。' : '办公室很安静。桌上有一张便条。'}</p>
    <p class="office-link small muted">提示：本院传说，在键盘上按 ↑↑↓↓←→←→BA，院长会回来一会儿。</p>
    ${foot()}</div>`;
  },
  mount(root) {
    const msg = t => { $('#officeMsg').textContent = t; };
    let chair = 0, plant = 0;
    $('#oChair', root).addEventListener('click', () => {
      chair++;
      if (chair === 1) msg('一把空着的椅子。院长不在。');
      else if (chair < 5) msg(`你确定要坐吗？这把椅子的椅子阻力很强。（${chair}/5）`);
      else { msg('你坐上了院长的椅子。椅子说："马上起来"现在是一个弹性单位。'); unlock('chair'); }
    });
    $('#oWin', root).addEventListener('click', () => {
      const w = $('#oWin');
      w.classList.toggle('open');
      if (w.classList.contains('open')) { $('#officeMsg').innerHTML = '窗外的世界挺好的。院长就是从这里出去的。<a href="#exit">走正常生活出口 →</a>'; }
      else msg('你关上了窗。办公室又安静了。');
    });
    $('#oNote', root).addEventListener('click', () => msg('便条上写着：院长出去看看世界了，你也可以。背面写着：记得关灯。'));
    $('#oDrawer', root).addEventListener('click', () => msg('抽屉里有：一份未签字的终极真理（已过期），一张写着"今日学术共识：暂无"的便条，半包酸笋。'));
    $('#oPlant', root).addEventListener('click', () => {
      plant++;
      msg(plant > 3 ? '它已经喝了很多大水了。本院建议少量多次。' : '你给院长的绿萝喝了一口大水。它看起来更强了。');
    });
    if (Date.now() - T.deanBack < 90000) setTimeout(() => { const c = $('#officeCat'); if (c) { c.classList.remove('in'); } }, Math.max(0, 90000 - (Date.now() - T.deanBack)));
  }
};

/* ---------- 量子速读室 ---------- */
V.speedread = {
  html() {
    return `<div class="wrap">${roomHead('speedread', '本室提供 0.3 秒读完一篇论文的服务。<em>读完后你会获得一种读过了的感觉</em>。')}
    <section class="panel bold">
      <div class="speed" id="speed">${esc(SPEED_TEXT)}</div>
      <div class="btn-row" style="margin-top:14px"><button class="btn" id="speedGo">开始量子速读（0.3 秒）</button></div>
    </section>
    <section id="speedOut"></section>
    ${foot()}</div>`;
  },
  mount(root) {
    $('#speedGo', root).addEventListener('click', () => {
      const box = $('#speed');
      const chunks = SPEED_TEXT.match(/.{1,5}/g);
      box.classList.add('reading');
      $('#speedGo').disabled = true;
      let i = 0;
      const step = () => {
        if (i < chunks.length && !RM) { box.textContent = chunks[i]; i += 3; setTimeout(step, 14); }
        else {
          box.classList.remove('reading');
          box.textContent = SPEED_TEXT;
          $('#speedGo').disabled = false;
          $('#speedOut').innerHTML = `<div class="cert">
            <h3>阅读证明</h3>
            <p style="margin:0">阅读用时：0.31 秒</p>
            <p style="margin:0">理解程度：量子叠加态（既懂又不懂）</p>
            <p style="margin:0">获得：一种读过了的感觉</p>
            <div class="q" style="margin-top:14px;text-align:left">
              <h3 style="font-size:18px">随堂测验：本文主要讲了什么？</h3>
              <div class="opts">${['A. 确实', 'B. 确实', 'C. 确实', 'D. 以上都确实'].map(o => `<button class="opt" data-quiz>${o}</button>`).join('')}</div>
            </div>
          </div>`;
          $$('[data-quiz]').forEach(b => b.addEventListener('click', () => { toast('回答正确。', {raw:true}); unlock('speed'); }));
        }
      };
      step();
    });
  }
};

/* ---------- 正常生活出口 ---------- */
V.exit = {
  html() {
    return `<div class="wrap">${roomHead('exit', '这扇门始终开放。所有特效已经关掉了。')}
    <section class="panel">
      <ul class="exit-list">
        <li>睡一觉。</li>
        <li>喝口水，正常大小的杯子就行。</li>
        <li>出去走走。</li>
        <li>这件事不一定值得追。</li>
        <li>你可以重新决定。</li>
      </ul>
      <p class="muted" style="margin:18px 0 0">楼上的理论都还在，它们不会跑。</p>
      <div class="btn-row" style="margin-top:16px"><button class="btn ghost" id="exitBack">回到院里（恢复院内标准）</button></div>
    </section>
  </div>`;
  },
  mount(root) {
    setMode('normal', {silent:true});
    unlock('exit');
    $('#exitBack', root).addEventListener('click', () => { setMode('std', {silent:true}); location.hash = '#home'; });
  }
};

/* ================= 路由 ================= */
function route() {
  const id = (location.hash || '#home').slice(1);
  if (id === 'slotm') { const el = $('#slotm'); if (el) { el.scrollIntoView({behavior: RM ? 'auto' : 'smooth'}); return; } }
  const v = V[id] ? id : 'home';
  if (v !== 'exit' && current === 'exit' && S.mode === 'normal') { /* 从出口离开时保持正常模式，除非用户点了回到院里 */ }
  current = v;
  S.visited[v] = 1;
  save();
  const view = $('#view');
  view.innerHTML = V[v].html();
  V[v].mount && V[v].mount(view);
  window.scrollTo(0, 0);
  if (ROOMS.filter(r => r.id !== 'home').every(r => S.visited[r.id])) unlock('allrooms');
}

/* ================= 全局委托 ================= */
document.addEventListener('click', e => {
  const t = e.target;
  const face = t.closest('.card .face');
  if (face && !t.closest('button')) {
    const card = face.closest('.card');
    card.classList.toggle('flipped');
    if (card.classList.contains('flipped')) {
      S.flipped[card.dataset.id] = 1; save();
      if (Object.keys(S.flipped).length >= 5) unlock('archive');
      knock(1.25);
    }
    return;
  }
  const act = t.closest('[data-act]');
  if (act) {
    const id = act.closest('.card').dataset.id;
    if (act.dataset.act === 'detail') openTheory(id);
    if (act.dataset.act === 'lab') { T.labBase = id; location.hash = '#lab'; }
    return;
  }
  const op = t.closest('[data-open]');
  if (op) { openTheory(op.dataset.open); return; }
  const go = t.closest('[data-go]');
  if (go) {
    const tid = go.dataset.tid, g = go.dataset.go;
    $('#dlgTheory').close();
    if (g === 'lab') T.labBase = tid;
    if (g === 'hybrid') T.hybridA = tid;
    if (g === 'garden') T.retirePick = byId[tid].name;
    if (location.hash === '#' + g) route(); else location.hash = '#' + g;
    return;
  }
  if (t.closest('[data-close]')) { t.closest('dialog').close(); return; }
  if (t.tagName === 'DIALOG') { t.close(); return; }
  const mc = t.closest('.mode-card');
  if (mc) { idleSlept = false; $('#dlgMode').close(); setMode(mc.dataset.mode); return; }
  if (t.closest('[data-random-room]')) { const r = pick(ROOMS.filter(x => x.id !== 'home')); location.hash = '#' + r.id; return; }
  if (t.closest('[data-wind]')) { toast('天台风很大。本院建议你回到屋里，或者走正常生活出口。', {raw:true}); return; }
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('front')) { e.preventDefault(); e.target.click(); }
});

/* ================= 启动 ================= */
function renderTicker() {
  const items = [...ANNOUNCE].sort(() => Math.random() - 0.5);
  $('#ticker').innerHTML = items.map(a => `<span>${esc(a)}</span>`).join('');
}
function renderAch() {
  const got = Object.keys(S.ach).length;
  $('#achBody').innerHTML = `
    <div class="progress" style="margin-bottom:6px"><i style="width:${got / ACH.length * 100}%"></i></div>
    <p class="ui small muted" style="margin:0 0 12px">已解锁 ${got} / ${ACH.length}。成就只保存在这台设备的浏览器里。</p>
    <div class="achs">${ACH.map(a => {
      const on = !!S.ach[a[0]];
      return `<div class="ach${on ? ' on' : ''}"><span class="medal">${on ? '已得' : '？'}</span><div><b>${on ? esc(a[1]) : '？？？'}</b><small>${esc(a[2])}</small></div></div>`;
    }).join('')}</div>`;
}
function boot() {
  renderTicker();
  $('#meritNum').textContent = S.merit;
  updateAchNum();
  $('#ticker').parentElement.addEventListener('click', () => {
    const tk = $('.ticker');
    tk.classList.toggle('paused');
    toast(tk.classList.contains('paused') ? '公告已读，未回。' : '公告继续滚动。', {raw:true});
  });
  $('#meritBtn').addEventListener('click', e => {
    knock();
    const r = e.currentTarget.getBoundingClientRect();
    addMerit(1, r.left + r.width / 2, r.top + r.height, '功德+1');
    unlock('merit1');
  });
  $('#modeBtn').addEventListener('click', () => { renderModeGrid(); $('#tgDm').checked = S.danmaku; $('#tgSnd').checked = S.sound; $('#dlgMode').showModal(); });
  $('#achBtn').addEventListener('click', () => { renderAch(); $('#dlgAch').showModal(); });
  $('#tgDm').addEventListener('change', e => { S.danmaku = e.target.checked; save(); if (!S.danmaku) $('#danmaku').innerHTML = ''; });
  $('#tgSnd').addEventListener('change', e => { S.sound = e.target.checked; save(); });
  window.addEventListener('hashchange', route);
  const m = S.mode && MODES[S.mode] && S.mode !== 'sleep' ? S.mode : 'std';
  setMode(m, {silent:true});
  route();
  setTimeout(() => unlock('enter'), 900);
  setInterval(spawnDanmaku, 3400);
  setTimeout(spawnDanmaku, 1200);
}
boot();
})();
