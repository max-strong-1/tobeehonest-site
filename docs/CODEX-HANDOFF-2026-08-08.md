# Codex handoff — To Bee Honest site
**Written 2026-08-08 by Claude (Foreman AI) for Codex.** Operator: Kel (Max Strong), Foreman AI.
Client: Nicolas Bettinger, To Bee Honest LLC, Panama City Beach FL.

Read this whole file before touching anything. Sections 0–2 are context you need to not break
things. Section 3 is the actual work, in priority order.

---

## 0. Where everything lives

| Thing | Path |
|---|---|
| Repo | `~/tobeehonest-site` (git, no GitHub remote — Vercel CLI deploys) |
| **The entire site** | `~/tobeehonest-site/index.html` — one file, inline `<style>` + inline `<script>`, ~2100 lines |
| Serverless API | `~/tobeehonest-site/api/` (`order-intent.js`, `marketplace-submit.js`, `_lib/`) |
| Tests | `~/tobeehonest-site/test/` — `npm test`, **34 tests, all must stay green** |
| Design intent | `~/tobeehonest-site/DESIGN.md` (⚠️ ~30 commits stale — see §4) |
| Product truth | `~/tobeehonest-site/PRODUCT.md` |
| Today's state | `~/tobeehonest-site/docs/HANDOFF-2026-08-08.md` |
| **The standalone frame viewer** | `~/client-reviews/to-bee-honest/2026-08-05-frame-viewer/` |
| Screenshots you produce | `~/client-reviews/to-bee-honest/<YYYY-MM-DD>-<topic>/` |

**Never put images, screenshots or renders in `~/the-vault`.** Standing operator rule. Media
lives in `~/client-reviews/` or Google Drive.

### Build / deploy

```bash
cd ~/tobeehonest-site
npm test          # 34 tests — must pass before any commit
vercel --yes      # deploys a PREVIEW url
```

**Do NOT run `vercel --prod`.** Production is `tobeehonest.com` and promoting it is Kel's call
alone. Ask; do not infer permission.

### Environment — already configured, do not change

`AIRTABLE_TOKEN`, `AIRTABLE_BASE_ID`, `RESEND_API_KEY`, `ORDER_ALERT_TO` are all set in Vercel
across production / preview / development as of 2026-08-08. All five forms are verified working
end to end.

⚠️ **`ORDER_ALERT_TO` is scoped per environment on purpose.** preview + development →
`kel@4manai.com` only. production → Nicolas + Kel. On 2026-08-08 a wiring test ran before this
was set and delivered five "WIRING TEST / DELETE ME" emails straight to the client. If you fire
any synthetic submission, pass an explicit `to` to `sendOrderAlert` — do not trust ambient
config, and never test against production.

---

## 1. What the site is

Single page. Eight full-viewport **tiers** stacked in `#stack`, navigated by a **honeycomb** on
the cover — seven hex cells carrying `data-jump="t-…"`, calling a global `go()`. A persistent
"Back to the Honeycomb" tag sits in every tier. There is no document scroll; each tier scrolls
internally.

Tiers: `t-cover`, `t-book`, `t-deck`, `t-gallery`, `t-story`, `t-yours`, `t-podcast`,
`t-market` (with the hive signup `t-join` at its foot).

