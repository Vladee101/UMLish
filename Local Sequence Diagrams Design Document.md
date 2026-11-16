# UMLish: Design Document

*Status: living implementation document. Sequence rendering has been calibrated against local PlantUML references; initial ER support is implemented.*

## 1. Summary

A browser-only editor and renderer for **PlantUML-compatible sequence and entity-relationship diagrams**. Users paste existing PlantUML text, see a diagram immediately, and can export or share it. No server computes anything, and the page is hardened so the browser itself refuses network requests. It is a static site deployed on Vercel.

The renderer is written from scratch (parser, layout, SVG) rather than wrapping the Java PlantUML engine. That keeps the bundle small, starts instantly, and makes "nothing leaves your machine" a property we can enforce rather than just claim.

## 2. Goals and non-goals

**Goals**

- Paste a typical PlantUML sequence diagram and get a faithful, classic-looking result.
- Render common PlantUML ER entities, attributes, and crow's-foot relationships with automatic layout.
- Be tolerant: render what we understand, warn about what we don't, never show an error screen for a partly supported diagram.
- Be provably local: no analytics, no CDN, no API routes, strict CSP.
- Work well as an editor: syntax highlighting, inline warnings, click-to-source, pan/zoom.
- Export client-side (SVG, PNG, print to PDF) and share via URL hash.

**Non-goals (for now)**

- Other PlantUML diagram types beyond sequence and the initial ER subset (class, activity, state, and so on).
- The PlantUML preprocessor (`!include`, `!define`, `!procedure`, `!if`). `!include` cannot work meaningfully in a local-only app anyway.
- Pixel-identical output to PlantUML. The target is "looks the way people expect", checked by eye against reference renders.
- Accounts, cloud storage, or collaboration.

## 3. Design principles

1. **Tolerant over strict.** A partial diagram plus a clear warning beats a failure.
2. **Local is a feature, enforced.** Privacy comes from the CSP and the absence of a backend, not from policy text.
3. **Theme is data.** All colors, sizes and strokes live in one `Theme` object. Layout and renderer read only from it, so a modern or hand-drawn theme is a new object, not a rewrite.
4. **Deterministic layout.** Text is measured with a bundled font, so output does not depend on which fonts the visitor has installed.
5. **Clean-room.** The look is reproduced from observation of output. No PlantUML source, sprites or generated assets are copied (see section 11).

## 4. Architecture

The core is a pure pipeline with no DOM dependency except text measurement, which is injected.

```
text --parse--> Diagram (AST + warnings)
     --layout(theme, measure)--> Scene (positioned shapes)
     --renderSvg(theme)--> SVG string
```

| Module | Responsibility |
| --- | --- |
| `parser/ast.ts` | AST types. Every node carries a 1-based source line. |
| `parser/parse.ts` | Tolerant line-oriented parser. Never throws. |
| `theme.ts` | The classic theme as data, plus `skinparam` overrides. |
| `measure.ts` | Canvas text measurer for the browser; deterministic estimator for tests. |
| `richText.ts` | Creole inline spans, plain-text labels, and style-aware measurement. |
| `layout.ts` | Diagram to `Scene`: columns, rows, activations, fragments. |
| `render.ts` | `Scene` to SVG, with `data-line` on each element. |
| `er/ast.ts`, `er/parse.ts` | ER AST, tolerant parser, and sequence/ER detection. |
| `er/layout.ts` | Entity sizing, grid placement, and relationship endpoints. |
| `er/render.ts` | Themed entity tables, attributes, labels, and crow's-foot markers. |
| `editor.ts` | CodeMirror 6 editor, highlighting, warning gutter. |
| `viewport.ts` | Wheel-zoom and drag-pan. |
| `share.ts` | Compress/decompress the diagram into the URL hash. |
| `export.ts` | SVG and PNG download. |
| `fonts.ts` | Bundled font loading and embedding. |
| `main.ts` | Wires everything together. |

Because the pipeline is pure, the parser, layout and renderer can be unit-tested in Node without a browser.

