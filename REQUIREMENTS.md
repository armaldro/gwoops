# Nest — Requirements

A working specification. Every requirement has a stable ID, a falsifiable
acceptance criterion, a priority and a status. IDs never change once assigned,
so commits and tasks can cite them.

| Status | Meaning |
|---|---|
| **Built** | Working in the codebase today. Verified against the code, not from memory. |
| **Planned** | Specified and buildable. Not started. |
| **Spike** | Needs research before it can be estimated. Do not plan around a date. |

| Priority | Meaning |
|---|---|
| **P0** | Without it the product does not function. |
| **P1** | Core value. Ship-blocking for the audience it serves. |
| **P2** | Clear benefit, deferrable. |
| **P3** | Worth doing eventually. |

---

## 1. Purpose & scope

Nest is a private inventory for a household whose belongings are spread across
more than one home. You photograph a thing; it gets named, categorised and
filed to the home you are standing in. Then you can ask where things are, and
ask for them to be redistributed sensibly.

The problem it solves is not "I own too much." It is **"I do not know what is
where, so I buy a second one, or arrive without it."**

**Explicitly not:**

- A shopping or wishlist app. It records what you own, not what you want.
- A home-security or valuation service. The insurance export is a convenience,
  not an appraisal.
- A social or sharing network. Inventories are private to a household.

---

## 2. Users & roles

Three roles, already enforced in the database (`member_role` enum, RLS
policies) rather than in application code.

| Role | Can | Cannot |
|---|---|---|
| **owner** | Everything, plus manage who has access | — |
| **member** | Add, edit, move, delete items; use the assistant | Manage the allowlist or members |
| **viewer** | Browse and ask questions | Change anything |

Primary users are two adults sharing a household across homes. A viewer is
typically a house-sitter or family member given temporary read access.

---

## 3. Functional requirements

### 3.1 Access & identity — `FR-AUTH`

| ID | Requirement | Acceptance | Pri | Status |
|---|---|---|---|---|
| FR-AUTH-1 | Sign-in is by emailed magic link; no passwords are stored | Submitting an allowlisted email sends a link that authenticates on click | P0 | Built |
| FR-AUTH-2 | Only allowlisted emails can hold an account | A signup for a non-allowlisted address is rejected **by the database**, not the app, so a valid link for a stranger still fails | P0 | Built |
| FR-AUTH-3 | Allowlist matching is case-insensitive | `Owner@Example.com` matches an allowlist entry of `owner@example.com` | P1 | Built |
| FR-AUTH-4 | Every table is readable only by its own household | A token for household A returns zero rows from household B, for every table | P0 | Built |
| FR-AUTH-5 | Viewers cannot write | Every write policy additionally requires a non-viewer role | P1 | Built |
| FR-AUTH-6 | An owner cannot remove their own membership | The delete policy excludes `user_id = auth.uid()` | P2 | Built |
| FR-AUTH-7 | Owners can invite and revoke by email | An invited address can sign in; a revoked, unredeemed one cannot | P1 | Built |
| FR-AUTH-8 | Misconfiguration degrades to an explanatory page, never a 500 | With Supabase env vars absent, every route lands on `/login` with a stated reason | P0 | Built |
| FR-AUTH-9 | The signup gate is swappable without touching RLS | Replacing the policy implementation changes who may sign up and nothing else | P2 | Planned |

### 3.2 Capture & recognition — `FR-CAP`

