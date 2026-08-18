#!/bin/zsh
# Creates the Express / International / Canada shipping rates in the TBH live
# Stripe account and registers each id as a Vercel prod env var, then redeploys.
# Amounts derive from live vendor quotes 2026-08-18 (see HANDOFF), padded per
# the price-more-not-less doctrine. Run once, by the operator.
set -e
cd "$(dirname "$0")/.."
KEY=$(grep -m1 '^sk_live' ~/.foreman-secrets/tbh-stripe.md)

make_rate() { # name display amount
  local id=$(curl -s https://api.stripe.com/v1/shipping_rates \
    -u "$KEY:" \
    -d display_name="$2" \
    -d type=fixed_amount \
    -d "fixed_amount[amount]=$3" \
    -d "fixed_amount[currency]=usd" | python3 -c 'import json,sys;print(json.load(sys.stdin)["id"])')
  echo "  $1 = $id ($2, ${3} cents)"
  printf '%s' "$id" | npx vercel env add "$1" production >/dev/null 2>&1
}

echo "US Express:"
make_rate STRIPE_SHIPPING_RATE_DECK_US_EXPRESS        "Express (3-5 days)"            4495
make_rate STRIPE_SHIPPING_RATE_PUZZLE_US_EXPRESS      "Express (2-4 days)"            3295
make_rate STRIPE_SHIPPING_RATE_FRAME_12X16_US_EXPRESS "Express (2-4 days)"            4495
make_rate STRIPE_SHIPPING_RATE_FRAME_16X24_US_EXPRESS "Express (2-4 days)"            4695
make_rate STRIPE_SHIPPING_RATE_FRAME_20X28_US_EXPRESS "Express (2-4 days)"            6995
echo "International (UK/EU/AU + more):"
make_rate STRIPE_SHIPPING_RATE_DECK_INTL        "International Standard" 1995
make_rate STRIPE_SHIPPING_RATE_PUZZLE_INTL      "International Standard" 2495
make_rate STRIPE_SHIPPING_RATE_FRAME_12X16_INTL "International Standard" 2495
make_rate STRIPE_SHIPPING_RATE_FRAME_16X24_INTL "International Standard" 2495
make_rate STRIPE_SHIPPING_RATE_FRAME_20X28_INTL "International Standard" 2495
echo "Canada:"
make_rate STRIPE_SHIPPING_RATE_DECK_CA        "Canada Standard" 1995
make_rate STRIPE_SHIPPING_RATE_PUZZLE_CA      "Canada Standard" 2495
make_rate STRIPE_SHIPPING_RATE_FRAME_12X16_CA "Canada Standard" 9995
make_rate STRIPE_SHIPPING_RATE_FRAME_16X24_CA "Canada Standard" 9995
make_rate STRIPE_SHIPPING_RATE_FRAME_20X28_CA "Canada Standard" 9995

echo "Redeploying…"
npx vercel deploy --prod --yes
echo "DONE — all three shipping zones live."
