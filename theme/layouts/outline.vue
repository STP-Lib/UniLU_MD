<script setup lang="ts">
import { useNav } from '@slidev/client'
import { computed, ref } from 'vue'
import { buildOutline } from '../utils/outline'

const nav = useNav()
const sections = computed(() => buildOutline(nav.slides.value))
const expanded = ref<number | null>(null)

function toggleSection(index: number) {
  expanded.value = expanded.value === index ? null : index
}

function isExpanded(index: number) {
  return nav.isPrintMode.value || expanded.value === index
}
</script>

<template>
  <div class="slidev-layout unilu-outline">
    <div class="unilu-outline-heading">
      <span>Presentation map</span>
      <h1>Outline</h1>
    </div>

    <nav class="unilu-outline-nav" aria-label="Presentation outline">
      <section
        v-for="(section, sectionIndex) in sections"
        :key="section.number"
        class="unilu-outline-section"
        :class="{ 'is-expanded': isExpanded(sectionIndex) }"
      >
        <button
          class="unilu-outline-trigger"
          type="button"
          :aria-expanded="isExpanded(sectionIndex)"
          :aria-controls="`outline-section-${sectionIndex}`"
          @click="toggleSection(sectionIndex)"
        >
          <span class="unilu-outline-number">{{ section.number }}</span>
          <span class="unilu-outline-title">{{ section.title }}</span>
          <lucide-chevron-down class="unilu-outline-chevron" aria-hidden="true" />
        </button>

        <Transition name="unilu-outline-expand">
          <div
            v-show="isExpanded(sectionIndex)"
            :id="`outline-section-${sectionIndex}`"
            class="unilu-outline-subsections"
          >
            <button
              v-for="subsection in section.subsections"
              :key="subsection.title"
              class="unilu-outline-subsection"
              type="button"
              :data-target="subsection.slideNo"
              @click="nav.go(subsection.slideNo)"
            >
              <span>{{ subsection.title }}</span>
              <lucide-arrow-right aria-hidden="true" />
            </button>
          </div>
        </Transition>
      </section>
    </nav>
  </div>
</template>
