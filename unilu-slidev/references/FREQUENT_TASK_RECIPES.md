# Frequent Task Recipes

Use this file for short, verified, reproducible Slidev workflow fixes. Search it through `scripts/skill_memory.py` before repeating a known investigation.

## Learned Recipes

<!-- SKILL_LEARNED_RECIPE:prevent-generated-deck-visual-qa-failures -->
### Prevent generated deck visual QA failures
- Problem: A presentation inherited canonical visual baselines and visual QA required two outline sections, so a valid one-section starter passed build and tests but failed CI.
- Fix: Do not copy canonical tests/visual/baseline into presentation repositories; allow visual QA to exercise a single generated outline section and test accordion collapse only when a second section exists; run the full quality gate before repository creation or push.
- Use when: A generated or starter presentation fails CI with visual difference percentages or an outline-needs-two-sections error.
- Command: `pnpm check`
- Learned: 2026-07-14T08:33:56+02:00
<!-- /SKILL_LEARNED_RECIPE:prevent-generated-deck-visual-qa-failures -->
