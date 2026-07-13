---
theme: unilu
title: UniLU Slidev Reference Deck
author: Shehbaz Tariq
institute: Interdisciplinary Centre for Security, Reliability and Trust (SnT), University of Luxembourg
eventName: UniLU_MD
eventFull: Browser-Native Academic Presentation System
date: July 13, 2026 · Luxembourg
contactEmail: shehbaz.tariq@uni.lu
contactWeb: www.uni.lu/snt
canvasWidth: 1600
aspectRatio: 16/9
colorSchema: light
transition: fade-out
drawings:
  persist: false
mcp: true
references:
  - key: slidev
    authorYear: Fu and Slidev contributors, 2026
    title: Slidev documentation
    url: https://sli.dev/
  - key: unilu-md
    authorYear: Tariq, 2026
    title: UniLU_MD theme and workflow contract
    url: https://github.com/STP-Lib/UniLU_MD
---

# UniLU Slidev Reference Deck

<!--
Introduce the purpose of this reference deck. PRIVATE-NOTES-MUST-NOT-SHIP
-->

---
layout: outline
routeAlias: outline
---

---
section: Why Slidev
subsection: Motivation and context
---

# Browser-native talks can retain academic discipline

<v-clicks>

- **Markdown authoring** keeps the argument visible and reviewable. \cite{slidev}
- **KaTeX and SVG** preserve equations and scientific figures.
- **Explicit quality gates** separate editing, private review, and public release.

</v-clicks>

<CompactBlock title="Design constraint">
Modern tooling must improve iteration without weakening provenance, legibility, or reproducibility.
</CompactBlock>

<!--
[click] Establish authoring simplicity.
[click] Separate browser math from full TeX figures.
[click] Emphasize the publication gate.
-->

---
layout: two-cols
section: Why Slidev
subsection: Theme contract
---

# The browser layout follows the established 16:9 geometry

- Fixed 1600 × 900 logical canvas
- XCharter body typography
- Latin Modern Sans title geometry
- Hard header and footer safe areas

::right::

<div class="unilu-spec-list">
  <div><span>Navy</span><strong>#1d2c44</strong></div>
  <div><span>Periwinkle</span><strong>#b0bcd2</strong></div>
  <div><span>Accent red</span><strong>#cc4040</strong></div>
  <div><span>Accent blue</span><strong>#5b90cc</strong></div>
</div>

The UniLU implementation preserves the established presentation geometry. \cite{unilu-md}

---
layout: equation
section: Scientific authoring
subsection: Mathematics
---

# Quantum notation remains native and selectable

$$
\rho_{t+1}=\mathcal{E}_{u_t}(\rho_t),
\qquad
y_t=\Tr(O\rho_t),
\qquad
\ket{\psi}=\sum_x \alpha_x\ket{x}.
$$

<CompactBlock title="Compatibility boundary">
Use KaTeX for equations. Compile TikZ, quantikz, and PGFPlots to SVG while retaining their source files.
</CompactBlock>

---
layout: figure
section: Scientific authoring
subsection: Evidence and provenance
---

# One exhibit should carry the result slide

<div class="unilu-demo-figure" role="img" aria-label="Three-stage evidence flow from source through analysis to a supported claim">
  <div>Source</div><span>→</span><div>Analysis</div><span>→</span><div class="accent">Supported claim</div>
</div>

The workflow keeps authoring and evidence traceable. \cite{slidev,unilu-md}

---
section: Controlled publication
subsection: Release workflow
---

# The workflow keeps progress private until release

1. Draft and preview locally or in a private Codespace.
2. Push commits to preserve progress without deploying.
3. Run the full local quality gate.
4. Publish only after explicit confirmation.

<div class="unilu-takeaway">Private source and public presentation are separate decisions.</div>

---
layout: closing
author: Shehbaz Tariq
contactEmail: shehbaz.tariq@uni.lu
contactWeb: www.uni.lu/snt
---