| ID | Requirement | Acceptance | Pri | Status |
|---|---|---|---|---|
| FR-CAP-1 | Photograph an item in-app and have it recognised | A photo yields a name, category and category-appropriate attributes | P0 | Built |
| FR-CAP-2 | An in-app photo files itself to the home you are standing in | A GPS fix inside a home's radius preselects it | P0 | Built |
| FR-CAP-3 | A location match is confirmed, never applied silently | The matched home is shown as a confirmable chip before saving | P1 | Built |
| FR-CAP-4 | A gallery upload asks where the item is | With no EXIF GPS, saving is blocked until a home is chosen | P0 | Built |
| FR-CAP-5 | EXIF GPS from a gallery photo takes precedence over device location | A photo taken elsewhere suggests that place, not where you are now | P1 | Built |
| FR-CAP-6 | Every recognised field is editable before saving | Name, category and all attributes can be corrected in the review sheet | P0 | Built |
| FR-CAP-7 | Recognition confidence is shown, not hidden | Low confidence is visibly flagged | P2 | Built |
| FR-CAP-8 | Alternative readings are one tap away | Up to three alternatives are offered without re-shooting | P2 | Built |
| FR-CAP-9 | Possible duplicates surface before saving | A near-identical existing item offers merge-or-keep | P1 | Built |
| FR-CAP-10 | Several photos can be imported at once | Multi-select processes with bounded concurrency and per-file status | P1 | Built |
| FR-CAP-11 | Photos are downscaled client-side before upload | No upload exceeds 1568px on its longest edge | P2 | Built |
| FR-CAP-12 | Recognition survives a provider outage | A failed call still allows manual entry, with a stated reason | P1 | Built |
| FR-CAP-13 | A barcode resolves brand and model exactly | Scanning a barcode prefills brand/model without guessing | P2 | Planned |
| FR-CAP-14 | A receipt fills purchase data across several items at once | One receipt photo yields date, price and merchant for each line | P2 | Planned |
| FR-CAP-15 | An item can carry several photos | Photos can be added from the item page; one is primary | P2 | Planned |
| FR-CAP-16 | A photo can be shared into Nest from the OS share sheet | Nest appears as a share target and opens the review sheet | P3 | Planned |
| FR-CAP-17 | Capture works offline and syncs later | A capture with no network is queued locally and uploads on reconnect | P2 | Planned |

### 3.3 Inventory & browse — `FR-INV`

| ID | Requirement | Acceptance | Pri | Status |
|---|---|---|---|---|
| FR-INV-1 | Browse everything, photo-first | A paginated grid leads with the photograph | P0 | Built |
| FR-INV-2 | Filter by home, category, owner and attributes | Facets combine; unknown values match nothing rather than everything | P0 | Built |
| FR-INV-3 | Full-text search across names, notes and attribute values | Searching a brand finds items whose brand attribute matches | P1 | Built |
| FR-INV-4 | Attribute facets derive from the same definition the extractor uses | A field added once appears in extraction, review and filters | P1 | Built |
| FR-INV-5 | An item page shows everywhere it has been | A chronological movement history with reasons | P1 | Built |
| FR-INV-6 | Moving an item records why and when | Every move writes a movement row; a failed write is surfaced | P0 | Built |
| FR-INV-7 | An item can be pinned so rebalancing leaves it alone | Pinned items never appear in proposed moves | P1 | Built |
| FR-INV-8 | Documents and valuables are private by default | They are excluded from shared views and invisible to the assistant | P1 | Built |
| FR-INV-9 | Items unassigned to a home are findable | A distinct filter lists them | P2 | Built |
| FR-INV-10 | Things that travel together can be grouped | Bundles move as a unit and stay together when rebalancing | P2 | Built |
| FR-INV-11 | Storage bins get printable QR labels | Scanning a label opens that bin's contents | P3 | Built |
| FR-INV-12 | Items can be marked lent out, to whom and when due | Lent items are excluded from redistribution and show a return date | P2 | Planned |

### 3.4 Distribution & logistics — `FR-PLAN`

| ID | Requirement | Acceptance | Pri | Status |
|---|---|---|---|---|
| FR-PLAN-1 | Balancing is deterministic, not model arithmetic | The same inventory always produces the same plan | P0 | Built |
| FR-PLAN-2 | Balancing is even *within meaningful groups* | Twelve pairs split six/six never puts every winter boot in one home | P0 | Built |
| FR-PLAN-3 | Uneven splits differ by at most one | Odd counts distribute with a maximum difference of one | P1 | Built |
| FR-PLAN-4 | Plans prefer leaving things where they are | An already-balanced inventory proposes zero moves | P1 | Built |
| FR-PLAN-5 | Pinned, in-transit and bundled items are respected | Pinned excluded; bundles land together | P1 | Built |
| FR-PLAN-6 | Groups too small to divide are reported, not silently skewed | One winter coat across three homes is flagged as indivisible | P2 | Built |
| FR-PLAN-7 | A plan becomes a checkable packing list | Approving a proposal creates a draft list grouped by destination | P1 | Built |
| FR-PLAN-8 | Ticking an item off actually moves it | A checkoff updates the item's home and writes a movement row | P0 | Built |
| FR-PLAN-9 | A cancelled trip releases in-transit items | Cancelling returns unchecked items to active | P2 | Built |
| FR-PLAN-10 | Homes can declare capacity limits | A plan that would exceed a home's stated capacity is refused with the reason, not proposed | P2 | Planned |
| FR-PLAN-11 | Trips have dates and generate a list ahead of time | Given a departure date, a packing list is produced for that trip | P2 | Planned |
| FR-PLAN-12 | Seasonal rotation can be requested | Out-of-season items are proposed for the home where they are not needed | P3 | Planned |

