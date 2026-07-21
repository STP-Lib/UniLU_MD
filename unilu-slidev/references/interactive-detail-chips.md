# Interactive detail chips and detail modals

Use the `DetailChips` component for clickable info chips that open a modal listing
items with descriptions, plus an optional formula strip and footnote. It ships in
every generated deck at `components/DetailChips.vue`, so reuse it instead of
hand-rolling a new modal. It is styled with the UniLU tokens, closes on the ×
button, backdrop click, or Escape, and scales with the slide canvas.

Interactivity is browser-only; it does not survive PDF export. Keep a static
fallback (for example the underlying figure) visible for the exported backup.

## Component API

`DetailChips` takes a single `panels` prop, an array of panel objects:

```ts
interface Item {
  name: string
  description: string
}
interface Formula {
  expr: string // e.g. 'Y = T + S + C + R'
  label?: string // e.g. 'additive'
}
interface Panel {
  label: string // chip text
  title?: string // modal heading; defaults to label
  accent?: string // 'blue' | 'red' | 'navy', or any CSS color; default blue
  items: Item[] // rows shown in the modal
  formulas?: Formula[] // optional formula pills under the list
  note?: string // optional footnote under the formulas
}
```

One chip is rendered per panel; each opens its own modal.

## Recommended usage: a thin data wrapper

Keep panel data out of `slides.md` so it does not inflate the deck word count.
Put the data in a small deck component that renders `DetailChips`, and control
placement (for example, overlaying the top of a figure) in that wrapper.

`components/ConceptCards.vue`:

```vue
<script setup lang="ts">
const panels = [
  {
    label: 'Time-Series Components',
    accent: 'blue',
    items: [
      { name: 'Trend (T)', description: 'Long-term rise or fall in the level.' },
      { name: 'Seasonality (S)', description: 'Fixed pattern over a known period.' },
    ],
    formulas: [
      { expr: 'Y = T + S + C + R', label: 'additive' },
      { expr: 'Y = T × S × C × R', label: 'multiplicative' },
    ],
    note: 'Additive when the seasonal swing is fixed; multiplicative when it grows with the level.',
  },
  {
    label: 'Forecasting Taxonomy',
    accent: 'red',
    items: [{ name: 'Naïve methods', description: 'Baselines that reuse recent values.' }],
  },
]
</script>

<template>
  <div class="cc-overlay"><DetailChips :panels="panels" /></div>
</template>

<style scoped>
/* Overlay the top of a position:relative figure container. */
.cc-overlay {
  position: absolute;
  top: 6px;
  left: 0;
  right: 0;
}
</style>
```

In `slides.md`, make the figure container `position: relative` and drop the
wrapper in. Gate it behind a click with `v-click` if it should appear on cue:

```md
<div class="figure">

![alt text](./figures/plot.png)

<div v-click="5"><ConceptCards /></div>

</div>

<style>
.figure {
  position: relative;
}
</style>
```

## Alternative: inline data in the slide

For a quick one-off you can define the data in a slide `<script setup>` block and
pass it directly, but prefer the wrapper above so the slide stays lean and the
deck word-count check is not inflated by data literals.
