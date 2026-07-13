export interface OutlineSubsection {
  title: string
  slideNo: number
}

export interface OutlineSection {
  number: string
  title: string
  slideNo: number
  subsections: OutlineSubsection[]
}

interface SlideRouteLike {
  no?: number
  meta?: {
    layout?: string
    slide?: {
      frontmatter?: Record<string, unknown>
    }
  }
}

export function layoutOf(route: SlideRouteLike, index = 0): string {
  return String(
    route.meta?.layout ||
      route.meta?.slide?.frontmatter?.layout ||
      (route.no === 1 || index === 0 ? 'cover' : 'default'),
  )
}

export function buildOutline(slides: SlideRouteLike[]): OutlineSection[] {
  const sections: OutlineSection[] = []
  const sectionByTitle = new Map<string, OutlineSection>()

  slides.forEach((route, index) => {
    const frontmatter = route.meta?.slide?.frontmatter || {}
    const layout = layoutOf(route, index)
    const slideNo = route.no || index + 1
    if (['cover', 'outline', 'closing', 'blank'].includes(layout)) return

    const sectionTitle = String(frontmatter.section || '').trim()
    const subsectionTitle = String(frontmatter.subsection || '').trim()
    if (!sectionTitle || !subsectionTitle) return

    let section = sectionByTitle.get(sectionTitle)
    if (!section) {
      section = {
        number: String(sections.length + 1).padStart(2, '0'),
        title: sectionTitle,
        slideNo,
        subsections: [],
      }
      sections.push(section)
      sectionByTitle.set(sectionTitle, section)
    }

    if (!section.subsections.some((item) => item.title === subsectionTitle)) {
      section.subsections.push({ title: subsectionTitle, slideNo })
    }
  })

  return sections
}
