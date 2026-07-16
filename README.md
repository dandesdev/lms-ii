# English LMS

A cloud-hosted collaborative class platform for online English teaching. Import markdown class files, edit together in real time with students, and share published classes via link or student login.

This lives in `lms/` and is **completely separate** from the local teacher dashboard in `app/`.

## Stack

- **Next.js** (App Router) on Vercel
- **Supabase** — auth, Postgres, image storage
- **Liveblocks** + **Lexical** — realtime collaborative editor with cursors and selections
- **Tailwind CSS**

## Features

- Teacher dashboard: manage students, import `.md` files, publish classes
- Collaborative editor: bold/italic/underline, headings, lists, tables, colors, highlights, section backgrounds, images, present/zoom mode
- Realtime co-editing with remote cursors and selection highlights
- Share links (`/c/[token]`) for guests without login
- Student portal: published classes for logged-in students

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run the SQL in [`supabase/schema.sql`](supabase/schema.sql)
3. Create a public storage bucket named `class-images`
4. Copy your project URL, anon key, and service role key

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
TEACHER_EMAIL=your-email@example.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

The email matching `TEACHER_EMAIL` gets the `teacher` role on first login.

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
4. In Supabase Auth settings → URL Configuration, add redirect allowlist entries for:
   - `{NEXT_PUBLIC_APP_URL}/auth/callback`
   - `{NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`
   (or a wildcard like `{NEXT_PUBLIC_APP_URL}/**`)

## Workflow

1. **Create class** with your AI writer (markdown file on your computer, as today)
2. **Sign in** as teacher at `/login`
3. **Add student** on the dashboard (include their email if they will log in)
4. Open the student → **Import markdown** → pick the `.md` file
5. Edit the class page, then click **Publish**
6. **Share** the link with your student, or they sign in at `/student` to see published classes

## Routes

| Route | Who | Purpose |
|-------|-----|---------|
| `/dashboard` | Teacher | Student list, stats |
| `/dashboard/students/[id]` | Teacher | Import classes, class list |
| `/class/[id]` | Teacher / linked student | Collaborative editor |
| `/c/[shareToken]` | Anyone (if published) | Guest collaborative editor |
| `/student` | Student | Published class list |
| `/login` | Everyone | Auth |
| `/forgot-password` | Everyone | Request password reset email |
| `/reset-password` | Recovery session | Set a new password after email link |

## Notes

- Markdown files stay on your computer; import is a one-way upload into the cloud editor
- Draft classes are teacher-only; students can edit only after publish
- The local `app/` dashboard is unchanged and still reads files from disk
