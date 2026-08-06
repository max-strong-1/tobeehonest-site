# DESIGN.md — To Bee Honest

## World
Torn-paper scrapbook collage, softened. Every surface reads as layered paper: torn edges, slight rotation, paper texture, drop shadows with real offset. Founder's own art is the imagery; UI chrome is built from the same paper grammar (no stock cards, no flat rectangles).

## Palette (from logo + IMG_5791 target saturation)
- `--paper`: #f7efe2 (warm cream ground — pinned by founder's "toned down, softer, warm, pastel")
- `--paper-deep`: #eadfca
- `--honey`: #d99a2b (primary accent — logo amber)
- `--sun`: #f2c94c (warm yellow)
- `--bloom`: #e8b64c (flower gold)
- `--bark`: #6b4b28 (brown — logo ring; headings/ink)
- `--ink`: #46351f (body text on paper, ≥4.5:1)
- Muted arc tones (backgrounds only, heavily desaturated): terracotta #d98d68, sage #a9b380, dusty blue #92a8bd, mauve #b393a8
- Strategy: **Full palette** — paper field owns regions, arc tones band whole sections like the collage's concentric rings

## Type
- Display: **Caprasimo** — chunky, soft, paper-cut feel (soft-3D dimensional per operator taste)
- Hand accents / mantras: **Shantell Sans** — childlike excitement, conversational
- Body: **Alegreya** — warm book-face, 65–75ch measure
- No Inter, no banned defaults

## Components
- **Paper panel**: torn-edge container (mask/clip-path with irregular polygon), 1–2° rotation, layered shadow (offset + blur)
- **Tab-as-bookmark nav**: top nav = paper bookmarks tucked behind the page edge; active tab pulls forward
- **Page-turn reveal**: section entrances lift like a lifted scrap tier — clip-path + rotate on scroll, exponential ease-out, content visible by default
- **Mantra card**: CSS-built torn-paper card in deck ratio, real printed front art, back = approved softened sky-only hero
- **Buttons**: paper tags with punched-hole + string look; hover = lift (translate + shadow deepen)

## Motion
One orchestrated moment: hero collage layers drift apart subtly on load/scroll (parallax tiers, like lifting scrapbook layers). Everything else restrained: lifts, page-turn section reveals honoring `prefers-reduced-motion`.

## Assets
- `assets/IMG_5110.PNG` hero tower collage
- `assets/IMG_5190.jpeg` logo
- `assets/IMG_5791.jpeg` pastel collage (section background material)
- `assets/IMG_5577.jpeg` physical print photo (about/provenance)
- Card sheet screenshots (IMG_5582/5634/5635) are print-preview captures — NOT shipped; mantra cards rebuilt in CSS from their content

## Never
Gradient text, glass blur decoration, icon-tile cards, eyebrow-on-every-section, section numbers, hype copy. Voice = story/conversation, never lecture.
