import { describe, expect, it } from 'vitest'
import { buildOutline } from '../../theme/utils/outline'

function route(no: number, frontmatter: Record<string, unknown>) {
  return { no, meta: { layout: frontmatter.layout as string, slide: { frontmatter } } }
}

describe('automatic outline', () => {
  it('groups content by section and routes each unique subsection to its first slide', () => {
    const outline = buildOutline([
      route(1, { layout: 'cover' }),
      route(2, { layout: 'outline' }),
      route(3, { section: 'Foundations', subsection: 'Motivation' }),
      route(4, { section: 'Foundations', subsection: 'Method' }),
      route(5, { section: 'Foundations', subsection: 'Method' }),
      route(6, { section: 'Results', subsection: 'Main result' }),
      route(7, { layout: 'closing' }),
    ])

    expect(outline).toEqual([
      {
        number: '01',
        title: 'Foundations',
        slideNo: 3,
        subsections: [
          { title: 'Motivation', slideNo: 3 },
          { title: 'Method', slideNo: 4 },
        ],
      },
      {
        number: '02',
        title: 'Results',
        slideNo: 6,
        subsections: [{ title: 'Main result', slideNo: 6 }],
      },
    ])
  })
})
