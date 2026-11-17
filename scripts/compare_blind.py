#!/usr/bin/env python3
"""Compare blind solvers' answers with the answer key.

Usage: python3 scripts/compare_blind.py <topic> [--name N]
Reads verify/<N>-<n>-answers.json (written by solvers: list of {id, answer, confidence, working, flag})
and, if present, verify/<N>-shuffle-key.json (from export_blind.py --shuffle). Prints a summary and every
disagreement, flag, low/medium-confidence answer and missing id. Exit code 1 if anything needs review.
"""
import glob, json, re, sys
from pathlib import Path
from bankparse import ROOT, load

args = sys.argv[1:]
name = None
if '--name' in args:
    i = args.index('--name'); name = args[i + 1]; del args[i:i + 2]
if not args:
    raise SystemExit(__doc__)
topic = args[0]; name = name or topic
V = ROOT / 'verify'
keyf = V / f'{name}-shuffle-key.json'
skey = json.loads(keyf.read_text()) if keyf.exists() else {}
bank = {q['id']: q for q in load(topic)}
chunks = sorted(glob.glob(str(V / f'{name}-[0-9]*.json')))
chunks = [c for c in chunks if not c.endswith('-answers.json')]
exported = [it['id'] for c in chunks for it in json.loads(Path(c).read_text())]
solved = {}
for f in sorted(glob.glob(str(V / f'{name}-[0-9]*-answers.json'))):
    for a in json.loads(Path(f).read_text()):
        solved[a['id']] = a

def key_letters(q):
    """Correct option letters as the solver saw them."""
    m = skey.get(q['id']) or {}
    inv = {bank_l: shown for shown, bank_l in m.items()}
    return sorted(inv.get(l.strip(), l.strip()) for l in q['ans'].split(','))

def letters(s):
    return sorted(set(re.findall(r'[A-D]', str(s).upper())))

def num(s):
    m = re.search(r'-?\d+(?:\.\d+)?(?:[eE]-?\d+)?', str(s).replace(',', ''))
    return float(m.group(0)) if m else None

rows = {'agree': 0, 'disagree': [], 'review': [], 'missing': []}
for qid in exported:
    q = bank.get(qid)
    if q is None:
        continue  # question deleted since export
    a = solved.get(qid)
    if a is None:
        rows['missing'].append(qid); continue
    if q['type'] == 'nat':
        tol = float(q['tol'] or 0.01); x = num(a['answer'])
        ok = x is not None and abs(x - float(q['ans'])) <= tol + 1e-9
        keystr = f"{q['ans']} ±{q['tol'] or '0.01'}"
    else:
        k = key_letters(q); ok = letters(a['answer']) == k; keystr = ','.join(k)
    conf = str(a.get('confidence', '')).lower(); flag = a.get('flag') or ''
    line = f"{qid} [{q['type']}] key={keystr} solver={a['answer']} conf={conf}" + (f" FLAG: {flag}" if flag else '') + f"\n    working: {a.get('working', '')}"
    if not ok:
        rows['disagree'].append(line)
    else:
        rows['agree'] += 1
        if flag or conf != 'high':
            rows['review'].append(line)
print(f"{topic}: exported {len(exported)}, answered {len(exported) - len(rows['missing'])}, agree {rows['agree']}, "
      f"disagree {len(rows['disagree'])}, agree-but-review {len(rows['review'])}, missing {len(rows['missing'])}")
for title in ('disagree', 'review'):
    if rows[title]:
        print(f"\n== {title} ==\n" + '\n'.join(rows[title]))
if rows['missing']:
    print('\n== missing ==\n' + ', '.join(rows['missing']))
sys.exit(1 if rows['disagree'] or rows['review'] or rows['missing'] else 0)
