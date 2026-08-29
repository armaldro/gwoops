# Nest

A private inventory for a household spread across more than one home.

Photograph something you own; Claude names it, categorises it and fills in the
details. Shot in the app, it files itself to the home you are standing in. Sent
from your gallery, it asks. Then ask the assistant things like *"split my shoes
evenly between the houses"* and it produces a packing list you tick off — and
ticking it off is what updates where everything actually is.

Only allowlisted email addresses can sign in. There is no public signup.

---

## What's in it

| | |
|---|---|
| **Capture** | In-app camera with GPS home-matching; gallery upload with EXIF GPS; multi-select batch import; AI recognition into per-category fields; duplicate detection before you save |
| **Inventory** | Photo-first grid, faceted filters, full-text search, item pages with a movement timeline |
| **Assistant** | Eight tools over your inventory. Balancing is a deterministic algorithm, not model arithmetic |
| **Packing lists** | Drafted by the assistant, approved by you; each tick writes a real move |
| **Bundles** | Outfits, kits and storage bins. A bundle stays together when homes are rebalanced |
| **Extras** | Insurance-shaped CSV/JSON export, warranty & expiry reminders, printable QR bin labels |
| **Design** | Warm editorial palette, one colour per home, full dark mode, installs to a phone home screen |
| **Foldables** | Bottom tabs folded; navigation rail and two-pane master-detail unfolded; hands-free camera in flex mode |

Categories with tailored fields: **clothing, shoes, electronics, kitchen, home &
tools, documents & valuables**. Toys/kids works under the generic schema — a
tailored one is in [BACKLOG.md](./BACKLOG.md).

---

## Setup

### 1. Supabase

Create a project at [supabase.com](https://supabase.com) (the free tier is
ample for a household), then:

```bash
npm install -g supabase        # if you don't have the CLI
supabase link --project-ref <your-project-ref>
supabase db push               # applies supabase/migrations/
```

`db push` creates every table, the row-level security policies, the private
`item-photos` storage bucket, and the `auth.users` trigger that enforces the
allowlist.

### 2. Environment

```bash
cp .env.example .env.local
```

Fill in:

| Variable | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page |
| `SUPABASE_SERVICE_ROLE_KEY` | same page — **server only**, never expose it |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` locally; your real origin in production |
| `CRON_SECRET` | any long random string |
| `SEED_ALLOWED_EMAILS` | the two of you, comma separated |

### 3. Bootstrap

```bash
npm install
npm run bootstrap
```

This creates the household, seeds the category catalogue and two starter homes,
and writes the allowlist. **Nobody can sign in until this runs** — that is
deliberate.

### 4. Run

```bash
npm run dev
```

Sign in at `/login` with an allowlisted address. Then go to **Settings → Homes**
and give each home its coordinates (there's a "use where I am" button) — that is
what makes photos file themselves.

---

## Deploying to Vercel

### Monorepo layout — two settings that are not optional

This repo is npm workspaces with two deployables. Vercel needs pointing at the
right one, and the environment variables need the right *type*.

**1. Root Directory.** The web app lives at `apps/web`, not the repo root. In
Vercel → Settings → Build & Deployment → **Root Directory**, set `apps/web`.
Without it the build fails with `routes-manifest.json couldn't be found`,
because Vercel looks for `.next` at the repo root.

**2. `NEXT_PUBLIC_*` variables must NOT be marked Sensitive.** Vercel's
sensitive variables are withheld from the build step, so Next.js inlines an
empty string and the app reports itself unconfigured — with no error, since an
empty string is a valid value. Symptom: the shipped bundle contains
`supabaseUrl: () => l("", "NEXT_PUBLIC_SUPABASE_URL")`.

| Variable | Type |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | plain — it ships in the browser bundle regardless |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | plain — public by design |
| `NEXT_PUBLIC_SITE_URL` | plain |
| `SUPABASE_SERVICE_ROLE_KEY` | **Sensitive** — server only |
| `ANTHROPIC_API_KEY` | **Sensitive** — server only |
| `CRON_SECRET` | **Sensitive** — server only |

