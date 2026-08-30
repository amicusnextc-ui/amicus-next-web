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

Mail goes out through `api/_mail.js`: **Resend when `RESEND_API_KEY` is set**
(the same provider, key and verified `amicuschurch.com` domain the
amicus-checkin project already uses — copy the value from that project's
environment variables), otherwise Mailtrap. With neither, the API returns
`email_not_configured` (503) and the form falls back to a local, unsent match.

| Variable | Required | Notes |
|---|---|---|
| `RESEND_API_KEY` | one of the two | Same key as the amicus-checkin project; sends from `noreply@amicuschurch.com` by default |
| `EMAIL_SIGNING_SECRET` | yes | **32+ characters.** Signs the verification token. Generate with `openssl rand -hex 32` |
| `MAIL_FROM_EMAIL` | Mailtrap only | Optional under Resend (defaults to `noreply@amicuschurch.com`; must be on a domain Resend has verified) |
| `MAIL_FROM_NAME` | no | Defaults to `AMICUS NEXT CHURCH` |
| `MAIL_REPLY_TO` | no | Sets `reply_to` |
| `PARTNER_EVENT_CODE` | no | Defaults to `AMICUS26`; must match the code on the printed sign |
| `ALLOWED_ORIGINS` | no | Comma-separated extra origins |
| `MAILTRAP_API_KEY` | one of the two | Fallback provider, used only when `RESEND_API_KEY` is absent |
| `MAILTRAP_USE_SANDBOX` | no | `true` routes Mailtrap to its sandbox; requires `MAILTRAP_INBOX_ID` |
| `MAILTRAP_INBOX_ID` | if sandbox | Required when `MAILTRAP_USE_SANDBOX=true` |
| `NOTION_API_KEY` | for records | Internal-integration secret; see **Records in Notion** below |
| `NOTION_APPLICATIONS_DB` | no | Overrides the 신청 database id (default baked in) |
| `NOTION_PRAYER_LOG_DB` | no | Overrides the 기도 기록 database id (default baked in) |

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

## Records in Notion

Verified applications and anonymous prayer counts are written to two Notion
databases under the **Prayer Partners 데이터** page
(<https://app.notion.com/p/3ccceab2cacc818187cdd83d09e16c50>):

- **기도 파트너 신청** (`37018bf4e2574ddcb44b74cf57ff5109`) — one row per
  verified application: partner, email, matched student, pickup code, whether
  the PDF email went out. Written when verification succeeds; a resend updates
  the row (deduped by 신청 ID) instead of duplicating it.
- **기도 기록** (`82d7e115616440a791e6939175c148a2`) — one row per person with
  an anonymous count, bumped by the directory's "오늘 기도 기록하기" button.
  Who prayed is never recorded, only that someone did.

The same record drives behavior, not just reporting:

- **Matching avoids duplicates.** Students without a partner are matched
  first, and a department genuinely closes once everyone in it has one.
- **Waiting numbers are real.** `/api/availability` serves per-department
  waiting counts from the record; the home page, application form, and
  directory badges all use it, falling back to their old localStorage
  estimates when the record is unreachable.

### Enabling it

1. Create an **internal integration** at <https://www.notion.so/profile/integrations>
   (workspace: the church workspace) and copy its secret.
2. Open the **Prayer Partners 데이터** page → ⋯ menu → **Connections** →
   connect the integration. Both databases inherit access from the page.
3. Add the secret as `NOTION_API_KEY` in Vercel (Production **and** Preview)
   and redeploy.

### When it is off or down

Nothing breaks: applications, matching (deterministic hash), email and PDF all
keep working; `/api/availability` returns 503 and the pages quietly fall back
to per-browser numbers; prayer counts stay device-only and the dialog's
wording says so. The Notion write itself is best-effort — an outage costs the
row, never the applicant's prayer card.
