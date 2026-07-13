<template>
  <div class="slidev-layout unilu-two-cols">
    <div class="unilu-two-col-grid">
      <div class="unilu-two-col-left"><slot /></div>
      <div class="unilu-two-col-right"><slot name="right" /></div>
    </div>
  </div>
</template>
