# Future implementation prompt — The Living Fieldbook

**Current task: design handoff only. Production UI implementation remains paused.** Use this brief when the user explicitly resumes the overhaul; its existence is not permission to start editing the app.

---

You are the design lead and frontend implementer for Rolldeo. Create an extraordinary, authored **Living Fieldbook** interface. The user rejected the earlier static cabinet specimen because the typography looked basic, controls bland, and overall composition generic. The user selected **concept 4** as the complete new visual direction. Do not polish or reintroduce that rejected design.

## Visual authority and approved brief

Read and visually inspect `docs/design/concepts/04-living-fieldbook.png`. Read `docs/design/concepts/selection.json` and `docs/design/concepts/prompts.json`. The selected image is a generated desktop UI concept, not a real app screenshot, production asset or font proof. It is the primary authority for composition, type ambition, material layers, control personality and atmosphere. Concepts 1–3, `preview-cabinet-study.html` and old cabinet assets are superseded exploration. `preview.html` is now a static concept-review page, not proof of functioning UI, theme swaps or smooth motion.

Approved image characteristics:

- Open illustrated fieldbook fills center/right (~65% desktop stage); light ivory pages within cobalt landscape/margins. Separate curled edges, underleaves, collage and fine engraving create tactile depth.
- Huge sweeping custom-looking Art Nouveau letterforms, high contrast curves, flowing ligatures/terminals on the left. Headline **Collect the unexpected.** Supporting copy **A curiosity for every story.**
- Winged key crossing a decorative page edge; impossible island map and brass astronomical instrument, with quiet live reading area. Strange and inviting, observational humor, curiosity stronger than menace.
- Distinctive round engraved **Roll** seal with concentric rings and pointing-hand illustration. Torn-paper **Explore the library** secondary tab. These become real semantic controls, not screenshot fragments.
- Expressive throughout: Home most spectacular, Roller most tactile, Library/Editor/Guide richly styled but practical. Cross-genre fantasy/horror/sci-fi/cyberpunk. Easy centralized palette/font/CSS presets remain required.

Treat the cabinet-of-curiosities subject as a collection of ideas; the visual metaphor is an open living fieldbook. Generic cards, plain fallback serif and square stock controls fail this brief even if they use tokens correctly.

Product: offline-first React 18 + Vite + Tailwind 3 + Zustand PWA for creating/organizing/rolling weighted random tables and TTRPG generators, sharing through import/export files. Preserve existing routes, data, engine and all workflows. No collection schema migration is needed for styling.

The user’s original Cyera and Santioni references suggest authored immersive illustration and narrative interaction; concept 4 is now more specific. Do not copy their art/lettering/brands or claim a site audit without doing it. Relevant design skills should serve this product; no mandatory WebGL/custom cursor/scroll hijack/large animation dependency.

## Implementation sources

Read `docs/design/STYLE_GUIDE.md` for the complete specification; `tokens.css` for exact centralized primitive→semantic→component recipe; `palettes.json` and `CONTRAST.md` for baseline colors/checks; `ASSET_PROMPTS.md` for separate original asset briefs and historical studies. Resolve these under `docs/design/`. These artifacts are recipe/reference, not an already implemented selected UI. Keep them aligned when final implementation choices change.

## Typography proof is essential

The image’s generated lettering does **not** correspond to a known available font. Do not claim that naming Fraunces/Bodoni/Georgia produces the same forms. First build an internal, actually self-hosted typography/glyph proof: headline, Rolldeo wordmark, nav, Roll/Roll again, long user titles, mixed-case text, numerals/punctuation and Unicode fallback. Check embedding/modification licenses and include them. This is work within the future authorized build, not a permission gate that stops progress.

Use an appropriately licensed expressive face with demonstrated OpenType alternates/ligatures, or original bespoke fixed hero/brand lettering plus a compatible real live heading font. Bodoni Moda is a provisional high-contrast candidate, not approved proof of the concept’s Art Nouveau character. `Rolldeo Display` is an unresolved future slot. Static bespoke SVG heading/wordmark ornament is allowed with the actual words represented accessibly and no duplicate announcement. User collection/result text and control labels remain live text; never bake them into images.

Body candidate Source Sans 3, alternate IBM Plex Sans; mono IBM Plex Mono, subject to actual files/license verification. Bundle approved WOFF2 locally with font-display swap and Unicode/system fallbacks. Missing-font fallback preserves function but is not finished visual acceptance.

