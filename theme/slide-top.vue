<script setup lang="ts">
import { useNav } from '@slidev/client'
import { computed } from 'vue'
import UniLUHeader from './components/UniLUHeader.vue'

const nav = useNav()
const chromeLayouts = new Set(['default', 'two-cols', 'figure', 'equation'])
const uncountedLayouts = new Set(['section', 'closing', 'blank'])

function layoutOf(route: any): string {
  return (
    route?.meta?.layout ||
    route?.meta?.slide?.frontmatter?.layout ||
    (route?.no === 1 ? 'cover' : 'default')
  )
}

const show = computed(() => chromeLayouts.has(nav.currentLayout.value))
const section = computed(() => nav.currentSlideRoute.value?.meta?.slide?.frontmatter?.section || '')
const total = computed(
  () => nav.slides.value.filter((route) => !uncountedLayouts.has(layoutOf(route))).length,
)
const current = computed(
  () =>
    nav.slides.value
      .slice(0, nav.currentSlideNo.value)
      .filter((route) => !uncountedLayouts.has(layoutOf(route))).length,
)
</script>

<template>
  <UniLUHeader v-if="show" :section="section" :current="current" :total="total" />
</template>
