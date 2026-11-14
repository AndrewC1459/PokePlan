# Poképlan

Poképlan is a React and Vite application. Its page is composed from reusable React components in `src/components` and `src/App.jsx`.

The game systems run as classic scripts in `src/game`, loaded in file-name order and sharing globals. They work with the React-rendered page through element IDs.

- `01-core.js` is the core: accounts, quests (add, edit, sort, repeat, undo), the calendar, XP, reminders, the single background animation loop, and `bootPlanner()` (called once every script has loaded).
- Later files add scenery, wildlife, partner progression, battle art, and polish. They wrap or assign core functions such as `renderPokemon`, `renderXP`, `animateQuests`, `drawWorld`, and `drawMove`. Every save goes through `persist()`.
- Pure logic lives in `src/planner` as ES modules with unit tests: dates, repeats and the daily rollover (`schedule.js`), merging two copies of a save (`merge.js`), and conflict-safe cloud writes (`cloudSave.js`). The core reaches `schedule.js` and `mergeSaves` through `window.PlannerLogic`.

All styles live in `src/styles.css`; the scripts don't inject CSS.

Poképlan is installable (`public/manifest.webmanifest`, `public/sw.js`). The service worker caches nothing; it only lets reminder notifications open the app. Reminders go out while Poképlan is open in a tab (even in the background) or as an installed app; reminders with the app fully closed would need a push server.

Sprites are served from `public/sprites` (Gen V animated sprites from Pokémon Showdown and the PokeAPI sprite collection).

Each day, finished quests from earlier days are cleared, unfinished one-off quests carry over to today, and missed copies of repeating quests are dropped.

## Run locally

```sh
pnpm install
pnpm dev
```

Create a production build with `pnpm build`; preview it with `pnpm preview`. Run the unit tests with `pnpm test`.

Add `?preview` to the URL for a sample trainer that never saves.

## Accounts (Supabase)

Accounts and saves are stored in Supabase so they work in any browser. `src/cloudSync.js` handles sign-up/log-in with Supabase Auth and keeps each user's save in the `planner_saves` table; browser local storage is only a cache.

- Run `supabase/schema.sql` once in the Supabase SQL Editor.
- On Vercel, the Supabase integration provides `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `..._ANON_KEY`); `vite.config.js` maps them for the browser.
- Locally, run `vercel env pull .env.local` to get the same keys. Without a key, accounts fall back to this-browser-only storage.

Accounts created before cloud saves are moved online automatically the first time their owner logs in.

Each write only replaces the cloud copy the tab last read (matched on `updated_at`). If another device saved in between, the two copies are merged quest by quest and saved again. Deleted quests are remembered for 30 days so an older copy can't bring them back. Returning to the tab loads any newer cloud copy.
