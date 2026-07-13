import { describe, expect, it } from 'vitest'
import { analyzeDeck, repositoryNameIsValid } from '../../scripts/deck-rules.mjs'

const validDeck = `---
theme: unilu
title: Test
author: Author
institute: Institute
eventName: Event
eventFull: Full Event
date: Today
references:
  - key: source
    authorYear: Author, 2026
    title: Source title
    doi: 10.0000/example
---

# Test

---
layout: outline
routeAlias: outline
---

---
section: Test section
subsection: Test subsection
---

# A concise action title

Evidence. \\cite{source}
`

describe('repository naming', () => {
  it('accepts the required convention', () => {
    expect(repositoryNameIsValid('260713_QML_QCNC')).toBe(true)
  })

  it('rejects ambiguous names', () => {
    expect(repositoryNameIsValid('qml-qcnc')).toBe(false)
    expect(repositoryNameIsValid('20260713_QML_QCNC')).toBe(false)
  })
})

describe('deck rules', () => {
  it('accepts a minimal academic deck', async () => {
    const result = await analyzeDeck(validDeck)
    expect(result.errors).toEqual([])
    expect(result.slideCount).toBe(3)
  })

  it('rejects raw TikZ and missing action titles', async () => {
    const result = await analyzeDeck(
      validDeck.replace('# A concise action title', '\\begin{tikzpicture}'),
    )
    expect(result.errors.join('\n')).toMatch(/TikZ/)
    expect(result.errors.join('\n')).toMatch(/action-title/)
  })

  it('rejects unknown citations and missing subsection metadata', async () => {
    const result = await analyzeDeck(
      validDeck.replace('subsection: Test subsection', '').replace('cite{source}', 'cite{missing}'),
    )
    expect(result.errors.join('\n')).toMatch(/subsection metadata/)
    expect(result.errors.join('\n')).toMatch(/unknown reference key 'missing'/)
  })

  it('requires one outline immediately after the cover', async () => {
    const result = await analyzeDeck(validDeck.replace('layout: outline', 'layout: blank'))
    expect(result.errors.join('\n')).toMatch(/exactly one outline slide/)
  })
})
