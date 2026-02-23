

## LabTrack — Implementation Plan

### Phase 1: Foundation & Authentication
- **Enable Lovable Cloud** (Supabase backend)
- **Auth pages**: Login and Signup with email/password
- **Profiles table**: Store practitioner name, linked to auth.users
- **Protected routes**: Redirect unauthenticated users to login

### Phase 2: Database Schema
- **patients** table: id, name, sex, user_id (practitioner), created_at
- **lab_sessions** table: id, patient_id, date, created_at
- **lab_results** table: id, session_id, marker_id, value
- **RLS policies**: Each practitioner only sees their own patients and data
- All tables linked with proper foreign keys and cascade deletes

### Phase 3: Core UI — Light & Clean Design
- **Layout**: Clean header with logo, patient selector, and action buttons
- **Dashboard**: Patient list with search, quick stats (sessions, markers, alerts)
- **Color palette**: White/light gray background, soft category colors, green/red/yellow for status indicators
- **Components**: Built with shadcn/ui Cards, Tables, Badges, Tabs, Dialogs

### Phase 4: Patient Management
- Create new patients (name + sex)
- Patient list sidebar or dropdown selector
- Edit patient name, delete patient with confirmation
- Patient overview showing session count and alert summary

### Phase 5: Lab Session Entry
- Add session with date picker
- 80+ markers organized by category tabs (Hemograma, Ferro, Glicemia, Lipídios, Tireoide, Hormônios, Vitaminas, Minerais, Hepático, Renal, Eletrólitos)
- Sex-specific functional medicine reference ranges displayed alongside each input
- Edit and delete existing sessions
- Color-coded inputs: green (normal), red (low), amber (high)

### Phase 6: Results Dashboard & Visualization
- Historical evolution table: all sessions as columns, markers as rows
- Sticky first column with marker names, scrollable session columns
- Color-coded cells with status indicators (✓ ok, ↓ low, ↑ high)
- Category filter tabs and status filter (All, With Data, Alerts)
- Alert banner showing markers outside functional reference ranges
- Category section dividers with colored accent

### Phase 7: AI-Powered PDF Import
- **Edge function** using Lovable AI (Gemini) to extract lab results from PDF text
- **PDF.js** on frontend to extract text from uploaded PDFs
- Send extracted text to edge function → AI parses into structured JSON
- Auto-match results to the 80+ supported markers using synonym matching
- Pre-fill session form with extracted values for review before saving
- Loading states with progress messages

### Phase 8: PDF Report Export
- Generate printable landscape report in new window
- Patient info header with stats summary
- Timeline visualization of all sessions
- Alert summary section for out-of-range markers
- Full historical data table with trend indicators (↗ ↘ →)
- Mini sparkline SVGs per marker showing trends
- Color legend and functional medicine reference attribution

