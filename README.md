# ML Math Practice

Daily MCQ practice for the maths behind ML and GATE DA: Linear Algebra, Probability, Calculus & Optimization, Statistics and Graph Theory, at Easy, Medium and Hard levels. Each problem comes with a full explanation.

Features: daily set with streak, problem list with filters, fresh-numbers problems that never run out, review list for wrong answers and bookmarks, and progress by topic and level with an activity calendar.

## Run locally

```
node scripts/check.js      # validate questions and generators
python3 scripts/build.py   # build index.html
```

Then open `index.html` in a browser.

## Add questions

Questions live in `bank/*.txt` (the build reads every `.txt` file there). Add new ones in a new file such as `bank/<topic>-<part>.txt`, then run check and build. The checker must pass.

```
@ prob m prob-m-076
T: Short title (shown in the problem list)
S: conditional-bayes
Q: Question text. Inline math in $...$, display math in $$...$$.
A: option
B: option
C: option
D: option
ANS: B
EXP: Step-by-step explanation. Extra lines continue the explanation.
```

- The header is `@ <topic> <e|m|h> <id>`, with id `<topic>-<level>-<NNN>`. Ids are permanent (saved progress is keyed by them): take the next unused number, never renumber or reuse.
- Topics: `la`, `prob`, `calc`, `stat`, `graph`. `S:` must be one of that topic's subtopic slugs (listed in `SUBTOPICS` in `src/core.js`).
- Only `Q:` and `EXP:` may continue on following lines, and a continuation line must never start with a field name such as `B:`.
- Options are shuffled on screen, so avoid "both A and C" or "none of the above". In explanations write `[[A]]`..`[[D]]` to refer to an option; the app shows its on-screen letter.
- Numerical answer: add `TYPE: nat`, omit A–D, give `ANS: 3.5` and optionally `TOL: 0.01` (absolute; `TOL: 0` only for integers).
- Multiple select: add `TYPE: msq` and list every correct option, e.g. `ANS: A,C`.
- Math is MathJax TeX, written without escaping.

Every question in the bank has been checked by an independent solver who did not see the answer (`scripts/export_blind.py`, `scripts/answers.py`, `scripts/compare_blind.py`); the reports are in `verify/`.

Progress is saved in your browser's local storage, so it stays on the device and browser you use.
