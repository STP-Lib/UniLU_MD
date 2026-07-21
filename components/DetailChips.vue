<script setup lang="ts">
// Reusable "detail chips" pattern for UniLU decks.
//
// Renders a row of clickable chips; each opens a modal that lists items with
// descriptions, plus an optional formula strip and footnote. Placement is left
// to the caller: wrap this component in your own positioned container to overlay
// a figure, or drop it inline. The modal is a full-slide overlay that scales
// with the Slidev canvas. Interactivity is browser-only (it does not survive
// PDF export). See references/interactive-detail-chips.md for usage.

import { onMounted, onUnmounted, ref } from 'vue'

interface Item {
  name: string
  description: string
}
interface Formula {
  expr: string
  label?: string
}
interface Panel {
  label: string
  title?: string
  accent?: string
  items: Item[]
  formulas?: Formula[]
  note?: string
}

const props = defineProps<{ panels: Panel[] }>()

const accents: Record<string, string> = {
  blue: 'var(--unilu-blue)',
  red: 'var(--unilu-red)',
  navy: 'var(--unilu-navy)',
}
function accentOf(panel: Panel): string {
  return (panel.accent && accents[panel.accent]) || panel.accent || 'var(--unilu-blue)'
}

const open = ref<number | null>(null)

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value !== null) {
    event.stopPropagation()
    open.value = null
  }
}
onMounted(() => window.addEventListener('keydown', onKey, true))
onUnmounted(() => window.removeEventListener('keydown', onKey, true))
</script>

<template>
  <div class="dc-cards">
    <button
      v-for="(panel, i) in props.panels"
      :key="panel.label"
      class="dc-chip"
      :style="{ background: accentOf(panel) }"
      @click.stop="open = i"
    >
      {{ panel.label }}
    </button>
  </div>

  <div v-if="open !== null" class="dc-backdrop" @click.stop="open = null">
    <div class="dc-panel" :style="{ borderTopColor: accentOf(props.panels[open]) }" @click.stop>
      <div class="dc-head">
        <h3 :style="{ color: accentOf(props.panels[open]) }">
          {{ props.panels[open].title || props.panels[open].label }}
        </h3>
        <button class="dc-close" aria-label="Close" @click.stop="open = null">&times;</button>
      </div>
      <ul class="dc-list">
        <li v-for="item in props.panels[open].items" :key="item.name">
          <span class="dc-name" :style="{ color: accentOf(props.panels[open]) }">
            {{ item.name }}
          </span>
          <span class="dc-desc">{{ item.description }}</span>
        </li>
      </ul>
      <div v-if="props.panels[open].formulas || props.panels[open].note" class="dc-note">
        <div v-if="props.panels[open].formulas" class="dc-formulas">
          <span v-for="f in props.panels[open].formulas" :key="f.expr" class="dc-formula">
            {{ f.expr }}<em v-if="f.label">{{ f.label }}</em>
          </span>
        </div>
        <p v-if="props.panels[open].note" class="dc-note-text">{{ props.panels[open].note }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Chips render inline; the caller positions the wrapper to overlay if wanted. */
.dc-cards {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}
.dc-chip {
  font-family: var(--unilu-font-sans);
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  border: none;
  border-radius: 999px;
  padding: 8px 16px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(29, 44, 68, 0.28);
  transition:
    transform 0.12s ease,
    box-shadow 0.12s ease;
}
.dc-chip::before {
  content: 'ⓘ ';
  opacity: 0.85;
}
.dc-chip:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(29, 44, 68, 0.36);
}

.dc-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(29, 44, 68, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.dc-panel {
  width: min(780px, 84%);
  max-height: 84%;
  overflow: auto;
  background: var(--unilu-paper);
  border-radius: 14px;
  border-top: 6px solid var(--unilu-blue);
  padding: 26px 32px 30px;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.4);
  font-family: var(--unilu-font-sans);
}
.dc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.dc-head h3 {
  margin: 0;
  font-size: 27px;
  font-weight: 700;
}
.dc-close {
  border: none;
  background: transparent;
  font-size: 30px;
  line-height: 1;
  color: var(--unilu-section-grey);
  cursor: pointer;
}
.dc-close:hover {
  color: var(--unilu-ink);
}
.dc-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.dc-list li {
  padding: 10px 0;
  border-top: 1px solid var(--unilu-soft);
}
.dc-list li:first-child {
  border-top: none;
}
.dc-name {
  display: block;
  font-size: 19px;
  font-weight: 700;
}
.dc-desc {
  display: block;
  font-size: 16px;
  line-height: 1.35;
  color: var(--unilu-ink);
  opacity: 0.82;
  margin-top: 2px;
}
.dc-note {
  margin-top: 18px;
  padding: 16px 18px;
  background: var(--unilu-soft);
  border-radius: 10px;
}
.dc-formulas {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.dc-formula {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  font-family: var(--unilu-font-mono);
  font-size: 18px;
  font-weight: 700;
  color: var(--unilu-navy);
  background: #fff;
  border: 1px solid #dfe4ef;
  border-radius: 8px;
  padding: 6px 12px;
}
.dc-formula em {
  font-family: var(--unilu-font-sans);
  font-style: normal;
  font-size: 12px;
  font-weight: 600;
  color: var(--unilu-section-grey);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.dc-note-text {
  margin: 0;
  font-size: 15px;
  line-height: 1.4;
  color: var(--unilu-ink);
  opacity: 0.85;
}
</style>
