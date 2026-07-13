<script setup lang="ts">
import TitleGeometry from '../components/TitleGeometry.vue'
</script>

<template>
  <div class="slidev-layout unilu-cover">
    <TitleGeometry />
    <div class="unilu-cover-title"><slot /></div>
    <div class="unilu-cover-details">
      <div class="unilu-cover-author">{{ $frontmatter.author }}</div>
      <div class="unilu-cover-institute">{{ $frontmatter.institute }}</div>
      <div class="unilu-cover-event">{{ $frontmatter.eventName }}</div>
      <div class="unilu-cover-event-full">{{ $frontmatter.eventFull }}</div>
      <div class="unilu-cover-date">{{ $frontmatter.date }}</div>
    </div>
    <img
      class="unilu-cover-logo unilu-cover-logo--unilu"
      src="/assets/UniLu_White.png"
      alt="University of Luxembourg"
    />
    <img class="unilu-cover-logo unilu-cover-logo--snt" src="/assets/SnT_White.png" alt="SnT" />
  </div>
</template>
