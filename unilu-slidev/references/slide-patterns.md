# Slide Patterns

## Claim With Progressive Evidence

```md
---
section: Results
---

# The proposed readout reduces error under finite sampling

<v-clicks>

- Baseline error remains above 0.12 across all tested seeds.
- The proposed readout reaches 0.08 ± 0.01.
- The gain persists under the matched sampling budget.

</v-clicks>

<FrameCite author-year="Author et al., 2026" title="Paper title" doi="10.xxxx/xxxxx" />
```

## Two Columns

```md
---
layout: two-cols
section: Method
---

# Training separates fixed quantum dynamics from a linear readout

- Fixed reservoir evolution
- Measured observables
- Regularized classical fit

::right::

<CompactBlock title="Optimization">
Only the classical readout is trained.
</CompactBlock>
```

## Equation

```md
---
layout: equation
section: Theory
---

# Contractive dynamics provide fading memory

$$
\norm{\rho_t-\sigma_t}_1 \leq C\lambda^t\norm{\rho_0-\sigma_0}_1,
\qquad 0<\lambda<1.
$$

<CompactBlock title="Implication">
Dependence on the initial state decays geometrically.
</CompactBlock>
```

## Figure Result

```md
---
layout: figure
section: Results
---

# Memory capacity peaks at an intermediate coupling strength

![Memory capacity versus coupling strength with confidence intervals](/figures/memory-capacity.svg)

<FrameCite author-year="Author et al., 2025" title="Paper title" url="https://arxiv.org/abs/0000.00000" />
```

Do not put a redundant title inside the figure. Keep panel labels only when they carry scientific references.

## Section And Closing

Use `layout: section` with `sectionNumber`, `sectionTitle`, and optional `subsections`. Use `layout: closing` with `author`, `contactEmail`, and `contactWeb`. These layouts intentionally suppress ordinary content chrome.
