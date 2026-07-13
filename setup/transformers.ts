import { defineMarkdownTransformer, defineTransformersSetup } from '@slidev/types'
import { findCitations } from 'slidev-theme-unilu/utils/citations'

const citationSyntax = defineMarkdownTransformer(({ s }) => {
  const source = s.toString()
  const matches = findCitations(source)
  if (!matches.length) return

  const slideKeys = [...new Set(matches.flatMap((match) => match.keys))]
  for (const match of [...matches].reverse()) {
    const start = match.start > 0 && source[match.start - 1] === ' ' ? match.start - 1 : match.start
    s.overwrite(start, match.end, `<DeckCite citekeys="${match.keys.join(',')}" />`)
  }
  s.append(`\n\n<SlideReferences citekeys="${slideKeys.join(',')}" />\n`)
})

export default defineTransformersSetup(() => ({
  pre: [citationSyntax],
}))
