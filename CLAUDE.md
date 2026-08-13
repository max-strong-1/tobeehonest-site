# CLAUDE.md — To Bee Honest site

Read `README.md` (entry points, deployment rules), `PRODUCT.md` (brand, products, audience), and `DESIGN.md` before making changes. Pushing to GitHub is NOT authorization to deploy — deployment to Vercel is a separate, explicit action.

## Stripe (accounts / commerce)

The book and mantra card deck are not yet purchasable — current CTAs are waitlist only. When commerce work starts, use Stripe with the agent-first tooling below.

- **Stripe MCP server** — wired in via `.mcp.json` (remote server at `https://mcp.stripe.com`). Approve it when Claude Code prompts on session start; authenticate with the To Bee Honest Stripe account. Gives agents read/write access to Stripe resources and doc search.
- **Docs as Markdown** — append `.md` to any `docs.stripe.com` URL for plain-text output (e.g. `https://docs.stripe.com/agents.md`).
- **Agent skills** — machine-readable catalog at `https://docs.stripe.com/.well-known/skills/index.json`; with the Stripe CLI installed, `stripe agent setup` installs the recommended set.
- **Reference notes** — `STRIPE.md` in this repo summarizes how Stripe's agent components fit this project.
