# NomLog

Voice-first food logging. Next.js (App Router) + Supabase (Postgres, auth) + Gemini. Also serves as the backend for the native iOS app in `NomLog-iOS/`.

## Running the app

### Testing the iOS app in the simulator (or just using the app): production mode

```bash
rm -rf .next && npm run build && npm start
```

This serves precompiled, optimized code at http://localhost:3000 — the simulator points there by default. **Always use this when testing the iOS app.** The dev server (below) compiles each route on first hit and can take minutes per screen, which makes the app feel broken.

### Editing web code: dev mode

```bash
npm run dev
```

Use only while actively changing web code (hot reload). If the dev server hangs and never binds, delete `.next` and retry.

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | What it is |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (server-only; account deletion) |
| `GEMINI_API_KEY` | Google Gemini API key |
| `NEXT_PUBLIC_SITE_URL` | The app's public URL (auth redirects) |

## Deploying to Vercel

1. Push this repo to GitHub and import it at [vercel.com/new](https://vercel.com/new) (framework auto-detected as Next.js; no build settings needed).
2. In the Vercel project settings → Environment Variables, add every variable from the table above. Set `NEXT_PUBLIC_SITE_URL` to the Vercel URL (e.g. `https://nomlog.vercel.app`).
3. In the Supabase dashboard → Authentication → URL Configuration, add the Vercel URL to Site URL / Redirect URLs so Google sign-in redirects back correctly.
4. Deploy. Then point the iOS app at production: change `apiBase` in `NomLog-iOS/NomLog/App/SupabaseConfig.swift` from `http://localhost:3000` to the Vercel URL and rebuild the app.

Note: the Gemini free tier allows ~20 requests/day/model — tips and recaps are cached server-side (one per day/week per user) to stay under it.
