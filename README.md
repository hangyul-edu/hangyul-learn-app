# 한귤 · Hangyul — Member App (Frontend)

A polished, mobile-first **consumer app** for Hangyul, built with **React + Vite +
TypeScript**. It is a real language-learning experience (home dashboard,
conversation & TOPIK learning, streaks, leagues, friends, AI tutor, subscription,
settings) **and** a complete client that exercises every member-facing API in the
backend.

It is intentionally **not** an API tester or admin panel: no raw payloads, no
endpoint names, no developer controls are shown to users. Admin-only APIs are not
integrated.

---

## 1. Requirements

- **Node.js ≥ 18** (tested on 20/22/26) and npm.
- The **Hangyul backend** running and reachable (see §5).

---

## 2. Install dependencies

```bash
cd frontend
npm install
```

---

## 3. Configure environment variables

Copy the example file and edit if needed:

```bash
cp .env.example .env
```

| Variable | Purpose | Default |
|---|---|---|
| `VITE_API_BASE_URL` | Backend base URL used by the app. **Leave empty for local dev** → the app calls `/api`, which the Vite dev server proxies to the backend (no CORS). Set it to the real origin for production builds, e.g. `https://api.hangyul.app`. | *(empty → `/api`)* |
| `VITE_DEV_BACKEND` | Where the dev proxy forwards `/api` (dev only). | `http://127.0.0.1:8000` |

### Setting the backend API base URL

- **Local development:** leave `VITE_API_BASE_URL` empty and point `VITE_DEV_BACKEND`
  at your backend (default `http://127.0.0.1:8000`). The dev proxy strips the
  `/api` prefix, so `/api/users/me` → `http://127.0.0.1:8000/users/me`.
- **Production / hosted backend:** set `VITE_API_BASE_URL=https://your-backend`
  before building. The app then calls that origin directly. The backend already
  allows all origins (CORS `*`) and the app uses bearer tokens (no cookies), so
  cross-origin works out of the box.

---

## 4. Run the frontend locally

```bash
npm run dev
```

Open **http://localhost:5173**. On a desktop browser the app renders inside a
centered phone frame; on a phone it fills the screen. It hot-reloads on save.

---

## 5. Run the backend together with the frontend

From the **repository root** (one directory up):

```bash
# 1) Provide a database schema.
#    Option A — Postgres (production-like): run the migrations.
DB_URL="postgresql+asyncpg://user:pass@localhost/hangyul" .venv/bin/alembic upgrade head

#    Option B — quick SQLite for local testing (no Postgres needed).
#    Create all tables from the ORM metadata, then point the app at the file:
.venv/bin/python - <<'PY'
from sqlalchemy import create_engine
import apps.api.main            # registers every ORM model
from src.common.db.base import Base
Base.metadata.create_all(create_engine("sqlite:////tmp/hangyul_dev.db"))
print("schema ready")
PY

# 2) Start the API. APP_ENV=local logs verification codes so you can complete
#    phone/email verification without a real SMS/email provider.
DB_URL="sqlite+aiosqlite:////tmp/hangyul_dev.db" APP_ENV=local \
  .venv/bin/python -m uvicorn apps.api.main:app --port 8000 --reload
```

On startup the API seeds demo content (subscription plans, sentences, quizzes,
FAQs, notices). In a **second terminal**, run the frontend (`npm run dev`).
That's it — the two talk over the dev proxy.

> The offline backend uses mock providers: verification codes are **printed to the
> API log** instead of sent by SMS/email, learning uses a deterministic mock
> speech evaluator, and AI replies come from a stub. Everything is testable
> without any third-party keys.

---

## 6. Open and test the web app

Go to **http://localhost:5173**. You land on the welcome screen.

### Test the main member flows

1. **Sign up** → *이메일로 시작하기*: enter name, phone, email, password →
   verify phone → verify email → accept agreements → done. The account is created
   and you're logged in.
   - **Getting the verification codes (offline dev):** they're in the API log.
     ```bash
     # phone code
     grep "verification code to +8210" /tmp/hangyul-api.log | tail -1
     # email code
     grep "email verification code to" /tmp/hangyul-api.log | tail -1
     ```
2. **Profile setup** → nickname (tap 중복확인) + pick an avatar → 다음.
3. **Onboarding** → choose 회화 or TOPIK → level/target → daily goal → 시작.
4. **Home** → streak, daily-goal rings per track, quick actions.
5. **회화 학습** → play audio, tap 🎙️ *따라 말하기* to record and get a
   pronunciation score, save ⭐ sentences.
6. **TOPIK 학습** → daily set + browse → solve a question → see grading.
7. **학습 → 강의** → browse courses → open a lesson → watch (progress saved) →
   for TOPIK lessons, tap *복습 문제 풀기* to run an AI practice set.
8. **학습 → TOPIK 기출 모의고사** → pick an exam → answer → get scored.
9. **학습 → AI 추천 문장** → optionally type a situation → get tailored sentences.
10. **리그** → your rank, weekly leaderboard, daily 출석 (attendance).
11. **친구** → search by phone, send/accept requests.
12. **AI 튜터** → chat with the tutor.
13. **멤버십** → start a trial / subscribe, apply a coupon, manage **결제 수단**
    (add a card via the hosted-widget intent → paste the authKey to confirm) and
    view **결제 내역** (invoices).
14. **내 정보** → settings, **계정 관리** (change email / phone / password),
    logout, delete account.

> Premium-gated areas (lecture playback, AI practice, exams, higher daily goals)
> return `402` for free members; the app shows a clean upgrade prompt. Start a
> free trial from **멤버십** to unlock them for testing.

