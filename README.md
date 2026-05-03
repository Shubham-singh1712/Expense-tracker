# AutoSpend AI

A dependency-free local-first prototype for the full AutoSpend workflow.

## Included

- Dashboard with income, expense, balance, monthly budget, charts, and reports.
- Manual transaction CRUD with category, merchant, method, source, status, and duplicate checks.
- Cash/no-receipt text parser that turns short natural-language entries into transactions.
- Receipt/screenshot upload intake that creates review items.
- Google account and Drive folder simulation for local development.
- Drive scan simulation with processing queue, statuses, review routing, and duplicate detection.
- Review inbox with approve, edit, keep-both, and reject actions.
- Finance assistant that answers from saved local transactions.
- CSV, JSON, and print export.
- Browser `localStorage` plus optional **SQLite** sync via the local backend (`autospend.db` in the project folder).
- Local AI backend proxy for OpenAI-powered parsing and assistant replies.

## Run

**Recommended:** run `.\start-autospend.ps1` — it creates `.env` if missing, starts the backend in a new window, and opens the app at `http://127.0.0.1:8787/`.

Alternatively run `.\start-backend.ps1` (or `python .\backend\server.py` from the project folder), then open `http://127.0.0.1:8787/` in your browser. You can still open `index.html` directly, but using the same origin as the API avoids browser restrictions and keeps Google OAuth popups working reliably.

## AI setup

1. Copy `.env.example` to `.env`.
2. Put your OpenAI API key in `.env` as `OPENAI_API_KEY=...`.
3. Run `.\start-backend.ps1`.
4. In Settings, keep the AI backend URL as `http://127.0.0.1:8787` and use Check AI.

The API key is read only by the local backend. It is not stored in browser `localStorage` or committed into source code.

## Google Drive integration

1. Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` to `.env`.
2. Do not leave placeholder values like `replace_with_google_client_id` or `replace_with_google_client_secret`.
3. Set `GOOGLE_REDIRECT_URI` to `http://127.0.0.1:8787/oauth2callback` in the Google Cloud OAuth consent screen.
4. Restart the backend.
5. Open the app and use the Drive section to connect and scan your Drive folder.

## Google Sign-in

The app supports Google OAuth for user authentication. Use the "Sign in with Google" button in Settings to authenticate and populate your profile information.

The same Google Cloud credentials are used for both user auth and Drive access.

Open the app at `http://127.0.0.1:8787/` (not as a raw `file://` page) so Google OAuth popups can post a result back to your tab securely.
