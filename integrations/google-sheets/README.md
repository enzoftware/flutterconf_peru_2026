# Sign-ups → Google Sheets

The "Avísame primero" form on the landing posts to a Google Apps Script web app, and the script appends one row per person to a spreadsheet. You don't need a server, a Google Cloud project or a service-account key.

## Setup (about 5 minutes)

1. Create a Google Sheet, for example "FlutterConf Perú 2026 · Registros", with the account that should own the data.
2. In the sheet, open **Extensions → Apps Script**.
3. Replace the contents of `Code.gs` with [`Code.gs`](./Code.gs) from this folder, then save.
4. Click **Deploy → New deployment**, choose the type **Web app**, and set:
   - *Execute as:* **Me**
   - *Who has access:* **Anyone**
5. Click **Deploy** and authorize the script. Google warns that the app is unverified: choose *Advanced → Go to …* (it is your own script).
6. Copy the **Web app URL**. It ends in `/exec`.
7. Paste the URL into `.env` as `PUBLIC_REGISTER_ENDPOINT=…` for local work, and add a repository secret with the same name for the deploy (GitHub → Settings → Secrets and variables → Actions).
8. Test it: open the URL in a browser, and it should answer `{"ok":true,…}`. Then submit the form from `npm run dev`. A **Registros** tab with headers appears on the first sign-up.

When you change `Code.gs`, use **Deploy → Manage deployments → Edit → Version: New version**. That keeps the same URL. A *new deployment* creates a new URL.

Check the deployment any time with `npm run check:keys`. It reports the deployed `Code.gs` version and probes the validations without writing any row.

## What is stored

| Column | From |
| --- | --- |
| Fecha (Lima) | Server time, America/Lima |
| Nombre, Correo, Perfil, Ciudad | The form (the city is optional) |
| Acepta correos | The required consent checkbox |
| Fuente, UTM source, UTM medium, UTM campaign, Página | `?ref=` and `utm_*` from the landing URL, so you can see which post brought each person |
| Clave correo | Normalized email used to detect duplicates (filled from version 2 on) |

To count interested people, use the row count, or add `=COUNTA(Registros!C2:C)` in another tab. PostHog also gets a `register_succeeded` event without personal data, so the funnel (page view → form started → sign-up) lives there.

## Spam, duplicates and security

The web app URL is public because the static page needs it, so every rule is enforced on the server (`Code.gs`). The form runs the same rules (`src/lib/registration.ts`) so people see the error right away.

| Threat | Defense |
| --- | --- |
| Bots filling every field | Hidden honeypot field `website`. The server answers ok and writes nothing, so bots don't learn they were caught |
| Bots submitting instantly | Time trap: anything sent less than 2.5 s after the page loaded is dropped the same way |
| Link spam in free text | Names and cities accept only letters, accents, spaces, `'`, `.` and `-`. No digits, URLs, domains or `<>` |
| Fake or throwaway emails | Strict email format, plus a blocklist of disposable inbox providers (mailinator, yopmail…) |
| Duplicates | One row per inbox. The key ignores case, `+tags` and Gmail dots (`Ana.Q+pe@gmail.com` = `anaq@gmail.com`). It is stored in the **Clave correo** column. The browser also remembers a successful sign-up and says "ya estabas en la lista" |
| Hammering | The same inbox at most once every 10 minutes, and 60 sign-ups per minute overall |
| Oversized or malformed requests | 2 KB body limit, JSON parsed inside try/catch, unknown roles refused, consent must be exactly `true` |
| Formula injection | Values starting with `= + - @` are stored as text, so opening the sheet never runs them |
| Concurrent writes | A script lock around the duplicate check and the append |

What it can't do: Apps Script doesn't expose the caller's IP or `Origin` header, so it can't block one client or one website. If spam gets through anyway, add Cloudflare Turnstile: a site key in the form, with the secret kept in the script's **Project Settings → Script properties**.

Privacy: the sheet stays private, because only the script, running as you, can write to it, and nobody can read it through the URL. The data is personal (name and email). Share the sheet only with the organizers, and use it only for what the form promises: news about FlutterConf Perú.

## Tests

`npm test` runs `Code.test.mjs`, which loads `Code.gs` in Node with in-memory fakes of SpreadsheetApp, CacheService and LockService. It also runs the same validation cases against the form rules, so the two can't drift apart.
