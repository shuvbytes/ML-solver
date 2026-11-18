# Graph Theory verification report

Date: 2026-11-18. Scope: all 200 `graph` questions (`bank/graph.txt`, `bank/graph-a.txt`, `bank/graph-b.txt`, `bank/graph-c.txt`).

## Method

1. `python3 scripts/export_blind.py graph 50 --shuffle` wrote 4 chunks of 50 (id, type, question, options; no answers or explanations), with every question's options shuffled so the stored answer letter gave nothing away.
2. Four independent solvers, one per chunk, ran in parallel. Each read only its chunk, solved every question, ran graph computations in Python (traversals, shortest paths, spanning-tree enumeration, spectra, PageRank, hitting times), gave a confidence level and flagged anything ambiguous. Answers were saved to `verify/graph-<n>-answers.json`.
3. `python3 scripts/compare_blind.py graph` compared them with the key (numerical answers within TOL, multiple-select as exact sets).

## Results

| | Count |
|---|---|
| Questions checked | 200 (mcq 155, nat 27, msq 18) |
| Agreed with the answer key | 199 |
| Disagreements | 1 |
| Flagged or below high confidence | 0 |
| Wrong answer keys | 0 |
| Rewritten or reworded | 0 |
| Deleted | 0 |

## Disputed questions

| Id | Problem | Verdict | Change |
|---|---|---|---|
| graph-h-042 | Solver answered the option showing 16, but its own working says "new MST weight 13" | Solver's letter slip. Re-worked with Kruskal: AB(1), CD(3), CE(4), then BD(5) joins {A,B} to {C,D,E}; total 13, which is the key | None |

## Near-duplicate check

graph-h-024 (cross edges in a directed DFS forest) and graph-h-031 (number of trees in a DFS forest) share the DFS setup but use different graphs and test different ideas, so both stay.

## Final counts

Easy 50, Medium 75, Hard 75, total 200. Every subtopic has at least 5 Easy, 7 Medium and 7 Hard questions (`node scripts/check.js --subtopics`).