## 5. Parser

### 5.1 Approach

PlantUML is line-oriented and loosely specified, so the parser is a hand-written line dispatcher (a regex per statement type plus a stack for nested fragments) rather than a formal grammar. It processes text between the first `@startuml` and `@enduml`, or the whole input if there is no `@startuml`.

Anything it does not understand becomes a `{line, message}` warning and is skipped. Unclosed blocks (fragments, boxes, multi-line notes) are closed at end of input with a warning.

### 5.2 Supported syntax (Tier 1 plus some Tier 2)

- **Participants:** `participant`, `actor`, `boundary`, `control`, `entity`, `database`, `collections`, `queue`; `as` aliases in either order; quoted names; `#color`; `order N`; implicit creation on first use; `create`; `box ... end box`.
- **Messages:** `->`, `-->`, `->>`, `->x`, `->o`, `<-`, `<->`, colored `-[#red]>`, found/lost messages (`[->`, `->]`), self-messages, `\n` in labels, activation shorthand (`++`, `--`, `**`, `!!`), and compact parallel groups with `&`.
- **Structure:** `alt/else`, `opt`, `loop`, `par`, `break`, `critical`, `group` (arbitrarily nested); single- and multi-line notes (`note`, `hnote`, `rnote`; `left/right of`, `over A,B`, `across`); single- and multi-line `ref over`; `activate`, `deactivate`, `destroy`, `return`; `== divider ==`, `... delay ...` with dotted lifelines, `|||` and `||N||` spacing.
- **Document level:** `title`, `header`, `footer`, `newpage` with independent titled scenes and page selection, `autonumber` (start, step, format, stop, resume), `hide footbox`, `skinparam` (flat and block forms).
- **Inline markup:** Creole `**bold**`, `//italic//`, and `<color:name>text</color>`, including nested styles and style-aware measurement.
- **Skipped with a warning:** `!` directives, `legend`, `autonumber inc`.

### 5.3 AST decisions

- **Arrows are normalised.** `A <- B` becomes `from=B, to=A` with the head on the end, so layout only ever draws left-to-right or right-to-left from `from` to `to`. Bidirectional arrows carry both `startHead` and `endHead`.
- **Endpoints can be edges.** `[->` and `->]` are represented as edge endpoints (left or right of the diagram), not as fake participants.
- **Activation shorthand is recorded verbatim** on the message; layout decides what it does.
- **Fragments hold sections.** The first section is the opening branch; each `else` adds one. Each section owns its events.

### 5.4 Known parsing ambiguities

- `A ->oscar B` with no space reads `o` as a circle head. Spaced input, which is nearly all real input, is unaffected.
- A participant named like a keyword (`loop`, `alt`) can be misread in rare cases.
- Only the first `@startuml` block in an input is parsed.
- `newpage` inside a fragment is not supported and produces a warning.

## 6. Layout

Layout takes the AST, a theme and a text measurer, and produces a `Scene`: a flat list of positioned shapes plus a viewBox and any layout warnings.

### 6.1 Pre-pass

A depth-first walk of all events computes autonumber prefixes (one per message and `return`), the set of participants created mid-diagram, and the column-spacing constraints.

### 6.2 Column spacing

Each participant gets a column. The distance between adjacent centers starts at the larger of a minimum gap and the box widths plus padding. Then constraints are relaxed, **shortest span first**:

- A message between participants i and j needs the center distance to be at least the label width plus padding.
- A self-message needs room on its right for the loop and the label.
- Notes need room to their left, right or both, depending on position. A note over several participants needs the span to cover its width.

When a span is too narrow, the deficit is distributed evenly across the gaps it covers. Processing short spans first avoids over-widening columns that a longer span would have widened anyway.

### 6.3 Vertical pass

A y cursor walks the events top to bottom. A message occupies label height, then a small gap, then the arrow row. Notes, fragments, dividers, delays and spacing advance the cursor by their own heights.