### 3.5 Assistant — `FR-ASSIST`

| ID | Requirement | Acceptance | Pri | Status |
|---|---|---|---|---|
| FR-ASSIST-1 | Ask questions in plain language about what you own | "Where are my running shoes?" returns the item and its home | P1 | Built |
| FR-ASSIST-2 | The assistant reads live inventory, never conversation memory | Answers reflect changes made since the last message | P1 | Built |
| FR-ASSIST-3 | It never does the arithmetic of a split itself | Splitting always calls the deterministic tool | P0 | Built |
| FR-ASSIST-4 | Every tool is read-only except creating a draft packing list | Only one tool writes, and it writes a draft | P0 | Built |
| FR-ASSIST-5 | Tool calls are legible to the user | Each is rendered as plain English, not raw JSON | P2 | Built |
| FR-ASSIST-6 | Judgement calls the algorithm could not make are named | Ties and indivisible groups are surfaced for a decision | P1 | Built |
| FR-ASSIST-7 | Private items are invisible to it | Documents and valuables never appear in tool results | P1 | Built |
| FR-ASSIST-8 | Conversations resume with tool calls intact | Reopening a thread preserves the full turn structure | P2 | Planned |
| FR-ASSIST-9 | It says so when the inventory is too sparse to answer | A near-empty inventory is named rather than confidently planned over | P2 | Built |

> **Known gap behind FR-ASSIST-8.** The schema (`chat_threads`,
> `chat_messages`) and the server-side persistence both exist, but nothing
> calls them: the client holds history in memory only and never sends a thread
> id, so conversations are lost on refresh and `persistTurn` is dead code.
> Finishing it means creating a thread on first message and loading it on
> mount — small, but currently unbuilt.

### 3.6 Purchase linking — `FR-SHOP`

> **Read this before building.** "Connect my Shopee/Taobao account and sync my
> orders" is **not achievable**. Both platforms' open APIs authorise *sellers*,
> not shoppers, and neither exposes a consumer's own order history to a
> third-party app. That is a policy boundary, not a technical one. These
> requirements specify the mechanisms that do work. Nest will never ask for
> marketplace credentials in order to scrape an account.

| ID | Requirement | Acceptance | Pri | Status |
|---|---|---|---|---|
| FR-SHOP-1 | An order-confirmation email creates or enriches an item | Forwarding a Shopee/Taobao confirmation yields item, price, date and order reference | P2 | Planned |
| FR-SHOP-2 | Email ingestion is opt-in and scoped | Only mail matching known merchant senders is read; scope is stated before it is granted | P1 | Planned |
| FR-SHOP-3 | Pasting a product URL prefills an item | A public product page yields title, image and price | P2 | Planned |
| FR-SHOP-4 | An order screenshot can be parsed | The existing vision pipeline extracts line items from a screenshot | P3 | Planned |
| FR-SHOP-5 | A linked purchase records provenance | Merchant, order reference and purchase date are stored and shown | P2 | Planned |
| FR-SHOP-6 | Linking never overwrites a human edit | A field the user has edited is preserved; conflicts are offered, not applied | P1 | Planned |
| FR-SHOP-7 | Warranty is derived from purchase date where known | An electronics purchase sets `warranty_ends_at` from date plus term | P3 | Planned |
| FR-SHOP-8 | Purchase links improve the insurance export | Exported rows carry price and order reference where available | P2 | Planned |

