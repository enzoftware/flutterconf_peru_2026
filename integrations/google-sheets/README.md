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

## What is stored

| Column | From |
| --- | --- |
| Fecha (Lima) | Server time, America/Lima |
| Nombre, Correo, Perfil, Ciudad | The form (the city is optional) |
| Acepta correos | The required consent checkbox |
| Fuente, UTM source, UTM medium, UTM campaign, Página | `?ref=` and `utm_*` from the landing URL, so you can see which post brought each person |

To count interested people, use the row count, or add `=COUNTA(Registros!C2:C)` in another tab. PostHog also gets a `register_succeeded` event without personal data, so the funnel (page view → form started → sign-up) lives there.

## Security notes

- The web app URL is public because the static page needs it. The script defends itself: field validation and length limits, a honeypot field for bots, one row per email, a global limit of 60 sign-ups per minute, a lock for concurrent writes, and protection against formula injection.
- The sheet itself stays private. Only the script, running as you, can write to it, and nobody can read it through the URL.
- The data is personal (name and email). Share the sheet only with the organizers, and use it only for what the form promises: news about FlutterConf Perú.
