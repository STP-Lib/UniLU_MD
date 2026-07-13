# LaTeX Compatibility

Slidev uses KaTeX, not a complete TeX distribution.

## Keep Native

Use `$...$` and `$$...$$` for KaTeX-supported equations. Shared macros belong in `setup/katex.ts`; the project keeps `throwOnError: true` so unsupported syntax fails visibly.

The template defines `\ket`, `\bra`, `\braket`, `\inner`, `\outer`, `\expect`, `\abs`, `\norm`, `\dv`, `\pdv`, `\dd`, `\Tr`, `\argmin`, `\argmax`, `\R`, `\C`, and `\I`.

## Convert To SVG

TikZ, quantikz, and PGFPlots require a TeX renderer. Keep:

```text
figures/
  model.svg
  sources/
    model.tex
    model.provenance.yaml
```

The provenance record should contain the source paper/citekey, page or figure, generation command, data files, tool versions, and review decision. Use the local PGFPlots and TikZ workflows where applicable.

## Migration Rules

| Beamer source      | Slidev treatment                                                |
| ------------------ | --------------------------------------------------------------- |
| Ordinary equations | Rewrite only unsupported commands; keep native KaTeX            |
| `physics` macros   | Use tested macros in `setup/katex.ts`                           |
| `align` derivation | Use KaTeX-supported aligned syntax or split across click states |
| TikZ / quantikz    | Compile to SVG and retain source                                |
| PGFPlots           | CSV to standalone TeX to SVG or high-resolution PNG             |
| PDF figure         | Convert to SVG or high-resolution PNG                           |

Never silently turn an unsupported equation into an image. Record each deliberate conversion in the migration notes.
