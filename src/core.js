/* ---------- core: rng, helpers, bank parser, generators ---------- */
const TOPICS = { la: 'Linear Algebra', prob: 'Probability', calc: 'Calculus & Optimization', stat: 'Statistics', graph: 'Graph Theory' };
const TOPIC_SHORT = { la: 'Lin Alg', prob: 'Prob', calc: 'Calculus', stat: 'Stats', graph: 'Graphs' };
const DIFF = { e: 'Easy', m: 'Medium', h: 'Hard' };
const QTYPES = { mcq: 'Single choice', nat: 'Numerical', msq: 'Multiple select' };
// Syllabus subtopics per topic (slug -> label). Keep in sync with CLAUDE.md.
const SUBTOPICS = {
  la: { 'vectors-norms': 'Vectors & norms', 'vector-spaces': 'Vector spaces', 'matrix-ops': 'Matrix operations', 'linear-systems': 'Linear systems',
    'rank-nullity': 'Rank & nullity', determinants: 'Determinants', eigen: 'Eigenvalues & eigenvectors', 'special-matrices': 'Special matrices',
    'quadratic-forms': 'Quadratic forms', 'projections-least-squares': 'Projections & least squares', lu: 'LU decomposition', 'svd-pca': 'SVD & PCA' },
  prob: { counting: 'Counting', 'axioms-events': 'Axioms & events', 'conditional-bayes': 'Conditional probability & Bayes', independence: 'Independence',
    'random-variables': 'Random variables (PMF, PDF, CDF)', 'expectation-variance': 'Expectation & variance', 'discrete-dists': 'Discrete distributions',
    'continuous-dists': 'Continuous distributions', 'joint-conditional': 'Joint & conditional distributions', 'conditional-expectation': 'Conditional expectation',
    'covariance-correlation': 'Covariance & correlation', transformations: 'Transformations', 'limit-theorems': 'Limit theorems', 'markov-chains': 'Markov chains' },
  calc: { limits: 'Limits', 'continuity-differentiability': 'Continuity & differentiability', derivatives: 'Derivatives', 'taylor-series': 'Taylor series',
    'maxima-minima': 'Maxima & minima', 'single-var-optimization': 'Single-variable optimisation', integrals: 'Integrals',
    'gradients-multivariable': 'Gradients (multivariable)', 'gradient-descent': 'Gradient descent', convexity: 'Convexity', 'constrained-optimization': 'Constrained optimisation' },
  stat: { descriptive: 'Descriptive statistics', 'sampling-distributions': 'Sampling distributions', 'estimation-mle': 'Estimation & MLE', 'bias-variance': 'Bias & variance',
    'confidence-intervals': 'Confidence intervals', 'z-test': 'z-test', 't-test': 't-test', 'chi-squared-test': 'Chi-squared test',
    'regression-correlation': 'Regression & correlation', 'bayesian-inference': 'Bayesian inference', 'information-theory': 'Information theory' },
  graph: { 'basics-degree': 'Basics & degree', trees: 'Trees', traversal: 'Traversal (BFS/DFS)', 'shortest-paths': 'Shortest paths', mst: 'Minimum spanning trees',
    'dag-toposort': 'DAGs & topological sort', connectivity: 'Connectivity', 'matching-coloring': 'Matching & colouring', spectral: 'Spectral graph theory', 'random-walks': 'Random walks' },
};
const subLabel = (topic, sub) => (SUBTOPICS[topic] && SUBTOPICS[topic][sub]) || sub || 'Untagged';

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
function shuffle(r, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }
function fr(n, d) { if (d === 0) return 'undefined'; if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); n /= g; d /= g; if (d === 1) return String(n); return (n < 0 ? '-' : '') + '\\frac{' + Math.abs(n) + '}{' + d + '}'; }
function num(x, dp = 4) { const v = Math.round(x * 10 ** dp) / 10 ** dp; return String(Object.is(v, -0) ? 0 : v); }
const P = x => (x < 0 ? '(' + x + ')' : String(x));
const M = s => '$' + s + '$';
const vec = (...xs) => '\\left(' + xs.join(',\\ ') + '\\right)';
const pmat = rows => '\\begin{pmatrix}' + rows.map(r => r.join('&')).join('\\\\') + '\\end{pmatrix}';
function lin(terms) { let out = ''; for (const [c, sym] of terms) { if (!c) continue; const a = Math.abs(c); const body = (a === 1 && sym ? '' : String(a)) + sym; out += (c < 0 ? '-' : (out ? '+' : '')) + body; } return out || '0'; }
function binom(n, k) { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); }

