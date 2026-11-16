/* ---------- app ---------- */
const BANK = parseBank(document.getElementById('bank').textContent);
const BYID = Object.fromEntries(BANK.map(q => [q.id, q]));
const KEY = 'mlmath-progress-v1';
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rich = s => esc(s).replace(/\n/g, '<br>');

function ymd(d = new Date()) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function addDays(s, n) { const [y, m, d] = s.split('-').map(Number); return ymd(new Date(y, m - 1, d + n)); }

// gsub (added later, optional): fresh-numbers answers per "topic/subtopic". Old saves simply lack it and get {}.
function blank() { return { v: 1, ts: 0, att: {}, bm: {}, days: {}, daily: {}, gs: {}, gsub: {}, streak: { cur: 0, best: 0, last: '' } }; }
function normalize(o) { const b = blank(); if (!o || typeof o !== 'object') return b; for (const k in b) if (o[k] !== undefined && typeof o[k] === typeof b[k]) b[k] = o[k]; return b; }
let S = blank();
try { S = normalize(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (e) { S = blank(); }

/* ---------- persistence: browser only ---------- */
function save() { S.ts = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

/* ---------- questions ---------- */
function getQ(id) {
  if (id.startsWith('g_')) { const [, gid, seed] = id.split('_'); return buildGenerated(gid, Number(seed)); }
  const b = BYID[id]; if (!b) return null;
  const base = { id, type: b.type, topic: b.topic, diff: b.diff, sub: b.sub, title: b.title, q: b.q, exp: b.exp };
  if (b.type === 'nat') return Object.assign(base, { options: [], ans: b.ans, tol: b.tol });
  const order = shuffle(mulberry32(hashStr(id)), [0, 1, 2, 3]);
  base.options = order.map(i => b.opts[i]);
  // [[B]] in an explanation means "the option written as B in the bank"; show the letter it has on screen.
  base.exp = b.exp.replace(OPTREF, (m, l) => '\u0001' + 'ABCD'[order.indexOf('ABCD'.indexOf(l))]);
  // mcq: correct = display index. msq: correct = sorted display indices.
  base.correct = b.type === 'msq' ? b.ans.map(i => order.indexOf(i)).sort((x, y) => x - y) : order.indexOf(b.ans);
  return base;
}
function meta(id) {
  if (id.startsWith('g_')) { const g = GENMAP[id.split('_')[1]]; return g ? { id, type: 'mcq', topic: g.topic, diff: g.diff, sub: g.sub, title: g.title, gen: true } : null; }
  const b = BYID[id]; return b ? { id, type: b.type, topic: b.topic, diff: b.diff, sub: b.sub, title: b.title } : null;
}
// Is the current answer in `sel` correct for question q?
function isCorrect(q, sel) {
  if (q.type === 'nat') { const x = parseNum(sel); return x !== null && Math.abs(x - q.ans) <= q.tol + 1e-9; }
  if (q.type === 'msq') { const a = (sel || []).slice().sort((x, y) => x - y); return a.length === q.correct.length && a.every((v, i) => v === q.correct[i]); }
  return sel === q.correct;
}
function parseNum(s) { const t = String(s == null ? '' : s).trim(); if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(t)) return null; return Number(t); }
function hasAnswer(q, sel) { if (q.type === 'nat') return parseNum(sel) !== null; if (q.type === 'msq') return !!(sel && sel.length); return sel !== null && sel !== undefined; }
const status = id => { const a = S.att[id]; if (!a) return 'new'; return a.last === 'w' ? 'wrong' : 'solved'; };
const solvedEver = id => !!(S.att[id] && S.att[id].sv);

function record(q, ok) {
  const t = ymd();
  if (q.gen) {
    const k = q.topic + q.diff; const g = S.gs[k] || (S.gs[k] = { c: 0, w: 0 }); ok ? g.c++ : g.w++;
    if (q.sub) { const sk = q.topic + '/' + q.sub; const gsb = S.gsub[sk] || (S.gsub[sk] = { c: 0, w: 0 }); ok ? gsb.c++ : gsb.w++; }
    if (!ok) S.att[q.id] = Object.assign(S.att[q.id] || { c: 0, w: 0 }, { last: 'w', d: t, g: 1 });
    else if (S.att[q.id]) Object.assign(S.att[q.id], { last: 'c', d: t, sv: 1 });
    if (S.att[q.id]) ok ? S.att[q.id].c++ : S.att[q.id].w++;
  } else {
    const a = S.att[q.id] || (S.att[q.id] = { c: 0, w: 0 });
    ok ? a.c++ : a.w++; a.last = ok ? 'c' : 'w'; a.d = t; if (ok) a.sv = 1;
  }
  const day = S.days[t] || (S.days[t] = { n: 0, c: 0 }); day.n++; if (ok) day.c++;
  const dl = S.daily[t];
  if (dl && dl.ids.includes(q.id) && !(dl.ans && dl.ans[q.id])) {
    dl.ans = dl.ans || {}; dl.ans[q.id] = ok ? 'c' : 'w';
    if (!dl.done && dl.ids.every(i => dl.ans[i])) {
      dl.done = true;
      const st = S.streak;
      if (st.last !== t) { st.cur = st.last === addDays(t, -1) ? st.cur + 1 : 1; st.last = t; st.best = Math.max(st.best, st.cur); }
      justCompleted = true;
    }
  }
  prune(); save();
}
function prune() {
  const cut = addDays(ymd(), -40), cut2 = addDays(ymd(), -400);
  for (const d in S.daily) if (d < cut) delete S.daily[d];
  for (const d in S.days) if (d < cut2) delete S.days[d];
}
function curStreak() { const st = S.streak, t = ymd(); return st.last === t || st.last === addDays(t, -1) ? st.cur : 0; }

/* ---------- per-subtopic stats ---------- */
// key "topic/sub" -> { total, solved, c, w, n }. Counts bank answers plus fresh-numbers answers (S.gsub).
function subStats() {
  const st = {}; const get = k => st[k] || (st[k] = { total: 0, solved: 0, c: 0, w: 0, n: 0 });
  for (const q of BANK) {
    const s = get(q.topic + '/' + q.sub); s.total++; if (solvedEver(q.id)) s.solved++;
    const a = S.att[q.id]; if (a) { s.c += a.c || 0; s.w += a.w || 0; }
  }
  for (const k in S.gsub) { const s = get(k); s.c += S.gsub[k].c || 0; s.w += S.gsub[k].w || 0; }
  for (const k in st) st[k].n = st[k].c + st[k].w;
  return st;
}

/* ---------- daily set ---------- */
function getDaily() {
  const t = ymd();
  if (S.daily[t]) return S.daily[t];
  const r = mulberry32(hashStr('daily-' + t));
  // One bank problem per topic plus one fresh-numbers problem. Within each topic, use the subtopic
  // with the fewest answers so far (ties broken at random), so practice spreads across the syllabus.
  const diffs = shuffle(r, ['e', 'm', 'm', 'h', 'e']); const ids = []; const st = subStats(); const used = new Set();
  const answers = (tp, sub) => (st[tp + '/' + sub] ? st[tp + '/' + sub].n : 0);
  const leastAttempted = (items, keyOf) => { const min = Math.min(...items.map(keyOf)); return pick(r, items.filter(x => keyOf(x) === min)); };
  Object.keys(TOPICS).forEach((tp, i) => {
    const subs = Object.keys(SUBTOPICS[tp]).filter(s => BANK.some(q => q.topic === tp && q.sub === s));
    if (!subs.length) return;
    const sub = leastAttempted(subs, s => answers(tp, s)); used.add(tp + '/' + sub);
    const pool = BANK.filter(q => q.topic === tp && q.sub === sub);
    const tiers = [pool.filter(q => !solvedEver(q.id) && q.diff === diffs[i]), pool.filter(q => !solvedEver(q.id)), pool.filter(q => q.diff === diffs[i]), pool];
    ids.push(pick(r, tiers.find(x => x.length)).id);
  });
  const gpool = GENS.filter(g => g.diff !== 'e' && !used.has(g.topic + '/' + g.sub));
  const g = leastAttempted(gpool.length ? gpool : GENS.filter(x => x.diff !== 'e'), x => answers(x.topic, x.sub));
  ids.push('g_' + g.id + '_' + (hashStr(t) % 900000 + 1000));
  S.daily[t] = { ids, ans: {}, done: false }; prune(); save();
  return S.daily[t];
}

/* ---------- state for views ---------- */
let view = 'today', solve = null, justCompleted = false;
const filt = { topic: 'all', sub: 'all', diff: 'all', st: 'all' };
let reviewTab = 'wrong', progTopic = 'la';

function filteredBank() {
  return BANK.filter(q => (filt.topic === 'all' || q.topic === filt.topic) && (filt.sub === 'all' || q.sub === filt.sub) && (filt.diff === 'all' || q.diff === filt.diff) &&
    (filt.st === 'all' || (filt.st === 'unsolved' && !solvedEver(q.id)) || (filt.st === 'solved' && solvedEver(q.id)) || (filt.st === 'wrong' && status(q.id) === 'wrong') || (filt.st === 'bookmarked' && S.bm[q.id])));
}
const genPool = f => GENS.filter(g => (f.topic === 'all' || g.topic === f.topic) && (!f.sub || f.sub === 'all' || g.sub === f.sub) && (f.diff === 'all' || g.diff === f.diff));
function wrongIds() { return Object.keys(S.att).filter(id => S.att[id].last === 'w' && meta(id)).sort((a, b) => (S.att[b].d || '').localeCompare(S.att[a].d || '')); }
function bmIds() { return Object.keys(S.bm).filter(id => S.bm[id] && meta(id)); }

/* ---------- rendering ---------- */
const diffPill = d => `<span class="pill d-${d}">${DIFF[d]}</span>`;
const topicTag = t => `<span class="tag t-${t}">${TOPICS[t]}</span>`;
const typeTag = type => (type === 'nat' || type === 'msq' ? `<span class="tag qtype">${QTYPES[type]}</span>` : '');
function statusIcon(id) {
  const s = status(id);
  if (s === 'solved') return '<span class="st st-ok" title="Solved" aria-label="Solved">✓</span>';
  if (s === 'wrong') return '<span class="st st-bad" title="Last attempt wrong" aria-label="Last attempt wrong">✗</span>';
  return '<span class="st st-new" aria-label="Not attempted">○</span>';
}
function rows(ids, ctx) {
  if (!ids.length) return '<p class="empty">No problems match these filters.</p>';
  return '<ol class="plist">' + ids.map((id, i) => { const m = meta(id); return `<li><button class="prow" data-open="${i}" data-ctx="${ctx}">
    ${statusIcon(id)}<span class="pnum">${m.gen ? '∞' : esc(id.split('-').pop())}</span><span class="ptitle">${esc(m.title)}</span>
    <span class="pmeta">${typeTag(m.type)}${topicTag(m.topic)}${diffPill(m.diff)}${S.bm[id] ? '<span class="star on" aria-label="Bookmarked">★</span>' : ''}</span></button></li>`; }).join('') + '</ol>';
}

function header() {
  const solved = BANK.filter(q => solvedEver(q.id)).length;
  const navs = [['today', 'Today'], ['practice', 'Problems'], ['review', 'Review'], ['progress', 'Progress']];
  $('#nav').innerHTML = navs.map(([k, l]) => `<a href="#${k}" class="${(solve ? solve.back : view) === k ? 'on' : ''}">${l}</a>`).join('');
  $('#hstats').innerHTML = `<span class="hs" title="Daily streak"><b>${curStreak()}</b> day streak</span><span class="hs"><b>${solved}</b>/${BANK.length} solved</span>`;
}

function render() {
  header();
  const main = $('#main');
  if (window.MathJax && MathJax.typesetClear) { try { MathJax.typesetClear([main]); } catch (e) {} }
  if (solve) main.innerHTML = renderSolve();
  else if (view === 'today') main.innerHTML = renderToday();
  else if (view === 'practice') main.innerHTML = renderPractice();
  else if (view === 'review') main.innerHTML = renderReview();
  else main.innerHTML = renderProgress();
  typeset(main);
}
function typeset(el) { if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([el]).catch(() => {}); }

function renderToday() {
  const d = getDaily(); const t = ymd(); const n = d.ids.length; const done = d.ids.filter(i => d.ans && d.ans[i]).length;
  const correct = d.ids.filter(i => d.ans && d.ans[i] === 'c').length;
  const nice = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const next = d.ids.findIndex(i => !(d.ans && d.ans[i]));
  const segs = d.ids.map(i => `<span class="seg ${d.ans && d.ans[i] ? (d.ans[i] === 'c' ? 'ok' : 'bad') : ''}"></span>`).join('');
  return `<section class="hero">
    <div><p class="eyebrow">${esc(nice)}</p><h1>Today’s set</h1>
    <p class="lede">One problem from each topic plus one with fresh numbers, picked from the subtopics you have practised least. Finish all ${n} to keep your streak.</p></div>
    <div class="streakbox"><div class="big">${curStreak()}</div><div>day streak</div><div class="sub">best ${S.streak.best}</div></div>
  </section>
  <div class="segs" aria-label="${done} of ${n} answered">${segs}</div>
  <div class="todaybar"><span>${done}/${n} answered · ${correct} correct</span>
    ${d.done ? '<span class="done">Set complete</span>' : `<button class="btn primary" data-start="${next < 0 ? 0 : next}">${done ? 'Continue' : 'Start today’s set'}</button>`}</div>
  ${d.done ? `<div class="banner">Set complete for ${esc(t)}. Come back tomorrow for a new one, or keep practising in Problems.</div>` : ''}
  ${rows(d.ids, 'daily')}`;
}

function chipGroup(name, opts, cur) {
  return `<div class="chips" role="group" aria-label="${name}">` + opts.map(([v, l]) => `<button class="chip ${cur === v ? 'on' : ''}" data-f="${name}" data-v="${v}" aria-pressed="${cur === v}">${l}</button>`).join('') + '</div>';
}
function renderPractice() {
  const ids = filteredBank().map(q => q.id);
  const genAvail = genPool(filt).length;
  let subRow = '';
  if (filt.topic !== 'all') {
    const cnt = s => BANK.filter(q => q.topic === filt.topic && q.sub === s).length;
    subRow = `<div class="chips subchips" role="group" aria-label="Subtopic">` +
      [['all', 'All subtopics', BANK.filter(q => q.topic === filt.topic).length], ...Object.entries(SUBTOPICS[filt.topic]).map(([s, l]) => [s, l, cnt(s)])]
        .map(([v, l, n]) => `<button class="chip ${filt.sub === v ? 'on' : ''}" data-f="sub" data-v="${v}" aria-pressed="${filt.sub === v}" ${n || v === filt.sub ? '' : 'disabled title="No problems yet"'}>${esc(l)} <span class="cn">${n}</span></button>`).join('') + '</div>';
  }
  return `<section class="phead"><h1>Problems</h1><p class="lede">${BANK.length} worked problems in GATE DA style, plus ${GENS.length} generators that produce new numbers every time.</p></section>
  <div class="filters">
    ${chipGroup('topic', [['all', 'All topics'], ...Object.entries(TOPICS)], filt.topic)}
    ${subRow}
    ${chipGroup('diff', [['all', 'All levels'], ['e', 'Easy'], ['m', 'Medium'], ['h', 'Hard']], filt.diff)}
    <div class="frow"><label for="stsel">Show</label>
      <select id="stsel">${[['all', 'All'], ['unsolved', 'Unsolved'], ['solved', 'Solved'], ['wrong', 'Last attempt wrong'], ['bookmarked', 'Bookmarked']].map(([v, l]) => `<option value="${v}" ${filt.st === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <span class="count">${ids.length} problems</span>
      <span class="grow"></span>
      <button class="btn" data-random="1" ${ids.length ? '' : 'disabled'}>Pick one at random</button>
      <button class="btn primary" data-fresh="1" ${genAvail ? '' : 'disabled'}>Fresh-numbers problem</button>
    </div>
  </div>
  ${rows(ids, 'practice')}`;
}

function renderReview() {
  const w = wrongIds(), b = bmIds(); const list = reviewTab === 'wrong' ? w : b;
  return `<section class="phead"><h1>Review</h1><p class="lede">Problems you got wrong stay here until you answer them correctly. Bookmarks stay until you remove them.</p></section>
  <div class="tabs" role="tablist">
    <button role="tab" class="tab ${reviewTab === 'wrong' ? 'on' : ''}" aria-selected="${reviewTab === 'wrong'}" data-rtab="wrong">Got wrong <span class="n">${w.length}</span></button>
    <button role="tab" class="tab ${reviewTab === 'bm' ? 'on' : ''}" aria-selected="${reviewTab === 'bm'}" data-rtab="bm">Bookmarked <span class="n">${b.length}</span></button>
    <span class="grow"></span>
    ${list.length ? `<button class="btn primary" data-retry="1">${reviewTab === 'wrong' ? 'Retry all wrong' : 'Practise bookmarks'}</button>` : ''}
  </div>
  ${list.length ? rows(list, 'review') : `<p class="empty">${reviewTab === 'wrong' ? 'Nothing to retry. Wrong answers will collect here.' : 'No bookmarks yet. Use the star on any problem to save it here.'}</p>`}`;
}

function renderProgress() {
  let tc = 0, tw = 0; for (const id in S.att) { if (!S.att[id].g) { tc += S.att[id].c; tw += S.att[id].w; } }
  for (const k in S.gs) { tc += S.gs[k].c; tw += S.gs[k].w; }
  const acc = tc + tw ? Math.round(100 * tc / (tc + tw)) : null; const solved = BANK.filter(q => solvedEver(q.id)).length;
  const cells = Object.keys(TOPICS).map(tp => {
    const tds = ['e', 'm', 'h'].map(df => {
      const pool = BANK.filter(q => q.topic === tp && q.diff === df); const s = pool.filter(q => solvedEver(q.id)).length;
      const g = S.gs[tp + df]; const pct = Math.round(100 * s / pool.length);
      return `<td><div class="cell"><span class="frac">${s}<small>/${pool.length}</small></span><span class="bar"><i class="d-${df}" style="width:${pct}%"></i></span>${g ? `<span class="gstat">fresh: ${g.c}/${g.c + g.w}</span>` : ''}</div></td>`;
    }).join('');
    return `<tr><th scope="row">${TOPICS[tp]}</th>${tds}</tr>`;
  }).join('');
  // heatmap: last 20 weeks, columns = weeks, rows = weekday
  const t = ymd(); const today = new Date(); const dow = (today.getDay() + 6) % 7; // Mon=0
  const start = addDays(t, -(19 * 7 + dow)); let hm = ''; let total = 0, active = 0;
  for (let w = 0; w < 20; w++) { hm += '<div class="hcol">'; for (let d = 0; d < 7; d++) { const day = addDays(start, w * 7 + d); if (day > t) { hm += '<span class="hc fut"></span>'; continue; }
    const n = (S.days[day] && S.days[day].n) || 0; total += n; if (n) active++; const lv = n === 0 ? 0 : n < 3 ? 1 : n < 6 ? 2 : n < 10 ? 3 : 4;
    hm += `<span class="hc l${lv}" title="${day}: ${n} answered"></span>`; } hm += '</div>'; }
  return `<section class="phead"><h1>Progress</h1></section>
  <div class="tiles">
    <div class="tile"><span class="k">Solved</span><span class="v">${solved}<small>/${BANK.length}</small></span></div>
    <div class="tile"><span class="k">Accuracy</span><span class="v">${acc === null ? '–' : acc + '<small>%</small>'}</span><span class="s">${tc + tw} answers</span></div>
    <div class="tile"><span class="k">Current streak</span><span class="v">${curStreak()}<small> days</small></span></div>
    <div class="tile"><span class="k">Best streak</span><span class="v">${S.streak.best}<small> days</small></span></div>
  </div>
  <h2 class="h2">By topic and level</h2>
  <div class="tblwrap"><table class="grid"><thead><tr><th></th><th>${diffPill('e')}</th><th>${diffPill('m')}</th><th>${diffPill('h')}</th></tr></thead><tbody>${cells}</tbody></table></div>
  <h2 class="h2">By subtopic</h2>
  ${renderSubTable()}
  <h2 class="h2">Activity, last 20 weeks</h2>
  <div class="heat"><div class="hdays"><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span><span>Sun</span></div><div class="hgrid">${hm}</div></div>
  <p class="note">${total} answers on ${active} days. Darker squares mean more problems answered that day.</p>
  <div class="danger"><button class="btn ghost" data-reset="1">Reset all progress</button></div>`;
}

function renderSubTable() {
  const st = subStats(); const tp = progTopic;
  const chips = `<div class="chips" role="group" aria-label="Topic for subtopic table">` + Object.entries(TOPICS).map(([v, l]) =>
    `<button class="chip ${tp === v ? 'on' : ''}" data-ptopic="${v}" aria-pressed="${tp === v}">${l}</button>`).join('') + '</div>';
  const body = Object.entries(SUBTOPICS[tp]).map(([sub, label]) => {
    const s = st[tp + '/' + sub] || { total: 0, solved: 0, c: 0, w: 0, n: 0 };
    const pct = s.total ? Math.round(100 * s.solved / s.total) : 0; const acc = s.n ? Math.round(100 * s.c / s.n) : null;
    return `<tr class="${s.total ? '' : 'nodata'}"><th scope="row">${esc(label)}</th>
      <td><div class="cell"><span class="frac">${s.solved}<small>/${s.total}</small></span><span class="bar"><i class="d-acc" style="width:${pct}%"></i></span></div></td>
      <td class="num">${acc === null ? '–' : acc + '%'}</td><td class="num">${s.n}</td></tr>`;
  }).join('');
  return `<div class="subtopic-head">${chips}</div>
  <div class="tblwrap"><table class="grid subgrid"><thead><tr><th>${esc(TOPICS[tp])}</th><th>Solved</th><th>Accuracy</th><th>Answers</th></tr></thead><tbody>${body}</tbody></table></div>
  <p class="note">Accuracy counts every answer in the subtopic, including fresh-numbers problems answered from now on.</p>`;
}

function renderSolve() {
  const s = solve; const q = s.q; const L = 'ABCD';
  const pos = s.gen ? 'Fresh numbers' : `${s.idx + 1} / ${s.ids.length}`;
  const multi = q.type === 'msq';
  const picked = i => (multi ? s.sel.includes(i) : i === s.sel);
  const isRight = i => (multi ? q.correct.includes(i) : i === q.correct);
  let answerUI;
  if (q.type === 'nat') {
    const cls = s.done ? (s.ok ? ' right' : ' wrongpick') : '';
    answerUI = `<div class="natwrap"><label for="natin">Your answer</label>
      <input id="natin" class="natin${cls}" type="number" step="any" inputmode="decimal" autocomplete="off" value="${esc(s.sel)}" ${s.done ? 'disabled' : ''}>
      <span class="nathint">${q.tol ? `Numerical answer. Accepted within ±${esc(q.tol)}.` : 'Numerical answer. Enter the exact value.'}</span></div>`;
  } else {
    const opts = q.options.map((o, i) => {
      let cls = 'opt' + (multi ? ' multi' : '');
      if (s.done) { if (isRight(i)) cls += ' right' + (multi && !picked(i) ? ' missed' : ''); else if (picked(i)) cls += ' wrongpick'; } else if (picked(i)) cls += ' sel';
      return `<button class="${cls}" data-opt="${i}" ${s.done ? 'disabled' : ''} role="${multi ? 'checkbox' : 'radio'}" aria-checked="${picked(i)}"><span class="ol">${L[i]}</span><span class="ot">${rich(o)}</span></button>`;
    }).join('');
    answerUI = (multi ? '<p class="selhint">Select all options that are correct. You need the exact set.</p>' : '') +
      `<div class="opts" role="${multi ? 'group' : 'radiogroup'}" aria-label="Answer options">${opts}</div>`;
  }
  const ok = s.done && s.ok;
  const answerText = q.type === 'nat' ? `The answer is ${esc(q.ans)}${q.tol ? ` (±${esc(q.tol)} accepted)` : ''}.`
    : multi ? `The correct option${q.correct.length > 1 ? 's are' : ' is'} ${q.correct.map(i => L[i]).join(', ')}.` : `The answer is ${L[q.correct]}.`;
  const keys = q.type === 'nat' ? 'Keys: Enter to check' : multi ? 'Keys: A–D to tick, Enter to check' : 'Keys: A–D to choose, Enter to check';
  const hasNext = s.gen || s.idx < s.ids.length - 1;
  return `<div class="sbar"><button class="btn ghost" data-back="1">← Back</button><span class="pos">${pos}</span>
    <button class="star ${S.bm[q.id] ? 'on' : ''}" data-bm="1" aria-pressed="${!!S.bm[q.id]}" title="Bookmark">${S.bm[q.id] ? '★ Bookmarked' : '☆ Bookmark'}</button></div>
  <article class="card">
    <div class="qmeta">${topicTag(q.topic)}${q.sub ? `<span class="tag">${esc(subLabel(q.topic, q.sub))}</span>` : ''}${diffPill(q.diff)}${typeTag(q.type)}${q.gen ? '<span class="tag fresh">Fresh numbers</span>' : ''}${s.prev ? `<span class="tag prev">${s.prev === 'w' ? 'You missed this before' : 'Solved before'}</span>` : ''}</div>
    <h1 class="qtitle">${esc(q.title)}</h1>
    <div class="qtext">${rich(q.q)}</div>
    ${answerUI}
    <div class="actions">
      ${s.done ? '' : `<button class="btn primary" data-submit="1" ${hasAnswer(q, s.sel) ? '' : 'disabled'}>Check answer</button>`}
      ${s.done && hasNext ? `<button class="btn primary" data-next="1">${s.gen ? 'Another fresh problem →' : 'Next problem →'}</button>` : ''}
      ${s.done && !hasNext ? '<button class="btn primary" data-back="1">Back to list</button>' : ''}
      ${!s.done && hasNext ? '<button class="btn ghost" data-next="1">Skip</button>' : ''}
      <span class="kbd">${keys}</span>
    </div>
    ${s.done ? `<div class="result ${ok ? 'ok' : 'bad'}"><p class="verdict">${ok ? 'Correct.' + (q.type === 'nat' && parseNum(s.sel) !== q.ans ? ` Exact answer: ${esc(q.ans)}.` : '') : `Not quite. ${answerText}`}</p><div class="exp">${rich(q.exp).replace(/\u0001([ABCD])/g, '<b class="optref">$1</b>')}</div></div>` : ''}
  </article>
  ${justCompleted ? `<div class="banner">Today’s set is complete. Your streak is now ${curStreak()} day${curStreak() === 1 ? '' : 's'}.</div>` : ''}`;
}

/* ---------- navigation ---------- */
function openQueue(ids, idx, back, gen) {
  justCompleted = false;
  if (gen) { solve = { gen, ids: [], idx: 0, back, q: null, sel: null, done: false }; nextGen(); return; }
  const q = getQ(ids[idx]); if (!q) return;
  solve = { ids, idx, back, q, sel: initSel(q), done: false, ok: false, prev: S.att[q.id] ? S.att[q.id].last : null };
  render(); window.scrollTo(0, 0);
  if (q.type === 'nat') { const el = document.getElementById('natin'); if (el) el.focus({ preventScroll: true }); }
}
const initSel = q => (q.type === 'msq' ? [] : q.type === 'nat' ? '' : null);
function nextGen() {
  const pool = genPool(solve.gen); if (!pool.length) return;
  const gg = pool[Math.floor(Math.random() * pool.length)]; const seed = Math.floor(Math.random() * 900000) + 1000;
  solve.q = buildGenerated(gg.id, seed); solve.sel = null; solve.done = false; solve.ok = false; solve.prev = null; render(); window.scrollTo(0, 0);
}
function goNext() {
  justCompleted = false;
  if (solve.gen) return nextGen();
  if (solve.idx < solve.ids.length - 1) openQueue(solve.ids, solve.idx + 1, solve.back);
}
function submit() {
  if (!solve || solve.done || !hasAnswer(solve.q, solve.sel)) return;
  solve.done = true; solve.ok = isCorrect(solve.q, solve.sel); record(solve.q, solve.ok); render();
  const r = document.querySelector('.result'); if (r) r.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
function listFor(ctx) {
  if (ctx === 'daily') return getDaily().ids;
  if (ctx === 'review') return reviewTab === 'wrong' ? wrongIds() : bmIds();
  return filteredBank().map(q => q.id);
}

document.addEventListener('click', e => {
  const a = e.target.closest('#nav a'); if (a && a.getAttribute('href') === location.hash) { e.preventDefault(); route(); return; }
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.open !== undefined) return openQueue(listFor(b.dataset.ctx), Number(b.dataset.open), view);
  if (b.dataset.start !== undefined) return openQueue(getDaily().ids, Number(b.dataset.start), 'today');
  if (b.dataset.f) { filt[b.dataset.f] = b.dataset.v; if (b.dataset.f === 'topic') filt.sub = 'all'; return render(); }
  if (b.dataset.ptopic) { progTopic = b.dataset.ptopic; return render(); }
  if (b.dataset.fresh) return openQueue([], 0, 'practice', { topic: filt.topic, sub: filt.sub, diff: filt.diff });
  if (b.dataset.random) { const ids = filteredBank().map(q => q.id); if (ids.length) openQueue(shuffle(Math.random, ids), 0, 'practice'); return; }
  if (b.dataset.rtab) { reviewTab = b.dataset.rtab; return render(); }
  if (b.dataset.retry) { const ids = reviewTab === 'wrong' ? wrongIds() : bmIds(); return openQueue(ids.slice(), 0, 'review'); }
  if (b.dataset.opt !== undefined && solve && !solve.done) { choose(Number(b.dataset.opt)); return render(); }
  if (b.dataset.submit) return submit();
  if (b.dataset.next) return goNext();
  if (b.dataset.back) { const back = solve ? solve.back : 'today'; solve = null; justCompleted = false; view = back; if (location.hash !== '#' + back) location.hash = back; return render(); }
  if (b.dataset.bm && solve) { const id = solve.q.id; if (S.bm[id]) delete S.bm[id]; else S.bm[id] = 1; save(); return render(); }
  if (b.dataset.reset) { if (b.dataset.confirm) { S = blank(); save(); render(); } else { b.dataset.confirm = '1'; b.textContent = 'Click again to erase everything'; b.classList.add('warn'); } }
});
// mcq: pick one option. msq: toggle the option in the selected set.
function choose(i) {
  if (solve.q.type === 'msq') { const s = solve.sel; const at = s.indexOf(i); if (at >= 0) s.splice(at, 1); else s.push(i); }
  else if (solve.q.type !== 'nat') solve.sel = i;
}
document.addEventListener('change', e => { if (e.target.id === 'stsel') { filt.st = e.target.value; render(); } });
// Numerical input: update state without re-rendering, so the field keeps focus while typing.
document.addEventListener('input', e => {
  if (e.target.id !== 'natin' || !solve || solve.done) return;
  solve.sel = e.target.value; const btn = document.querySelector('[data-submit]'); if (btn) btn.disabled = !hasAnswer(solve.q, solve.sel);
});
document.addEventListener('keydown', e => {
  if (!solve || e.metaKey || e.ctrlKey || e.altKey) return;
  if (document.activeElement && document.activeElement.id === 'natin') { if (e.key === 'Enter') { solve.sel = document.activeElement.value; submit(); e.preventDefault(); } return; }
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
  const k = e.key.toLowerCase(); const i = 'abcd'.indexOf(k) >= 0 ? 'abcd'.indexOf(k) : '1234'.indexOf(k);
  if (i >= 0 && !solve.done && solve.q.type !== 'nat') { choose(i); render(); e.preventDefault(); return; }
  if (e.key === 'Enter') { if (document.activeElement && document.activeElement.tagName === 'BUTTON' && !document.activeElement.dataset.opt) return; if (!solve.done) submit(); else goNext(); e.preventDefault(); }
});
function route() { const h = location.hash.replace('#', ''); const v = ['today', 'practice', 'review', 'progress'].includes(h) ? h : 'today'; view = v; solve = null; justCompleted = false; render(); }
window.addEventListener('hashchange', route);
route();
