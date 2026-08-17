# STRIPE.md — Stripe agents reference for To Bee Honest

Source: https://docs.stripe.com/agents/how-it-works (append `.md` for Markdown output).
Captured 2026-08-13. Longer note lives in the `brain-dump` repo (`stripe-agents-for-tbh.md`).

Stripe's agent support is three independent components. What matters for this project:

## 1. Agent developer tools — use now

Wired into this repo via `.mcp.json` (Stripe MCP server at `mcp.stripe.com`). Also available:

- Agent skills: `stripe agent setup` via the CLI, or the catalog at `https://docs.stripe.com/.well-known/skills/index.json`
- Stripe CLI for managing resources, triggering test events, tailing logs

These help us (the developers) build the integration. They don't process payments themselves.

## 2. Payments / commerce — when products launch

The Sun Stone Theory book and the mantra card deck are physical, one-time-purchase products. When they become purchasable:

- Start with standard Stripe Checkout / Payment Links — simplest fit for a static brand site (a Payment Link needs zero backend).
- Usage-based Billing (token metering, tiers) is for metered AI apps — not this project unless a paid digital offering appears.

## 3. Agentic commerce — later, optional

Lets AI agents discover and buy products on behalf of customers (product feeds, shared payment tokens, Agentic Commerce Suite). Private preview / waitlist as of Aug 2026. Worth revisiting once the book and deck are actually sellable — being agent-discoverable could suit this brand — but nothing to build yet.

## Links

- Agents landing: https://docs.stripe.com/agents
- How it works: https://docs.stripe.com/agents/how-it-works
- Agentic commerce: https://docs.stripe.com/agentic-commerce
- Token billing (if ever needed): https://docs.stripe.com/billing/token-billing
