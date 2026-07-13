<script setup lang="ts">
import ClosingGeometry from '../components/ClosingGeometry.vue'
</script>

<template>
  <div class="slidev-layout unilu-closing">
    <ClosingGeometry />
    <img
      class="unilu-closing-logo"
      src="/assets/Uni_lu_White_last.png"
      alt="University of Luxembourg"
    />
    <div class="unilu-closing-rule" />
    <div class="unilu-closing-heading">Contact</div>
    <div class="unilu-closing-contact">
      <div>{{ $frontmatter.author }}</div>
      <div><strong>Email:</strong> {{ $frontmatter.contactEmail }}</div>
      <div><strong>Web:</strong> {{ $frontmatter.contactWeb }}</div>
    </div>
    <img class="unilu-closing-qr" src="/assets/QR_Linkedin_clean.png" alt="LinkedIn QR code" />
    <div class="unilu-closing-caption">Scan to connect on LinkedIn</div>
  </div>
</template>
