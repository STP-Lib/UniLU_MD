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

  if (/\b(TODO|TBD|PLACEHOLDER)\b/i.test(source)) {
    errors.push('Deck contains TODO, TBD, or PLACEHOLDER text.')
  }
  if (/\\begin\{(?:tikzpicture|quantikz|axis)\}/.test(source)) {
    errors.push(
      'Raw TikZ, quantikz, or PGFPlots source must be compiled to SVG before browser use.',
    )
  }

  parsed.slides.forEach((slide, index) => {
    const layout = slide.frontmatter.layout || (index === 0 ? 'cover' : 'default')
    const heading = slide.content.match(/^#\s+(.+)$/m)?.[1]?.trim()
    if (regularLayouts.has(layout) && !heading) {
      errors.push(`Slide ${index + 1} (${layout}) needs one action-title H1.`)
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
  })

  return { slideCount: parsed.slides.length, errors, warnings }
}
