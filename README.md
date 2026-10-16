# OJT Logbook Maker

AI-powered form filling for your OJT (On-the-Job Training) logbook. Paste your daily notes and let AI organize them into the correct logbook sections — your text, your words, perfectly organized.

> **Important**: This is NOT an AI writing tool. The AI only classifies and maps your existing text into the correct fields. It never generates, rewrites, or paraphrases content.

## Features

- **Paste → Auto Fill → Review → Export** — Simple 4-step workflow
- **Exact Text Preservation** — Your words are never changed
- **AI Text Classification** — Powered by Google Gemini 2.0 Flash
- **Double Validation** — Server-side + client-side verification that AI output matches original text
- **Manual Override** — Fill sections manually without AI
- **A4 PDF Generation** — Professional OJT logbook format with auto page breaks
- **Complete Logbook** — Combine all entries into a single PDF
- **Student Profile** — One-time setup for the logbook cover page
- **Guest mode** — `/try` generates a logbook from a PRD without an account; only the PRD is stored, and guests get 5 generations per hour per IP
- **Supervisor Feedback** — Monthly performance assessments with 10 rating criteria
- **Dashboard** — Calendar view with CRUD operations (View, Edit, Delete, Duplicate)
- **Accounts** — Sign up and sign in with a university email + password (email verified by a 6-digit code), or with the university Google account. Password reset by email code.

## Tech Stack

| Layer        | Technology                              |
| ------------ | --------------------------------------- |
| Framework    | Next.js 16 (App Router, `proxy.ts`)     |
| Language     | TypeScript                              |
| Styling      | Tailwind CSS v4                         |
| Icons        | Lucide React                            |
| Database     | Neon Serverless PostgreSQL              |
| Auth         | Neon Auth (Managed Better Auth): email + password, Google, email codes |
| AI           | Google Gemini 2.0 Flash                 |
| PDF          | jsPDF (client-side, programmatic)       |

## Setup

### 1. Clone and Install

```bash
cd ojt-logbook-maker
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your values:

```env
NEON_AUTH_BASE_URL=https://ep-xxx.neonauth.us-east-2.aws.neon.tech/neondb/auth
NEON_AUTH_COOKIE_SECRET=long_random_string   # openssl rand -base64 32
AUTH_SECRET=long_random_string               # signs the admin token
ADMIN_USERNAME=your_admin_id
ADMIN_PASSWORD=long_unique_password
DATABASE_URL=postgresql://user:password@ep-xyz.neon.tech/neondb?sslmode=require
GEMINI_API_KEYS=key_one,key_two           # one or more, comma separated
OPENROUTER_API_KEYS=key_one                 # optional backup pool
```

`ADMIN_USERNAME` and `ADMIN_PASSWORD` are the credentials for the admin portal at `/admin`.
If either is unset, admin login is disabled. Admin sessions are signed with `AUTH_SECRET`
and expire after 8 hours; login is limited to 5 attempts per IP per 15 minutes.

`DATABASE_URL` is required: there is no built-in fallback database.

### Neon Auth (student sign in)

Student accounts, passwords, Google sign-in, email verification and password reset are handled
by [Neon Auth](https://neon.com/docs/auth/overview). In the Neon Console, open your project, then
**Auth**:

1. **Enable Auth**, then copy the Auth URL into `NEON_AUTH_BASE_URL`.
2. **Settings > Auth**: turn on **Sign-up with Email**, then **Verify at Sign-up** with
   **Verification code** as the method. Students type a 6-digit code; links need a custom SMTP provider.
3. **Configuration > Domains**: add your production URL, e.g. `https://ojt-logbookmaker.vercel.app`.
   Localhost is allowed automatically. For Vercel previews add a wildcard such as
   `https://*-yourteam.vercel.app`.
4. **Google**: works immediately with Neon's shared Google app (users see "continue to neon.tech").
   For production, create your own Google OAuth client (Web application) and set its
   **Authorized redirect URI** to `{NEON_AUTH_BASE_URL}/callback/google`, then paste the client ID and
   secret under **Settings > Auth > OAuth providers**. No JavaScript origins are needed.
