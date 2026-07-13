<script setup lang="ts">
defineProps<{
  section?: string
  current: number
  total: number
}>()
</script>

<template>
  <header class="unilu-header" aria-hidden="true">
    <span>{{ section || '' }}</span>
    <span class="unilu-header__counter">{{ current }}/{{ total }}</span>
  </header>
</template>
