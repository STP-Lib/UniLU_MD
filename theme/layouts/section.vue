<template>
  <div class="slidev-layout unilu-section">
    <div class="unilu-section-number-ring">{{ $frontmatter.sectionNumber }}</div>
    <div class="unilu-section-title">{{ $frontmatter.sectionTitle }}</div>
    <div class="unilu-section-rule" />
    <ul v-if="$frontmatter.subsections?.length" class="unilu-section-subsections">
      <li v-for="item in $frontmatter.subsections" :key="item">{{ item }}</li>
    </ul>
  </div>
</template>