### Use test accounts

There are no pre-seeded end-user accounts (users are created via sign-up). The
fastest path is to **sign up a fresh account** as above — with `APP_ENV=local`
the codes are in the log, so it takes seconds. Re-use that account to log in
later; toggle **자동 로그인 유지** on the login screen to test auto-login (reload
the page — you stay signed in).

### Verify authentication and API integration

- After login, reload the browser: you remain signed in (**auto-login** restores
  the session from `localStorage` and calls `/users/me`).
- Open **DevTools → Network** and watch requests carry
  `Authorization: Bearer …`. When the access token expires the app calls
  `/auth/token/refresh` transparently and retries; if the refresh token is dead
  it signs you out and returns to the welcome screen.
- Every screen calls real endpoints — Home → `/dashboard/summary`, 리그 →
  `/leagues/me` + `/leagues/rankings`, etc.

---

## 7. Build for production

```bash
VITE_API_BASE_URL=https://your-backend npm run build   # type-checks, then bundles
npm run preview                                        # serve the built dist locally
```

The build output is static files in `frontend/dist/` — deploy them to any static
host (Netlify, Vercel, S3+CloudFront, Nginx…). Configure the host to **serve
`index.html` for unknown routes** (SPA fallback) so client-side routing works on
refresh/deep-links, and `admin.html` for `/admin` and `/admin/*` (two bundles,
two entry HTML files — see `docs/admin-portal.md`).

**Vercel** is covered by the checked-in `frontend/vercel.json`; set the project's
**Root Directory** to `frontend` so it is picked up. Its rewrites map `/admin`
and `/admin/*` to `admin.html` and everything else to `index.html`. Order
matters — the `/admin` rules must precede the catch-all — and Vercel checks the
filesystem before applying rewrites, so hashed `/assets/*` files still serve
normally. Without it a deep link like `/faq` 404s on refresh; `src/main.tsx`
also carries a runtime `/admin` → `admin.html` redirect as a last-resort
fallback for hosts that cannot be configured, which the rewrites make redundant.

Remember that `VITE_*` values are **inlined at build time**: changing one in the
host's dashboard requires a fresh build (redeploy with the build cache cleared),
not just a restart. Set `VITE_API_BASE_URL` explicitly for any host that is not
also serving the API — the `/api` default only resolves through the dev proxy or
a single-box deployment. The API must in turn list the deployed origin in
`CORS_ALLOW_ORIGINS` (see the root `.env.example`).

---

## 8. Project structure

```
frontend/
├─ index.html
├─ vite.config.ts          # dev server + /api → backend proxy
├─ .env.example
└─ src/
   ├─ main.tsx             # providers: QueryClient, Toast, Router, Auth
   ├─ App.tsx              # routes + auth gating (RequireAuth / RequireGuest)
   ├─ styles/              # design system (orange theme tokens + components)
   ├─ lib/                 # config, http client (+refresh), storage, types, format
   ├─ api/endpoints.ts     # typed API layer — one place, grouped by domain
   ├─ hooks/               # auth context, toast, login flow
   ├─ components/ui/        # Button, Field, Card, Modal, states, kit…
   ├─ components/layout/    # Screen, TopBar, AppShell (bottom nav)
   └─ screens/             # one folder-free file per journey screen
```

Design principles: a single typed API layer (`api/endpoints.ts`), a reusable UI
kit + consistent design tokens, `@tanstack/react-query` for
loading/error/retry/caching, and central token/refresh handling in `lib/http.ts`.

---

## 9. Troubleshooting

**CORS errors in the browser**
- In dev, always use `npm run dev` and leave `VITE_API_BASE_URL` empty — requests
  go through the same-origin `/api` proxy, so CORS never applies.
- In production the backend sends `Access-Control-Allow-Origin: *` and the app
  uses bearer tokens (no cookies). If you still see CORS errors, confirm
  `VITE_API_BASE_URL` points at the correct backend origin (scheme + host + port)
  and that the backend is actually reachable from the browser.

**“401 / logged out unexpectedly” or token expiration**
- Access tokens are short-lived (~30 min). The app refreshes them automatically.
- Refresh tokens are **single-use**; if two tabs race a refresh, one may be
  invalidated and you'll be signed out — just log in again.
- Changing your password intentionally signs you out of all sessions.

**API requests fail / spinner never ends**
- Check the backend is running: `curl http://127.0.0.1:8000/subscriptions/plans`
  should return JSON.
- Check the browser Network tab for the failing request's status and the JSON
  `code`/`detail` (the app surfaces `detail` as a friendly toast).
- Verify `VITE_DEV_BACKEND` matches where uvicorn is listening.

**Verification code never arrives**
- The offline backend does **not** send real SMS/email. Read the code from the
  API log (see §6). Ensure the API was started with `APP_ENV=local`.

**Environment/config not applied**
- Vite only reads `VITE_*` variables, and only at **dev-server start / build
  time**. After editing `.env`, restart `npm run dev` (or rebuild).

**Backend won't start**
- Most often the schema is missing. Run the migrations, or use the SQLite
  `create_all` snippet in §5. If startup logs a Redis warning, that's fine —
  without `REDIS_URL` the API uses an in-memory session store for dev.

**Microphone / pronunciation not working**
- The record button needs mic permission and a secure context. `localhost` is
  treated as secure; on other hosts serve over HTTPS.

**Blank page after deploying**
- Configure your static host's SPA fallback to serve `index.html` for all routes.
