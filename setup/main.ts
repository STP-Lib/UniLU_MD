import KaTexBlockWrapper from '@slidev/client/builtin/KaTexBlockWrapper.vue'
import VClicks from '@slidev/client/builtin/VClicks.ts'
import { defineAppSetup } from '@slidev/types'
import CompactBlock from '../theme/components/CompactBlock.vue'
import DeckCite from '../theme/components/DeckCite.vue'
import FrameCite from '../theme/components/FrameCite.vue'
import SlideReferences from '../theme/components/SlideReferences.vue'

export default defineAppSetup(({ app }) => {
  app.component('KaTexBlockWrapper', KaTexBlockWrapper)
  app.component('VClicks', VClicks)
  app.component('CompactBlock', CompactBlock)
  app.component('DeckCite', DeckCite)
  app.component('FrameCite', FrameCite)
  app.component('SlideReferences', SlideReferences)
})
