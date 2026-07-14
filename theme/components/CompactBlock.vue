<script setup lang="ts">
import katex from 'katex'
import { nextTick, onMounted, onUpdated, ref } from 'vue'

defineProps<{ title: string }>()

const body = ref<HTMLElement | null>(null)
const inlineMath = /\$(?!\$)([^$\n]+?)\$(?!\$)/g

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function renderInlineMath(source: string) {
  let html = ''
  let lastIndex = 0

  inlineMath.lastIndex = 0
  for (const match of source.matchAll(inlineMath)) {
    const start = match.index ?? 0
    const expression = match[1] ?? ''
    html += escapeHtml(source.slice(lastIndex, start))
    html += katex.renderToString(expression, {
      displayMode: false,
      throwOnError: true,
      strict: 'warn',
      trust: false,
    })
    lastIndex = start + match[0].length
  }

  return html + escapeHtml(source.slice(lastIndex))
}

function processInlineMath() {
  if (!body.value) return

  const walker = document.createTreeWalker(body.value, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  let node: Node | null

  while ((node = walker.nextNode())) {
    const text = node as Text
    if (!text.data.includes('$')) continue
    if (text.parentElement?.closest('.katex, .compact-block-math')) continue
    textNodes.push(text)
  }

  for (const textNode of textNodes) {
    inlineMath.lastIndex = 0
    if (!inlineMath.test(textNode.data)) continue

    const source = textNode.data
    const fragment = document.createDocumentFragment()
    let lastIndex = 0
    inlineMath.lastIndex = 0

    for (const match of source.matchAll(inlineMath)) {
      const start = match.index ?? 0
      const expression = match[1] ?? ''
      if (start > lastIndex)
        fragment.append(document.createTextNode(source.slice(lastIndex, start)))

      const math = document.createElement('span')
      math.className = 'compact-block-math'
      math.innerHTML = katex.renderToString(expression, {
        displayMode: false,
        throwOnError: true,
        strict: 'warn',
        trust: false,
      })
      fragment.append(math)
      lastIndex = start + match[0].length
    }

    if (lastIndex < source.length) fragment.append(document.createTextNode(source.slice(lastIndex)))
    textNode.replaceWith(fragment)
  }
}

function refreshMath() {
  void nextTick(processInlineMath)
}

onMounted(refreshMath)
onUpdated(refreshMath)
</script>

<template>
  <aside class="unilu-compact-block">
    <div class="unilu-compact-block__title" v-html="renderInlineMath(title)" />
    <div ref="body" class="unilu-compact-block__body"><slot /></div>
  </aside>
</template>
