# Deploying Kodee on Railway

One Railway **project**, one Postgres, and **three services** off the same repo — each with a different **Root Directory**:

| Service | Root Directory | Type | Public domain |
|---------|----------------|------|---------------|
| `kodee-backend` | `backend` | Node (Express API) | yes |
| `kodee-admin` | `admin` | Static SPA (Vite) | yes |
| `kodee-portal` | `portal` | Static SPA (Vite) | yes |

Each service has its own `railway.json`, so build/start are already defined — you only set the Root Directory and the variables below.

---

## 1. Repo → GitHub

Push the monorepo to a GitHub repo (`.gitignore` is included). Railway deploys from the repo root; each service is scoped by its Root Directory.

## 2. Create the project + Postgres

1. **New Project** → **Deploy from GitHub repo** → pick the repo (this creates the first service; set it up as the backend in step 3).
2. **New** → **Database** → **Add PostgreSQL**.

## 3. Backend service (`kodee-backend`)

- **Settings → Root Directory:** `backend`
- **Settings → Networking:** **Generate Domain** (note it, e.g. `kodee-backend-production.up.railway.app`).
- **Variables:**

  ```
  DATABASE_URL=${{Postgres.DATABASE_URL}}
  JWT_SECRET=<long random string>
  PAYMENT_WINDOW_DAYS=5
  ENABLE_SCHEDULER=true
  AT_USERNAME=
  AT_API_KEY=
  AT_SENDER_ID=KODEE
  # set this after the frontends have domains (step 6)
  CORS_ORIGINS=
  ```

Build/deploy are automatic: Nixpacks installs (the `postinstall` runs `prisma generate`), `npm run build` compiles TS, then on deploy `railway.json` runs `prisma db push` and starts `node dist/index.js`. Health check hits `/api/health`.

## 4. Admin service (`kodee-admin`)

- **New** → **GitHub Repo** → same repo.
- **Settings → Root Directory:** `admin`
- **Generate Domain.**
- **Variables** — the API URL is read at **container start** (not build), so a plain redeploy/restart picks up changes; no rebuild needed:

  ```
  API_URL=https://${{kodee-backend.RAILWAY_PUBLIC_DOMAIN}}/api
  ```

  (Or a literal `https://<backend-domain>/api`. A bare origin without `/api` also works — the start script appends it.)

## 5. Portal service (`kodee-portal`)

Same as admin, Root Directory `portal`, same `API_URL`.

## 6. Close the CORS loop

Back on **kodee-backend → Variables**, set:

```
CORS_ORIGINS=https://${{kodee-admin.RAILWAY_PUBLIC_DOMAIN}},https://${{kodee-portal.RAILWAY_PUBLIC_DOMAIN}}
```

Redeploy the backend. Done — the API now only accepts the two frontends, and each frontend talks to the API.

> The frontends read `API_URL` at **container start** (a small script writes `dist/env.js`), so changing the backend URL only needs a redeploy/restart of the frontend — never a rebuild. The reference-variable form still needs the backend service to exist so `${{kodee-backend.RAILWAY_PUBLIC_DOMAIN}}` resolves; if it ever resolves empty, the app falls back to `/api` and login will report exactly that.

## 7. Seed once (optional demo data)

The seed **wipes and repopulates** (`deleteMany`), so only run it on a fresh DB. From your machine with the Railway CLI:

```bash
railway link                       # pick the project
railway service                    # select kodee-backend
railway run npm run seed           # runs against the Railway Postgres
```

Then log in with `landlord@kodee.app` / `kodee1234`.

---

## Local development against Railway Postgres

No local Postgres needed — borrow Railway's:

```bash
cd backend
railway link && railway service        # select kodee-backend
railway run npm run setup              # generate + db push + seed (first time)
railway run npm run dev                # API on :4000 with Railway's DATABASE_URL
```

Frontends run normally (`npm run dev`); their Vite proxy sends `/api` → `localhost:4000`, so no `VITE_API_URL` is needed in dev.

---

## Notes

- **Schema changes:** `railway.json` runs `prisma db push` on every deploy (matches the Dartbit flow — fast, no migration files). When you want history/rollbacks, generate migrations locally (`npx prisma migrate dev --name <change>`), commit the `prisma/migrations/` folder, and change the backend start command to `npx prisma migrate deploy && node dist/index.js`.
- **Scheduler:** the monthly invoice/SMS cron runs inside the backend service. On a single instance that's correct; if you ever scale the backend to >1 replica, move the cron to a dedicated worker service (or a Railway cron) so reminders don't double-send.
- **Secrets:** set a real `JWT_SECRET`. Put shared vars in a Railway **Variable Group** if you prefer.
- **Node:** pinned to `>=20` via `engines` in each `package.json`.
