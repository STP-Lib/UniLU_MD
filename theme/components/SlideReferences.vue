<script setup lang="ts">
import { computed } from 'vue'
import { useDeckReferences } from '../composables/useDeckReferences'
import { parseCiteKeys, referenceUrl } from '../utils/citations'

const props = defineProps<{ citekeys: string }>()
const { references } = useDeckReferences()
const citedReferences = computed(() =>
  parseCiteKeys(props.citekeys)
    .map((key) => {
      const index = references.value.findIndex((reference) => reference.key === key)
      if (index < 0) return undefined
      const reference = references.value[index]
      return { ...reference, number: index + 1, href: referenceUrl(reference) }
    })
    .filter((reference) => Boolean(reference)),
)
</script>

<template>
  <div v-if="citedReferences.length" class="unilu-slide-references" aria-label="Slide references">
    <div v-for="reference in citedReferences" :key="reference.key" class="unilu-slide-reference">
      <sup>{{ reference.number }}</sup>
      <a v-if="reference.href" :href="reference.href" target="_blank">
        {{ reference.authorYear }}. {{ reference.title
        }}<template v-if="reference.doi">. doi:{{ reference.doi }}</template>
      </a>
      <span v-else>{{ reference.authorYear }}. {{ reference.title }}</span>
    </div>
  </div>
</template>