`SEED_ALLOWED_EMAILS` and `SEED_HOUSEHOLD_NAME` are read only by
`scripts/bootstrap.mjs`, which runs locally. They do nothing in Vercel.

### First-time setup

1. Push this branch, then in Vercel: **Add New → Project → Import** `armaldro/gwoops`.
2. Set the Root Directory to `apps/web` (see above). Framework is detected as Next.js.
3. Add every variable from `.env.example` under **Settings → Environment
   Variables**, for Production *and* Preview. Set `NEXT_PUBLIC_SITE_URL` to your
   real origin (`https://gwoops.com`).

   > **`NEXT_PUBLIC_*` variables are inlined at build time.** Saving them in
   > Vercel changes nothing until you **redeploy** — the running build still
   > has `undefined` baked in. This is the most common cause of a deployment
   > that cannot reach Supabase. If the app is misconfigured it now says so on
   > the sign-in page instead of returning a 500.
4. In Supabase → **Authentication → URL Configuration**, add
   `https://gwoops.com/auth/callback` to the redirect allowlist. Magic links
   fail silently without this.
5. `vercel.json` registers the daily reminders cron. Vercel sends
   `Authorization: Bearer $CRON_SECRET` automatically, so the endpoint is only
   reachable by the cron once that variable is set.

### Pointing an existing Vercel project at this code

If a Vercel project already exists and serves the domain, you do not need a new
one — repoint the existing project:

- **Settings → Git → Connected Git Repository**: disconnect the old repo,
  connect `armaldro/gwoops`, and set the **Production Branch** to the branch you
  want to deploy.
- Redeploy. The domain stays attached to the project throughout, so there is no
  DNS change and no downtime window.

### Domains and DNS

`gwoops.com` currently resolves to an `A` record at `2.57.91.91`, which is not
Vercel. Two ways to move it, and the first is usually the right one:

**Option A — keep DNS at your registrar (recommended).** Only the records for
this site change; MX and everything else stay exactly as they are.

1. Vercel → project → **Settings → Domains** → add `gwoops.com` and
   `www.gwoops.com`.
2. Vercel then shows the exact record values to create. Use the values it
   displays rather than any you have written down — Vercel has changed its
   apex IP over time, and the dashboard is the authority.