/* ---------- bank parser ---------- */
function parseBank(text) {
  const out = []; const counters = {}; let cur = null, key = null;
  // ANS is interpreted after the whole block is read, because TYPE may come after it.
  // mcq: ans = option index (-1 if invalid). msq: ans = sorted option indices. nat: ans = number (NaN if invalid), tol = tolerance.
  const finish = () => {
    if (!cur) return;
    const raw = cur.ansRaw;
    if (cur.type === 'nat') { cur.ans = raw !== '' && /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(raw) ? Number(raw) : NaN;
      cur.tol = cur.tolRaw === '' ? 0.01 : (/^(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(cur.tolRaw) ? Number(cur.tolRaw) : NaN); }
    else if (cur.type === 'msq') cur.ans = raw.split(',').map(s => s.trim()).filter(Boolean).map(s => (s.length === 1 ? 'ABCD'.indexOf(s) : -1)).sort((a, b) => a - b);
    else cur.ans = raw.length === 1 ? 'ABCD'.indexOf(raw) : -1;
    out.push(cur);
  };
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    const head = line.match(/^@ (\w+) ([emh])(?: (\S+))?$/);
    if (head) {
      finish();
      const [, topic, diff, explicitId] = head; const ck = topic + diff;
      counters[ck] = (counters[ck] || 0) + 1;
      cur = { id: explicitId || (topic + '-' + diff + '-' + String(counters[ck]).padStart(3, '0')), topic, diff, sub: '', type: 'mcq', typeRaw: '', title: '', q: '', opts: ['', '', '', ''], ansRaw: '', tolRaw: '', ans: -1, exp: '' };
      key = null; continue;
    }
    if (!cur) continue;
    const kv = line.match(/^(T|S|TYPE|TOL|Q|A|B|C|D|ANS|EXP): ?(.*)$/);
    if (kv) {
      key = kv[1]; const v = kv[2];
      if (key === 'T') cur.title = v; else if (key === 'S') cur.sub = v.trim(); else if (key === 'Q') cur.q = v; else if (key === 'EXP') cur.exp = v;
      else if (key === 'TYPE') { cur.typeRaw = v.trim(); cur.type = QTYPES[cur.typeRaw] ? cur.typeRaw : 'invalid'; }
      else if (key === 'TOL') cur.tolRaw = v.trim();
      else if (key === 'ANS') cur.ansRaw = v.trim();
      else cur.opts['ABCD'.indexOf(key)] = v;
      continue;
    }
    if (line.trim() === '') continue;
    if (key === 'Q') cur.q += '\n' + line; else if (key === 'EXP') cur.exp += '\n' + line;
  }
  finish();
  return out;
}

/* ---------- graph helpers for generators ---------- */
const LET = 'ABCDEF';
function randGraph(r, n, extra) {
  const perm = shuffle(r, [...Array(n).keys()]); const E = new Map();
  const key = (u, v) => (u < v ? u + '-' + v : v + '-' + u);
  for (let i = 1; i < n; i++) { const u = perm[i], v = perm[ri(r, 0, i - 1)]; E.set(key(u, v), { u: Math.min(u, v), v: Math.max(u, v) }); }
  let tries = 0;
  while (E.size < n - 1 + extra && tries < 200) { tries++; const u = ri(r, 0, n - 1), v = ri(r, 0, n - 1); if (u === v) continue; const k = key(u, v); if (!E.has(k)) E.set(k, { u: Math.min(u, v), v: Math.max(u, v) }); }
  return [...E.values()].sort((a, b) => a.u - b.u || a.v - b.v);
}
const edgeList = es => es.map(e => LET[e.u] + '–' + LET[e.v] + ' (' + e.w + ')').join(', ');

