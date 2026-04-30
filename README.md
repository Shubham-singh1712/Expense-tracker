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
- Browser `localStorage` persistence.
- Local AI backend proxy for OpenAI-powered parsing and assistant replies.

## Run

Open `index.html` in a browser.

## AI setup

1. Copy `.env.example` to `.env`.
2. Put your OpenAI API key in `.env` as `OPENAI_API_KEY=...`.
3. Run `.\start-backend.ps1`.
4. In Settings, keep the AI backend URL as `http://127.0.0.1:8787` and use Check AI.

The API key is read only by the local backend. It is not stored in browser `localStorage` or committed into source code.

Live Google OAuth, real Drive API scanning, and hosted PostgreSQL still need separate cloud setup before replacing the local simulation layers.
