# Poképlan

Poképlan is a React and Vite application. Its page is composed from reusable React components in `src/components` and `src/App.jsx`.

The existing quest, calendar, progression, battle, terrain, and sprite behavior is preserved in `src/legacy`. Those scripts currently integrate with the React-rendered component tree through the existing element IDs. This keeps the feature set intact during the migration; the next refactor can move each behavior into React state and hooks.

## Run locally

```sh
pnpm install
pnpm dev
```

Create a production build with `pnpm build`; preview it with `pnpm preview`.

Accounts and tasks still use browser local storage. React does not provide server-side account storage; connect a backend such as Supabase to share user data across devices.
