import KaTexBlockWrapper from '@slidev/client/builtin/KaTexBlockWrapper.vue'
import VClicks from '@slidev/client/builtin/VClicks.ts'
import { defineAppSetup } from '@slidev/types'
import CompactBlock from 'slidev-theme-unilu/components/CompactBlock.vue'
import DeckCite from 'slidev-theme-unilu/components/DeckCite.vue'
import FrameCite from 'slidev-theme-unilu/components/FrameCite.vue'
import SlideReferences from 'slidev-theme-unilu/components/SlideReferences.vue'

export default defineAppSetup(({ app }) => {
  app.component('KaTexBlockWrapper', KaTexBlockWrapper)
  app.component('VClicks', VClicks)
  app.component('CompactBlock', CompactBlock)
  app.component('DeckCite', DeckCite)
  app.component('FrameCite', FrameCite)
  app.component('SlideReferences', SlideReferences)
})
