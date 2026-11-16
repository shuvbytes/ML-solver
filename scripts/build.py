#!/usr/bin/env python3
"""Build index.html from src/ and bank/*.txt. Run: python3 scripts/build.py"""
from pathlib import Path
root = Path(__file__).resolve().parent.parent
order = ["la", "prob", "calc", "stat", "graph"]
files = sorted((root / "bank").glob("*.txt"), key=lambda p: (order.index(p.stem.split("-")[0]) if p.stem.split("-")[0] in order else 99, p.stem))
bank = "\n\n".join(p.read_text(encoding="utf-8").strip() for p in files) + "\n"
if "</script" in bank.lower():
    raise SystemExit("bank contains '</script' which would break the page")
html = (root / "src/shell.html").read_text(encoding="utf-8")
html = html.replace("/*BANK*/", bank).replace("/*CORE*/", (root / "src/core.js").read_text(encoding="utf-8")).replace("/*APP*/", (root / "src/app.js").read_text(encoding="utf-8"))
(root / "index.html").write_text(html, encoding="utf-8")
print(f"Built index.html from {len(files)} bank files ({len(html)//1024} KB)")
