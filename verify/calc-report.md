# Calculus & Optimization verification report

Date: 2026-11-17. Scope: all 200 `calc` questions (`bank/calc.txt`, `bank/calc-a.txt`, `bank/calc-b.txt`).

## Method

1. `python3 scripts/export_blind.py calc 50 --shuffle` wrote 4 chunks of 50 (id, type, question, options; no answers or explanations), with every question's options shuffled so the stored answer letter gave nothing away.
2. Four independent solvers, one per chunk, ran in parallel. Each read only its chunk, solved every question, checked numeric work in Python (numpy/sympy), gave a confidence level and flagged anything ambiguous. Answers were saved to `verify/calc-<n>-answers.json`.
3. `python3 scripts/compare_blind.py calc` compared them with the key (numerical answers within TOL, multiple-select as exact sets).
4. Every changed question got a second blind pass with a fresh solver and shuffled options.

## Results

| | Count |
|---|---|
| Questions checked | 200 (mcq 148, nat 35, msq 17) |
| Agreed with the answer key | 200 |
| Disagreements | 0 |
| Flagged or below high confidence | 0 |
| Wrong answer keys | 0 |
| Rewritten or reworded | 0 |
| Deleted | 0 |

## Disputed questions

None. One solver noted on calc-h-045 that "critical points" can be read two ways; the option in question is false under both readings, so no change was needed.

Single-variable subtopics (limits, continuity/differentiability, derivatives, Taylor series, maxima/minima, single-variable optimisation, integrals) hold 132 of the 200 questions, above the half that CLAUDE.md requires.

## Final counts

Easy 50, Medium 75, Hard 75, total 200. Every subtopic has at least 4 Easy, 6 Medium and 6 Hard questions (`node scripts/check.js --subtopics`).