Responsive scale proposal: hero `clamp(4rem,2rem + 6vw,9rem)` with actual-glyph proven leading .84–.95 and ~7–10ch composition; titles `clamp(2.25rem,1.5rem + 2vw,4rem)`/1.02; result heading `clamp(1.75rem,1.25rem + 1.5vw,3rem)`/1.1; UI body 1rem/1.4, reading 1.125rem/1.65, label .9375rem/1.4, caption .8125rem/1.4, code .875rem/1.5. Use actual supported weights (400–600 as appropriate), tabular numeric fields. Prose measure 60–70ch/max 80; user headings wrap. Flourishes have safe bounds without clipping/covering controls at 200% zoom.

## Theme recipe and light-paper stages

Independent presets: existing `theme: light|dark|system`, new `palette: cobalt|verdigris`, new `typography: fieldbook|editorial`, new `surface: layered|clean-paper`; existing resultTheme IDs stay unchanged. Defaults: system unless saved otherwise, cobalt, fieldbook, layered, existing result style. Unknown new values fall back individually, never clear data/preferences. Preserve `.light`/`.dark`, color-scheme, OS listeners/cleanup and root attributes. Stored system remains system; resolved data-mode is light/dark. If earlier unshipped planning IDs were somehow saved, alias cabinet→fieldbook, etched→layered, crisp→clean-paper. Appearance controls are compact secondary UI, not a demo header.

Base surrounding dark cobalt: canvas #071436, chrome #10234A/#192F59, text #F1F1E8, muted #ADBBD2, accent #DCC27C, hover #ECD89D, onaccent #101B33, line #6F819E. Light surrounding cobalt: canvas #F2F3EB, chrome #FCFCF5/#E5E9EE, text #142443, muted #52617A, accent #80601C, hover #654A13, onaccent #FFFFFF, line #758199. Full alternative verdigris and status roles are precisely specified in palettes.json/tokens.css.

**Do not turn the selected luminous fieldbook into a navy card in dark mode.** Dark/light changes surrounding room/chrome; the principal paper stage is intentionally light in both. Explicit paper roles, invariant by mode:

| Role | Cobalt | Verdigris |
|---|---|---|
| Paper / field / inset | #F2F3EB / #FCFCF5 / #E5E9EE | #F3F1E8 / #FFFCF4 / #E5E9DF |
| Ink / secondary ink | #142443 / #52617A | #18382E / #4D675B |
| Brass ink / hover / rule | #80601C / #654A13 / #758199 | #735421 / #593F17 / #74887B |
| Error / success / warning ink | #A33935 / #246644 / #785700 | #A03932 / #286640 / #775500 |

These reuse measured existing light-palette pairings. Existing contrast evidence applies to exact opaque colors, not the image’s texture. Final shading/states/syntax/overlays must be checked in actual browser. Normal text ≥4.5:1 and meaningful boundaries/focus ≥3:1. Keep opaque quiet core under paragraphs/fields. Grain ≤.035 at edges only. Paper-context native controls use light color-scheme despite dark surroundings. Mark context with data-paper-context or data-context=paper on theme scope: seal focus there uses paper brass ink; seals on dark surroundings use the chrome accent. Dark paper brass on dark verdigris surround is only 2.34:1 and must not be used as its focus outline.

Palette/type/surface change only centralized primitives. Bind semantic purposes and component roles on `:root` and **every local `[data-theme-scope]` that changes primitives**; inherited aliases have already resolved against ancestors. `tokens.css` demonstrates correct rebinding. Tailwind’s legacy colors still expect HSL channels (`--background: var(--p-tone-0)`), not a nested full hsl() string. Components consume paper/chrome roles and seal/tab/page/field aliases; no scattered literal color/font/surface/motion or React palette conditionals. Portals inherit the appropriate root/local context. No runtime theme authoring framework.

Surface layered: underleaf/main page/optional corner curl, reserved geometry, black/deep-ink shadow at .16–.22, quiet central paper. Clean-paper removes grain/extra curl but retains underleaf and seal/tab/bookmark control identity. Spacing 4/8/12/16/24/32/48/64/96/128px in rem; gutters 32/24/16 desktop/tablet/mobile; reading page pad 32–48 desktop/20 mobile; working groups 16–24, labels 8. General field radius 3px does not define hero seal/page-edge shape.