**Modes** (impeccable's frame — what visitor success means on a surface):
everything is **Persuade** except `t-gallery`, which is **Experience** (the artwork leads from
the first viewport; the interface recedes), and `t-story` / `t-podcast`, which are **Read**.

Brand: torn-paper scrapbook collage. Every image is Nicolas's own art. Voice is story and
conversation, never lecture. Type: Caprasimo (display), Shantell Sans (hand), Alegreya (body).

---

## 2. Evidence you are working from — don't re-derive it

An `impeccable critique` ran 2026-08-08 across three builds, blind, on one rubric
(Nielsen 10 scored 0–4, heuristic 10 marked n/a on these Persuade/Experience surfaces).

| Build | Score | Band |
|---|---|---|
| **Live `tobeehonest.com`** | **26/36 — 72%** | **Good** |
| `interim.html` (a construction teaser, not a real site) | 22/36 — 61% | Acceptable |
| **Current `index.html`** | **19/32 — 59%** | Acceptable |

**The live site beats what we are building.** The measured reason:

| Artwork as % of first viewport | Live | Current |
|---|---|---|
| Gallery, desktop | **32.4%** | **13.7%** |
| Gallery, mobile | 37.2% | 28.6% |
| Cover | **~62%** | art pushed to the right half behind a cream scrim |

The live cover treats the collage as the **page background** and lays the copy panel and
honeycomb *on top of it*. Ours puts the art in a slot beside a panel. That single inversion is
most of the 13-point gap: a layout that only works with *this* artwork cannot read as a template.

Where the **current** build is genuinely better, and which must not be lost:
- a working **3× magnifier lens** in the viewer (live has none at all)
- a viewer that **live-previews frame + mat** on the real print (live's configurator has three
  appearance controls that render nothing — you pick a $429 framed object sight-unseen)
- five forms wired to Airtable + Resend (live has none)

So this is **not a revert.** Take the art-forward composition from live; keep the commerce and
the lens we built.

Full critique screenshots: `~/client-reviews/to-bee-honest/2026-08-08-critique-{current,live}/`

---

## 3. The work, in priority order

Do these in order. Commit after each. `npm test` green before every commit. Screenshot before
and after at **390×844 and 1440×900** and actually look at the images — do not judge from source.

### Task 1 — Cover: make the art the ground (highest value)

**Problem:** `t-cover` puts the hero collage in the right half behind a cream scrim so a copy
panel can sit beside it. It is the brand's best asset doing background duty.

**Do:** rebuild the cover so the collage is full-bleed page background, with the torn-paper copy
panel and the honeycomb laid over it with no containers and no backing plates. The honeycomb
should read as another scrap in the composition, not as UI floating above artwork.

**Acceptance:** artwork ≥55% of the first viewport at 1440×900, measured (sum the artwork element
rects, subtract overlaying panels). Mobile: the copy panel must not cover the collage — shrink it
or make it semi-transparent, and lift the honeycomb so **at least two full rows clear the fold**.
Today the mobile cover apologises for its own navigation with the line "the honeycomb is down
here ↓" — when a design has to write directions to its own nav, delete the directions and fix
the nav.

### Task 2 — Gallery: cut the chrome

**Problem:** 86% of the only Experience surface is not the artist's work. The gold frames are
wider, brighter and higher-contrast than the images inside them, so attention lands on the frame
first. Chrome is the composition.

**Do:** first viewport goes to **two pieces at large scale** instead of four small. Drop the
per-frame "click to see it closer" captions to hover/tap-only. Move the hang toggle and the
"walls are dark on purpose" line below the first row. Reduce the frame face width — the gold
currently reads as brass, not antique gilt.

**Acceptance:** artwork ≥60% of the gallery's first viewport on desktop; ≥60% for a single piece
on mobile. Keep the dark wall — it is a deliberate lighting change and it works; it is the
*frame furniture* that is over-scaled, not the wall.

### Task 3 — Port the standalone frame/mount viewer into the site

This is the one Kel specifically asked for, so read this carefully.

**Origin:** a standalone HTML built 2026-08-05 and sent to Nicolas to explain the frame/mount
problem — how prints with and without a mount get **cropped at particular sizes**, and what each
combination looks like **on a wall**. It lives outside the site and needs to come in.

**Source files** — `~/client-reviews/to-bee-honest/2026-08-05-frame-viewer/`:

| File | Size | What it is |
|---|---|---|
| `decision.html` | 56 KB | The fullest version — mount/crop explanation + wall context + lens. **Start here.** |
| `viewer.html` | 31 KB | "choose your frame" — the interactive configurator |
| `index.html` | 24 KB | Frame options + the mount decision, no lens |
| `*.build.html` | ~700 KB | Self-contained twins with images inlined (what was emailed to Nicolas) |
| `build.py`, `strip_frames.py`, `publish_prints.py` | — | The scripts that produced them |
| `ARTWORK-MANIFEST.md` | — | Which artwork maps to which asset |

**Do:** read `decision.html` first and inventory what it explains that the live site's viewer does
not. Port the *explanatory* capability into the site's existing `<dialog id="galleryOrderDialog">`
— specifically the mount-vs-no-mount comparison and the size-cropping explanation, which is the
single most common print-buying disappointment and the thing this file was built to prevent.

**Do not** wholesale-replace the site's viewer. It already has the 3× lens and live frame/mat
preview that `decision.html` does not. Merge toward the union.

**Keep the honest copy already in the site:** *"the size on the label is the print itself, not the
frame around it."* Sizes are **locked**: `8x12` $249 · `12x18` $279 · `16x24` $429. These strings
are byte-matched across `index.html` `TBH_PRICES`, the Zod enum in `api/order-intent.js`, and the
Airtable `Size` select. **Do not rename them anywhere.**

### Task 4 — URL state

**Problem:** `history.length` never changes, `location.href` never changes, and browser Back
**exits the site entirely**. No tier is linkable, shareable or bookmarkable. You cannot send a
collector "the gallery," and Nicolas cannot link the deck in a bio.

**Do:** `history.pushState` a hash per tier inside `go()`, restore on `popstate`, read the hash on
load. Small change, disproportionate return.

**Acceptance:** `tobeehonest.com/#gallery` opens the gallery directly; Back steps through visited
tiers and only leaves the site from the cover.

### Task 5 — Brief violations (cheap, do last)

- `DESIGN.md` bans **section numbers**. Every honeycomb cell renders `01`–`07`. Remove, or get
  Kel to amend the brief — do not silently keep both.
- **`IBM Plex Mono` at `index.html:740`** on `.viewer-room .roomcap`. That is *Foreman AI's own*
  brand mono on the client's site. Replace with the brand stack.
- **Flat rectangles** are on the Never list, but every form field, mat and the viewer side panel
  is one. Bring the paper grammar into the form components.
- Arc tones are specified "backgrounds only, heavily desaturated"; the deck faces use them as
  full-saturation foreground gradients.

---

## 4. Traps that have already cost time today

1. **`.tag-btn{display:inline-flex}` defeated the `hidden` attribute.** `hidden` is only a
   *user-agent* `display:none`, the weakest cascade origin — any author `display` rule beats it.
   Fixed with `.tag-btn[hidden]{display:none}`. Watch for this pattern elsewhere.
2. **`#t-book .book-grid` (id) beat `.two-col,.book-grid` (class) inside a media query**, so a
   desktop 2-column layout survived to 375px. Check specificity before assuming a media query won.
3. **The impeccable hook reads its config from `process.cwd()`, not from the file it scans.**
   Config written to `~/tobeehonest-site/.impeccable/` was ignored because the shell's cwd was
   elsewhere. A `dark-glow` waiver and a `hooks off` both silently did nothing for hours.
4. **`DESIGN.md` is ~30 commits stale.** It documents a "tab-as-bookmark nav" that was deleted and
   a "page-turn reveal" that was never built, and says nothing about the Gallery, the viewer, the
   room view or the 3D book — the most-worked surfaces on the site. Treat it as *stated intent*,
   not as a description of what exists. Re-baselining it is a good final task.
5. **Known false positive:** `#viewerArt` inside `<dialog>` has no `src` at rest — it is populated
   by JS on click. The detector flags it as `broken-image` every run. Leave it.

---

## 5. impeccable

Impeccable was upgraded on 2026-08-08 from a hand-installed 4.0.2 skill to the **official
Claude Code plugin, 4.0.4** (`pbakaus/impeccable`, Apache-2.0). The old copy at
`~/.claude/skills/impeccable/` **no longer exists** — do not reference that path.

**Codex installs its own copy.** From the repo root:

```bash
cd ~/tobeehonest-site
npx impeccable install --providers=codex --scope=project
```

That writes `.codex/` skill files plus `.codex/hooks.json`. Then open `/hooks` and approve the
project hook — Codex tracks trust by hook definition, so it will re-prompt after any update.

Then, before starting work:

```bash
node .codex/skills/impeccable/scripts/context.mjs --target index.html
```

(adjust the path to wherever the installer put the skill). Follow its directives and do not
rerun it.

4.0.4 ships **23 commands**, **59 deterministic detector rules**, and four helper agents
(`impeccable-manual-edit-applier`, `impeccable-asset-producer`, `impeccable-documenter`,
`impeccable-finish-reviewer`). The critique flow wants two isolated sub-agents — one design
review, one detector/browser evidence — and a single-context run must be banner-flagged
`⚠️ DEGRADED`. Load the playbook that owns each task — `layout` for
Task 1–2, `craft`/`new-work` for Task 3, `polish` for Task 5 — and load `craft-floor.md`
immediately before editing UI.

**The brief wins.** Nicolas pinned "way toned down, softer, warm, pastel" and the torn-paper
world. Do not redirect it toward your own taste, and do not change intentional design to satisfy
a detector.

Re-run `critique` at the end and report the new score against the 19/32 baseline. The goal is to
beat the live site's **26/36**.

---

## 6. Open questions for Kel — do not guess these

1. **Is the gallery/deck artwork actually torn-paper collage?** The viewer subtitle calls every
   piece "original torn-paper collage," but the deck faces include a photo-real infinity pool and
   a mirror selfie, and the gallery pieces read as several different media. An artist will notice
   this in four seconds. Needs Nicolas.
2. **Does the Marketplace deserve a honeycomb cell?** It is 1 of 7 top-level destinations, the
   longest tier on the site, opens by telling the visitor nothing exists yet — and the site's most
   valuable conversion (the hive email signup) is buried at its foot.
3. **The Story tier has zero CTAs.** It is the emotional peak of the site and a dead end. One
   paper tag at the foot of the pull-quote — "then come see the room" → gallery — would fix it,
   but the destination is a judgement call.
4. **`Make It Yours` on the live site resolves to `mailto:kel@4manai.com`** — the agency's address
   on the client's site. The current build has a real form; confirm the live one gets replaced.
