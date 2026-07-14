<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDeckReferences } from '../composables/useDeckReferences'
import { parseCiteKeys, referenceUrl } from '../utils/citations'

const props = defineProps<{ citekeys: string }>()
const { references } = useDeckReferences()
const activeKey = ref<string | undefined>()
const citations = computed(() =>
  parseCiteKeys(props.citekeys).map((key) => {
    const index = references.value.findIndex((reference) => reference.key === key)
    return {
      key,
      number: index >= 0 ? index + 1 : '?',
      reference: index >= 0 ? references.value[index] : undefined,
      label:
        index >= 0
          ? `${references.value[index].authorYear}. ${references.value[index].title}`
          : key,
    }
  }),
)

const activeCitation = computed(() => citations.value.find((item) => item.key === activeKey.value))
const close = () => {
  activeKey.value = undefined
}
</script>

<template>
  <sup
    class="unilu-cite"
    :aria-label="`References ${citations.map((item) => item.number).join(', ')}`"
  >
    <template v-for="(citation, index) in citations" :key="citation.key">
      <span v-if="index" aria-hidden="true">,</span>
      <button
        class="unilu-cite__button"
        type="button"
        :aria-label="`Open details for reference ${citation.number}`"
        :title="citation.label"
        @click.stop="activeKey = citation.key"
      >
        {{ citation.number }}
      </button>
    </template>
  </sup>

  <Teleport to="body">
    <div
      v-if="activeCitation?.reference"
      class="unilu-reference-modal"
      role="presentation"
      @click.self="close"
    >
      <section
        class="unilu-reference-modal__panel"
        role="dialog"
        aria-modal="true"
        :aria-label="activeCitation.reference.title"
      >
        <button
          class="unilu-reference-modal__close"
          type="button"
          aria-label="Close reference details"
          @click="close"
        >
          ×
        </button>
        <p class="unilu-reference-modal__eyebrow">Reference {{ activeCitation.number }}</p>
        <h2>{{ activeCitation.reference.title }}</h2>
        <p class="unilu-reference-modal__authors">{{ activeCitation.reference.authorYear }}</p>
        <div v-if="activeCitation.reference.relevance" class="unilu-reference-modal__section">
          <h3>Why it is cited here</h3>
          <p>{{ activeCitation.reference.relevance }}</p>
        </div>
        <div v-if="activeCitation.reference.evidence" class="unilu-reference-modal__section">
          <h3>Relevant result or concept</h3>
          <p>{{ activeCitation.reference.evidence }}</p>
        </div>
        <a
          v-if="referenceUrl(activeCitation.reference)"
          class="unilu-reference-modal__link"
          :href="referenceUrl(activeCitation.reference)"
          target="_blank"
          rel="noreferrer"
        >
          {{
            activeCitation.reference.doi
              ? `Verify via DOI: ${activeCitation.reference.doi}`
              : 'Open the paper source'
          }}
        </a>
      </section>
    </div>
  </Teleport>
</template>