**Activations.** Each participant has a stack of open bars. Nested bars shift right. Arrows attach to the nearest bar edge on the correct side. A look-ahead treats `activate X` immediately after a message to X as `++` on that message, so the arrowhead lands on the bar edge rather than under it.

**Call stack for `return`.** Messages that activate a target push a `{caller, callee}` pair. `return` pops one and draws a dashed message from callee back to caller, closing the callee's bar. An explicit `--` or `deactivate` also removes the matching call, so a later `return` returns to the right place. A `return` with no active call produces a warning.

**Created and destroyed participants.** A created participant's box is drawn at the row of the message that creates it, and the arrow ends at the box edge. A destroyed participant gets an X, its lifeline ends there, and it has no footer box.

**Fragments.** The horizontal extent is the union of everything inside it (including nested fragments), expanded by padding, so nesting insets automatically. The vertical extent is filled in after the contents are laid out. Each `else` adds a dashed divider with its label.

**Edge messages.** The arrow length for `[->` is long enough for its label, measured from the leftmost (or rightmost) participant.

### 6.4 Bounds

Bounds are tracked as shapes are emitted, then widened for the title, header and footer if those are wider than the diagram. The SVG viewBox may start at a negative x; no shifting pass is needed.

**Pages and parallel groups.** `layoutPages` splits top-level `newpage` events into independent scenes; the app and calibration tool select the active scene, and exports contain only that page. Messages prefixed with `&` use compact rows 20 px below the preceding message, matching the reference renderer.

## 7. Rendering and the classic theme

The renderer turns a `Scene` into one SVG string. It draws in layers: participant groups, lifelines, activation bars, then everything else, so arrows are never hidden by bars.

The classic look is expressed as theme tokens:

- Participant boxes: pale yellow fill (`#FEFECE`), dark red-brown stroke (`#A80036`), small corner radius.
- Notes: pale yellow (`#FBFB77`) with a folded corner; `hnote` is a hexagon and `rnote` a plain rectangle.
- Lifelines: thin and dashed. Activation bars: white with the same stroke.
- Fragments: unfilled, dark stroke, a pentagon-cornered grey tab with a bold keyword, and dashed `else` dividers with bold bracketed labels.
- Dividers: double horizontal line with a boxed bold label.
- Arrowheads: filled, open (thin), half, cross and circle variants. Dashed shafts for `-->`.
- Participant kinds have distinct icons: actor stick figure, database cylinder, boundary, control, entity, stacked collections, rounded queue.
- Participant boxes appear at the top and bottom unless `hide footbox`.

`skinparam` values for arrow color, lifeline color, participant and note colors, background, and default font name and size are applied as overrides on a cloned theme. Message labels are left-aligned at the left end of the arrow, and autonumbers are bold prefixes.

Color strings accept both `#red` and `#FF0000`. The renderer converts the former to CSS-valid `red`.

**Theme selection.** Classic remains the reference-compatible default. Modern uses indigo strokes, rounded participant boxes, softer fills, and more generous spacing. Hand-drawn uses a warm paper palette and deterministic irregular SVG paths for lines, boxes, fragments, and self-messages; its geometry is stable across renders and PNG exports. All themes share the bundled font and accurate canvas measurement. `skinparam` overrides are applied to a clone of the selected base theme.

## 8. App shell

- **Editor.** CodeMirror 6 with a small stream-language tokenizer for PlantUML. Autocomplete suggests supported keywords and participant aliases, quoting names that contain spaces. Parser and layout warnings appear as gutter markers and in a clickable warnings panel that navigates to the source line.
- **Preview.** Wheel-zoom and drag-pan on a transformed stage. A drag does not trigger a click. Fit-to-pane on first render and via a button.
- **Click to source.** Every message, note, fragment, divider and participant carries `data-line`; clicking selects that line in the editor.
- **Rendering cadence.** Edits re-render after a 120 ms debounce. Layout is synchronous and fast for typical diagrams; if it becomes a bottleneck it can move into a Web Worker.
- **Persistence and files.** The last diagram and selected theme are stored in `localStorage` (guarded for private mode). A diagram in the URL hash takes priority on load. Open and Save use the File System Access API where available, retaining the opened handle for subsequent saves; other browsers use a file input and `.puml` download.
- **Sharing.** The text is compressed with `CompressionStream('deflate-raw')`, base64url-encoded, and kept in the hash as `#d=...`. Hashes are never sent to a server. Corrupt or foreign hashes are ignored.
- **Export.** SVG is a standalone file with the fonts embedded. PNG rasterises that SVG at 2x on a canvas. PDF uses the browser print dialog with print CSS that shows only the diagram.

