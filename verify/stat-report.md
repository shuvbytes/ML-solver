# Statistics verification report

Date: 2026-11-17. Scope: all 200 `stat` questions (`bank/stat.txt`, `bank/stat-a.txt`, `bank/stat-b.txt`).

## Method

1. `python3 scripts/export_blind.py stat 50 --shuffle` wrote 4 chunks of 50 (id, type, question, options; no answers or explanations), with every question's options shuffled so the stored answer letter gave nothing away.
2. Four independent solvers, one per chunk, ran in parallel. Each read only its chunk, solved every question, checked numeric work in Python (numpy/sympy), gave a confidence level and flagged anything ambiguous. Answers were saved to `verify/stat-<n>-answers.json`.
3. `python3 scripts/compare_blind.py stat` compared them with the key (numerical answers within TOL, multiple-select as exact sets).
4. Every changed question got a second blind pass with a fresh solver and shuffled options.

## Results

| | Count |
|---|---|
| Questions checked | 200 (mcq 154, nat 28, msq 18) |
| Agreed with the answer key | 200 |
| Disagreements | 0 |
| Flagged or below high confidence | 1 |
| Wrong answer keys | 0 |
| Rewritten or reworded | 1 |
| Deleted | 0 |

## Disputed questions

| Id | Problem | Verdict | Change |
|---|---|---|---|
| stat-h-020 | Two finite-population-correction conventions exist: $\sqrt{(N-n)/(N-1)}$ gives 1.61 (key) and $\sqrt{1-n/N}$ gives 1.60, and both were options (solver: medium confidence) | Convention-dependent | The question now names the factor, and the 1.60 distractor was replaced by 1.21 (using the sampled fraction $n/N$ by mistake). Rechecked blind |

## Final counts

Easy 50, Medium 75, Hard 75, total 200. Every subtopic has at least 4 Easy, 6 Medium and 6 Hard questions (`node scripts/check.js --subtopics`).
