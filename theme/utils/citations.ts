export interface DeckReference {
  key: string
  authorYear: string
  title: string
  doi?: string
  url?: string
  relevance?: string
  evidence?: string
}

export interface CitationMatch {
  start: number
  end: number
  keys: string[]
}

export function parseCiteKeys(value: string): string[] {
  return [
    ...new Set(
      value
        .split(',')
        .map((key) => key.trim())
        .filter(Boolean),
    ),
  ]
}

export function normalizeReferences(value: unknown): DeckReference[] {
  if (!Array.isArray(value)) return []

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return undefined
      const item = entry as Record<string, unknown>
      const key = String(item.key || '').trim()
      const authorYear = String(item.authorYear || '').trim()
      const title = String(item.title || '').trim()
      if (!key || !authorYear || !title) return undefined
      return {
        key,
        authorYear,
        title,
        doi: item.doi ? String(item.doi).trim() : undefined,
        url: item.url ? String(item.url).trim() : undefined,
        relevance: item.relevance ? String(item.relevance).trim() : undefined,
        evidence: item.evidence ? String(item.evidence).trim() : undefined,
      }
    })
    .filter((entry): entry is DeckReference => Boolean(entry))
}

export function findCitations(source: string): CitationMatch[] {
  const protectedRanges: Array<[number, number]> = []
  const protectedPattern = /```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`|<!--[\s\S]*?-->/g
  for (const match of source.matchAll(protectedPattern)) {
    const start = match.index || 0
    protectedRanges.push([start, start + match[0].length])
  }

  const matches: CitationMatch[] = []
  const pattern = /\\cite\{([^{}]+)\}/g
  for (const match of source.matchAll(pattern)) {
    const start = match.index || 0
    if (start > 0 && source[start - 1] === '\\') continue
    if (protectedRanges.some(([from, to]) => start >= from && start < to)) continue

    const keys = parseCiteKeys(match[1])
    if (keys.length) matches.push({ start, end: start + match[0].length, keys })
  }
  return matches
}

export function referenceUrl(reference: DeckReference): string | undefined {
  if (reference.doi) return `https://doi.org/${reference.doi}`
  return reference.url
}
