<script setup lang="ts">
import { computed } from 'vue'
import { useDeckReferences } from '../composables/useDeckReferences'
import { parseCiteKeys } from '../utils/citations'

const props = defineProps<{ citekeys: string }>()
const { references } = useDeckReferences()
const citations = computed(() =>
  parseCiteKeys(props.citekeys).map((key) => {
    const index = references.value.findIndex((reference) => reference.key === key)
    return {
      key,
      number: index >= 0 ? index + 1 : '?',
      label:
        index >= 0
          ? `${references.value[index].authorYear}. ${references.value[index].title}`
          : key,
    }
  }),
)
</script>

<template>
  <sup
    class="unilu-cite"
    :aria-label="`References ${citations.map((item) => item.number).join(', ')}`"
  >
    <template v-for="(citation, index) in citations" :key="citation.key">
      <span v-if="index" aria-hidden="true">,</span
      ><span :title="citation.label">{{ citation.number }}</span>
    </template>
  </sup>
</template>