### 3.7 Virtual try-on — `FR-STYLE`

> **Feasibility, checked against your account.** `gemini-3.1-flash-image` and
> `gemini-3-pro-image` are available and produce images, so superimposing a
> wardrobe item onto a photo is buildable now. **Continuous live AR is a
> different problem** — it needs on-device pose estimation and segmentation per
> frame; a cloud round trip per frame is impossible on latency and cost. The
> buildable "live" version freezes a frame and generates from it.

| ID | Requirement | Acceptance | Pri | Status |
|---|---|---|---|---|
| FR-STYLE-1 | Try an owned item onto an uploaded photo | Selecting a garment and a photo returns a composite of that item on that person | P2 | Planned |
| FR-STYLE-2 | Only items you actually own can be tried on | The picker is the wardrobe; nothing external is offered | P2 | Planned |
| FR-STYLE-3 | Build a full look from several items | Top, bottom and shoes compose into one image | P2 | Planned |
| FR-STYLE-4 | Freeze a live camera frame and try on from it | Capture, generate, display; near-live rather than continuous | P2 | Planned |
| FR-STYLE-5 | Results are clearly labelled as generated | Output is visibly marked as an AI composite, never mistakable for a photograph | P1 | Planned |
| FR-STYLE-6 | Try-on images are private and disposable by default | Generated images are household-scoped and deletable; not retained unless saved | P1 | Planned |
| FR-STYLE-7 | A look can be saved as a bundle | An approved combination becomes an outfit bundle, reusing existing bundles | P3 | Planned |
| FR-STYLE-8 | Generation cost is visible and bounded | A per-household monthly cap prevents runaway spend | P2 | Planned |
| FR-STYLE-9 | Continuous AR overlay | Real-time garment tracking on a live feed | P3 | **Spike** |

### 3.8 Multi-household — `FR-TENANT`

> Requires replacing the invite-only trigger (FR-AUTH-2), which is currently the
> strongest guarantee in the product. Nothing here ships until FR-AUTH-9 exists
> and FR-AUTH-4 is proven under multiple concurrent tenants.

| ID | Requirement | Acceptance | Pri | Status |
|---|---|---|---|---|
| FR-TENANT-1 | Anyone can create an account and their own household | Signup succeeds without a prior invite and creates an isolated household | P1 | Planned |
| FR-TENANT-2 | Joining an existing household still needs an invite | No self-service path into someone else's data | P0 | Planned |
| FR-TENANT-3 | Cross-tenant isolation is continuously tested | An automated test asserts tenant A cannot read tenant B, run on every deploy | P0 | Planned |
| FR-TENANT-4 | Per-household quotas on items, storage and AI spend | Exceeding a quota is refused with a clear message, not a failure | P1 | Planned |
| FR-TENANT-5 | Plan tiers and billing | A household's tier determines its quotas | P2 | Planned |
| FR-TENANT-6 | Abuse controls on AI endpoints | Rate limits per household; anomalies are detectable | P1 | Planned |
| FR-TENANT-7 | Operators can support a household without reading its data | Admin tooling exposes metadata and usage, never inventory contents | P1 | Planned |
| FR-TENANT-8 | A household can export everything and delete itself | Export produces a complete archive; deletion removes all rows and objects | P1 | Planned |

### 3.9 Platform — `FR-PLAT`

| ID | Requirement | Acceptance | Pri | Status |
|---|---|---|---|---|
| FR-PLAT-1 | All business logic sits behind an HTTP API | No client-specific logic exists outside the application tier | P1 | Planned |
| FR-PLAT-2 | The API is described by a typed contract | Request/response schemas generate both server validation and client types | P1 | Planned |
| FR-PLAT-3 | Native iOS/Android clients use the same API | A native client needs no server change | P2 | Planned |
| FR-PLAT-4 | Long-running work runs as a job, not a request | Batch import and bulk re-recognition survive past request timeouts | P1 | Planned |
| FR-PLAT-5 | Job progress is visible and resumable | A batch shows progress and resumes after interruption | P2 | Planned |
| FR-PLAT-6 | Push notifications for reminders and completed jobs | An expiring warranty can notify without the app open | P3 | Planned |
| FR-PLAT-7 | Installs to a phone home screen | Works as a PWA with correct icons and orientation | P2 | Built |
| FR-PLAT-8 | Usable one-handed on a phone, two-paned unfolded | Every interactive target is at least 44px; layout adapts by width | P1 | Built |

