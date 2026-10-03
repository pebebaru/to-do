# to:DO

Personal execution assistant built with Next.js, React, TypeScript, and Supabase.

Visual design follows the existing Stitch **to:DO Execution Assistant** project, including its exact color tokens, variable font weights, command center layout, mobile critical dispatch, schedule, editor, and focus ring. See `design-system.md` and the reference screens in `design/stitch/`. Local screenshots are `preview.jpg`, `mobile-preview.jpg`, and `focus-preview.jpg`.

## Local preview

Run `npm install` then `npm run dev`. With no Supabase environment variables, the application is clearly labeled device-local preview and uses editable example tasks. Preview data stays in this browser.

## Cloud setup

1. Connect the Supabase and Vercel integrations in Codex. Inspect existing projects, migrations, policies, auth redirect URLs, environment variable names, and deployments before changes.
2. Select/create a development Supabase project. Apply the versioned migration after review. Configure email OTP and allow your local and Vercel preview redirect URLs.
3. Copy `.env.example` to `.env.local`; set the public Supabase URL and anonymous/publishable key. Never use a service-role key here.
4. Configure the same environment keys on the linked Vercel project using the Next.js preset. Production deployment is authorized; this local session currently needs Vercel CLI login and a target project before deployment.
5. Verify sign-in, CRUD, two-user isolation, offline retries, and recurrence against the real project. See qa-checklist.md.

## Validation

`npm test`, `npm run typecheck`, and `npm run build`.

## Current limits

Remote infrastructure has not been inspected or changed. Background push, concurrent-device conflict merging, and collaboration screens are deferred. Foreground notification checks require explicit browser permission. Up to 1000 current records are loaded; pagination is needed before larger accounts. App icons use scalable SVG; dedicated raster Apple touch/PWA icons should be added before store/wrapper release.
