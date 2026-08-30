# Prayer Partners — deployment

The site is served by the **`amicus-prayer-partner`** Vercel project, deployed
from `amicusnextc-ui/amicus-next-web`.

The repository holds two sites. `amicus-next-web` (the news/postcard site)
deploys from the repository root; Prayer Partners deploys from this
subdirectory. That only works if the project's **Root Directory** is set to
`prayer-partner` — otherwise Vercel builds the repository root, the pages land
under `/prayer-partner/…`, and `api/` resolves to the root project's functions
rather than the ones in this folder.

| Setting | Value |
|---|---|
| Root Directory | `prayer-partner` |
| Framework preset | Other (none) |
| Connected repository | `amicusnextc-ui/amicus-next-web` |

Until Aug 2026 this project had no Git connection and every production
deployment was a `vercel deploy` run by hand from inside this directory, which
is why Root Directory had never been set. It is set now and deployments come
from Git. Do not go back to deploying this directory by hand — a CLI deploy and
a Git deploy will fight over which one is live.

## Environment variables

Set these for **Production _and_ Preview**. Preview is easy to miss, and
without it no preview deployment can exercise email at all.

| Variable | Required | Notes |
|---|---|---|
| `MAILTRAP_API_KEY` | yes | Missing → the API returns `email_not_configured` (503) and the form falls back to a local, unsent match |
| `MAIL_FROM_EMAIL` | yes | Sender address |
| `EMAIL_SIGNING_SECRET` | yes | **32+ characters.** Signs the verification token. Generate with `openssl rand -hex 32` |
| `MAIL_FROM_NAME` | no | Defaults to `AMICUS NEXT CHURCH` |
| `MAIL_REPLY_TO` | no | Sets `reply_to` |
| `PARTNER_EVENT_CODE` | no | Defaults to `AMICUS26`; must match the code on the printed sign |
| `ALLOWED_ORIGINS` | no | Comma-separated extra origins |
| `MAILTRAP_USE_SANDBOX` | no | `true` routes to the Mailtrap sandbox — **use this on Preview** so test submissions never reach real addresses |
| `MAILTRAP_INBOX_ID` | if sandbox | Required when `MAILTRAP_USE_SANDBOX=true` |

## Origins

`api/_http.js` rejects requests whose `Origin` is not allowlisted. The list is
the production domain, localhost, the deployment's own hostnames (Vercel
injects `VERCEL_URL`, `VERCEL_BRANCH_URL`, `VERCEL_PROJECT_PRODUCTION_URL`),
and anything in `ALLOWED_ORIGINS`.

Including the deployment's own hostnames is what lets a preview call its own
API. Without it, only production could send email, so nothing could be
verified before release.

## Functions

`vercel.json` in this directory declares the two routes. `includeFiles` on the
PDF route bundles the Korean font, without which the generated prayer card
renders CJK as blank boxes.

- `api/request-email-verification.js` — 10s
- `api/verify-send-prayer-card.js` — 20s, bundles `api/fonts/**`

## Checking a deployment

1. Open `partner.html?code=AMICUS26` and complete the three steps.
2. Submit. A 6-digit code should arrive (or land in the Mailtrap sandbox inbox).
3. Enter it — a student is matched and the PDF prayer card is emailed.

If submitting shows "이메일 발송 설정이 아직 완료되지 않았습니다", the
environment variables above are missing for that environment. If it shows
"요청한 사이트를 확인할 수 없습니다", the origin was rejected.
