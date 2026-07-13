# Slide Patterns

## Claim With Progressive Evidence

```md
---
section: Evidence
subsection: Matched-budget result
---

# The proposed readout reduces error under finite sampling

<v-clicks>

- Baseline error remains above 0.12 across all tested seeds.
- The proposed readout reaches 0.08 ± 0.01.
- The gain persists under the matched sampling budget.

</v-clicks>

The matched-budget comparison follows the registered protocol. \cite{paper-key}
```

## Two Columns

```md
---
layout: two-cols
section: Method
subsection: Training architecture
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
subsection: Contractivity
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
subsection: Memory capacity
---

# Memory capacity peaks at an intermediate coupling strength

![Memory capacity versus coupling strength with confidence intervals](/figures/memory-capacity.svg)

The figure reproduces the registered source. \cite{paper-key}
```

Do not put a redundant title inside the figure. Keep panel labels only when they carry scientific references.

## Outline And Closing

Place one `layout: outline` slide after the cover and give it `routeAlias: outline`. The outline automatically discovers the unique `section` values on content slides and the first slide carrying each unique `subsection` value.

Every content slide must identify its top-level `section` and its outline target in `subsection`. Section numbers follow first appearance and require no divider slides or manual numbering. Use `layout: closing` with `author`, `contactEmail`, and `contactWeb`.

## Numbered Citations

Declare references once in the deck headmatter. Array order defines the stable deck-wide number.

```yaml
references:
  - key: paper-key
    authorYear: Author et al., 2026
    title: Paper title
    doi: 10.xxxx/xxxxx
```

Write `\cite{paper-key}` in ordinary Markdown content. Multiple keys use `\cite{first-key,second-key}`. The theme inserts small superscript numbers in the content and automatically places the corresponding numbered references beside the UniLU footer logo. Do not manually number citations.