## Controls and page outcomes

**Controls:** Roll seal is a real circular button with live label, concentric ring/pointing-hand decorative layers. Home diameter 144–184 desktop/104–128 mobile, working seal 56–72 or compact bookmark. Paper tab is a real link/button with live words and separate torn edge. Bookmark action has notched tail and accessible label. Stable hit/focus geometry ignores irregular alpha. Fields have opaque fresh-paper inset, readable native affordance, ruled boundary, persistent label/help and linked invalid messages. ≥44px touch targets, 2px focus with 3px offset, state words/icons as well as colors. Nav has aria-current; dialogs/search keyboard, Escape, focus trap/return; toasts/status do not steal focus. No nested interactive collection actions.

**Home:** quiet complete navigation; spectacular left flowing headline/seal/tab, right open fieldbook live selected specimen/quick-roll result, winged-key/map/astronomical margin art. Preserve quick roll, recent and pinned access. Mobile: title/action→single page/result→recent/pinned index; simplified portrait page/art layers instead of shrink-scaled desktop text. No mandatory intro, art-only hotspots, theme-demo header, generic marketing tiles or fake stats.

**Roller:** resizable remembered bookmark/index browser at left, selected table/action at top of open readable result leaf right. Keep collections/publishers/namespace/search/group/filter, tables/templates, favorites/quick access, virtualization, multiple rolls, current result, history/pins/copy/delete/details/descriptions/trace/capture/sets. Mobile Browse drawer then stable roll/result/history. Long prose/tables/code set height; no fixed result card or tilted paragraphs.

**Library:** illustrated folios/spreads or efficient grouped index with name/description/author/count/tags/actions, ruled filter strip and Import/New bookmarks. Keep grid/grouped organization, selection/bulk/delete/import conflict/built-in/user distinction. Preserve authored covers and neutral unknown-genre fallback. Mobile search/filter disclosure/rows; no hover-only actions or repetitive stock rounded cards.

**Editor:** maker’s working fieldbook: collection selector/title/draft or save status, Save/Export bookmarks, structure index and paper tabs, quiet fields/weights/validation/reorder, preview/context/help leaf. Preserve metadata/includes/variables/templates/tables/entries, autocomplete/insertion, drafts, visual and Monaco JSON, validation and preview. Keyboard equivalent for reorder, tabular numeric weights, errors linked in text. Monaco named themes/font options resolve actual global preset/mode/paper context via APIs and keep OS/workers/offline behavior.

**Guide:** ivory readable article leaf ~65ch, bookmark sidebar and small marginal illustration. Keep guide/quickstart/spec/schema/Using Rolldeo routes, headings/anchors/markdown/tables/code/downloads. Mobile index disclosure→article; local wide-code/table scroll, normal prose reflow. No giant ornament at every heading.

Existing resultTheme IDs: default→Fieldbook leaf; ttrpg→ruled Field notes; cyberpunk→Signal folio/mono metadata; sleek→minimal Editorial leaf; whimsical→Playful marginal stamps. All inherit chosen paper/ink/type. Relabel “Result style”; preserve IDs and history/prose class consumers until migrated. No hardcoded neon/pink/parchment override or five font downloads.

## Original art and movement

User explicitly authorizes image generation, including decorative elements. Generate/draw separate open-book shell/underleaf/curl/shadow, cobalt landscape, winged artifact, folded map, armillary corner, seal ring/pointing hand, torn tab/bookmark edges, lunar/moth/quill/plant margin ornaments, genre folios and small state marks. Exact briefs: ASSET_PROMPTS.md. No baked UI lettering/labels. Real text covers functional areas. Detailed shaded RGBA is not alpha-mask-ready; masks/currentColor only for true mono linework. Review original sources/licensing, alpha edges/halos, responsive crops and all themes. Cache optimized local assets/fonts. Full concept image never becomes app backdrop.

Motion goal: immediate result plus decorative page continuation. Seal press 80 ms, edge uncover ~180 ms, settle ~120 ms (≤380 ms total); live words update at once and never become a flipping raster. Rapid repeats interrupt/shorten ornament ~120 ms, no disabled wait/no dropped history. Seal hover ring≤2°, pressed≤2px; tab/drawer 220 ms with safe focus; optional Home art depth≤4px fine-pointer only/requestAnimationFrame/cleanup/offscreen pause. Settle cubic-bezier(.22,1,.36,1), exit(.4,0,1,1). Reduced motion zero distances/durations/no crop/parallax, final result immediate. No scroll hijack, endless loops, custom cursor, character scramble or mandatory page-turn navigation. Actual smoothness must be demonstrated in browser, not claimed from raster.

