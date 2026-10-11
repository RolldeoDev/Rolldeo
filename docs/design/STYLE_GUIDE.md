# Rolldeo — The Living Fieldbook

Approved visual direction: concept 4, **The Living Fieldbook**, 11 October 2026. Design handoff only. Production implementation remains paused.

## Visual authority

[04-living-fieldbook.png](concepts/04-living-fieldbook.png) is the user-selected visual authority. It shows an open illustrated fieldbook occupying the center and right, light ivory pages against a midnight cobalt landscape, a winged key crossing the page, a folded island map, brass astronomy, and sweeping Art Nouveau lettering on the left. Its signature action is a round engraved Roll seal with a pointing hand; a torn-paper tab provides the secondary Library action. The headline is **Collect the unexpected.** Supporting copy: **A curiosity for every story.**

The concept is a generated desktop UI illustration, not a functioning interface, production asset pack, font specimen or implemented screenshot. It establishes composition, type ambition, material treatment, control personality and atmosphere. Its tiny annotation text and decorative specimen numbers are not implementation requirements. Live controls, collections and results must remain real accessible text. Do not embed the full image as the implemented homepage.

The user rejected the earlier cabinet specimen: ordinary serif typography, bland controls and generic composition did not meet the intended quality. Concepts 1–3, the static cabinet hero, its old typography/rectangular controls and earlier cabinet assets are **superseded explorations**, not competing requirements. The cabinet-of-curiosities subject survives as a collection of possible stories; the actual visual metaphor is now a **living fieldbook**. Token compliance alone does not satisfy the visual brief.

