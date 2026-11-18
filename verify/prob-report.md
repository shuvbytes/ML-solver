# Probability verification report

Date: 2026-11-17. Scope: all 200 `prob` questions (`bank/prob.txt`, `bank/prob-a.txt`, `bank/prob-b.txt`).

## Method

1. `python3 scripts/export_blind.py prob 50 --shuffle` wrote 4 chunks of 50 (id, type, question, options; no answers or explanations), with every question's options shuffled so the stored answer letter gave nothing away.
2. Four independent solvers, one per chunk, ran in parallel. Each read only its chunk, solved every question, checked numeric work in Python (numpy/sympy), gave a confidence level and flagged anything ambiguous. Answers were saved to `verify/prob-<n>-answers.json`.
3. `python3 scripts/compare_blind.py prob` compared them with the key (numerical answers within TOL, multiple-select as exact sets).
4. Every changed question got a second blind pass with a fresh solver and shuffled options.

## Results

| | Count |
|---|---|
| Questions checked | 200 (mcq 152, nat 30, msq 18) |
| Agreed with the answer key | 200 |
| Disagreements | 0 |
| Flagged or below high confidence | 2 |
| Wrong answer keys | 0 |
| Rewritten or reworded | 2 |
| Deleted | 0 |

## Disputed questions

| Id | Problem | Verdict | Change |
|---|---|---|---|
| prob-m-072 | "Starts in state 1" did not say $X_0$ or $X_1$; the readings give 0.65 and 0.70 (solver: medium confidence) | Ambiguous wording; key 0.65 is right for $X_0=1$ | Question now says "at time $0$, i.e. $X_0=1$". Rechecked blind |
| prob-h-020 | Option "$0\le p\le0.2$" is also a true statement, only less tight than the key | Two defensible options | Question now asks for the exact range over all dependence structures; the explanation says why $p=0$ is impossible. Rechecked blind |

## Final counts

Easy 50, Medium 75, Hard 75, total 200. Every subtopic has at least 3 Easy, 5 Medium and 5 Hard questions (`node scripts/check.js --subtopics`).
