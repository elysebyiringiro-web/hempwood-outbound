# HempWood Outbound CRM

Vercel-ready Next.js application for project-informed, person-level outbound campaigns.

## Included in this release

- Contact-level project bundling
- Qualified-project weekly target: 83 projects
- Seven-step, 20-day campaign workflow
- Tasks, reminders, and activity history
- Person research summaries and project associations
- Lifecycle changes that stop outreach at MQL
- MQL sales handover records
- Browser persistence for the first manual workflow release

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Validate

```bash
npm run lint
npm run build
```

## Deploy to Vercel

1. Import this GitHub repository into Vercel.
2. Keep the detected framework as **Next.js**.
3. Use `main` as the production branch.
4. Deploy without environment variables for this first manual release.

The current application stores changes in the browser. The next production milestone will replace browser persistence with Postgres, add team authentication, and connect read-only Google Sheets imports.

## Planned environment variables

See `.env.example`. Never commit real credentials.
