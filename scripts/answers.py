#!/usr/bin/env python3
"""Print the answer key for a topic: one line per question, `id<TAB>type<TAB>answer` (nat adds ±TOL).

Usage: python3 scripts/answers.py <topic> [--json] [--shuffle-key verify/<name>-shuffle-key.json]
With --shuffle-key, only the questions in that key are printed, with answers in the shuffled letters
the solvers saw (see export_blind.py --shuffle).
"""
import json, sys
from bankparse import load

args = sys.argv[1:]
skey = None
if '--shuffle-key' in args:
    i = args.index('--shuffle-key'); skey = json.load(open(args[i + 1])); del args[i:i + 2]
if not args:
    raise SystemExit(__doc__)
qs = load(args[0])
if skey is not None:
    qs = [q for q in qs if q['id'] in skey]
def ans(q):
    if skey is None or not skey.get(q['id']):
        return q['ans']
    inv = {bank: shown for shown, bank in skey[q['id']].items()}
    return ','.join(sorted(inv[l.strip()] for l in q['ans'].split(',')))
if '--json' in args:
    print(json.dumps({q['id']: {'type': q['type'], 'ans': ans(q), 'tol': q['tol'] or ('0.01' if q['type'] == 'nat' else '')} for q in qs}, indent=1))
else:
    for q in qs:
        extra = f" ±{q['tol'] or '0.01'}" if q['type'] == 'nat' else ''
        print(f"{q['id']}\t{q['type']}\t{ans(q)}{extra}")