The supplied [Cyera reference](https://secure-the-unknown.cyera.com/) and [Santioni reference](https://www.awwwards.com/sites/santioni-spirits) informed the aspiration for an authored illustrated world and expressive narrative interaction. Concept 4 is the more specific authority for this product. Do not copy those brands, art or lettering. No complete technical review of those reference sites is claimed.

## Product, intent and boundaries

Rolldeo is an offline-first React 18/Vite/Tailwind 3/Zustand PWA for creating, organizing, importing, exporting and rolling weighted random tables and TTRPG generators across fantasy, horror, science fiction and cyberpunk. Preserve all routes, data, engine behavior and working workflows. The overhaul adds a memorable identity and clearer visual hierarchy; its costs are original layered illustration, real typographic development and a modest control vocabulary. Keep those costs bounded through shared art layers and a small centralized preset system.

The mood remains **strange and inviting**: meticulous engraving, surreal artifacts, observational humor, curiosity stronger than menace. Be expressive throughout; Home has the most spectacular composition, Roll the signature action, Library/Editor/Guide richly styled practical workspaces. Decoration must not reduce readability, discoverability or speed.

## Review artifacts and status

- [Selected concept](concepts/04-living-fieldbook.png): primary composition and art-direction authority.
- [Generation prompts](concepts/prompts.json) and [selection record](concepts/selection.json): concept 4 is selected, 1–3 superseded.
- [preview.html](preview.html): static selected-concept review page; not an implemented app, theme-control specimen or tested animation prototype.
- [preview-cabinet-study.html](preview-cabinet-study.html): superseded earlier interactive specimen, kept for historical review only.
- [ASSET_PROMPTS.md](ASSET_PROMPTS.md): selected concept interpretation, separate asset production briefs and historical studies.
- [tokens.css](tokens.css): centralized three-layer theme recipe; parameters require rendered visual refinement.
- [palettes.json](palettes.json), [CONTRAST.md](CONTRAST.md): algorithmically checked base palette values. Paper-role combinations below use existing light-palette pairs; final textured/shaded states still need rendered validation.
- [DESIGN_PROMPT.md](DESIGN_PROMPT.md): complete future implementation handoff.

No app changes, bundled fonts, production art optimization, measured animation quality, performance result, deployed site or implemented UI-Max score are claimed.

## Immutable visual grammar and easy themes

Preserve through every preset:

1. A large open page is the composition’s reading stage. Layered page edges and a surrounding illustrated margin create depth without tilting actual paragraphs or inputs.
2. Expressive high-contrast letterforms and controlled flourishes provide the headline silhouette. Huge geometric type or ordinary fallback serif is insufficient.
3. Primary actions are engraved seals; secondary actions are paper tabs or bookmarks. Working controls belong to a fieldbook through contour, ruled structure and tactile states, not generic square buttons with different colors.
4. Illustrated impossible artifacts/maps cross decorative page boundaries. Content never needs to be deciphered from an image.
5. The result arrives immediately; a brief page-uncover motion explains change. Repeated rolling remains instantly available.
6. Quiet, neutral body text and practical form geometry anchor the expressive frame. Large collection names, code and long prose are real text and reflow naturally.

Customize palette, type families/scale/weight/leading, paper treatment, spacing, stroke, edge geometry, shadows, density and motion centrally. A theme retains the open-page composition and seal/tab/bookmark identities. Do not make a runtime theme builder or scatter theme conditionals through components.

### Preference model and compatibility

Keep existing `theme: light | dark | system` and `resultTheme: default | ttrpg | cyberpunk | sleek | whimsical`. Preserve saved values and `ui-store`; defaults for missing new preferences: `palette: cobalt`, `typography: fieldbook`, `surface: layered`. Alternative proposals: palette `verdigris`, typography `editorial`, surface `clean-paper`.

If a previous planning specimen used `cabinet`/`etched`/`crisp` as IDs, it did not ship as application state. If any implementation already stores those values, alias `cabinet`→`fieldbook`, `etched`→`layered`, `crisp`→`clean-paper` instead of clearing data. Unknown choices fall back individually. Preserve browser width, library organization, editor selection and other preferences.

`data-mode` holds resolved light/dark; stored `theme` may remain system. Preserve `.light`/`.dark` and `color-scheme`, OS-media subscriptions and listener cleanup. Palette/type/surface attributes change independently. Apply saved preferences before first paint where practical. Compact accessible appearance choices can live in a menu/dialog; **a theme-demo control bar must not dominate the final header**.

## Ink, paper and surroundings

Use the complete base palette table in [palettes.json](palettes.json). Exact current roles:

| Role | Cobalt dark | Cobalt light | Verdigris dark | Verdigris light |
|---|---|---|---|---|
| Surround | #071436 | #F2F3EB | #0C241F | #F3F1E8 |
| Chrome surface | #10234A | #FCFCF5 | #16372F | #FFFCF4 |
| Chrome raised | #192F59 | #E5E9EE | #20483E | #E5E9DF |
| Chrome text | #F1F1E8 | #142443 | #F2EFE3 | #18382E |
| Chrome muted | #ADBBD2 | #52617A | #B7C8BE | #4D675B |
| Chrome accent | #DCC27C | #80601C | #DBBF84 | #735421 |
| Accent hover | #ECD89D | #654A13 | #ECD7AA | #593F17 |
| On accent | #101B33 | #FFFFFF | #142B24 | #FFFFFF |
| Chrome boundary | #6F819E | #758199 | #779C8B | #74887B |

The selected design is **lighter within its cobalt world**, including in dark mode. Do not invert the entire fieldbook into a navy card. Home’s page/result stages remain ivory with dark ink. Dark/light governs surrounding surfaces, navigation and tool chrome; explicit paper roles preserve the approved luminous reading stage. In light mode the surrounding room is ivory and the illustrated cobalt landscape/margin still anchors the scene. Broad page glare must be reviewed at actual brightness; any dimmed-paper variant requires new contrast calculation.

| Paper role, invariant across modes | Cobalt | Verdigris |
|---|---|---|
| Paper | #F2F3EB | #F3F1E8 |
| Fresh sheet / field | #FCFCF5 | #FFFCF4 |
| Inset / selected row | #E5E9EE | #E5E9DF |
| Ink | #142443 | #18382E |
| Secondary ink | #52617A | #4D675B |
| Brass ink / paper link / focus | #80601C | #735421 |
| Brass ink hover | #654A13 | #593F17 |
| Page rule / input boundary | #758199 | #74887B |
| Error ink | #A33935 | #A03932 |
| Success ink | #246644 | #286640 |
| Warning ink | #785700 | #775500 |

These paper values are exactly existing light-palette roles, so the previously calculated light-palette pairs apply. For example cobalt ink/paper is 13.79:1 and secondary ink/fresh sheet 6.08:1; verdigris ink/paper 11.29:1 and secondary ink/fresh sheet 6.01:1. Paper link/fresh sheet: cobalt 5.65:1, verdigris 6.78:1. Page rule/inset: cobalt 3.22:1, verdigris 3.07:1. These are real base sRGB checks, **not validation of the concept image’s texture or rendered artwork**. Keep essential text, fields and boundaries on an opaque untextured core. Edge grain, page stains, art/collage may surround it. Do not pick body colors from the raster. Recheck all applied overlays, syntax colors, final states and custom presets.

## Typography is an implementation milestone

The selected image’s flowing ligatures, long terminals and exceptional high-contrast curves are critical. The generated lettering does **not** identify an actual font. Fraunces/Georgia fallback from the rejected specimen is not an acceptable finished solution. Font naming in a token file is not typography proof.

As an internal implementation milestone before full page layouts, produce a real **self-hosted typography/glyph proof** with the hero phrase, Rolldeo wordmark, nav labels, Roll/Roll again, long collection titles, mixed case, numerals, punctuation and supported Unicode fallback. Compare actual rendered letterforms and hierarchy with concept 4. This is implementation validation, not an unsolicited permission gate; continue within the user’s authorized build scope when implementation is resumed. Check licensing for embedding/modification and include license files. Use one of these routes:

- An appropriately licensed expressive display face plus controlled OpenType ligatures/alternate glyphs, demonstrated in the browser; candidate Bodoni Moda is a provisional high-contrast starting point, not a claim it reproduces the concept’s Art Nouveau forms.
- Original bespoke lettering for the **fixed brand and fixed hero phrase**, with the actual words represented accessibly in the document and no duplicate announcement. Separately choose a compatible live display font for changing headings. A decorative custom SVG treatment may augment a real heading; it must not obscure or convert arbitrary user text into images.

`Rolldeo Display` in the recipe is an **unresolved future font slot**, not a delivered font. Body proposal: Source Sans 3; alternate IBM Plex Sans. Mono proposal: IBM Plex Mono. Verify actual files/licenses, bundle locally, use font-display swap and supported Unicode/system fallbacks. Fallbacks preserve functionality while loading/offline; they do not pass final design acceptance. Do not make live button labels, user results or collection titles raster imagery.

| Role | Proposed size | Leading / weight |
|---|---|---|
| Home headline | clamp(4rem, 2rem + 6vw, 9rem), constrained ~7–10ch | .84–.95 as proven by actual glyphs; face-specific weight 400–600 |
| Page title | clamp(2.25rem, 1.5rem + 2vw, 4rem) | 1.02 / actual display face |
| Result heading | clamp(1.75rem, 1.25rem + 1.5vw, 3rem) | 1.1; flowing but no swash collision with content |
| Body / reading | 1rem UI; 1.125rem result | 1.4 UI / 1.65 reading; 400 |
| Labels / controls | .9375rem; nav 1rem | 1.4 / 600 as appropriate |
| Caption | .8125rem | 1.4 / 400 |
| Code / weight | .875rem | 1.5 / 400; tabular figures |

Keep body measure 60–70ch, max 80ch. Display flourishes have their own safe visual bounds so they can cross negative space without clipping at 200% zoom. Dynamic headings wrap; they are not forced into the hero’s fixed lettering layout. Do not copy the concept’s tiny all-caps annotation density into app forms. Code/JSON remains neutral and readable.

## Materials, controls and tokens

Spacing primitives: 4/8/12/16/24/32/48/64/96/128px in rem. Page gutters: 32 desktop, 24 tablet, 16 mobile. Reading page inner padding: 32–48 desktop, 20 mobile; field groups 16–24; label gap 8. Choose density by task; illustration does not force excess space in long editors. Touch targets ≥44px even where a decorative contour looks smaller.

Layered surface: separate underleaf, main paper and optional corner curl, each with reserved geometry; paper depth shadow in black/deep cobalt at .16–.22. Grain opacity ≤.035 at margins only. Clean-paper alternative removes grain and extra curls, retaining an underleaf edge and seal/tab/bookmark contours. Do not reduce it to a generic square card kit. Radii for fields may be 3px, but their inset line and bookmark alignment establish identity; hero seals use circular geometry independently of general field radius. Page corners/cuts are visual layers, not clip-paths on content containers.

### Real functional controls

- **Roll seal:** a circular `<button>` with live text, concentric engraved rings and pointing-hand decoration. Home diameter approximately 144–184px desktop, 104–128px mobile; working Roll/Roll again uses 56–72px seal or a compact bookmark control when space is limited. Separate decorative ring/hand art from text; `aria-hidden` ornaments. Center text remains legible. Do not use arc lettering as the only accessible label.
- **Paper tab:** real link/button with live label, light paper background and a separately masked torn edge. Focus outline follows a generous stable outline around the whole control, not a serrated edge. Arrow is decorative; action remains plainly named.
- **Bookmark action:** narrow paper/brass strip with a notched end and live label/icon. Useful for save/export/details actions; icons have names, not mystical glyphs alone.
- **Fields:** opaque fresh-paper inset, ruled lower boundary plus visible contour where needed, persistent label, focused ring and linked errors. Neutral rectangular typing area is permitted; naked native controls as the final design are not.
- **Collection presentation:** illustrated page folio/spread or index entry with art seal and name; not a stack of identical rounded cards. Lists stay efficient.

Token layers: raw preset primitives → semantic purposes → component bindings. Raw colors/fonts/material/motion values belong only in the centralized primitive layer. `tokens.css` retains the legacy HSL-channel bridge for Tailwind (`--background` etc.) and adds explicit paper/ink/seal/tab roles. Palette/type/surface choices set only their primitives. Semantic/component aliases must be rebound on **the element that changes primitives**, using `:root, [data-theme-scope]`, so descendant overrides do not inherit already-resolved ancestor aliases.

```html
<section data-theme-scope data-palette="cobalt" data-mode="dark"
         data-type="fieldbook" data-surface="layered">
  <button class="roll-seal"><span>Roll</span></button>
</section>
<section data-theme-scope data-palette="verdigris" data-mode="light"
         data-type="editorial" data-surface="clean-paper">
  <button class="roll-seal"><span>Roll</span></button>
</section>
```

```css
.roll-seal {
  background: var(--seal-bg); color: var(--seal-ink);
  border: var(--seal-stroke) solid var(--seal-rule);
  border-radius: var(--seal-radius); min-width: var(--seal-size);
  min-height: var(--seal-size); font-family: var(--font-display);
}
.roll-seal:focus-visible {
  outline: var(--stroke-focus) solid var(--seal-focus);
  outline-offset: var(--focus-offset);
}
```

This demonstrates theme swapping, not the finished engraved control; add separately authored concentric rings/pointing-hand layers and real hover/press states. No giant theme builder or palette conditional scattered in React. Declare paper context explicitly with `[data-paper-context]` or `[data-theme-scope][data-context="paper"]`: native controls use `color-scheme: light` and focus uses dark brass ink. A seal placed on surrounding cobalt/green uses the corresponding chrome accent for its outline. The dark brass paper focus color on dark verdigris surround is only 2.34:1 and is therefore forbidden there; use the verified light brass chrome accent. Map local fields/results to paper tokens and verify portal wrappers: a dialog must know whether it uses global chrome or paper roles.

## Responsive compositions

Validate 375/768/1440px plus long names/content and 200% zoom. Wide ≥1200px, intermediate 768–1199px, small <768px, collapsing sooner when content needs it. Natural document scroll. Max scene width ~1600px, max article measure independently constrained. Decorative overlaps are allowed inside reserved art bounds; never cover controls or live text.

### Home — the open fieldbook

```text
Wide: quiet Rolldeo + Home/Library/Roll/Editor/Guide, search/appearance secondary
      left ~35%: flowing “Collect the unexpected.” + short copy
      Roll seal + torn-paper Library tab
      center/right ~65%: open ivory fieldbook and specimen/result
      winged artifact crossing page edge; map/astronomical object/cobalt landscape
      continuation: quick roll/recent/pinned index, accessible without an intro
Small: brand/search/menu → expressive shortened line breaks → Roll seal/Library tab
       one portrait page with specimen/result + separate edge art
       recent/pinned index; art crops simplify without losing open-page identity
```

Use the concept’s large page and title proportions. No appearance-demo header, two-column generic marketing panel, ornamental cabinet cabinet-as-object, fake metric strip or feature bento. An actual quick-roll table selection and source/result can occupy the fieldbook, with sensible empty state. Preserve recent/pinned workflows. A mobile page may be a single open leaf; do not shrink all desktop annotations into illegible texture. Browser nav supplies every existing destination even though the concept image shows only three.

### Roller — page continuation

```text
Wide: narrow index/bookmark browser (resizable, remembered)
      right: ivory result leaf, selected-table source at top, compact Roll seal
      readable result + copy/pin/details bookmarks, history as following index
      art at page corners; content does not rotate or sit under a winged-key image
Small: selected table + Browse tab → stable Roll → result leaf → history
       searchable index in accessible drawer; details/filters remain reachable
```

Browser keeps collections/publisher/namespace hierarchy, search, grouping, tables/templates, favorites/quick access, width preference and virtualization. Current result, roll multiple, history/pins/delete/copy, trace/capture/descriptions/details/sets remain available. Long prose/tables/code determine page height. A rolled result immediately replaces live content; its decorative page edge uncovers in parallel. Roll again never waits for ornament. No unsolicited scroll/focus jump.

### Library — folios and index leaves

```text
Wide: fieldbook title + illustrated margin, Import tab / New collection bookmark
      search/tag/namespace/view controls in a ruled strip
      roomy illustrated collection folios (2–3 across) or efficient grouped index
      namespace divider bookmarks, clear author/description/table counts/actions
Small: title/actions → search → filter disclosure with count → folio/index rows
       selection/bulk controls wrap; full name/important actions remain visible
```

Retain grid/grouped views and built-in/user distinction, ownership, selection/delete and import conflict flows. Existing custom cover art stays where available; neutral index illustration for unknown genres. Covers are an accent, not half the screen. Roll/edit/menu actions remain visible on keyboard/touch; no hover-only access. Avoid repetitive identical cards with a random icon and huge empty padding.

### Editor — a maker’s working fieldbook

```text
Wide: collection selector/title/draft or save status + Save/Export bookmarks
      structure index | metadata/tables/templates/variables/JSON paper tabs
                      | neutral ruled fields, weights, reorder, validation
                      | pattern preview/context/help as adjacent/expandable leaf
Small: selector/status → labeled tabs or section select → active working page
       structure drawer; expandable preview; reachable save/error state
```

Retain every metadata/includes/variable/template/table/entry control, drafts, validation, autocomplete/insertion, pattern preview/context, visual mode and Monaco JSON, keyboard/reordering behavior. Ornament at the margin only; typing surface stays opaque and neutral. Fields, tabs and action bookmarks share the expressive material system while letting people work quickly. JSON uses named Monaco themes mapped to active palette/mode/paper context and font roles; update through Monaco APIs, not DOM hacks. Preserve validation and worker/offline support. Weight fields use tabular figures; reordering has keyboard move alternatives.

### Guide — actual field notes

```text
Wide: illustrated chapter heading + bookmark sidebar → ivory article leaf ~65ch
      code/tables/figures/downloads, small margin motifs, related-page tabs
Small: heading → Guide index disclosure → article → related pages
```

Retain guide, quickstart, specification, schema and Using Rolldeo routes, headings/anchors/downloads and markdown behavior. One illustration at entry, not a giant flourish after every paragraph. Wide code/tables scroll in labeled local regions; ordinary prose reflows. The fieldbook shape supports reading rather than requiring sideways or page-turn-only navigation.

## Component states and interaction

| Component | States and preservation |
|---|---|
| Nav / bookmarks | Active page text/marker + aria-current; hover underline/ink change; focus distinct; mobile expanded/Escape/focus return |
| Roll seal | Ready; hover ring shifts ≤2°/shadow changes; pressed sinks ≤2px; pending true computation label if needed; native disabled only when functional constraints require it. No decorative wait lock. |
| Tab / bookmark action | Live label, stable hit area, slight edge-lift on hover; keyboard focus equivalent emphasis; pressed settles. Destructive label plainly names action. |
| Field/select | Persistent label/help/value, opaque paper, visible boundary/focus; invalid icon/text linked with aria-describedby. Appearance cannot hide select affordance. |
| Collection folio | Resting/selected/keyboard/touch actions; actual metadata and wrapping titles; independent actions are not nested buttons |
| Result leaf/history | Source, ready/calculating/error, copy/pin/details/deletion; pinned state has label/icon; latest label; long content grows without clipping |
| Editor rows | Focus/invalid/drag/saved/draft; row order is meaningful numbering; handles + keyboard equivalent; linked validation and readable weights |
| Dialog/command search | Opaque sheet, title, focus trap/return, Escape, keyboard results, counts/empty/no match; portals inherit correct context |
| Toast/import/offline | Polite precise status; no focus stealing; imports preserve file/validation/conflict choices; offline describes local usage honestly |
| Empty/loading/error | A small relevant marginal sketch plus clear next action; no dancing loader, no whimsical error obscuring recovery; reserve layout |

Use semantic buttons and links; all controls reachable by keyboard, focus outline 2px with 3px offset (paper focus uses verified brass ink), touch targets ≥44px. States have words/icons, not color alone. Link underlines stay visible. Live result-ready announcement is short/polite and does not re-read a long result/history or steal focus. Dangerous actions have a named confirmation and clear consequence. Decorative layers are aria-hidden/empty alt; authored user illustrations receive appropriate context.

## Original artwork production

The user explicitly authorizes image generation for illustrations **and decorative pieces**. Produce distinct assets from the selected visual grammar rather than crop generated UI lettering/controls from the concept. Separate foreground/midground/background; preserve source masters and actual alpha. Generated text is not a UI asset. Source choices/original drawing/licensing must be reviewed; do not imitate copyrighted artist-specific work or reuse the references’ art.

| Asset | Selected fieldbook brief / layering |
|---|---|
| Open book shell | Ivory open spread, spine/underleaf/curl layers on transparency, no words or text-like marks, spacious neutral core for real result. Desktop wide and mobile single-leaf versions. |
| Cobalt landscape | Engraved improbable coast/island/quiet castle with deep blue atmosphere, scene perimeter rather than wallpaper behind text; adapt to other genres and palette/mode. |
| Winged artifact | Key with moth wings in brass/ivory/cobalt engraving; separate transparent foreground crossing decorative boundary only. Use original detailed study as possible inspiration, not approved reusable final. |
| Impossible map | Folded island map, separate folds/shadow/collage so the map can sit on an outer page margin. Any map labels in app are real text or nonessential fictional art labels with review. |
| Astronomical instrument | Brass armillary/crescent/moon orbits on transparency, crop-safe offscreen anchor; secondary object, not second competing hero. |
| Roll seal ornaments | Original concentric engraved rings and pointing hand as independent transparent/vector layers; no baked Roll text. Build a real button over them. |
| Paper tab/bookmark edges | Torn edge, underleaf/notched tail and optional tiny arrow/ink flourish on separate assets; no baked labels, no hit area based on irregular alpha. |
| Display/wordmark | Real licensed font proof and/or original fixed-text vector lettering; actual accessible hero/brand words represented correctly. Live headings/controls remain text. |
| Page ornaments | Delicate corner rays, lunar phase strip, botanical vignette, quill/moth; generate as individual pieces, no full screenshot backdrop. Current old divider/celestial studies are optional historical inspiration subject to reapproval. |
| Genre folios | Fantasy wing/compass; horror polite moth/unsettling letter; sci-fi bottled world/instrument; cyberpunk receiver/paper bird. Same engraved line and page system. |
| Small states | Empty bookmark, folded leaf, intact spare key for recovery, closed notebook for offline; labels provide meaning. |

Detailed ivory/gold RGBA artwork has shaded tonal information; applying its alpha as a flat CSS mask destroys that detail. Only true monochrome SVG/linework uses currentColor/masks. Review curated artwork variants or neutral-tone treatment against both palette/mode combinations. Maintain smooth clean alpha edges without halos, adequate contrast against page/surround and recognizable silhouettes at actual size. No required remote media. Final crop/image quality and scene weights require real review; the concept is not optimization evidence.

## Motion: page uncover, not staged access

Motion makes the fieldbook feel alive and continues the page metaphor. It is an implementation goal, not something measured in the static concept.

- Initial Home: content and actions present immediately; page/foreground can settle ≤6px over 220–320ms. One coordinated sequence, not staggered sections forever.
- Roll: live result updates immediately. Page edge exposes the new leaf over ≤380ms (80ms seal feedback → ~180ms edge uncover → ~120ms settle). Mask/curl only decorative layers; user paragraphs never become a flipping raster and cannot be unreadably rotated.
- Repeated roll: interrupt/shorten ornament (~120ms for rapid repeats); no disabled control until animation completes, no result/history loss.
- Seal hover: engraved inner ring ≤2° and fine shadow shift over 120ms; pressed depth ≤2px. Keyboard focus gets equally clear static feedback; no pointer-dependent functionality.
- Tab/drawer: edge-lift or 8px panel continuation over 220ms with focus unchanged. Navigation is ordinary links, never mandatory page-turn-only gestures.
- Optional Home depth: decorative layers ≤4px on fine-pointer devices, one requestAnimationFrame loop, offscreen/background suspended. No scroll hijack or endless ambient loop.

Easing: settle `cubic-bezier(.22,1,.36,1)`, exit `cubic-bezier(.4,0,1,1)`. Centralize durations/distances/intensity. Prefer CSS/SVG transforms and limited clipping; no initial WebGL/large animation library requirement. Reduced motion removes depth/crop/turn and sets duration/distance to zero; results appear immediately, focus/status remain visible. Respect preference changes and cleanup. Sound stays off by default; no custom cursor, text scramble or forced smooth scroll.

## Result-style compatibility

Keep resultTheme IDs and persist them. Name the selector “Result style,” separate from overall appearance. All variants inherit global paper/ink and type roles:

| ID | Treatment |
|---|---|
| default | Fieldbook: open reading leaf, source marker, restrained page edge |
| ttrpg | Field notes: ruled margins and notebook source bookmark |
| cyberpunk | Signal folio: mono metadata, cut-corner index details, neutral prose |
| sleek | Editorial: minimal page edge, no vignette, generous reading measure |
| whimsical | Playful notes: small irregular stamps in the margin |

No variant hardcodes neon, pink, parchment or additional font downloads over the chosen global theme. Keep existing result/history/prose class consumers until migration completes. Verify all five with four palette/mode combinations and long prose/table/code, details/trace, pins/history. Local aliases must rebind correctly at variant scopes/portals.

## Future repository migration

1. Inventory the functional baseline and CSS consumers. `src/main.tsx` contains active router wiring; `src/App.tsx` is retained for reference. Preserve URLs/deep links and layouts’ semantics.
2. Centralize tokens from `src/index.css` into a small stylesheet, map `tailwind.config.js` colors/font/radius/shadow to CSS variables. Keep legacy utilities until their consumers migrate. Replace old named mint/lavender/copper and hardcoded result themes by role, not blind search-and-replace.
3. Extend `src/stores/uiStore.ts` with validated independent presets/defaults; preserve ui-store keys/partialize, theme/resultTheme and all saved UI state. Keep applyTheme `.light`/`.dark` and colorScheme, independent preset attributes, OS listener cleanup in `src/components/common/ThemeSwitcher.tsx`, startup timing in `src/AppInitializer.tsx`.
4. **Typography and art proof before full page work:** real self-hosted heading/button/wordmark glyphs, licensing and responsive open-page/engraved-control layered prototype. Review against concept 4. Do not spend a complete implementation pass polishing a generic fallback system.
5. Shared shell/components in `src/components/layout/Layout.tsx`, common search/modal/theme/toast/offline/install controls. Expressive seals/tabs/bookmarks, neutral fields and correct keyboard states.
6. Home/Library: `src/pages/HomePage.tsx`, `src/components/home/QuickRoll.tsx` and QuickRollResult; `src/pages/LibraryPage.tsx`, library CollectionCard/FilterBar/namespace/selection/delete controls. Keep recent/pins, organization, imports and authored covers.
7. Roller: `src/pages/RollerPage.tsx`, `src/components/roller/SplitPanelLayout.tsx`, browser/list/filter/search/accordion, CurrentRollResult/ResultsPanel/RollHistoryList, drawers/details/trace/capture/sets/multiple. Preserve virtualization, resize width and every action; migrate `src/components/common/ResultThemeSwitcher.tsx` IDs intact.
8. Editor: `src/pages/EditorPage.tsx`, EditorWorkspace/sidebar/tabs/mobile nav, entry/table/template/metadata/includes/variables and PatternPreview. `src/components/editor/JsonEditor.tsx` currently picks vs/vs-dark and hardcodes mono font; use defineTheme/setTheme and editor font options from resolved CSS roles and actual preset/mode changes, preserving OS support/workers/validation.
9. Guide: existing Guide/Quickstart/Spec/Schema/UsingRolldeo pages, `src/components/guide/GuideLayout.tsx`, GuideSidebar/MarkdownRenderer. Preserve code/tables/downloads and active routes. Branding in `src/assets/rollifyLogo.png` needs reviewed replacement, not silent relabeling.
10. Local responsive assets/fonts and `vite.config.ts` PWA policy: existing globPatterns includes image/font formats, but verify emitted paths, cache budgets and first-installed offline behavior. Prune old visual classes after audit; preserve engine/services/database/import-export/collection/favorite/roll stores and editor drafts.

## Future acceptance: the image is the bar

Visual acceptance precedes declaring success from a green build:

- Side-by-side 1440px screenshot comparison with selected concept: open light fieldbook dominates center/right, spectacular flowing heading on left, cobalt illustrated margins, engraved circular Roll and torn-paper secondary tab, meaningful layered page depth. Similar quality/composition, not traced art or raster screenshot replacement.
- Actual self-hosted font/glyph proof/licensing. Display character must meet the selected image’s ambition. Ordinary Georgia, default Bodoni without sufficient shaping, flat normal buttons or generic card kit fail even if tokens work.
- 375/768/1440px layouts and 200% zoom maintain identity with mobile single-leaf composition and readable live words, no action collisions, no page-wide horizontal overflow. Work screens share fieldbook control/material identity and remain efficient.
- Independent palette/type/surface/mode changes work across shared UI, portals, result variants, Guide, errors and Monaco; proper alias scoping and legacy preference survival. Theme alternatives preserve design identity rather than reverting to plain components.
- Art layers are separately generated/drawn/exported, optimized and local. No generated UI text in baked assets; original source/licensing documented; alpha edges and crops approved in both modes/palettes.
- Roll result instant/repeat immediately available; page-uncover motion demonstrated in browser, interrupts cleanly, reduced motion instant. Keyboard/focus/announcements intact; no scroll hijack. Smoothness must be reviewed/measured, not inferred from the raster.
- All existing routes/workflows, weighted engine, collections, imports/exports, search/filter/grouping, history/pin/copy/details/trace/multiple, drafts, JSON/visual validation/preview/reorder and Guide downloads work. Relevant existing tests rather than CSS-string tests.
- Measure final normal text ≥4.5:1 and meaningful boundaries/focus ≥3:1, including paper/chrome contexts, real final shading, syntax, selected/error states. Keyboard dialogues/search/reordering and touch ≥44px. Status meaning does not depend on color alone.
- Budgets proposed for implementation: added design CSS ≤35KB gzip; added design JS ≤20KB gzip; critical Home art ≤220KB desktop/120KB mobile, initially needed new art ≤350KB/220KB; initial WOFF2 ≤180KB. Reduce layers/weights rather than silently inflate. CLS≤.1, LCP≤2.5s, INP≤200ms on documented representative mobile profile; report existing bottlenecks separately.
- Installed warm-offline reload/navigation covers Home/Roll/Library/Editor/Guide, all local fonts/art/icons/Monaco and chosen appearance. Keep virtualization efficient. Run supported-runtime build/lint and relevant existing suites (`npm run build`, `npm run lint`, `npm test -- --run`); report actual results, environment and pre-existing failures.

Awwwards skill scorecard belongs to the final implemented UI with real rubric evidence and deliberate product adaptations. No documentation-only score. The current work stops after this revised guide, prompt, asset briefs and concept review. The user must explicitly resume app implementation.
