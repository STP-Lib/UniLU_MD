# Migration From UniLU Beamer

## Inventory

Read the driver, metadata, preamble/macros, section order, title/closing files, figures, bibliography, and notes. Record unsupported packages and every TikZ, quantikz, PGFPlots, or PDF-only figure.

## Map Structure

| Beamer                                     | Slidev                                   |
| ------------------------------------------ | ---------------------------------------- |
| `\title`, `\author`, `\institute`, `\date` | Deck headmatter                          |
| `\section`                                 | Content `section` metadata and outline   |
| `\begin{frame}{...}`                       | Slide separator plus one H1 action title |
| `columns`                                  | `layout: two-cols` and `::right::`       |
| `block` / `compactblock`                   | `<CompactBlock>`                         |
| `\framecite` / `\cite`                     | Headmatter registry plus `\cite{key}`    |
| overlay specifications                     | `<v-clicks>`, `v-click`, `v-after`       |
| `\note`                                    | Final HTML comment                       |
| TikZ / quantikz / PGFPlots                 | SVG plus retained source/provenance      |

## Preserve Meaning

Migrate the argument, not line-by-line TeX. Keep notation, units, citations, uncertainty, and speaker intent. Remove duplicated figure headings and put needed context in the slide title, caption, or notes. Do not convert an entire slide to an image.

## Compare

Render representative cover, outline, content, equation, figure, summary, and closing pages from both systems. Compare geometry, font use, line wrapping, figure size, footer clearance, and click sequence. Run `pnpm check` and export a backup PDF before declaring the migration complete.
