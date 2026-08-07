# To Bee Honest — Rev-2 Restructure (post-Nicolas feedback, 2026-08-07)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Executes on branch `launch-48h` on top of the completed 48h-launch plan. Same review discipline.

**Goal:** Apply Nicolas's Aug-6 direction + Kel's edits: honeycomb nav, 7 sections, frameless mat-first gallery with hi-res art, deck/book/make-it-yours tab rework, framed-only product with mat choice.

**Sources of truth:** Nicolas email 2026-08-06 19:37 (-0700) + thread "The Moody Gallery — we need your original artwork files" (msgs 3-4) + Kel verbal directives (session 2026-08-06 late). Hi-res art ingested by Wave A (`.superpowers/sdd/2026-08-06-48h-launch/wave-a-report.md`).

## Global Constraints

- Brand spelling: **To Bee Honest** (Kel typed "To Be Honest"; brand pun stands unless Kel overrides).
- 7 sections only: The Story · The Book · The Mantra Deck · The Moody Gallery · Make It Yours · The Podcast · The Community Marketplace. The Hive becomes a SECTION INSIDE Marketplace (email signup form moves there, keeps its POST wiring). The Library tier is DELETED.
  - Slot-3 ambiguity in Nicolas's list ("The Matra Deck" twice) resolved as The Moody Gallery — he gave gallery directives in the same email, so it exists; flag to Nicolas in next recap.
- Cover: honeycomb nav (7 cells, interim.css 2/3/2 hex-cluster pattern + "Choose a cell to see what the bees are building" note) REPLACES the side tab rail on the cover. Section-to-section nav inside tiers keeps working (side rail may remain within non-cover tiers or be replaced by a compact hive glyph — implementer proposes, reviewer checks usability).
- Cover text: h1 becomes `Scrapbook for your inner world.` (drop "A"). Remove "or explore the tabs below ↘" entirely. Keep "Join the Hive" CTA (retarget to Marketplace hive section).
- Cover top-left: concentric-circles mark, PRESENT but INVISIBLE (opacity 0 or blend — keeps layout slot; Kel: "looks like a circle with circles inside it, but keep it invisible"), with wordmark text `To Bee Honest` beside it in the interim page's font stack (Shantell Sans / Caprasimo — match interim.css usage).
- Gallery display: NO frame graphics anywhere. Art + mat only. Mat displayed white by default; the two Red Bird pieces display with black mat (email: "red bird with white cloud, with black mat"). Wall stays dark, lamp glow KEPT but the hard glow/dark edge must be blended (gradient feather). ZERO mentions of the Mantra deck anywhere in the gallery section.
- Gallery product: **print + mat + frame only** — no print-alone. Order form: Format control dies (or hidden constant "Framed"); Mat colour choice White / Black; frame colour choice stays (Black / Antique Gold per Airtable launch set) but all on-site imagery shows gold.
- Gallery catalog: hi-res renditions from Wave A. 18 pieces available; Nicolas said "10 art pieces total" — build data-driven so trimming to his 10 is a one-line array edit; ship all 18 until his list arrives, flag in recap email.
- Deck tab: images = exactly his 4 cards + Tower of Knowledge card-back (×4 arrangement), nothing else. Copy verbatim from his email: "A mantra card a day? A card a break? 54 ways to add whimsy and self-reflection to your day." + "The Sun Stone Theory is a compact affirmation and consciousness card deck that invites you to tap dormant personal power through short, declarative passages and metaphors, at your own, on your own terms. Let's go on this playful adventure, shall we?" Keep "Order the Deck" button + order-capture wiring. NO mantra-card prints sold anywhere.
- Book tab: Butterfly Tower of Knowledge image (Gmail attachment, msg 19fd9a83ed024f34, attachment 2) faded background; book cover (assets/web/book-cover-hires.jpg) centered + elevated ("the book is basically salvation").
- Make It Yours: same butterfly background treatment + **Send Inquiry** button (mailto or small form → order-intent? — mailto:kel@4manai.com acceptable at launch; implementer picks simplest honest path).
- Backend: Gallery Airtable table gets `Mat` handling — schema: mat ∈ {"White","Black"} required; format fixed "Framed" server-side (reject "Print"). Airtable field "Mat Color" must be created (MCP create_field) or value rides in existing structure — coordinate before code.
- All prior global constraints from 2026-08-06-48h-launch.md still bind (no payment, placeholder prices, honeypots, no COMMERCE_* changes, commit trailer).

## Waves

- Wave A (running): hi-res ingestion → assets/prints/*.
- Wave B: Cover + structure (honeycomb nav, 7 tiers, Hive merge, Library delete, cover text/wordmark). One agent, index.html (+interim.css copy-in as needed).
- Wave C: Gallery rework (display + order form + catalog from Wave A slugs). After B (same file).
- Wave D: Deck + Book + Make It Yours tabs (incl. Gmail butterfly attachment download → assets/web/). After C (same file).
- Wave E: Backend mat/framed-only (api/order-intent.js + tests + Airtable field) — parallel with B/C/D (different files).
- Wave F: full sweep re-run + redeploy preview.

Each wave: task review + fix loop per subagent-driven-development. Ledger continues in `.superpowers/sdd/2026-08-06-48h-launch/progress.md`.
