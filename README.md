# Poképlan

Poképlan is a React and Vite application. Its page is composed from reusable React components in `src/components` and `src/App.jsx`.

The existing quest, calendar, progression, battle, terrain, and sprite behavior is preserved in `src/legacy`. Those scripts currently integrate with the React-rendered component tree through the existing element IDs. This keeps the feature set intact during the migration; the next refactor can move each behavior into React state and hooks.

## Run locally

```sh
pnpm install
pnpm dev
```

Create a production build with `pnpm build`; preview it with `pnpm preview`.

## Accounts (Supabase)

Accounts and saves are stored in Supabase so they work in any browser. `src/cloudSync.js` handles sign-up/log-in with Supabase Auth and keeps each user's save in the `planner_saves` table; browser local storage is only a cache.

- Run `supabase/schema.sql` once in the Supabase SQL Editor.
- On Vercel, the Supabase integration provides `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `..._ANON_KEY`); `vite.config.js` maps them for the browser.
- Locally, run `vercel env pull .env.local` to get the same keys. Without a key, accounts fall back to this-browser-only storage.

Accounts created before cloud saves are moved online automatically the first time their owner logs in.
