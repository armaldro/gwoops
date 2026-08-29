# Backlog

Deliberately deferred, with the reasoning, so nothing here is a surprise later.

## Toys, Kids & Baby Gear — tailored schema

The `toys` category exists and works today under the generic schema (type,
brand, colours). What it does not have is its own attribute set. When it earns
one, the fields to add in `lib/categories/schemas.ts` are:

- `age_range` — select: `0-6m`, `6-12m`, `1-2y`, `2-4y`, `4-6y`, `6-9y`, `9-12y`, `12+`
- `set_pieces` — number, for anything that arrives as a set
- `battery_type` — select: `AA`, `AAA`, `C`, `D`, `9V`, `built-in`, `none`
- `safety_notes` — text: small parts, recalls, age warnings
- `brand`, `character` — text, for the "we already have three of these" case
- `balanceBy: ['type', 'age_range']` — so a rebalance does not send every
  toddler toy to one house and every board game to the other

Adding those fields is the whole change: the vision prompt, the review sheet and
the inventory facets all read from that one definition.

## Other candidates

**Barcode and QR scanning on capture.** For electronics and packaged goods, a
barcode resolves brand and model exactly rather than probably. Worth it once
there are enough boxed items to matter.

**Receipt OCR.** Photograph a receipt, get purchase date, price and warranty
start filled in across several items at once. The single biggest lever on the
insurance export being genuinely complete.

**Native share target.** Register the PWA as a share target so a photo can go
from the camera roll into Nest without opening the app first.

**Per-home capacity limits.** The distribution algorithm already accepts
weights; exposing "this flat only has one wardrobe" as a real constraint would
let it refuse an over-stuffed plan rather than proposing one.

**Multi-photo items.** The schema supports several photos per item
(`item_photos`), and the detail page renders them, but capture only ever
attaches one. Adding more from the item page is a small gap.

**Household currency setting.** `SGD` is currently the default in two places
(the recognition prompt and the assistant context). It should be a column on
`households`.
