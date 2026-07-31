# To Bee Honest

Canonical source repository for the To Bee Honest website.

## Entry points

- `index.html` — public interim construction page.
- `interim.html` — editable mirror of the interim construction page.
- `index-pre-rev5-backup.html` — approved full website revealed through “Peek inside the hive.”
- `interim.css` and `interim.js` — construction-page presentation and behavior.
- `bee-cursor.css` and `bee-cursor.js` — isolated Ink bee cursor used by the approved website.
- `assets/` — current website media.
- `archive/` — recoverable superseded HTML revisions; not active entry points.

## Deployment

The local directory is linked to the Vercel project `tobeehonest-site`. Deployment is a separate, explicit action; pushing to GitHub should not be treated as authorization to deploy production.

## Source-of-truth rule

This repository is the canonical code source. The Foreman AI vault should contain project status, decisions, and links back to this repository—not duplicate website source files.
