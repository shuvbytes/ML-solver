// Validate the question bank and generators. Run: node scripts/check.js [--subtopics]
const fs = require('fs'), path = require('path');
const { parseBank, GENS, buildGenerated, TOPICS, SUBTOPICS } = require('../src/core.js');
const dir = path.join(__dirname, '..', 'bank');
const text = fs.readdirSync(dir).filter(f => f.endsWith('.txt')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n\n');
const B = parseBank(text);
let errors = 0; const err = (id, m) => { errors++; console.log(`ERROR ${id}: ${m}`); };
const ids = new Set(), titles = new Map();
for (const q of B) {
  if (ids.has(q.id)) err(q.id, 'duplicate id'); ids.add(q.id);
  if (!TOPICS[q.topic]) err(q.id, 'unknown topic ' + q.topic);
  if (!q.id.startsWith(q.topic + '-' + q.diff + '-')) err(q.id, 'id must start with topic-diff-');
  if (!q.title) err(q.id, 'missing T:'); if (!q.q) err(q.id, 'missing Q:'); if (!q.exp) err(q.id, 'missing EXP:');
  if (!q.sub) err(q.id, 'missing S:');
  else if (!(SUBTOPICS[q.topic] && SUBTOPICS[q.topic][q.sub])) err(q.id, `S: ${q.sub} is not a ${q.topic} subtopic (allowed: ${Object.keys(SUBTOPICS[q.topic] || {}).join(', ')})`);
  if (q.type === 'invalid') err(q.id, `unknown TYPE: ${q.typeRaw} (use nat or msq, or omit for mcq)`);
  if (q.type !== 'nat' && q.tolRaw) err(q.id, 'TOL: is only allowed with TYPE: nat');
  if (q.type === 'nat') {
    if (q.opts.some(o => o)) err(q.id, 'TYPE: nat must not have options A-D');
    if (!Number.isFinite(q.ans)) err(q.id, `ANS must be a plain number for TYPE: nat (got "${q.ansRaw}")`);
    if (!Number.isFinite(q.tol) || q.tol < 0) err(q.id, `TOL must be a non-negative number (got "${q.tolRaw}")`);
  } else if (q.type === 'mcq' || q.type === 'msq') {
    if (q.opts.some(o => !o)) err(q.id, 'needs four options A-D');
    if (new Set(q.opts).size < 4) err(q.id, 'duplicate options');
    if (q.type === 'mcq' && q.ans < 0) err(q.id, `ANS must be one of A, B, C, D (got "${q.ansRaw}")`);
    if (q.type === 'msq') {
      if (!q.ans.length) err(q.id, 'TYPE: msq needs at least one correct option, e.g. ANS: A,C');
      if (q.ans.some(i => i < 0)) err(q.id, `ANS for msq must be comma-separated letters A-D (got "${q.ansRaw}")`);
      if (new Set(q.ans).size !== q.ans.length) err(q.id, 'ANS lists an option twice');
    }
  }
  const all = q.q + q.opts.join('') + q.exp;
  if ((all.split('$').length - 1) % 2) err(q.id, 'odd number of $ (unbalanced math)');
  if (/<\/script/i.test(all)) err(q.id, 'contains </script');
  const t = q.title.toLowerCase(); if (titles.has(t)) console.log(`WARN ${q.id}: same title as ${titles.get(t)}`); else titles.set(t, q.id);
}
for (const g of GENS) { let fail = 0;
  if (!(SUBTOPICS[g.topic] && SUBTOPICS[g.topic][g.sub])) err('gen ' + g.id, 'needs a valid subtopic in GEN_SUB');
  for (let s = 1; s <= 300; s++) { const q = buildGenerated(g.id, s);
  if (!q) { fail++; continue; } const all = q.q + q.options.join('') + q.exp;
  if (new Set(q.options).size < 4) err('gen ' + g.id, 'duplicate options at seed ' + s);
  if (/NaN|undefined|Infinity/.test(all)) err('gen ' + g.id, 'NaN/undefined at seed ' + s);
  if ((all.split('$').length - 1) % 2) err('gen ' + g.id, 'unbalanced $ at seed ' + s); }
  if (fail > 3) err('gen ' + g.id, fail + '/300 seeds failed'); }
console.log(`\n${B.length} questions, ${GENS.length} generators`);
const byTD = {}, byType = {}; for (const q of B) { const k = q.topic + '-' + q.diff; byTD[k] = (byTD[k] || 0) + 1; byType[q.type] = (byType[q.type] || 0) + 1; }
console.log(byTD); console.log('types:', byType);
if (process.argv.includes('--subtopics')) {
  for (const tp of Object.keys(TOPICS)) {
    console.log(`\n${tp.padEnd(30)}  e   m   h   total`);
    for (const sub of Object.keys(SUBTOPICS[tp])) {
      const c = d => B.filter(q => q.topic === tp && q.sub === sub && (!d || q.diff === d)).length;
      console.log(`  ${sub.padEnd(28)}${String(c('e')).padStart(3)} ${String(c('m')).padStart(3)} ${String(c('h')).padStart(3)}   ${String(c()).padStart(3)}`);
    }
  }
}
console.log(errors ? `\n${errors} error(s)` : '\nAll checks passed');
process.exit(errors ? 1 : 0);
