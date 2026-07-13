import type { ShikiSetupReturn } from '@slidev/types'
import { defineShikiSetup } from '@slidev/types'

export default defineShikiSetup((): ShikiSetupReturn => ({
  themes: {
    light: 'github-light',
    dark: 'github-dark',
  },
}))
