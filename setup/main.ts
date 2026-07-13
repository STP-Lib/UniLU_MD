import KaTexBlockWrapper from '@slidev/client/builtin/KaTexBlockWrapper.vue'
import VClicks from '@slidev/client/builtin/VClicks.ts'
import { defineAppSetup } from '@slidev/types'
import CompactBlock from '../theme/components/CompactBlock.vue'
import FrameCite from '../theme/components/FrameCite.vue'

export default defineAppSetup(({ app }) => {
  app.component('KaTexBlockWrapper', KaTexBlockWrapper)
  app.component('VClicks', VClicks)
  app.component('CompactBlock', CompactBlock)
  app.component('FrameCite', FrameCite)
})
