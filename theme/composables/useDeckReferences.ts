import { useNav } from '@slidev/client'
import { computed } from 'vue'
import { normalizeReferences } from '../utils/citations'

export function useDeckReferences() {
  const nav = useNav()
  const references = computed(() => {
    const headmatter = nav.slides.value[0]?.meta?.slide?.frontmatter
    return normalizeReferences(headmatter?.references)
  })

  return { nav, references }
}