5. Before launch: set the **Application name**, add a custom SMTP provider (the shared sender is
   rate limited), and turn off **Allow Localhost**.

How it fits together: Neon owns the identity; this app keeps `app_users`, which links each Neon user
to the `usr_<mobile>` account their entries live under. Only `@medhaviskillsuniversity.edu.in`
accounts with a verified email can use the logbook. The first time a student signs in (email or
Google) they add their mobile number once at `/onboarding`.

### 3. Neon Database Setup

1. Create a serverless PostgreSQL database at [neon.tech](https://neon.tech)
2. Copy your connection string into `DATABASE_URL` in `.env.local` and in your Vercel environment variables.

The app creates and updates its tables on first use. Each student keeps one current copy of
everything; saving again overwrites it, and no history is kept:

| Table | Holds |
|---|---|
| `app_users` | Account, linked to the Neon Auth user, with only the **last** sign-in time |
| `user_profiles` | One profile per student (saved over on every update) |
| `supervisor_feedback` | One feedback form per student (saved over on every update) |
| `edited_pdfs` + `edited_pdf_chunks` | The student's latest edited PDF, stored in 3 MB chunks because Vercel limits each request to 4.5 MB |
| `daily_entries` | Logbook entries (latest Fill logbook save only) |
| `prd_uploads` | Uploaded PRDs: the file (up to 3.5 MB) and its text. One per student (latest), one per guest browser tab |

A full 90-page logbook PDF is about 8 MB, so 200 saved PDFs need roughly 1.6 GB of database storage.
Logbook PDFs are built in the browser from `public/templates/OJT_Logbook.pdf` (slimmed with
`node scripts/slim-template.mjs`), so they never pass through a Vercel function.

```sql
-- ============================================================
-- PROFILES TABLE
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  learner_name TEXT DEFAULT '',
  registration_number TEXT DEFAULT '',
  program_name TEXT DEFAULT '',
  semester TEXT DEFAULT '',
  location TEXT DEFAULT '',
  industry_partner_name TEXT DEFAULT '',
  ojt_start_date DATE,
  ojt_end_date DATE,
  department TEXT DEFAULT '',
  designation TEXT DEFAULT '',
  supervisor_name TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- ============================================================
-- DAILY ENTRIES TABLE
-- ============================================================
CREATE TABLE daily_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TEXT DEFAULT '',
  end_time TEXT DEFAULT '',
  department TEXT DEFAULT '',
  designation TEXT DEFAULT '',
  original_text TEXT DEFAULT '',
  my_space TEXT DEFAULT '',
  tasks_carried_out TEXT DEFAULT '',
  key_learning_observations TEXT DEFAULT '',
  tools_technology_used TEXT DEFAULT '',
  special_achievements TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE daily_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own entries"
  ON daily_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own entries"
  ON daily_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own entries"
  ON daily_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own entries"
  ON daily_entries FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- SUPERVISOR FEEDBACK TABLE
-- ============================================================
CREATE TYPE rating_value AS ENUM ('good', 'acceptable', 'needs_improvement');

CREATE TABLE supervisor_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_date DATE,
  to_date DATE,
  student_name TEXT DEFAULT '',
  punctuality TEXT DEFAULT '',
  professional_appearance TEXT DEFAULT '',
  ability_to_communicate TEXT DEFAULT '',
  interest_shown_for_learning TEXT DEFAULT '',
  productivity_at_work TEXT DEFAULT '',
  error_free_work TEXT DEFAULT '',
  working_as_team TEXT DEFAULT '',
  initiative_and_commitment TEXT DEFAULT '',
  flexibility_and_adaptability TEXT DEFAULT '',
  adherence_to_safety_ethics TEXT DEFAULT '',
  total_score INTEGER,
  remarks TEXT DEFAULT '',
  supervisor_name TEXT DEFAULT '',
  designation TEXT DEFAULT '',
  signature_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE supervisor_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own feedback"
  ON supervisor_feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feedback"
  ON supervisor_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own feedback"
  ON supervisor_feedback FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own feedback"
  ON supervisor_feedback FOR DELETE
  USING (auth.uid() = user_id);
```

4. Go to **Authentication → Settings** and configure:
   - Enable Email/Password sign-in
   - Set your Site URL (e.g., `http://localhost:3000`)
   - Add `http://localhost:3000/auth/callback` to Redirect URLs

### 4. Get AI API Keys

The app spreads AI requests across a pool of keys (`src/lib/ai.ts`). Every
request starts on a different key; when a key hits its rate limit it rests
and the next key takes over. Gemini keys are tried first, then OpenRouter.

1. Gemini: create keys at [Google AI Studio](https://aistudio.google.com/app/apikey).
   Free quota is per Google Cloud project, so create each key in its own project.
2. OpenRouter (optional backup): create a key at [openrouter.ai/keys](https://openrouter.ai/keys).
   Only models ending in `:free` are used (the app ignores any other and sends a
   $0 max price), so you are never charged. The account allows 50 free requests a day,
   or 1000 a day after a one-time $10 credit purchase.
   Logbooks are written in 8-day chunks at the same time, so even 76 days take
   about 15-25 seconds. The fast "lite" Gemini models are always used as
   fallbacks after any you configure, because Google sometimes reports a model
   as overloaded (503).
3. Add them to `.env.local` (and Vercel) as comma-separated lists:
   `GEMINI_API_KEYS`, `OPENROUTER_API_KEYS`, and optionally `GEMINI_MODELS` /
   `OPENROUTER_MODELS`. The old single-key names still work.

### 5. Run the Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Core Workflow

```
Paste text → Click "Auto Fill Logbook" → AI classifies text → Review & edit → Save → Download PDF
```

The AI acts as a **semantic classifier/extractor** — it only determines which piece of the student's existing text belongs in which logbook field. It never generates new content.

## Project Structure

```
src/
├── app/
│   ├── page.tsx                          # Landing page
│   ├── layout.tsx                        # Root layout
│   ├── globals.css                       # Design system
│   ├── (auth)/                           # Split-screen auth pages
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx               # details → email code
│   │   └── forgot-password/page.tsx
│   ├── onboarding/                       # one-time mobile number / verify / wrong-account step
│   ├── api/auth/[...path]/route.ts       # Neon Auth proxy (sign in/up, Google, codes, reset)
│   ├── api/account/                      # check (sign-up pre-check), onboard (attach mobile)
│   ├── api/extract-logbook/route.ts      # AI extraction API
│   └── dashboard/
│       ├── page.tsx                      # Entry list
│       ├── new-entry/page.tsx            # Core paste→fill→review flow
│       ├── entry/[id]/page.tsx           # View/edit entry
│       ├── profile/page.tsx              # Student profile
│       ├── feedback/page.tsx             # Supervisor feedback
│       └── logbook/page.tsx              # Complete logbook PDF
├── components/
│   ├── sidebar.tsx                       # Dashboard sidebar
│   ├── navbar.tsx                        # Top navbar + mobile drawer
│   ├── detected-fields.tsx              # 5 editable logbook fields
│   ├── original-text-panel.tsx          # Read-only original text
│   ├── logbook-preview.tsx              # A4 preview component
│   └── entry-card.tsx                   # Dashboard entry card
├── lib/
│   ├── auth/                            # Neon Auth server/client, session → account, admin token
│   ├── db.ts                            # Neon Serverless PostgreSQL connection
│   ├── logbook-stamp.ts                 # Stamps profile + entries onto the logbook template
│   ├── pdf-generator.ts                 # Builds logbook PDFs in the browser
│   ├── edited-pdf-*.ts                  # Saving the edited PDF to Neon in chunks
│   ├── types.ts                         # TypeScript interfaces
│   ├── validation.ts                    # Text verification logic
│   └── utils.ts                         # Date/time utilities
└── proxy.ts                              # Neon Auth middleware for /dashboard and /onboarding
```

## Deployment

The app is deployed on [Vercel](https://vercel.com).

1. Push to GitHub
2. Import the repository in Vercel
3. Add the environment variables from `.env.example` in the Vercel dashboard (Settings > Environment Variables)
4. Deploy. Every push to `main` redeploys automatically.

Keep `GEMINI_API_KEY` and the other secrets server-side (no `NEXT_PUBLIC_` prefix).

## License

MIT
