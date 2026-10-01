# SIMA Map Studio

A browser app for the South Island Meteorological Agency to create and download
**Significant Weather Outlook** maps, **Climate Outlook** maps and
**Weather Risks Today** graphics, plus any custom map types you define.

It runs entirely in the browser: no build step, no server, no accounts. Open
`index.html` from any static host (GitHub Pages works out of the box).

## Running it

* **GitHub Pages** – in the repository settings, enable Pages for the branch
  (root folder). The app is then available at
  `https://<org>.github.io/<repo>/`.
* **Locally** – any static server works, e.g. `python3 -m http.server 8000`
  then open `http://localhost:8000/`. Opening `index.html` directly from disk
  also works (export falls back to system fonts in that case).

## Standard tab

| Tool | Key | What it does |
|------|-----|--------------|
| Select | `V` | Click an area/element to select it. Drag to move. Drag blue points to reshape, double-click a point to remove it, Shift+click the outline to add one. |
| Risk area | `D` | The curve tool. Click around the edge of the area. Close it by clicking the first point, pressing `Enter` or double-clicking. `Backspace` removes the last point, `Esc` cancels. The area only closes when you close it. |
| Text | `T` | Click to place a text box (background, border, size, alignment are editable). |
| Arrow | `L` | Drag to draw an arrow or plain line. |
| Box | `B` | Drag to draw a rounded box (hold Shift for a square). |
| Icon | `I` | Pick a weather icon, then click to place it. |

After closing an area a popover asks for the risk level (Slight = yellow,
Enhanced = orange, High = red) and hazards. Every area can later be re-levelled,
re-labelled, reshaped, duplicated, re-ordered or deleted from the inspector.

Other shortcuts: scroll to zoom the editor (for tiny areas), `Space`+drag or
middle-drag to pan, `0` fit, `1`–`9` set the level of the selected area,
arrows nudge, `Ctrl+Z` / `Ctrl+Y` undo/redo, `Ctrl+D` duplicate, `Ctrl+S`
save project, `Ctrl+E` export PNG.

Work is autosaved in the browser. **Save** / **Open** write and read a
`.sima.json` project file so maps can be kept or shared.

**Export** produces PNG (1× or 2×), JPG, SVG, or copies the PNG to the
clipboard. Maps are 2000 × 1650 px with the Poppins font embedded.

## AI Map Creation tab

Paste your written risk levels. Claude restates its understanding, asks
anything unclear, and when you press **Plot on map** it returns a plan that the
app turns into areas following the regional boundaries and forecast zones
(lightly rounded; say "no smoothing" for sharp edges). The result opens in the
Standard tab for fine-tuning. Works with every template, including custom ones.

## Settings tab

* **Claude API key** – stored in a cookie on this device only and sent
  directly from the browser to `api.anthropic.com`. Choose the model and test
  the connection.
* **Branding** – wordmark lines, website text, optional logo upload.
* **Export & editor** – default PNG scale, hints bar, automatic labels.
* **Map types** – duplicate a built-in template, create one by hand, or
  describe one and let Claude draft it (legend style, labels, categories and
  colours). Custom types appear as tabs in the Standard view.

## Project layout

```
index.html         app shell
css/app.css        UI styles
css/fonts.css      Poppins (embedded for exact PNG export)
js/geo.js          projection, smooth curves, geometry helpers
js/templates.js    map types, logo, legends, titles
js/icons.js        weather icon set
js/ai.js           Claude API calls (raw HTTP from the browser)
js/app.js          editor, inspector, export, AI tab, settings
data/nz-geo.js     NZ regions, lakes and places (Natural Earth 10m, public domain)
data/zones.js      forecast zones used by the AI tab
reference/         the original example graphics this design is based on
```
