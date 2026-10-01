# CRM database (Supabase)

All CRM data lives in Supabase in its own **`crm` schema**. The `public` schema in the
same project belongs to the recruitment website and is never touched by these scripts.

## Files

| File | What's in it |
|---|---|
| `schema/00_setup.sql` | Creates the `crm` schema |
| `schema/01_core.sql` | organizations, users (logins), organization_settings |
| `schema/02_recruitment.sql` | clients, client leads, jobs, candidates, applications, interviews, placements, templates, recruiter targets |
| `schema/03_partners.sql` | field-agent profiles, referrals, referral chat, commission ledger, payouts, payee bank details |
| `schema/04_hr_people.sql` | employees and their lifecycle: onboarding, documents, assets, probation, promotions, transfers, salary revisions, exits, requests |
| `schema/05_hr_time.sql` | attendance, shifts, corrections, WFH, leave requests / balances / policies, holidays |
| `schema/06_hr_pay_growth.sql` | payroll, performance reviews and cycles, goals, training, benefits, tax declarations, HR policies |
| `schema/07_finance.sql` | finance settings, invoices, receipts, recurring billing, expenses, vendors and bills, contracts, timesheets, F&F, bank lines, journals, budgets |
| `schema/08_workspace.sql` | tasks, announcements, notifications, approvals, audit log, compliance, data quality, integrations, workflow rules, email outbox, uploaded files |
| `schema/09_relationships.sql` | foreign keys between the tables above, plus indexes |
| `schema/10_sync_and_security.sql` | change tracking (`_sync_state` + triggers) and row-level security |
| `seed/seed.sql` | the demo data for every table (wipes CRM rows first) |

Every table also has two internal columns:
- `_position`: keeps lists in the order the app shows them.
- `_extra`: holds any value that doesn't fit its typed column (for example a malformed date), so nothing is ever lost.

## Commands (run inside `crm/`)

```bash
npm run db:push      # create / update tables (safe to re-run)
npm run db:seed      # replace all CRM data with the demo data
npm run db:reset     # drop the crm schema, recreate it, load demo data
npm run db:verify    # check Supabase returns exactly the demo data
npm run db:generate  # rebuild the SQL files after changing src/lib/types.ts or the mock seed
```

All of them use `DATABASE_URL` from `.env`.

## How the app uses it

`src/lib/db/sync.ts` does the work. The API routes didn't change.

1. On the first request, the server loads every `crm` table into memory.
2. After each request, whatever changed is saved back to Supabase in one transaction.
3. Before each request (at most once a second), the server checks `_sync_state`. If
   another server, or someone editing in the Supabase dashboard, changed a table, that
   table is reloaded.

Settings in `.env`:
- `DATABASE_URL`: Postgres connection string. Required.
- `CRM_DATA_SOURCE=mock`: run offline on the built-in demo data, without Supabase.
- `DATABASE_FRESHNESS_MS`: how often to check for outside changes. Default 1000.
- `DATABASE_POOL_MAX`: connections per server. Default 5.

## Adding a field or a table

1. Change the type in `src/lib/types.ts`. For a new collection, also add it to
   `src/lib/mock/data.ts` and list it under a domain in `scripts/db/config.ts`.
2. Run `npm run db:generate`, then `npm run db:push`.
3. To start from fresh demo data, also run `npm run db:seed`.
