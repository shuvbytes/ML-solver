# Linear Algebra verification report

Date: 2026-11-16. Scope: all 200 `la` questions (`bank/la.txt`, `bank/la-e.txt`, `bank/la-m.txt`, `bank/la-h.txt`).

## Method

1. `python3 scripts/export_blind.py la` wrote 5 chunks of 40 (id, type, question, options; no answers or explanations).
2. Five independent solvers, one per chunk, ran in parallel. Each read only its chunk, solved every question with brief working, checked numeric work in Python (numpy/sympy), and gave a confidence level.
3. Their answers were compared with `python3 scripts/answers.py la`.
4. Every rewritten or repaired question then went through a second blind pass with a fresh solver, exported with `--shuffle` so the stored answer letter gave nothing away (most single-answer keys are stored as A; options are shuffled on screen).

## Results of the blind pass

| | Count |
|---|---|
| Questions checked (first pass) | 200 |
| Agreed with the answer key | 200 |
| Disagreements | 0 |
| Low or medium confidence | 0 |
| Flagged by solvers | 3 (`la-e-015`, `la-e-020`, `la-e-033`) |
| Rechecked after changes (second pass, shuffled) | 15, all agreed, none flagged |

No answer key was wrong.

## Disputed and changed questions

| Id | Problem | Verdict | Change |
|---|---|---|---|
| la-e-015 | Solver flagged: options showed explanation text, not the sets | Bank bug: explanation lines starting `A:`..`D:` were parsed as options and overwrote them, on the live site too | Explanation lines now use `[[A]]`..`[[D]]`; options restored. Rechecked: agreed |
| la-e-020 | Same as above (options B–D) | Same bug | Same fix. Rechecked: agreed |
| la-e-033 | Same as above (all options) | Same bug | Same fix. Rechecked: agreed |
| la-e-042 | Weak distractor (midrange); data $1,2,6$ also reused in la-h-020 | Near-duplicate data, weak trap | New data $y=1,2,3,10$; distractors are the median (L1 loss), dividing by $n-1$, and forgetting to divide by $n$ |
| la-m-030 | Same idea and trap as la-h-003 (one-unknown least squares, $\sum xy/\sum x^2$) | Near-duplicate | Rewritten: a repeated equation acts as a weight ($x=1,1,4$ gives $2$, not $2.5$) |
| la-m-049 | Operation-count question | Kept the standard result only | Now asks the total cost $O(n^3+mn^2)$ for $m$ solves; explanation walks through forward and back substitution |
| la-m-070 | LU factor shapes of a tridiagonal matrix | Kept: it is about factor shapes | No change |
| la-h-032 | Same idea as la-e-041 (trace of the hat matrix) | Near-duplicate | Rewritten: leverage $h_{55}=0.6$ of an extreme point in simple regression |
| la-h-043 | Medium difficulty (obvious perfect square) | Made harder | New form $2x^2+2y^2+z^2+2xz+2yz$: first two leading minors positive, the third is $0$, so PSD not PD |
| la-h-045 | Same idea as la-e-046 (solve $Ax=b$ from $L$, $U$) | Near-duplicate | Rewritten: solve $A^Tx=b$ from the same factors ($U^Ty=b$, then $L^Tx=y$) |
| la-h-049 | Medium difficulty; close to la-h-018 ($I+P$ for idempotent $P$) | Made harder | Now: find $\alpha$ with $(I+\alpha P)^{-1}=I-\frac13P$ ($\alpha=\frac12$), traps from the first-order guess and a mis-solved fraction |
| la-h-053 | Rebuilt the same matrix as la-e-029 / la-m-006 | Near-duplicate | Rewritten: $A^4$ entry from non-orthogonal eigenvectors ($65$); trap uses $P^T$ for $P^{-1}$ |
| la-h-054 | Same idea and trap as la-h-018 (function of a projection's eigenvalues) | Near-duplicate | Rewritten: determinant of a symmetric block matrix via the Schur complement ($-1$); trap treats blocks as scalars |
| la-h-055 | Same idea as la-e-038 ($2\times2$ PD range, factor-2 trap) | Near-duplicate | Rewritten: inertia of $xy+yz$, which is $(1,1,1)$; trap reads definiteness off the zero diagonal |
| la-h-061 | "exactly"/"only" options could be read loosely | Ambiguous wording | Options are now explicit sets, and the question asks which set equals the solution set |
| la-h-072 | Same trap as la-m-022 (singular values vs eigenvalues of a triangular matrix) | Near-duplicate | Rewritten: variance along the first PC from the data matrix's singular values ($\sigma_1^2/n=3.6$) |

Deleted: none. Ids are unchanged.

## Explanations that named options by bare letter

Options are shuffled on screen, so "(C) fails" or "B is the trap" pointed at the wrong option for most students. 60 `la` explanations now use the markers (including the rewrites), plus 4 in `stat` and 1 in `graph`. All were converted to `[[A]]`..`[[D]]`, which the app now renders as the on-screen letter. The checker rejects bare letters and repeated fields, and the README documents the convention.

## Near-duplicate scan

All 200 titles and questions were compared across the three files. Seven pairs were rewritten (see the table). These related pairs were kept, because each has a different trap or asks a different thing:
la-m-034 / la-h-038 (nontrivial solutions vs dimension of the solution space), la-m-022 / la-e-047, la-e-025 / la-h-027, la-e-044 / la-h-057 (pivoting sign), la-h-068 / la-h-074 (Cholesky vs $LDL^T$), la-m-014 / la-h-014.

## Final counts

| | Easy | Medium | Hard | Total |
|---|---|---|---|---|
| la | 50 | 75 | 75 | 200 |

Every subtopic has at least 4 Easy, 6 Medium and 6 Hard questions.
