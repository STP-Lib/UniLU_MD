# UniLU Theme Contract

Source of truth: `UniLU_PPT@36ed0d7`, ported to a 1600 by 900 logical browser canvas.

## Tokens

| Role         | Value     |
| ------------ | --------- |
| Navy         | `#1d2c44` |
| Periwinkle   | `#b0bcd2` |
| Red accent   | `#cc4040` |
| Dim text     | `#b8c4d0` |
| Blue accent  | `#5b90cc` |
| Section grey | `#8a93a3` |
| Arc grey     | `#c9cedb` |

## Typography

Body text uses bundled XCharter OpenType fonts. Title and closing geometry use bundled Latin Modern Sans. Code uses Latin Modern Mono. Their licenses are retained in `public/fonts/`; no network font service is required.

## Geometry

- Canvas: fixed `16/9`, logical width `1600`.
- Cover: navy background; right periwinkle panel; red and pale tangent paths; title centered vertically in a stable upper-left title zone; metadata centered in the left 72% region; white institutional logos at the lower corners.
- Content: section label and counter in the top safe band; action title below it; content bounded above the logo footer; numbered citations left-aligned beside the UniLU logo.
- Outline: `outline_bg.png`, persistent top-level section rows, accordion subsection disclosure, and direct subsection navigation generated from frontmatter.
- Closing: horizontal mirror of the cover; contact block and QR code on the right.

Cards use a maximum 6px radius. Decorative gradients, background orbs, and excessive color highlighting are outside the contract.

## Numbering

Cover slides count toward the visible content total but suppress the counter. Outline, closing, and blank layouts do not count. This reproduces the practical Beamer behavior without relying on route-number side effects.

## Citations

References are declared once in headmatter and numbered by declaration order. `\cite{key}` produces the same superscript number wherever that key appears and adds the full source to the current slide footer. The footer begins just to the right of the UniLU logo and remains clear of the SnT logo.

## Visual QA

Run `pnpm qa:visual`. It renders every slide at 1600 by 900, waits for local fonts, checks for blank slides, text/image overflow, console errors, and optional baseline differences. Inspect screenshots manually after any theme or figure change.
