import { defineKatexSetup } from '@slidev/types'

export default defineKatexSetup(() => ({
  throwOnError: true,
  strict: 'warn',
  trust: false,
  maxExpand: 2000,
  macros: {
    '\\ket': '\\left|#1\\right\\rangle',
    '\\bra': '\\left\\langle#1\\right|',
    '\\braket': '\\left\\langle#1\\middle|#2\\right\\rangle',
    '\\inner': '\\left\\langle#1\\middle|#2\\right\\rangle',
    '\\outer': '\\left|#1\\right\\rangle\\!\\left\\langle#2\\right|',
    '\\expect': '\\left\\langle#1\\right\\rangle',
    '\\abs': '\\left|#1\\right|',
    '\\norm': '\\left\\lVert#1\\right\\rVert',
    '\\dv': '\\frac{\\mathrm{d}#1}{\\mathrm{d}#2}',
    '\\pdv': '\\frac{\\partial #1}{\\partial #2}',
    '\\dd': '\\,\\mathrm{d}',
    '\\Tr': '\\operatorname{Tr}',
    '\\argmin': '\\operatorname*{arg\\,min}',
    '\\argmax': '\\operatorname*{arg\\,max}',
    '\\R': '\\mathbb{R}',
    '\\C': '\\mathbb{C}',
    '\\I': '\\mathbb{I}',
  },
}))
