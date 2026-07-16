# Interactive plots with precomputed data

## Select the architecture

Prefer Plotly.js in a Vue component with precomputed data when the plot needs hover labels, zoom, pan, trace toggles, client-side filtering, animation, or a slider over stored parameter values. This keeps the presentation self-contained and works in local preview, Codespaces, and a static GitHub Pages build.

Add a Python backend only when a user action must:

- recompute a simulation or optimization;
- run model inference that cannot be represented by stored results;
- query live, private, or changing data; or
- select from too many states to precompute and ship reasonably.

GitHub Pages cannot run Python. A backend must be started and deployed separately, served over HTTPS for a public deck, and configured for the deck's origin. Do not accept that operational cost unless the interaction requires it.

Pyodide is an alternative when Python must run in the browser, but do not choose it by default. Its download size, startup delay, and package limitations are usually unnecessary for plots that can use precomputed data.

## Build the precomputed workflow

1. Keep the generator, input data, and provenance under `figures/sources/<plot-slug>/`.
2. Run the generator in the project's Python environment. In the `C:\Codes` workspace, use `conda run -n SigCOM python <generator>.py` unless the project specifies another environment.
3. Write a compact, deterministic JSON artifact to `public/data/<plot-slug>.json`. Include stable field names, units, series labels, and only the precision needed for display.
4. Install Plotly in the presentation with `pnpm add plotly.js-dist-min`. Commit the resulting package and lockfile changes. Do not load Plotly from a CDN; talks must not depend on venue internet access.
5. Create `components/<PlotName>.vue`. Load the JSON with `import.meta.env.BASE_URL` so the URL works under a GitHub Pages subpath.
6. Mount the component in `slides.md`, give it fixed dimensions, and keep the slide title outside the chart.
7. Retain a static SVG or PNG generated from the same results for PDF export and failure recovery.

Use this base-safe loading pattern:

```js
const response = await fetch(`${import.meta.env.BASE_URL}data/<plot-slug>.json`)

if (!response.ok) {
  throw new Error(`Plot data failed to load: ${response.status}`)
}

const specification = await response.json()
```

Use `Plotly.newPlot` after the Vue component mounts, set `responsive: true`, and call `Plotly.purge` before unmounting. Keep the plot background transparent, match the theme's typography and colors, and disable controls that do not help explain the result. Do not place a second title inside the chart.

## Keep the deck responsive

- Precompute expensive transformations in Python. Let the browser perform only lightweight selection and display changes.
- Reduce or aggregate dense arrays before shipping them. Preserve the full research output beside the generator when the deck uses a display-oriented subset.
- Load the Plotly bundle and data when the component mounts rather than blocking unrelated slides.
- Reserve the component's final width and height before loading so the slide does not move during a click sequence.
- Add a concise caption or nearby sentence that states what the audience should notice. Register and cite reproduced or source-defining results through the deck headmatter.

## Verify browser and export behavior

Run `pnpm dev` and exercise every control at the presentation resolution. Then run `pnpm check` and inspect `.artifacts/visual/`. Confirm that the plot loads under the production base path, text remains legible, legends do not cover data, and slide clicks do not reset the component unexpectedly.

Run `pnpm export:clicks` and inspect the backup PDF. PDF cannot preserve hover, zoom, sliders, or animation. If the asynchronous chart is missing, clipped, or captured in an unsuitable state, use the static SVG or PNG for export rather than relying on timing.