### 8.1 ER diagrams

`isErDiagram` selects the ER pipeline for entity blocks, enums, and crow's-foot relationships. A bare `entity E` remains a sequence participant because that syntax is ambiguous. `parseEr` supports aliases in either order, colors, required and visibility prefixes, attribute types, `<<PK>>`, `<<FK>>`, `<<UK>>`, enum members, solid and dashed relationships, labels, and implicit entities referenced by relationships.

The initial layout measures each entity table and places entities in a declaration-order grid. Relationships connect rectangle borders, with self-relationships rendered as loops. The renderer draws one/zero-one/one-many/zero-many markers and entity tables in Classic, Modern, or Hand-drawn. Warnings, autocomplete, click-to-source, persistence, sharing, and SVG/PNG export use the same shell as sequence diagrams.

Current ER limits are declaration-order rather than crossing-optimized placement, straight relationship paths between different entities, no packages, inheritance, or multiline titles, and no sequence-style `newpage` splitting.

## 9. Privacy and security model

The site is static: no backend, no API routes, no analytics, no remote fonts or scripts. `vercel.json` sets the following headers on every response:

```
Content-Security-Policy:
  default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:; font-src data:; connect-src 'none';
  object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
```

`connect-src 'none'` means the browser blocks `fetch`, XHR and WebSocket even if a bug or dependency tried to use them. Automatic storage is limited to the user's own `localStorage` and URL hash; local files are read or written only through explicit Open and Save actions. The header badge states the guarantee in the UI.

Fonts are bundled as inlined data URIs (hence `font-src data:`). Because exports embed the same fonts, an exported SVG renders identically anywhere, including when rasterised.

User input is treated as untrusted: all text is XML-escaped before entering SVG, and diagram text never reaches `innerHTML` unescaped (warnings are escaped before display).

## 10. Testing and calibration

**Unit tests (Vitest).** The parser tests cover participants, arrows, structure, autonumber, skinparam, boxes and error tolerance. The layout tests cover vertical ordering, column widening, the `return` call stack, and SVG escaping with `data-line`. The share tests cover round-trip, large input, and rejection of corrupt hashes. Completion tests cover keywords and participant aliases; file tests cover native handles and browser fallbacks.

**Fixture corpus.** Fifty-five original diagrams in `src/fixtures/corpus.ts` cover supported syntax, realistic combinations, spacing stress cases, and error recovery. `src/fixtures/fixtures.test.ts` stores each fixture's Classic AST and SVG snapshots and smoke-renders every scene with Modern and Hand-drawn as well. Any diagram a user reports as broken becomes a new fixture.

**Calibration page.** `calibration.html` is a Vite development-only entry point and is excluded from the production build. It downloads a fixture's `.puml` source, accepts a PNG rendered by real PlantUML on the developer's own machine, and provides side-by-side, flip, overlay, and opacity controls. Nothing is uploaded. Initial calibration against PlantUML 1.2023.13 covered basic messages, activation, notes, long labels, autonumbering, and realistic flows; it reduced the outer margin from 10 to 5 px and removed a duplicate trailing margin. Spacing and proportion matter more than color for the "feels right" factor: box padding, row spacing, lifeline overshoot, label alignment and arrowhead geometry. These are all theme numbers, so tuning is cheap.

**ER fixtures.** Four initial examples in `src/er/fixtures.ts` cover attributes and keys, aliases and cardinalities, enums and self-relationships, and tolerant recovery. AST and Classic SVG snapshots are stored in `src/er/snapshots/`; every example also renders with Modern and Hand-drawn.

