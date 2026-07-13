<script setup lang="ts">
import { useNav } from '@slidev/client'
import { computed } from 'vue'
import UniLUFooter from './components/UniLUFooter.vue'

const nav = useNav()
const show = computed(() => !['cover', 'closing', 'blank'].includes(nav.currentLayout.value))
</script>

<template>
  <UniLUFooter v-if="show" />
</template>
