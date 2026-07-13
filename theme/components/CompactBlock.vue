<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <aside class="unilu-compact-block">
    <div class="unilu-compact-block__title">{{ title }}</div>
    <div class="unilu-compact-block__body"><slot /></div>
  </aside>
</template>
