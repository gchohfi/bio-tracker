# Bio Tracker

A web application for healthcare practitioners to manage patients and track lab results over time using functional medicine reference ranges.

## Features

- **Patient management** — Create and manage a list of patients with sex-specific reference ranges
- **Lab sessions** — Record lab exam sessions per patient with dates
- **150+ lab markers** — Support for a comprehensive panel of biomarkers (blood count, hormones, vitamins, minerals, thyroid, lipids, and more)
- **PDF import** — Automatically extract lab results from PDF exam files via AI-powered edge function
- **Evolution table** — Compare results across sessions with color-coded alerts (normal / low / high)
- **Dashboard** — Overview of patients, sessions, and pending alerts with trend charts
- **PDF report** — Generate a detailed evolution report as a PDF with sparklines for each marker
- **Authentication** — Secure practitioner login via Supabase Auth

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions)
- **Charts**: Recharts
- **PDF generation**: jsPDF + jspdf-autotable
- **PDF parsing**: pdfjs-dist

## Getting Started

### Prerequisites

- Node.js (install with [nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- A [Supabase](https://supabase.com) project

### Local development

```sh
# 1. Clone the repository
git clone https://github.com/gchohfi/bio-tracker.git
cd bio-tracker

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env and fill in your Supabase URL and anon key

# 4. Start the development server
npm run dev
```

### Environment variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your Supabase anon/public key |

### Available scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run unit tests |

## Project Structure

```
src/
├── components/       # Reusable UI components
├── contexts/         # React context providers (Auth)
├── hooks/            # Custom React hooks
├── integrations/     # Supabase client and generated types
├── lib/              # Core logic: markers, report generation, utilities
├── pages/            # Route-level page components
└── test/             # Unit tests
supabase/
├── functions/        # Edge functions (PDF extraction)
└── migrations/       # Database migrations
```