**Current verification status.** All 109 unit and fixture snapshot tests pass. The Vite production build and app shell have been exercised in Chromium: editing, sequence and ER autocomplete, warning-panel navigation, click-to-source, persistence, share-link restoration, theme switching, and themed sequence/ER SVG and PNG export work. Native file handles and file-input/download fallbacks have focused tests; OS file-picker interaction still needs manual verification outside the built-in test browser. Fixture switching, source download, local PNG loading, calibration comparison controls, Creole styling, parallel messages, dotted delays, and multipage selection/export also pass browser checks. Initial reference-based theme tuning is complete; Vercel CSP headers, print/PDF, and Safari PNG export still need deployment/device verification.

## 11. Licensing and provenance

- The renderer is clean-room. It reproduces the look from observation (shapes, rough colors, proportions) and uses no PlantUML code, sprites or generated assets, which carry their own licenses.
- Liberation Sans (Regular and Bold) is bundled under the SIL Open Font License 1.1, subset to Latin. The OFL text should ship with any redistribution of the font files.
- Dependencies: CodeMirror 6 and Lezer (MIT), Vite and Vitest (MIT), TypeScript (Apache-2.0).

## 12. Decisions that need checking

These are choices made from memory or inference that should be verified against real PlantUML output during calibration.

| Decision | Current behaviour | How to verify |
| --- | --- | --- |
| `participant Foo as Bar` (neither quoted) | `Foo` is the label, `Bar` is the id | Compare references in later messages |
| Half arrowheads (`\`, `/`) | Both draw the upper half | Compare against `A -\ B` and `A -/ B` |
| Note `left`/`right` position | 6 px from the lifeline, ignoring bar offsets | Compare notes beside activated participants |
| Row spacing, box padding | Estimated | Overlay on the calibration page |

## 13. Roadmap

1. **Verify the app end to end.** Install dependencies, fix any Vite/CodeMirror wiring issues, confirm fonts and CSP behave in a Vercel preview, check PNG export on Safari.
2. **Fixture corpus and calibration page.** Built and initially calibrated against local PlantUML 1.2023.13 reference renders.
3. **Tier 2 syntax.** Implemented Creole inline markup (`**bold**`, `//italic//`, `<color>`), `newpage`, multi-line `ref`, parallel messages (`&`), and dotted lifelines inside delays.
4. **Editor polish.** Implemented autocomplete for keywords and participant names, a clickable warnings panel, and file open/save via the File System Access API with browser fallbacks.
5. **Themes.** Implemented Modern and Hand-drawn themes alongside Classic, with a persisted UI selector and themed exports.
6. **PWA.** Service worker so the app works fully offline after the first load.
7. **Performance.** Move layout into a Web Worker if large diagrams make typing laggy.
8. **ER diagrams.** Implemented the initial entity, attribute, relationship, automatic-layout, theme, editor, and export pipeline. Next: crossing reduction, orthogonal routing, packages, and richer ER syntax.

## 14. Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Syntax drift from real PlantUML on edge cases | Pasted diagrams look wrong | Tolerant parser, fixture corpus, warnings instead of failures |
| Text widths differ from rendered widths | Clipped or overlapping labels | Bundled font, measure only after font load, same font embedded in exports |
| Look is close but not close enough | Users distrust the output | Calibration page, theme-as-data for rapid tuning |
| Editor and build wiring untested | Delays the first usable release | Roadmap item 1 comes first |
| Scope creep into other diagram types | Dilutes quality | Explicit non-goal; revisit after sequence diagrams are solid |

## 15. Open questions

- Is a visual-to-text direction (drag a message to reorder, edit the source) worth building, or does it belong in a later phase?
- Should the hand-drawn theme use rough.js, or a lighter custom jitter to avoid a dependency?
- How much Creole is needed in practice? A survey of real diagrams would help prioritise.
- Do we want a compatibility report ("N of M lines understood") in the UI to build trust with pasted diagrams?
