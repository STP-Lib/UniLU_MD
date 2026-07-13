import { parse } from '@slidev/parser'

const regularLayouts = new Set(['default', 'two-cols', 'figure', 'equation'])

function stripVisibleText(content) {
  return content
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]+\]\([^)]*\)/g, ' ')
    .replace(/[$*_>#`|~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function repositoryNameIsValid(name) {
  return /^\d{6}_[A-Z0-9]+_[A-Z0-9]+$/.test(name)
}

export async function analyzeDeck(source, filepath = 'slides.md') {
  const parsed = await parse(source, filepath)
  const errors = []
  const warnings = []

  if (parsed.errors?.length) {
    for (const error of parsed.errors) errors.push(`Parser line ${error.row}: ${error.message}`)
  }

  const first = parsed.slides[0]
  const requiredHeadmatter = [
    'theme',
    'title',
    'author',
    'institute',
    'eventName',
    'eventFull',
    'date',
  ]
  for (const key of requiredHeadmatter) {
    if (!first?.frontmatter?.[key]) errors.push(`Headmatter is missing '${key}'.`)
  }
  if (first?.frontmatter?.theme !== 'unilu') errors.push('Headmatter must use theme: unilu.')

  const references = Array.isArray(first?.frontmatter?.references)
    ? first.frontmatter.references
    : []
  const referenceKeys = new Set()
  references.forEach((reference, index) => {
    const label = `Reference ${index + 1}`
    if (!reference?.key || !reference?.authorYear || !reference?.title) {
      errors.push(`${label} needs key, authorYear, and title.`)
      return
    }
    if (referenceKeys.has(reference.key)) {
      errors.push(`Reference key '${reference.key}' is duplicated.`)
    }
    referenceKeys.add(reference.key)
    if (!reference.doi && !reference.url) {
      warnings.push(`${label} ('${reference.key}') has no DOI or URL.`)
    }
  })

  if (/\b(TODO|TBD|PLACEHOLDER)\b/i.test(source)) {
    errors.push('Deck contains TODO, TBD, or PLACEHOLDER text.')
  }
  if (/\\begin\{(?:tikzpicture|quantikz|axis)\}/.test(source)) {
    errors.push(
      'Raw TikZ, quantikz, or PGFPlots source must be compiled to SVG before browser use.',
    )
  }

  const outlineSlides = parsed.slides
    .map((slide, index) => ({ slide, index }))
    .filter(({ slide }) => slide.frontmatter.layout === 'outline')
  if (outlineSlides.length !== 1) {
    errors.push(`Deck needs exactly one outline slide; found ${outlineSlides.length}.`)
  } else if (outlineSlides[0].index !== 1) {
    errors.push('The outline slide must appear immediately after the cover.')
  }

  const sectionTitles = new Set()

  parsed.slides.forEach((slide, index) => {
    const layout = slide.frontmatter.layout || (index === 0 ? 'cover' : 'default')
    const heading = slide.content.match(/^#\s+(.+)$/m)?.[1]?.trim()

    if (regularLayouts.has(layout) && !heading) {
      errors.push(`Slide ${index + 1} (${layout}) needs one action-title H1.`)
    }
    if (regularLayouts.has(layout)) {
      const section = String(slide.frontmatter.section || '').trim()
      const subsection = String(slide.frontmatter.subsection || '').trim()
      if (!section) errors.push(`Slide ${index + 1} (${layout}) needs section metadata.`)
      if (!subsection) {
        errors.push(`Slide ${index + 1} (${layout}) needs subsection metadata for the outline.`)
      }
      if (section) sectionTitles.add(section)
    }
    if (heading && heading.length > 86) {
      warnings.push(
        `Slide ${index + 1} title is ${heading.length} characters; shorten it if it wraps.`,
      )
    }

    const wordCount = stripVisibleText(slide.content).split(/\s+/).filter(Boolean).length
    if (regularLayouts.has(layout) && wordCount > 115) {
      warnings.push(
        `Slide ${index + 1} has about ${wordCount} visible words; consider splitting it.`,
      )
    }

    for (const match of slide.content.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)) {
      if (!match[1].trim())
        errors.push(`Slide ${index + 1} image '${match[2]}' has empty alt text.`)
    }
    for (const match of slide.content.matchAll(/<img\b([^>]*)>/gi)) {
      if (!/\balt\s*=\s*["'][^"']+["']/i.test(match[1])) {
        errors.push(`Slide ${index + 1} contains an img element without useful alt text.`)
      }
    }

    for (const match of slide.content.matchAll(/\\cite\{([^{}]+)\}/g)) {
      const keys = match[1]
        .split(',')
        .map((key) => key.trim())
        .filter(Boolean)
      for (const key of keys) {
        if (!referenceKeys.has(key)) {
          errors.push(`Slide ${index + 1} cites unknown reference key '${key}'.`)
        }
      }
    }
  })

  if (!sectionTitles.size) errors.push('Deck needs at least one content section.')

  return { slideCount: parsed.slides.length, errors, warnings }
}
