#!/usr/bin/env python3
"""Export a topic's questions for blind verification, WITHOUT answers or explanations.

Usage: python3 scripts/export_blind.py <topic> [chunk_size=40] [--ids id1,id2,...] [--shuffle] [--name NAME]
Writes verify/<NAME>-1.json, verify/<NAME>-2.json, ... (NAME defaults to the topic; verify/ is git-ignored).
Each item: id, type (mcq | nat | msq), question, options (A-D, empty for nat).

--shuffle permutes each question's options (deterministically, by id) so the stored answer letter gives
nothing away. The mapping goes to verify/<NAME>-shuffle-key.json, which solvers must not read;
`python3 scripts/answers.py <topic> --shuffle-key verify/<NAME>-shuffle-key.json` prints the key in shuffled letters.
"""
import hashlib, json, random, sys
from bankparse import ROOT, load

args = [a for a in sys.argv[1:]]
def opt(flag, default=None):
    if flag in args:
        i = args.index(flag); v = args[i + 1]; del args[i:i + 2]; return v
    return default
ids = opt('--ids'); name = opt('--name'); shuffle = '--shuffle' in args
args = [a for a in args if a != '--shuffle']
if not args:
    raise SystemExit(__doc__)
topic = args[0]
size = int(args[1]) if len(args) > 1 else 40
name = name or topic
qs = load(topic)
if ids:
    want = ids.split(','); byid = {q['id']: q for q in qs}
    missing = [i for i in want if i not in byid]
    if missing: raise SystemExit(f'unknown ids: {missing}')
    qs = [byid[i] for i in want]
if not qs:
    raise SystemExit(f'no questions for topic {topic!r}')
out = ROOT / 'verify'
out.mkdir(exist_ok=True)
for old in out.glob(f'{name}-[0-9]*.json'):
    old.unlink()
key = {}
def item(q):
    opts = {k: q['opts'][k] for k in 'ABCD' if k in q['opts']}
    if shuffle:
        key[q['id']] = {}  # nat questions have no options to shuffle but still belong to this export
    if shuffle and opts:
        letters = list(opts); perm = letters[:]
        random.Random(int(hashlib.sha256(q['id'].encode()).hexdigest(), 16)).shuffle(perm)
        key[q['id']] = dict(zip(letters, perm))  # shown letter -> bank letter
        opts = {shown: q['opts'][bank] for shown, bank in key[q['id']].items()}
    return {'id': q['id'], 'type': q['type'], 'question': q['q'], 'options': opts}
for n, i in enumerate(range(0, len(qs), size), 1):
    items = [item(q) for q in qs[i:i + size]]
    (out / f'{name}-{n}.json').write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'verify/{name}-{n}.json: {len(items)} questions')
if shuffle:
    (out / f'{name}-shuffle-key.json').write_text(json.dumps(key, indent=1), encoding='utf-8')
    print(f'verify/{name}-shuffle-key.json: option mapping (keep away from solvers)')
