import { describe, expect, it } from 'vitest'
import { findCitations, normalizeReferences, parseCiteKeys } from '../../theme/utils/citations'

describe('citation syntax', () => {
  it('deduplicates comma-separated keys while preserving order', () => {
    expect(parseCiteKeys('first, second,first')).toEqual(['first', 'second'])
  })

  it('finds citations in prose but ignores code and notes', () => {
    const source = [
      'Supported claim \\cite{first,second}.',
      '`\\cite{inline-code}`',
      '```tex',
      '\\cite{code-block}',
      '```',
      '<!-- \\cite{speaker-note} -->',
    ].join('\n')

    expect(findCitations(source).map((match) => match.keys)).toEqual([['first', 'second']])
  })

  it('normalizes complete headmatter references only', () => {
    expect(
      normalizeReferences([
        { key: 'paper', authorYear: 'Author, 2026', title: 'Paper', doi: '10.0/test' },
        { key: 'incomplete', title: 'Missing author' },
      ]),
    ).toEqual([
      {
        key: 'paper',
        authorYear: 'Author, 2026',
        title: 'Paper',
        doi: '10.0/test',
        url: undefined,
      },
    ])
  })
})