### 3.10 Data & export — `FR-DATA`

| ID | Requirement | Acceptance | Pri | Status |
|---|---|---|---|---|
| FR-DATA-1 | Export everything as CSV and JSON | Both formats download; CSV quotes correctly | P1 | Built |
| FR-DATA-2 | The CSV carries what an insurer asks for | Serial, price, purchase date and condition per row | P2 | Built |
| FR-DATA-3 | Warranty and expiry produce reminders | Dates within the horizon appear on the dashboard | P2 | Built |
| FR-DATA-4 | Reminder generation is idempotent | A daily run creates no duplicates and does not resurrect dismissed ones | P2 | Built |
| FR-DATA-5 | Photos are private, served by expiring signed URL | An unauthenticated request for an object is refused | P0 | Built |
| FR-DATA-6 | Value totals are shown per home | Each home shows estimated total value | P3 | Built |

---

## 4. Non-functional requirements

| ID | Requirement | Acceptance |
|---|---|---|
| NFR-1 | Privacy is enforced in three independent layers | Signup gate, row-level security, and session middleware each block access on their own |
| NFR-2 | Secrets never reach the browser | Only `NEXT_PUBLIC_*` values appear in client bundles; the service-role key appears in at most two server paths |
| NFR-3 | A capture completes in under 10 seconds on mobile data | Measured from shutter to review sheet |
| NFR-4 | AI cost per capture stays roughly flat as the catalogue grows | The stable prompt prefix is cached; cache reads are non-zero after the first call |
| NFR-5 | A failed AI call never blocks cataloguing | Manual entry always remains available |
| NFR-6 | The app is usable one-handed | 44px minimum touch targets, primary actions in thumb reach |
| NFR-7 | Light and dark are both first-class | No colour is defined only inside a media query |
| NFR-8 | The inventory is never silently wrong | Any write that half-succeeds is reported rather than swallowed |
| NFR-9 | Deployment misconfiguration is self-diagnosing | The app states what is missing instead of returning a platform error |

---

## 5. Architecture constraints

1. **Three tiers.** Presentation (`apps/web`), application (`apps/api`), data
   (Supabase). Only the application tier reaches the database.
2. **Auth crosses the tier boundary as the user's own JWT**, never as the
   service-role key, so row-level security keeps enforcing. Service-role is
   permitted in exactly two paths: writing an invite for someone with no
   account, and the reminders cron.
3. **Domain logic is pure.** `packages/domain` performs no I/O and imports no
   framework, which is why its tests need no database and no mocks.
4. **Providers sit behind seams.** The AI provider and the signup policy are
   interfaces; swapping either is configuration, not a rewrite.
5. **Deterministic before generative.** Anything that can be computed exactly
   is computed exactly, and the model is given the result to explain.

---

## 6. Out of scope

- **Marketplace account scraping.** Storing a user's Shopee or Taobao
  credentials to read their orders. Not built, at any priority.
- **Valuation or appraisal.** Estimated values are rough figures for planning
  and insurance paperwork, not assessments.
- **Public sharing.** No public inventory links, no social features.
- **Sharing an inventory between households.** Households are isolated; that is
  the security model, not a limitation to work around.

---

## 7. Open questions

1. **Invite-only versus productizing.** FR-AUTH-2 and FR-TENANT-1 contradict
   each other. Current reading is sequencing — strict now, open later behind
   FR-AUTH-9. Confirm before any FR-TENANT work starts.
2. **Where the API tier runs.** Hono runs unchanged on Vercel, Fly, Railway and
   Cloudflare. Vercel now; a container host once FR-PLAT-4 has real volume.
3. **Try-on quality bar.** FR-STYLE-1 is buildable, but garment realism varies
   by item type. Worth a throwaway test on real wardrobe photos before
   committing to P2.
4. **Currency.** `SGD` is hardcoded in two places. Should be a column on
   `households` before FR-TENANT-1.