## Repository integration and sequence

Inspect actual code/AGENTS and preserve others’ edits. Active routes are in src/main.tsx; src/App.tsx is reference. Existing src/index.css is extensive, tailwind.config.js has HSL aliases and hardcoded font/radii; migrate consumers incrementally. UIStore theme/resultTheme preferences persist under ui-store; add validated independent choices without resets. applyTheme preserves mode classes/colorScheme; startup in src/AppInitializer.tsx and ThemeSwitcher OS listener need compatibility.

1. Functional baseline/consumer inventory, meaningful existing failures.
2. Central tokens/presets/persistence/OS/portal scoping; verify independently.
3. Internal actual typography/licensing/glyph proof and selected-style layered page/seal/tab prototype. Meet concept 4's visual bar before propagating a generic system.
4. Shared src/components/layout/Layout.tsx and common search/modal/theme/toast/offline/install vocabulary.
5. Home/QuickRoll/QuickRollResult, Library/CollectionCard/FilterBar/namespace/selection/delete using original optimized art.
6. Roller/SplitPanelLayout/browser/results/history/drawers/details/trace/multiple and ResultThemeSwitcher without functional losses.
7. EditorWorkspace/sidebar/tabs/mobile nav/form modules/PatternPreview and JsonEditor.tsx. Replace fixed vs/vs-dark and mono font with defined resolved themes/options; keep validation/draft/worker behavior.
8. Existing Guide pages/components, code styling/downloads, local assets/fonts/PWA vite.config.ts, reviewed branding replacement for src/assets/rollifyLogo.png.
9. Real responsive/keyboard/reduced-motion/long-content/zoom/offline/contrast/performance review, meaningful existing tests; prune legacy visual CSS by audit.

Preserve src/engine/**, database/import-export/services, collection/favorite/roll stores, editor draft mechanics and schema. Changing appearance does not warrant collection-data migration.

## Acceptance and report

- Side-by-side 1440 px screenshot comparison to selected concept: open light fieldbook center/right, exceptional flowing headline left, cobalt illustrated margins, engraved Roll seal/torn-paper Library tab, layered paper depth. Similar authored quality, not traced art or embedded screenshot. Tokens/green build alone cannot pass.
- Real self-hosted font and glyph/license evidence; actual text/controls, no generic fallback finished design. Separately produced original layers/ornaments, optimized alpha/crops/themes; no generated UI text asset.
- 375/768/1440px and 200% zoom, mobile single-leaf identity, long names/result/code/tables, no concealed actions/page overflow. Work screens useful and consistent.
- Independent palette/type/surface/mode in portals/Guide/errors/Monaco, system changes and saved preferences/result IDs survive. All 5 result styles × 4 palette/mode combinations preserve workflows/content.
- Actual immediate roll/repeat, interrupted animation/no lost history, reduced-motion instant, keyboard/focus/status/touch behavior, verified contrast (final normal text ≥4.5:1, meaningful boundaries ≥3:1). No scroll takeover.
- Existing routes/import-export/search-filter/grouping/history/pins/favorites/details/trace/multiple/drafts/JSON+visual validation/preview/reorder/downloads pass meaningful regressions; installed warm-offline navigation with local fonts/art/Monaco works.
- Target added CSS ≤35 KB gzip / JS ≤20 KB gzip, critical hero art ≤220 KB desktop / 120 KB mobile, initial new art ≤350 KB / 220 KB, initial WOFF2 ≤180 KB. Target CLS ≤.1, LCP ≤2.5 s, INP ≤200 ms on documented mobile profile; report actual metrics and existing bottlenecks separately.
- Run supported-runtime npm run build, npm run lint and relevant existing tests (npm test -- --run), browser console/render/accessibility/performance checks. Report actual evidence, changed files, important decisions, limits and pre-existing failures. Awwwards score, if applicable, is honest implemented-rubric evidence with product adaptations, not a planning score.

Do not deploy/publish unless authorized. The design-only task ends here; future implementation begins when the user resumes it.
