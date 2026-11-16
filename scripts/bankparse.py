"""Minimal Python reader for bank/*.txt, mirroring parseBank in src/core.js.
Used by export_blind.py and answers.py."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIELD = re.compile(r'^(T|S|TYPE|TOL|Q|A|B|C|D|ANS|EXP): ?(.*)$')
HEAD = re.compile(r'^@ (\w+) ([emh])(?: (\S+))?$')


def bank_files(topic):
    """bank/<topic>.txt and bank/<topic>-*.txt, in a stable order."""
    return sorted(p for p in (ROOT / 'bank').glob('*.txt') if p.stem == topic or p.stem.startswith(topic + '-'))


def parse(text):
    out, cur, key = [], None, None
    for raw in text.split('\n'):
        line = raw.rstrip()
        h = HEAD.match(line)
        if h:
            if cur: out.append(cur)
            cur = {'id': h.group(3), 'topic': h.group(1), 'diff': h.group(2), 'type': 'mcq', 'sub': '', 'title': '',
                   'q': '', 'opts': {}, 'ans': '', 'tol': '', 'exp': ''}
            key = None
            continue
        if cur is None: continue
        m = FIELD.match(line)
        if m:
            key, v = m.group(1), m.group(2)
            if key == 'T': cur['title'] = v
            elif key == 'S': cur['sub'] = v.strip()
            elif key == 'TYPE': cur['type'] = v.strip()
            elif key == 'TOL': cur['tol'] = v.strip()
            elif key == 'Q': cur['q'] = v
            elif key == 'ANS': cur['ans'] = v.strip()
            elif key == 'EXP': cur['exp'] = v
            else: cur['opts'][key] = v
            continue
        if not line.strip(): continue
        if key == 'Q': cur['q'] += '\n' + line
        elif key == 'EXP': cur['exp'] += '\n' + line
    if cur: out.append(cur)
    return out


def load(topic):
    qs = []
    for p in bank_files(topic):
        qs += [q for q in parse(p.read_text(encoding='utf-8')) if q['topic'] == topic]
    order = {'e': 0, 'm': 1, 'h': 2}
    return sorted(qs, key=lambda q: (order[q['diff']], q['id']))
