<script setup lang="ts">
withDefaults(
  defineProps<{
    authorYear: string
    title: string
    doi?: string
    url?: string
    index?: number
  }>(),
  { index: 1 },
)
</script>

<template>
  <div class="unilu-frame-cite" :data-index="index">
    <a v-if="doi || url" :href="doi ? `https://doi.org/${doi}` : url" target="_blank">
      {{ authorYear }}. {{ title }}<template v-if="doi">. doi:{{ doi }}</template>
    </a>
    <span v-else>{{ authorYear }}. {{ title }}</span>
  </div>
</template>
