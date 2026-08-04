# English LMS

A cloud-hosted collaborative class platform for online English teaching. Import markdown class files, edit together in real time with students, and share published classes via link or student login.

This lives in `lms/` and is **completely separate** from the local teacher dashboard in `app/`.

## Stack

- **Next.js** (App Router) on Vercel
- **Supabase** — auth, Postgres, image storage, per-teacher quotas
- **Liveblocks** + **Lexical** — realtime collaborative editor with cursors and selections
- **Tailwind CSS**

## Features

- Teacher dashboard: workspace folder sync, student list, usage quotas
- Collaborative editor: formatting, sections, images, present/zoom mode
- Realtime co-editing with remote cursors and selection highlights
- Share links (`/c/[token]`) for guests without login
- Student claim links (`/claim/[token]`) so students can sign up with any email
- Student portal: published classes for logged-in linked students
- Multi-teacher: invite-only onboarding, superuser admin usage + alerts

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run the SQL in [`supabase/schema.sql`](supabase/schema.sql)
3. Run migrations in [`supabase/migrations/`](supabase/migrations/) (including `20260727_multi_tenant_invites_quotas.sql`, `20260731_student_claim_tokens.sql`, and `20260804_class_editor_theme.sql`)
4. Ensure storage buckets: `class-images` (public), `lms-data` (private)
5. Copy your project URL, anon key, and service role key

### 2. Liveblocks

1. Create a project at [liveblocks.io](https://liveblocks.io)
2. Copy the public and secret API keys

### 3. Environment

Copy `.env.local.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
LIVEBLOCKS_SECRET_KEY=...
NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY=...
SUPERUSER_EMAIL=your-email@example.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=...          # random string for usage cron
RESEND_API_KEY=...       # optional — superuser alert emails
```

`SUPERUSER_EMAIL` gets the `superuser` role on first login. Additional teachers need an invite link from the superuser (`/admin/invites`).

### 4. Run locally

```bash
cd lms
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Deploy to Vercel

1. Push the repo and import the `lms` folder as a Vercel project (root directory: `lms`)
2. Add the same environment variables in Vercel
3. Set `NEXT_PUBLIC_APP_URL` to your production URL
4. In Supabase Auth → URL Configuration, add redirect allowlist entries for:
   - `{NEXT_PUBLIC_APP_URL}/auth/callback`
   - `{NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`
   (or a wildcard like `{NEXT_PUBLIC_APP_URL}/**`)

## Workflow

1. **Prepare files** on your computer (`control/journal.md`, `students/...`) — see [/docs/getting-started](/docs/getting-started)
2. **Sign in** as superuser or invited teacher at `/login`
3. On the dashboard, **Connect workspace** and **Sync now** (or run `npm run sync` from `lms/`)
4. Open a student → edit classes, **Publish**, share the class link for live class, or copy the **claim link** so they can create a login
5. Superuser: monitor platform usage at `/admin/usage` and create teacher invites at `/admin/invites`

## Routes

| Route | Who | Purpose |
|-------|-----|---------|
| `/dashboard` | Teacher / superuser | Students, workspace sync, usage |
| `/docs/getting-started` | Anyone | Folder layout and browser requirements |
| `/admin/usage` | Superuser | Platform + per-teacher usage |
| `/admin/invites` | Superuser | Create/revoke teacher invites |
| `/invite/[code]` | Invited teacher | Signup with invite |
| `/claim/[token]` | Student | Signup / sign-in to link account |
| `/dashboard/students/[id]` | Teacher | Classes + student account linking |
| `/class/[id]` | Teacher / linked student | Collaborative editor |
| `/c/[shareToken]` | Anyone (if published) | Guest collaborative editor |
| `/student` | Linked student | Published class list |
| `/login` | Everyone | Auth (signup only via invite/claim) |

## Sync options

| Method | When |
|--------|------|
| Browser **Connect workspace** | Chrome/Edge on desktop — preferred |
| `npm run sync` | CLI; reads parent `English/` folder layout; requires one prior login |

Both upload to `lms-data/{your-profile-id}/dashboard.json` and upsert students/classes for your tenant.

## Notes

- Markdown files stay on your computer; sync uploads seeds into the cloud editor
- Draft classes are teacher-only; students can edit only after publish
- At 100% quota, new uploads and imports are blocked; existing classes still work
- The local `app/` dashboard is unchanged and still reads files from disk
