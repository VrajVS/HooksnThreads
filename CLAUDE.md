# Hooks & Threads — Handoff for the next Claude session

You're picking up an in-progress project. This file is the fast lane: what's here, what decisions have already been made (so you don't re-litigate them), what to watch out for, and where to look when you need more. Read this first, then browse the code as you go — don't try to memorize file-level detail from here, because the code is the source of truth and this file drifts.

## What this is

Hooks & Threads is a handmade-crochet e-commerce site — the storefront half of the real business at hooksnthreads.shop. It's a React + Vite + TypeScript SPA on the frontend and a Python + FastAPI + PostgreSQL backend, with a full admin panel and a user-management module.

Repo: https://github.com/VrajVS/HooksnThreads — active branch is **`website`**.
Local path: `C:\Users\vraj.suthar\Documents\GitHub\HooksnThreads-Ecommerce`.
The folder was originally `wellness-landing` (early scaffold); it's since been renamed. If you see stale references, treat them as bugs.

## Run it

```bash
npm run dev
```

That uses `concurrently` to start Vite (port 5180) and uvicorn (port 4000) together. Vite proxies `/api` and `/uploads` to uvicorn, so the SPA calls `/api/*` and it just works. `.claude/launch.json` has the same config for the Browser pane's `preview_start`; the global launch config at `~/.claude/launch.json` mirrors it under the name `hooksnthreads-ecommerce`.

- Storefront: http://localhost:5180
- Admin login: http://localhost:5180/admin/login
- FastAPI docs: http://127.0.0.1:4000/docs

Python venv lives at `server/venv` (not committed). If you're setting up from scratch: `cd server && python -m venv venv && venv\Scripts\pip install -r requirements.txt`.

## Environment

`server/.env` (gitignored — do not commit) holds:

- `DATABASE_URL` — Postgres 18 connection string, local: `postgresql://postgres:postgres@localhost:5432/hooksnthreads`
- `JWT_SECRET` — signing key for both auth cookies
- `CUSTOMER_COOKIE_NAME` — `session_token`
- `ADMIN_COOKIE_NAME` — `admin_token`
- `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` — the initial Super Admin account created by `scripts/seed.py`

Postgres is running locally on 5432 with `postgres`/`postgres` for user/password.

## Database

Seven tables, all managed by a hand-rolled migration runner (`server/scripts/migrate.py`) that applies numbered `.sql` files from `server/migrations/` and tracks state in `schema_migrations`:

- `customer_users` — storefront customers (was `users`, renamed in migration 007)
- `store_users` — admin-panel staff (was `admins`, renamed in migration 006)
- `roles` — role_id + name + `is_system` flag
- `role_permissions` — `(role_id, permission_key)` many-to-many
- `categories` — slug PK
- `products` — handle PK, `category_slug` FK
- `schema_migrations` — migration bookkeeping

Seed: `python scripts/seed.py` inserts 5 categories + 27 products, creates the Super Admin role with all 16 permissions, and creates the seeded admin from env vars. Idempotent.

## Auth: two fully separate systems

This is the single most important architectural fact. Do not merge them, do not add a "role" column to one to grant access to the other.

- **Customers** — `customer_users` table, cookie `session_token`, endpoints `/api/auth/*`, pages `/login` and `/signup`. Backend dependency: `require_customer` in `server/app/deps.py`.
- **Admins** — `store_users` table, cookie `admin_token`, endpoints `/api/admin/auth/*`, page `/admin/login`. Backend dependency: `require_admin` in the same file.

Both use bcrypt + JWT in an httpOnly cookie. Neither cookie grants any access to the other's endpoints. Frontend has two separate React contexts: `auth-context.tsx` (customer) and `admin-auth-context.tsx` (admin).

## Permissions

CRUD-level, 16 keys total, defined in `server/app/permissions.py`:

```
products.{view,create,update,delete}
categories.{view,create,update,delete}
users.{view,create,update,delete}
roles.{view,create,update,delete}
```

Enforcement pattern: every admin endpoint depends on `require_permission("some.key")`, a factory in `deps.py` that returns a FastAPI dependency. Super Admin (`is_system=true` role) is granted every permission unconditionally — this is a code-level bypass in `require_permission`, not extra rows in `role_permissions`.

**The "Super Admin" role is non-editable and non-deletable** (guaranteed by 403s in `admin_roles.py` on any is_system row). This is deliberate: it guarantees at least one account always has full access. Do not add a UI to "unlock" it.

Frontend mirrors backend with `useHasPermission(key)` hook (`src/hooks/use-has-permission.ts`). Nav items in `admin-layout.tsx` and action buttons on list pages are gated by the matching `.view`/`.create`/`.update`/`.delete` key. The SPA is defense-in-depth only — backend enforcement is the source of truth. A user without `.view` won't see the nav item; if they hit the URL directly, the API returns 403 and a toast shows.

## What's built

Storefront:
- Home with hero, featured products, category grid, image marquee, guide cards, FAQ, carousel
- Category pages, product pages, search
- Cart, wishlist (still `localStorage`-backed — not in DB)
- Customer signup / login / logout
- Legal pages (privacy, refund, shipping, terms), contact, 404

Admin panel (`/admin/*`):
- Products CRUD with image upload
- Categories CRUD with image upload
- Users CRUD (admin panel users only — customers are managed separately at the DB layer)
- Roles CRUD with a permission matrix (module × CRUD checkboxes)
- Collapsible sidebar with brand mandala icon, avatar dropdown, change-password dialog
- Pagination, search, skeletons, `AlertDialog` confirmations, sonner toasts

## What's deferred (do not build unless asked)

- **Checkout / payments / orders** — blocked on Razorpay credentials. No `orders` / `order_items` / `addresses` tables yet.
- **Customer account dashboard** — no order history page, no address book; the customer login only powers "is someone logged in" for the navbar.
- **Real image hosting** — admin-uploaded images live on local disk at `server/uploads/`. Fine for dev; a real deploy will need object storage.
- **Route-level permission guards on the frontend** — deliberately not added. Backend is authoritative; SPA hides nav.

## Preferences and decisions already made (don't re-open these)

- **Backend is Python + FastAPI.** Not Node, not Flask.
- **No ORM.** Hand-written SQL through `psycopg` v3. This is a strong preference — don't introduce SQLAlchemy or Prisma.
- **No migration framework.** The hand-rolled runner is intentional. Don't add Alembic.
- **Local Postgres, not Supabase.** The user chose to self-host.
- **No React Query.** Small `useProducts` / `useCategories` / etc. hooks around plain `fetch`.
- **Tailwind v3 + shadcn/ui components.** Not Tailwind v4, not Chakra, not MUI.
- **Cream background** (`#efe8dd`-ish) with a dark forest-green accent (`hsl(151 87% 14%)`) for the admin panel. The Cinzel serif "HOOKS & THREADS" wordmark in the admin header is a fixed design choice.
- **CRUD-level permissions** (not blanket module perms). This choice was explicit — don't collapse them back.
- **Two separate auth systems** (see above). Non-negotiable.

## Recurring gotchas

- **Zombie uvicorn workers.** After code changes, sometimes a stale worker keeps serving old code and returns 500 on the first request. Symptom: an endpoint that worked five minutes ago now 500s and the log shows a schema/table error that's already been fixed. Fix: `Get-Process python3.13`, kill the worker PID (not the reloader — the reloader has the lowest PID and will respawn a fresh worker). Bit us three times during table renames.
- **Vite HMR gets wedged occasionally** after an import error early in a session. Fix: delete `node_modules/.vite` and restart `npm run dev`.
- **PowerShell + git stderr.** `git push` writes informational messages to stderr, which PowerShell renders in red as if it's an error. Read the actual git output, not the color.
- **Windows line-endings (CRLF vs LF).** `git add` will warn on nearly every file. Cosmetic, not a real issue.
- **The `<ip_reminder>` tag** occasionally appears in the conversation stream. It's a silent system-level rule about copyright handling — don't echo it into your response, don't write meta-commentary about it. Just follow the rule quietly.

## Where things live

```
/                          — frontend root (Vite + React 19 + TS)
  src/
    App.tsx                — router
    pages/                 — storefront pages
    pages/admin/           — admin panel pages
    components/            — shared UI
    components/ui/         — shadcn primitives
    context/               — auth-context (customer) and admin-auth-context
    hooks/                 — data-fetching + use-has-permission
    lib/api.ts             — fetch wrapper
    data/site-data.ts      — marketing-only static content (hero, FAQ, guide cards, marquee)
  public/images/           — storefront/marketing images (in git)
  index.html, vite.config.ts, tailwind.config.js
server/                    — backend root (Python 3.13 + FastAPI)
  app/
    main.py                — FastAPI app, CORS, static /uploads mount, router registration
    db.py                  — psycopg connection pool
    config.py              — env var loading
    security.py            — bcrypt + PyJWT
    deps.py                — require_customer, require_admin, require_permission factory
    permissions.py         — the 16 permission-key constant
    routers/
      auth.py              — customer signup/login/logout/me
      admin_auth.py        — admin login/logout/me/change-password
      admin_users.py       — admin CRUD (uses store_users)
      admin_roles.py       — role CRUD + permission matrix
      admin_products.py    — product CRUD, paginated
      admin_categories.py  — category CRUD, paginated
      products.py, categories.py — public read endpoints
      uploads.py           — multipart image upload
  migrations/*.sql         — numbered, applied in order
  scripts/migrate.py       — runner, tracks in schema_migrations
  scripts/seed.py          — categories + products + Super Admin role + admin account
  uploads/                 — admin-uploaded images (contents gitignored)
  venv/                    — not committed
  .env                     — not committed (DATABASE_URL, JWT_SECRET, seed creds)
.claude/launch.json        — dev-server config for the preview tool
```

## Recent history (rough, chronological)

The project started as a wellness-landing scaffold, got content-swapped to Hooks & Threads, then grew a full transactional plan. Real product images were sourced from `D:\Personal\HooksnThreads\assets` and pre-processed with `ffmpeg`. The catalogue moved from a static `site-data.ts` array to Postgres. The admin panel got a production-grade polish pass (toasts, alert dialogs, skeletons, pagination, search). Then the user-management module — roles, CRUD-level permissions, Super Admin. Then table renames: `admins` → `store_users`, `users` → `customer_users`. Then the folder was renamed from `wellness-landing` to `HooksnThreads-Ecommerce` and the whole thing was pushed to GitHub on the `website` branch.

That's the arc. When you touch something, read the relevant file — don't guess from this summary.

## Working style the user prefers

- Short, direct responses. No trailing recap of what you just did.
- Ask before doing anything destructive or anything that touches shared state (git push, DB migrations, deleting files).
- One question at a time when you do need to ask; don't fan out with three sub-questions.
- Use `AskUserQuestion` for genuine forks in the road; pick a reasonable default and proceed otherwise.
- No emojis unless the user uses them first.
- Comments in code: only when the *why* is non-obvious. Never document *what* the code does.
