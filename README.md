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

Append to `bank/<topic>.txt` using the format in `CLAUDE.md`, then run check and build.

Progress is saved in your browser's local storage, so it stays on the device and browser you use.