/* ---------- generators: fresh numbers every time ---------- */
const GENS = [
  { id: 'det2', topic: 'la', diff: 'e', title: 'Determinant of a 2×2 matrix (fresh numbers)', make(r) {
    const a = ri(r, -4, 8), b = ri(r, -4, 8), c = ri(r, -4, 8), d = ri(r, -4, 8); const ans = a * d - b * c;
    return { q: 'Compute ' + M('\\det' + pmat([[a, b], [c, d]])) + '.', ans: M(ans), wrong: [a * d + b * c, b * c - a * d, a * b - c * d, a + d, ans + 2].map(M),
      exp: M('\\det\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}=ad-bc') + '.\n' + M(P(a) + '\\cdot' + P(d) + '-' + P(b) + '\\cdot' + P(c) + '=' + a * d + '-' + P(b * c) + '=' + ans) + '.' };
  } },
  { id: 'matvec', topic: 'la', diff: 'e', title: 'Matrix–vector product (fresh numbers)', make(r) {
    const A = [[ri(r, -3, 4), ri(r, -3, 4), ri(r, -3, 4)], [ri(r, -3, 4), ri(r, -3, 4), ri(r, -3, 4)]]; const x = [ri(r, -2, 3), ri(r, -2, 3), ri(r, -2, 3)];
    const y = A.map(row => row[0] * x[0] + row[1] * x[1] + row[2] * x[2]);
    const cv = v => M(pmat([[v[0]], [v[1]]]));
    const colsum = [A[0][0] + A[0][1] + A[0][2], A[1][0] + A[1][1] + A[1][2]];
    return { q: 'Compute ' + M('Ax') + ' for ' + M('A=' + pmat(A)) + ' and ' + M('x=' + pmat(x.map(v => [v]))) + '.', ans: cv(y),
      wrong: [cv([y[1], y[0]]), cv([y[0] + x[0], y[1] - x[2]]), cv(colsum), cv([y[0] - 1, y[1] + 1]), cv([-y[0], y[1]])],
      exp: 'Each entry is a row of ' + M('A') + ' dotted with ' + M('x') + ':\n' + A.map((row, i) => M('y_' + (i + 1) + '=' + row.map((v, j) => P(v) + '\\cdot' + P(x[j])).join('+') + '=' + y[i])).join('\n') };
  } },
  { id: 'eig2', topic: 'la', diff: 'm', title: 'Eigenvalues of a 2×2 matrix (fresh numbers)', make(r) {
    let l1 = ri(r, -3, 6), l2 = ri(r, -3, 6); if (l1 === l2) l2 = l1 + ri(r, 1, 3);
    const s = l1 + l2, p = l1 * l2, a = ri(r, -2, 5), d = s - a; const need = a * d - p; // b*c = need
    const opts = [1, -1, 2, -2, 3].filter(b => need % b === 0); const b = need === 0 ? pick(r, [1, 2, -1]) : pick(r, opts); const c = need === 0 ? 0 : need / b;
    const hi = Math.max(l1, l2), lo = Math.min(l1, l2); const pr = (x, y) => M('\\lambda=' + Math.max(x, y) + ',\\ ' + Math.min(x, y));
    return { q: 'Find the eigenvalues of ' + M('A=' + pmat([[a, b], [c, d]])) + '.', ans: pr(hi, lo), wrong: [pr(a, d), pr(-hi, -lo), pr(s, p), pr(hi + 1, lo - 1), pr(hi, -lo), pr(hi + 2, lo)],
      exp: M('\\operatorname{tr}A=' + a + '+' + P(d) + '=' + s) + ', ' + M('\\det A=' + P(a) + '\\cdot' + P(d) + '-' + P(b) + '\\cdot' + P(c) + '=' + p) + '.\nCharacteristic equation: ' + M(lin([[1, '\\lambda^2'], [-s, '\\lambda'], [p, '']]) + '=0') + ', which factors as ' + M('(' + lin([[1, '\\lambda'], [-hi, '']]) + ')(' + lin([[1, '\\lambda'], [-lo, '']]) + ')=0') + '.\nCheck: the eigenvalues sum to the trace and multiply to the determinant.' };
  } },
  { id: 'inv2', topic: 'la', diff: 'm', title: 'Entry of a 2×2 inverse (fresh numbers)', make(r) {
    let a, b, c, d, det, t = 0; do { a = ri(r, -3, 6); b = ri(r, -4, 5); c = ri(r, -4, 5); d = ri(r, -3, 6); det = a * d - b * c; t++; } while (([1, -1, 2, -2, 3, -3, 4, 5].indexOf(det) < 0 || b === 0) && t < 500);
    return { q: 'For ' + M('A=' + pmat([[a, b], [c, d]])) + ', what is the (1,2) entry (row 1, column 2) of ' + M('A^{-1}') + '?', ans: M(fr(-b, det)),
      wrong: [fr(b, det), fr(-c, det), fr(d, det), fr(a, det), fr(-b, 1), fr(det, -b)].map(M),
      exp: M('A^{-1}=\\dfrac{1}{ad-bc}\\begin{pmatrix}d&-b\\\\-c&a\\end{pmatrix}') + ', and ' + M('ad-bc=' + det) + '.\nThe (1,2) entry is ' + M('\\dfrac{-b}{\\det A}=\\dfrac{' + (-b) + '}{' + det + '}=' + fr(-b, det)) + '. Swap the diagonal, negate the off-diagonal, divide by the determinant.' };
  } },
  { id: 'polyeig', topic: 'la', diff: 'h', title: 'Eigenvalues of a matrix polynomial (fresh numbers)', make(r) {
    const a = ri(r, 1, 5), b = ri(r, 1, 4); const k = ri(r, -4, 3), m = ri(r, -3, 4);
    const l1 = a + b, l2 = a - b; const p = x => x * x + k * x + m;
    const pr = (x, y) => M(Math.max(x, y) + '\\text{ and }' + Math.min(x, y));
    const poly = lin([[1, 'A^2'], [k, 'A'], [m, 'I']]), polyL = lin([[1, '\\lambda^2'], [k, '\\lambda'], [m, '']]);
    return { q: 'Let ' + M('A=' + pmat([[a, b], [b, a]])) + '. What are the eigenvalues of ' + M('B=' + poly) + '?', ans: pr(p(l1), p(l2)),
      wrong: [pr(l1, l2), pr(l1 * l1, l2 * l2), pr(p(l1) + 1, p(l2) - 1), pr(p(a), p(b)), pr(p(l1), p(-l2))],
      exp: M('A') + ' is symmetric with trace ' + M(2 * a) + ' and det ' + M(a * a - b * b) + ', so its eigenvalues are ' + M('a\\pm b=' + l1 + ',\\ ' + l2) + ' (eigenvectors ' + M('(1,1)') + ' and ' + M('(1,-1)') + ').\nIf ' + M('Av=\\lambda v') + ' then ' + M('p(A)v=p(\\lambda)v') + '. With ' + M('p(\\lambda)=' + polyL) + ':\n' + M('p(' + l1 + ')=' + p(l1)) + ', ' + M('p(' + l2 + ')=' + p(l2)) + '.' };
  } },
  { id: 'union', topic: 'prob', diff: 'e', title: 'Union of independent events (fresh numbers)', make(r) {
    const a = ri(r, 1, 7) / 10, b = ri(r, 1, 7) / 10; const ans = a + b - a * b; const f = x => M(num(x, 3));
    return { q: 'Events ' + M('A') + ' and ' + M('B') + ' are independent with ' + M('P(A)=' + a) + ' and ' + M('P(B)=' + b) + '. Find ' + M('P(A\\cup B)') + '.', ans: f(ans),
      wrong: [Math.min(1, a + b), a * b, a + b - 2 * a * b, (1 - a) * (1 - b), ans + 0.05].map(f),
      exp: 'Independence gives ' + M('P(A\\cap B)=' + a + '\\times' + b + '=' + num(a * b, 3)) + '.\n' + M('P(A\\cup B)=' + a + '+' + b + '-' + num(a * b, 3) + '=' + num(ans, 3)) + '. Equivalently ' + M('1-(1-' + a + ')(1-' + b + ')') + '.' };
  } },
  { id: 'expect', topic: 'prob', diff: 'e', title: 'Expected value of a discrete variable (fresh numbers)', make(r) {
    const ps = pick(r, [[0.2, 0.3, 0.5], [0.1, 0.6, 0.3], [0.25, 0.25, 0.5], [0.4, 0.4, 0.2], [0.5, 0.3, 0.2]]);
    const xs = shuffle(r, [-2, -1, 0, 1, 2, 3, 4, 5, 6, 8, 10]).slice(0, 3).sort((a, b) => a - b);
    const E = xs.reduce((s, x, i) => s + x * ps[i], 0); const E2 = xs.reduce((s, x, i) => s + x * x * ps[i], 0);
    const f = x => M(num(x, 3));
    return { q: M('X') + ' takes values ' + M(xs.join(',\\ ')) + ' with probabilities ' + M(ps.join(',\\ ')) + '. Find ' + M('E[X]') + '.', ans: f(E),
      wrong: [(xs[0] + xs[1] + xs[2]) / 3, E2, xs.reduce((s, x, i) => s + x * ps[2 - i], 0), E + 0.5, E - 1].map(f),
      exp: M('E[X]=\\sum x_ip_i=' + xs.map((x, i) => P(x) + '(' + ps[i] + ')').join('+') + '=' + num(E, 3)) + '.\nThe plain average of the values ignores the probabilities.' };
  } },
  { id: 'binom', topic: 'prob', diff: 'm', title: 'Binomial probability (fresh numbers)', make(r) {
    const n = ri(r, 4, 8), k = ri(r, 1, n - 1), p = pick(r, [0.2, 0.3, 0.4, 0.6]); const q = Math.round((1 - p) * 10) / 10;
    const ans = binom(n, k) * p ** k * q ** (n - k); const f = x => M('\\approx' + num(x, 4));
    return { q: 'A test has ' + n + ' independent questions, and you get each right with probability ' + M(p) + '. What is ' + M('P(\\text{exactly } ' + k + '\\text{ right})') + '?', ans: f(ans),
      wrong: [p ** k * q ** (n - k), binom(n, k) * q ** k * p ** (n - k), binom(n, k) * p ** k, 1 - ans, binom(n, k) / 2 ** n].map(f),
      exp: M('X\\sim\\text{Bin}(' + n + ',' + p + ')') + ': ' + M('P(X=' + k + ')=\\binom{' + n + '}{' + k + '}(' + p + ')^{' + k + '}(' + q + ')^{' + (n - k) + '}=' + binom(n, k) + '\\times' + num(p ** k, 6) + '\\times' + num(q ** (n - k), 6) + '\\approx' + num(ans, 4)) + '.\nThe ' + M('\\binom{n}{k}') + ' factor counts which ' + k + ' questions are the correct ones.' };
  } },
  { id: 'bayes', topic: 'prob', diff: 'm', title: 'Bayes’ theorem (fresh numbers)', make(r) {
    const pr = pick(r, [0.01, 0.02, 0.05, 0.1]), se = pick(r, [0.9, 0.95, 0.99]), fp = pick(r, [0.02, 0.05, 0.1]);
    const num1 = pr * se, den = num1 + (1 - pr) * fp, ans = num1 / den; const f = x => M('\\approx' + num(x, 3));
    return { q: 'A spam filter: ' + num(pr * 100) + '% of emails are spam. The filter flags ' + num(se * 100) + '% of spam and wrongly flags ' + num(fp * 100) + '% of legitimate email. Given an email is flagged, what is the probability it is spam?', ans: f(ans),
      wrong: [se, num1, 1 - fp, pr, (se + pr) / 2].map(f),
      exp: M('P(\\text{flag})=' + pr + '\\cdot' + se + '+' + num(1 - pr, 2) + '\\cdot' + fp + '=' + num(den, 5)) + '.\n' + M('P(\\text{spam}\\mid\\text{flag})=\\dfrac{' + num(num1, 5) + '}{' + num(den, 5) + '}\\approx' + num(ans, 3)) + '.\nWhen the base rate is low, false positives from the large legitimate pool dominate.' };
  } },
  { id: 'markov', topic: 'prob', diff: 'h', title: 'Stationary distribution of a 2-state chain (fresh numbers)', make(r) {
    const a = ri(r, 1, 6) / 10; let b = ri(r, 1, 6) / 10; if (b === a) b = Math.round((b + 0.1) * 10) / 10;
    const p1 = b / (a + b), p2 = a / (a + b); const pr = (x, y) => M('\\left(' + num(x, 3) + ',\\ ' + num(y, 3) + '\\right)');
    return { q: 'A Markov chain has transition matrix ' + M('P=' + pmat([[num(1 - a, 2), a], [b, num(1 - b, 2)]])) + ' (rows = current state). What is its stationary distribution ' + M('\\pi') + '?', ans: pr(p1, p2),
      wrong: [pr(p2, p1), pr(0.5, 0.5), pr(1 - a, a), pr(1 - b, b)],
      exp: 'At stationarity, probability flow between the states balances: ' + M('\\pi_1\\cdot' + a + '=\\pi_2\\cdot' + b) + '.\nWith ' + M('\\pi_1+\\pi_2=1') + ': ' + M('\\pi_1=\\dfrac{' + b + '}{' + a + '+' + b + '}\\approx' + num(p1, 3)) + ', ' + M('\\pi_2\\approx' + num(p2, 3)) + '.' };
  } },
  { id: 'grad', topic: 'calc', diff: 'e', title: 'Gradient at a point (fresh numbers)', make(r) {
    const a = ri(r, 1, 4), b = ri(r, -3, 3) || 2, x = ri(r, -3, 3) || 1, y = ri(r, -3, 3) || 2;
    const gx = 2 * a * x * y, gy = a * x * x + 3 * b * y * y; const v = (p, q) => M(vec(p, q));
    return { q: 'For ' + M('f(x,y)=' + (a === 1 ? '' : a) + 'x^2y' + (b > 0 ? '+' : '-') + (Math.abs(b) === 1 ? '' : Math.abs(b)) + 'y^3') + ', compute ' + M('\\nabla f(' + x + ',' + y + ')') + '.', ans: v(gx, gy),
      wrong: [v(gy, gx), v(2 * a * x, a * x * x + 3 * b * y), v(gx, 3 * b * y * y), v(a * x * y, a * x * x + b * y * y), v(gx, gy + a * x * x)],
      exp: M('\\partial f/\\partial x=' + 2 * a + 'xy=' + gx) + ' and ' + M('\\partial f/\\partial y=' + a + 'x^2+' + P(3 * b) + 'y^2=' + a * x * x + '+' + P(3 * b * y * y) + '=' + gy) + '.' };
  } },
  { id: 'gdstep', topic: 'calc', diff: 'e', title: 'One gradient descent step (fresh numbers)', make(r) {
    const a = ri(r, 1, 3), b = ri(r, -6, 6), x0 = ri(r, -4, 5) || 2, eta = pick(r, [0.1, 0.05, 0.2, 0.25]);
    const g = 2 * a * x0 + b, x1 = x0 - eta * g; const f = x => M(num(x, 4));
    return { q: 'Run one step of gradient descent on ' + M('f(x)=' + (a === 1 ? '' : a) + 'x^2' + (b ? (b > 0 ? '+' : '') + b + 'x' : '')) + ' from ' + M('x_0=' + x0) + ' with learning rate ' + M('\\eta=' + eta) + '. What is ' + M('x_1') + '?', ans: f(x1),
      wrong: [x0 + eta * g, x0 - eta * (a * x0 + b), x0 - g, x0 - eta * 2 * a * x0, x1 + eta].map(f),
      exp: M("f'(x)=" + 2 * a + 'x' + (b ? (b > 0 ? '+' : '') + b : '')) + ', so ' + M("f'(" + x0 + ')=' + g) + '.\n' + M('x_1=x_0-\\eta f\'(x_0)=' + x0 + '-' + eta + '\\cdot' + P(g) + '=' + num(x1, 4)) + '. Step against the gradient.' };
  } },
  { id: 'quadmin', topic: 'calc', diff: 'm', title: 'Minimiser of a 2-D quadratic (fresh numbers)', make(r) {
    const a = ri(r, 1, 4), b = ri(r, 1, 4), c = ri(r, -8, 8) || 4, d = ri(r, -8, 8) || -2;
    const v = (p, q) => M(vec(p, q)); const t = (k, s) => (k ? (k > 0 ? '+' : '-') + (Math.abs(k) === 1 ? '' : Math.abs(k)) + s : '');
    return { q: 'Find the minimiser of ' + M('f(x,y)=' + (a === 1 ? '' : a) + 'x^2' + t(b, 'y^2') + t(c, 'x') + t(d, 'y')) + '.', ans: v(fr(-c, 2 * a), fr(-d, 2 * b)),
      wrong: [v(fr(c, 2 * a), fr(d, 2 * b)), v(fr(-c, a), fr(-d, b)), v(fr(-c, 2 * b), fr(-d, 2 * a)), v(fr(-d, 2 * b), fr(-c, 2 * a)), v(fr(-c, 2 * a), fr(d, 2 * b))],
      exp: 'Set the gradient to zero: ' + M('\\partial_x f=' + 2 * a + 'x' + t(c, '') + '=0\\Rightarrow x=' + fr(-c, 2 * a)) + ' and ' + M('\\partial_y f=' + 2 * b + 'y' + t(d, '') + '=0\\Rightarrow y=' + fr(-d, 2 * b)) + '.\nThe Hessian ' + M('\\operatorname{diag}(' + 2 * a + ',' + 2 * b + ')') + ' is positive definite, so this is the global minimum.' };
  } },
  { id: 'lagr', topic: 'calc', diff: 'm', title: 'Lagrange multipliers (fresh numbers)', make(r) {
    const a = ri(r, 1, 4), b = ri(r, 1, 4), c = ri(r, 2, 12);
    return { q: 'Maximise ' + M('xy') + ' subject to ' + M((a === 1 ? '' : a) + 'x+' + (b === 1 ? '' : b) + 'y=' + c) + ' (with ' + M('x,y>0') + ').', ans: M(fr(c * c, 4 * a * b)),
      wrong: [fr(c * c, a * b), fr(c * c, 4), fr(c * c, 2 * a * b), fr(c * c, 4 * (a + b)), fr(c, 4 * a * b)].map(M),
      exp: M('\\mathcal L=xy-\\lambda(' + a + 'x+' + b + 'y-' + c + ')') + ': ' + M('y=' + a + '\\lambda') + ', ' + M('x=' + b + '\\lambda') + ', so ' + M(a + 'x=' + b + 'y') + ' and each term is half the budget.\n' + M('x=' + fr(c, 2 * a) + ',\\ y=' + fr(c, 2 * b)) + ', giving ' + M('xy=\\dfrac{c^2}{4ab}=' + fr(c * c, 4 * a * b)) + '.' };
  } },
  { id: 'newton', topic: 'calc', diff: 'h', title: 'Two steps of Newton’s method (fresh numbers)', make(r) {
    const c = pick(r, [2, 3, 5, 6, 7, 10, 11]), x0 = ri(r, 1, 3);
    let p = x0 * x0 + c, q = 2 * x0; let g = gcd(p, q); p /= g; q /= g; // x1 = p/q
    let p2 = p * p + c * q * q, q2 = 2 * p * q; g = gcd(p2, q2); p2 /= g; q2 /= g;
    const wrongs = [fr(p, q), fr(p * p - c * q * q, 2 * p * q), fr(x0 * x0 - c, 2 * x0), fr(p2 + q2, q2), fr(p2 * 2, q2 * 2 + 1)].map(M);
    return { q: 'Apply Newton’s method to ' + M('f(x)=x^2-' + c) + ' starting at ' + M('x_0=' + x0) + '. What is ' + M('x_2') + '?', ans: M(fr(p2, q2)), wrong: wrongs,
      exp: 'Newton: ' + M('x_{n+1}=x_n-\\dfrac{x_n^2-' + c + '}{2x_n}=\\dfrac{x_n^2+' + c + '}{2x_n}') + '.\n' + M('x_1=\\dfrac{' + (x0 * x0) + '+' + c + '}{' + 2 * x0 + '}=' + fr(p, q)) + ', ' + M('x_2=' + fr(p2, q2) + '\\approx' + num(p2 / q2, 5)) + ' (true root ' + M('\\sqrt{' + c + '}\\approx' + num(Math.sqrt(c), 5)) + ').' };
  } },
  { id: 'zscore', topic: 'stat', diff: 'e', title: 'z-score (fresh numbers)', make(r) {
    const mu = ri(r, 40, 80), s = pick(r, [4, 5, 8, 10, 12]), z0 = pick(r, [-2, -1.5, -1, -0.5, 0.5, 1, 1.25, 1.5, 2, 2.5]); const x = mu + z0 * s; const f = v => M(num(v, 3));
    return { q: 'A variable has mean ' + M(mu) + ' and standard deviation ' + M(s) + '. What is the z-score of ' + M(num(x, 2)) + '?', ans: f(z0),
      wrong: [(x - mu) / (s * s), -z0, x - mu, (x - mu) / Math.sqrt(s), z0 + 1].map(f),
      exp: M('z=\\dfrac{x-\\mu}{\\sigma}=\\dfrac{' + num(x, 2) + '-' + mu + '}{' + s + '}=' + num(z0, 3)) + '.' };
  } },
  { id: 'svar', topic: 'stat', diff: 'm', title: 'Sample variance (fresh numbers)', make(r) {
    const n = ri(r, 4, 5); let xs; do { xs = Array.from({ length: n }, () => ri(r, 1, 12)); } while (xs.reduce((a, b) => a + b, 0) % n !== 0);
    const mean = xs.reduce((a, b) => a + b, 0) / n; const ss = xs.reduce((a, x) => a + (x - mean) ** 2, 0); const f = v => M(num(v, 3));
    return { q: 'Find the sample variance ' + M('s^2') + ' (denominator ' + M('n-1') + ') of ' + M('\\{' + xs.join(',') + '\\}') + '.', ans: f(ss / (n - 1)),
      wrong: [ss / n, Math.sqrt(ss / (n - 1)), ss, ss / (n - 2), mean].map(f),
      exp: 'Mean ' + M('\\bar x=' + mean) + '. Squared deviations: ' + M(xs.map(x => (x - mean) ** 2).join(',\\ ')) + ', summing to ' + M(ss) + '.\n' + M('s^2=\\dfrac{' + ss + '}{' + (n - 1) + '}\\approx' + num(ss / (n - 1), 3)) + '. Dividing by ' + M('n') + ' gives the biased MLE.' };
  } },
  { id: 'ci', topic: 'stat', diff: 'm', title: 'Confidence interval for a mean (fresh numbers)', make(r) {
    const xb = ri(r, 20, 120), s = pick(r, [4, 6, 8, 10, 12, 15]), n = pick(r, [16, 25, 36, 49, 64, 100]); const se = s / Math.sqrt(n);
    const ci = z => M('(' + num(xb - z * se, 2) + ',\\ ' + num(xb + z * se, 2) + ')');
    return { q: 'A sample of ' + M('n=' + n) + ' has mean ' + M(xb) + '. The population SD is known to be ' + M(s) + '. What is the 95% confidence interval for ' + M('\\mu') + '?', ans: ci(1.96),
      wrong: [ci(1.645), ci(2.576), M('(' + num(xb - 1.96 * s, 2) + ',\\ ' + num(xb + 1.96 * s, 2) + ')'), ci(1.96 / Math.sqrt(n))],
      exp: M('\\text{SE}=\\sigma/\\sqrt n=' + s + '/' + Math.sqrt(n) + '=' + num(se, 4)) + '. Margin ' + M('=1.96\\times' + num(se, 4) + '=' + num(1.96 * se, 3)) + '.\n' + M('\\bar x\\pm1.96\\,\\text{SE}') + ' gives the interval. 1.645 is for 90%, 2.576 for 99%.' };
  } },
  { id: 'slope', topic: 'stat', diff: 'm', title: 'Regression slope and intercept (fresh numbers)', make(r) {
    const rr = pick(r, [-0.8, -0.6, -0.5, 0.4, 0.5, 0.6, 0.75, 0.9]), sx = pick(r, [2, 4, 5, 8]), sy = pick(r, [3, 6, 10, 12]), mx = ri(r, 2, 10), my = ri(r, 10, 40);
    const b = rr * sy / sx, a = my - b * mx; const f = v => M(num(v, 3));
    return { q: 'For paired data, ' + M('\\bar x=' + mx) + ', ' + M('\\bar y=' + my) + ', ' + M('s_x=' + sx) + ', ' + M('s_y=' + sy) + ', and ' + M('r=' + rr) + '. What is the intercept of the least-squares line ' + M('\\hat y=a+bx') + '?', ans: f(a),
      wrong: [my - (rr * sx / sy) * mx, my + b * mx, my - rr * mx, b, mx - b * my].map(f),
      exp: 'Slope ' + M('b=r\\,s_y/s_x=' + rr + '\\cdot' + sy + '/' + sx + '=' + num(b, 4)) + '. The line passes through ' + M('(\\bar x,\\bar y)') + ', so\n' + M('a=\\bar y-b\\bar x=' + my + '-' + P(num(b, 4)) + '\\cdot' + mx + '=' + num(a, 3)) + '.' };
  } },
  { id: 'totvar', topic: 'stat', diff: 'h', title: 'Law of total variance (fresh numbers)', make(r) {
    const w = pick(r, [0.2, 0.25, 0.4, 0.5, 0.6, 0.75]), m1 = ri(r, 0, 10), m2 = m1 + ri(r, 2, 10), v1 = ri(r, 1, 9), v2 = ri(r, 1, 9);
    const within = w * v1 + (1 - w) * v2, between = w * (1 - w) * (m1 - m2) ** 2, ans = within + between; const f = v => M(num(v, 3));
    return { q: 'A population is ' + num(w * 100) + '% group A (mean ' + M(m1) + ', variance ' + M(v1) + ') and ' + num((1 - w) * 100) + '% group B (mean ' + M(m2) + ', variance ' + M(v2) + '). What is the overall variance?', ans: f(ans),
      wrong: [within, between, v1 + v2, within + (m2 - m1) ** 2, (v1 + v2) / 2 + between].map(f),
      exp: M('\\operatorname{Var}(Y)=E[\\operatorname{Var}(Y\\mid G)]+\\operatorname{Var}(E[Y\\mid G])') + '.\nWithin: ' + M(w + '\\cdot' + v1 + '+' + num(1 - w, 2) + '\\cdot' + v2 + '=' + num(within, 3)) + '. Between: ' + M('w(1-w)(\\mu_A-\\mu_B)^2=' + num(between, 3)) + '.\nTotal ' + M('=' + num(ans, 3)) + '.' };
  } },
  { id: 'handshake', topic: 'graph', diff: 'e', title: 'Edges of a regular graph (fresh numbers)', make(r) {
    let n, k; do { n = ri(r, 5, 20); k = ri(r, 2, Math.min(7, n - 1)); } while ((n * k) % 2);
    return { q: 'A simple graph has ' + M(n) + ' vertices, each of degree ' + M(k) + '. How many edges does it have?', ans: M(n * k / 2),
      wrong: [n * k, n + k, n * (n - 1) / 2, n * k / 2 + 1, n * k / 4].map(v => M(num(v))),
      exp: 'Handshake lemma: ' + M('\\sum\\deg v=2|E|') + ', so ' + M('|E|=\\dfrac{' + n + '\\cdot' + k + '}{2}=' + n * k / 2) + '.' };
  } },
  { id: 'cayley', topic: 'graph', diff: 'm', title: 'Spanning trees of a complete graph (fresh numbers)', make(r) {
    const n = ri(r, 3, 7); const ans = n ** (n - 2); const fact = k => (k <= 1 ? 1 : k * fact(k - 1));
    return { q: 'How many labelled spanning trees does ' + M('K_{' + n + '}') + ' have?', ans: M(ans),
      wrong: [n * (n - 1) / 2, n ** (n - 1), fact(n), fact(n - 1), n - 1].map(M),
      exp: 'Cayley’s formula: ' + M('K_n') + ' has ' + M('n^{n-2}') + ' spanning trees, so ' + M(n + '^{' + (n - 2) + '}=' + ans) + '. (Every spanning tree has ' + M('n-1=' + (n - 1)) + ' edges.)' };
  } },
  { id: 'dijkstra', topic: 'graph', diff: 'm', title: 'Shortest path with Dijkstra (fresh numbers)', make(r) {
    const n = 5; const es = randGraph(r, n, 3).map(e => ({ ...e, w: ri(r, 1, 9) }));
    const dist = Array(n).fill(Infinity), prev = Array(n).fill(-1), done = Array(n).fill(false); dist[0] = 0;
    for (let it = 0; it < n; it++) { let u = -1; for (let i = 0; i < n; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i; done[u] = true;
      for (const e of es) { const v = e.u === u ? e.v : e.v === u ? e.u : -1; if (v >= 0 && dist[u] + e.w < dist[v]) { dist[v] = dist[u] + e.w; prev[v] = u; } } }
    const T = n - 1; const path = []; for (let v = T; v >= 0; v = prev[v]) path.unshift(LET[v]);
    const direct = es.find(e => e.u === 0 && e.v === T); const tot = es.reduce((s, e) => s + e.w, 0);
    return { q: 'An undirected weighted graph has edges ' + edgeList(es) + '. What is the shortest distance from A to ' + LET[T] + '?', ans: M(dist[T]),
      wrong: [direct ? direct.w : dist[T] + 2, dist[T] + 1, dist[T] - 1, path.length - 1, dist[T] + 3, tot].filter(v => v > 0 && v !== dist[T]).map(M),
      exp: 'Dijkstra from A gives final distances: ' + dist.map((d, i) => LET[i] + '=' + d).join(', ') + '.\nShortest path: ' + path.join('→') + ' with length ' + M(dist[T]) + '. Always settle the closest unsettled vertex next, then relax its edges.' };
  } },
  { id: 'mst', topic: 'graph', diff: 'h', title: 'Minimum spanning tree with Kruskal (fresh numbers)', make(r) {
    const n = 5; const raw = randGraph(r, n, 3); const ws = shuffle(r, [...Array(14).keys()].map(i => i + 1)).slice(0, raw.length);
    const es = raw.map((e, i) => ({ ...e, w: ws[i] })); const sorted = es.slice().sort((a, b) => a.w - b.w);
    const par = [...Array(n).keys()]; const find = x => (par[x] === x ? x : (par[x] = find(par[x])));
    let total = 0; const steps = [];
    for (const e of sorted) { const a = find(e.u), b = find(e.v); if (a !== b) { par[a] = b; total += e.w; steps.push(LET[e.u] + '–' + LET[e.v] + ' (' + e.w + ') ✓'); } else steps.push(LET[e.u] + '–' + LET[e.v] + ' (' + e.w + ') skip, makes a cycle'); }
    const naive = sorted.slice(0, n - 1).reduce((s, e) => s + e.w, 0);
    const star = es.filter(e => e.u === 0 || e.v === 0).reduce((s, e) => s + e.w, 0);
    return { q: 'An undirected graph has weighted edges ' + edgeList(es) + '. What is the total weight of its minimum spanning tree?', ans: M(total),
      wrong: [naive, total + 1, total + 2, total - 1, star, total + 3].filter(v => v > 0 && v !== total).map(M),
      exp: 'Kruskal: scan edges by increasing weight and add each one that joins two different components.\n' + steps.join('; ') + '.\nTotal ' + M('=' + total) + '.' + (naive !== total ? ' Summing the 4 lightest edges (' + naive + ') is wrong here because they contain a cycle.' : '') };
  } },
];
const GEN_SUB = { det2: 'determinants', matvec: 'matrix-ops', eig2: 'eigen', inv2: 'matrix-ops', polyeig: 'eigen',
  union: 'independence', expect: 'expectation-variance', binom: 'discrete-dists', bayes: 'conditional-bayes', markov: 'markov-chains',
  grad: 'gradients-multivariable', gdstep: 'gradient-descent', quadmin: 'maxima-minima', lagr: 'constrained-optimization', newton: 'single-var-optimization',
  zscore: 'descriptive', svar: 'descriptive', ci: 'confidence-intervals', slope: 'regression-correlation', totvar: 'descriptive',
  handshake: 'basics-degree', cayley: 'trees', dijkstra: 'shortest-paths', mst: 'mst' };
for (const g of GENS) g.sub = GEN_SUB[g.id] || '';
const GENMAP = Object.fromEntries(GENS.map(g => [g.id, g]));

function buildGenerated(gid, seed) {
  const g = GENMAP[gid]; if (!g) return null;
  for (let t = 0; t < 30; t++) {
    const r = mulberry32(seed * 31 + t * 7919 + 1);
    let o; try { o = g.make(r); } catch (e) { continue; }
    const seen = new Set([o.ans]); const wrong = [];
    for (const w of o.wrong) { if (wrong.length === 3) break; if (!w || /NaN|Infinity|undefined/.test(w) || seen.has(w)) continue; seen.add(w); wrong.push(w); }
    if (wrong.length < 3) continue;
    const order = shuffle(mulberry32(seed + 17), [0, 1, 2, 3]); const base = [o.ans, ...wrong];
    return { id: 'g_' + gid + '_' + seed, gen: gid, type: 'mcq', topic: g.topic, diff: g.diff, sub: g.sub, title: g.title, q: o.q, options: order.map(i => base[i]), correct: order.indexOf(0), exp: o.exp };
  }
  return null;
}

if (typeof module !== 'undefined') module.exports = { parseBank, GENS, buildGenerated, TOPICS, SUBTOPICS, QTYPES };
