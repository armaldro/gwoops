# Backlog

Superseded by [REQUIREMENTS.md](./REQUIREMENTS.md), which carries every item
below as a numbered requirement with acceptance criteria and priority.

Kept only as a map from the old prose to the new IDs:

| Was | Now |
|---|---|
| Toys/kids tailored schema | FR-CAP-1 (the category exists; its attribute set is still generic) |
| Barcode and QR scanning | FR-CAP-13 |
| Receipt OCR | FR-CAP-14 |
| Multi-photo items | FR-CAP-15 |
| Native share target | FR-CAP-16 |
| Per-home capacity limits | FR-PLAN-10 |
| Household currency setting | Open question 4 |

The toys attribute set, spelled out, since it is the one item that lost detail
in the move. Add to `packages/domain/src/categories.ts`:

- `age_range` — select: `0-6m`, `6-12m`, `1-2y`, `2-4y`, `4-6y`, `6-9y`, `9-12y`, `12+`
- `set_pieces` — number
- `battery_type` — select: `AA`, `AAA`, `C`, `D`, `9V`, `built-in`, `none`
- `safety_notes` — text
- `character` — text
- `balanceBy: ['type', 'age_range']`, so a rebalance does not send every
  toddler toy to one home and every board game to the other
