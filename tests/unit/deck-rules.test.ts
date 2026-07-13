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
---

# Test

---
section: Test
---

# A concise action title

Evidence.
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
    expect(result.slideCount).toBe(2)
  })

  it('rejects raw TikZ and missing action titles', async () => {
    const result = await analyzeDeck(
      validDeck.replace('# A concise action title', '\\begin{tikzpicture}'),
    )
    expect(result.errors.join('\n')).toMatch(/TikZ/)
    expect(result.errors.join('\n')).toMatch(/action-title/)
  })
})
