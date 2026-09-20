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
- **Supervisor Feedback** — Monthly performance assessments with 10 rating criteria
- **Dashboard** — Calendar view with CRUD operations (View, Edit, Delete, Duplicate)
- **Authentication** — Official University Email OTP / Magic Link with Neon DB session tracking

## Tech Stack

| Layer        | Technology                              |
| ------------ | --------------------------------------- |
| Framework    | Next.js 15 (App Router)                 |
| Language     | TypeScript                              |
| Styling      | Tailwind CSS v4                         |
| Icons        | Lucide React                            |
| Database     | Neon Serverless PostgreSQL              |
| Email        | Nodemailer (Gmail SMTP)                 |
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
DATABASE_URL=postgresql://user:password@ep-xyz.neon.tech/neondb?sslmode=require
GEMINI_API_KEY=your_gemini_api_key
SMTP_USER=ojtlogbookmaker@gmail.com
SMTP_PASS=your_16_character_app_password
```

### 3. Neon Database Setup

1. Create a serverless PostgreSQL database at [neon.tech](https://neon.tech)
2. Copy your connection string into `DATABASE_URL` in `.env.local` or Railway / Vercel environment settings.

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

### 4. Get a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create an API key
3. Add it to your `.env.local` as `GEMINI_API_KEY`

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
│   ├── (auth)/                           # Auth pages
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── auth/callback/route.ts            # OAuth callback
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
│   ├── db.ts                            # Neon Serverless PostgreSQL connection
│   ├── login-tracker.ts                 # Audit logging & database session tracking
│   ├── pdf-generator.ts                 # jsPDF document generation
│   ├── types.ts                         # TypeScript interfaces
│   ├── validation.ts                    # Text verification logic
│   └── utils.ts                         # Date/time utilities
└── middleware.ts                         # Auth session middleware
```

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import in [Vercel](https://vercel.com)
3. Set environment variables in Vercel dashboard
4. Deploy

### Other Platforms

```bash
npm run build
npm start
```

Ensure the `GEMINI_API_KEY` environment variable is set server-side (not exposed to the client).

## License

MIT