3. At your registrar, replace `A @ → 2.57.91.91` with the apex record Vercel
   gives you, and point `www` at the `CNAME` target Vercel gives you (currently
   your `www` is a CNAME to `gwoops.com`, which will follow the apex once it
   moves — but setting it explicitly to Vercel's target is more robust).
4. Lower the apex TTL to 300 an hour beforehand if you want a fast cutover; your
   current apex TTL of 50 is already short.

**Option B — delegate DNS to Vercel.** Point your registrar's nameservers at
`ns1.vercel-dns.com` / `ns2.vercel-dns.com` and manage records in Vercel.

> **Check your email first.** Delegating nameservers moves *all* DNS, not just
> the website. Any `MX`, `TXT` (SPF/DKIM/DMARC), or subdomain records on
> `gwoops.com` stop resolving the moment the nameservers change unless you
> recreate them in Vercel DNS first. Export your current zone, recreate every
> record in Vercel, and only then switch the nameservers.

### Managing who can access the Vercel project

This is a Vercel account setting, separate from the app's own allowlist:

- **Team members** (can see and deploy every project): Vercel →
  **Team Settings → Members** → remove anyone who should not be there.
- **Per-project access** on Pro/Enterprise teams: project →
  **Settings → Project Members**.
- **Anyone with the deployment URL**: project → **Settings → Deployment
  Protection** → turn on *Vercel Authentication* so preview and production
  deployments require a logged-in team member.
- **Git access** matters too: someone with write access to `armaldro/gwoops` can
  ship code. Check GitHub → repo → **Settings → Collaborators**.

Removing someone from Vercel does **not** remove their access to the app itself.
That is governed by `allowed_emails` — revoke them in **Settings → Who can get
in** inside Nest.

---

## Foldables and small screens

Layouts target the *device class*, never a model number, so this holds for the
Find N5, the Fold line, Pixel Fold and whatever ships next.

| Width | Device | Navigation | Grid |
|---|---|---|---|
| `< 640` | cover screen, phone portrait | bottom tabs | 2 columns |
| `640–719` | large phone | bottom tabs | 3 columns |
| `fold:` `720–1023` | unfolded inner screen, phone landscape | left rail | 4 columns |
| `lg:` `1024+` | desktop | left rail | 5 columns |

`720px` is the boundary because the unfolded inner screen of a book foldable
lands somewhere in 700–900px CSS width with a near-square aspect. It also
catches a phone in landscape, where a rail is right for a different reason —
there, vertical space is the scarce axis.

**Unfolding gives you two panes.** Inventory grid beside item detail, packing
list beside the item you are ticking off, conversation beside the plan the
assistant just wrote. It is URL-driven (`?item=<id>`) and switched purely by
CSS, so the back button and link sharing behave identically folded and
unfolded, and there is no client-side breakpoint detection.

**Half-folded is a supported posture.** Under
`@media (vertical-viewport-segments: 2)` the camera puts its viewfinder in the
upper segment and the shutter in the lower, so the phone stands on a table and
photographs a shelf hands-free. The Viewport Segments API is Chromium-only, so
this is strictly progressive enhancement — every layout is already correct from
the width rules alone.

Folding also reconfigures the camera underneath the page: Android tears the
track down without firing an error, and the viewfinder silently goes black.
`capture-studio.tsx` watches for that (`videoWidth === 0`, or an ended track)
and re-acquires the stream.

---

## How it is put together

```
Next.js 15 (App Router, TypeScript, Tailwind v4) — PWA
├── Supabase Auth       magic link, allowlist-gated
├── Supabase Postgres   household-scoped, RLS on every table
├── Supabase Storage    private item-photos bucket, signed URLs
└── Anthropic SDK       claude-opus-5
    ├── Vision   messages.parse() + zodOutputFormat
    └── Chat     beta.messages.toolRunner + betaZodTool (streaming)
```

Two principles run through it:

**Math is deterministic; judgement is Claude's.** `lib/distribution.ts` does the
balancing — stratifying by the attributes that matter, respecting pinned and
in-transit items, keeping bundles together, and preferring to leave things where
they are. Claude picks the scope, reads the result, and explains the trade-offs.
It never counts shoes itself. That file is pure and has 22 tests.

**Nothing mutates without confirmation.** Every assistant tool is read-only
except `create_packing_list`, which writes a *draft*.

### Privacy, in three independent layers

1. **The database.** A `before insert on auth.users` trigger rejects any account
   whose email is not in `allowed_emails`. A valid magic link for a stranger
   still cannot create an account.
2. **Row-level security.** Every table is scoped to your household; viewers get
   read-only policies. A leaked anon key reads nothing.
3. **Middleware.** Unauthenticated requests never reach an app route.

Documents and valuables are marked private, kept out of the shared grid, and are
invisible to the assistant.

### Cost

The recognition prompt carries the whole category catalogue, so it sits behind a
`cache_control` breakpoint and every capture after the first reads it at about a
tenth of the price. Photos are downscaled to 1568px client-side before upload —
larger buys nothing, since that is the longest edge Claude's vision uses.

---

## Commands

```bash
npm run dev          # development server
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # vitest — distribution, geo and duplicate matching
npm run bootstrap    # one-time household + allowlist setup
```

## Layout

```
app/
  (auth)/login/            magic-link sign-in
  (app)/                   the signed-in app
    page.tsx               home dashboard
    capture/               camera, gallery, review
    inventory/             grid, facets, search
    items/[id]/            detail, attributes, movement timeline
    locations/             homes and their gaps
    chat/                  the assistant
    packing/               lists and checkoff
    bundles/               outfits, kits, bins
    settings/              profile, homes, allowlist, export
  print/labels/            printable QR bin labels
  api/                     recognize, chat, export, cron
lib/
  distribution.ts          the balancing algorithm (pure, tested)
  categories/schemas.ts    one definition driving extraction + filters + seeds
  agent/                   tools and system prompt
  vision/                  recognition schema and cached prompt
  geo.ts image.ts duplicates.ts photos.ts queries.ts
  actions/                 server actions
  supabase/                clients, middleware, types
supabase/migrations/       schema and RLS
```
