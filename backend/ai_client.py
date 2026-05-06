"""LLM helpers: OpenAI (Responses API) or OpenRouter (Chat Completions, e.g. Gemini 2.5 Flash)."""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request

from catalog import EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS

DEFAULT_OPENAI_MODEL = "gpt-4.1-mini"
DEFAULT_OPENROUTER_MODEL = "google/gemini-2.5-flash"
OPENROUTER_BASE_DEFAULT = "https://openrouter.ai/api/v1"


def resolved_provider() -> str:
    p = (os.environ.get("AUTOSPEND_LLM_PROVIDER") or "").strip().lower()
    if p in ("openrouter", "openai"):
        return p
    if os.environ.get("OPENROUTER_API_KEY", "").strip():
        return "openrouter"
    return "openai"


def llm_health_info() -> dict:
    provider = resolved_provider()
    if provider == "openrouter":
        model = os.environ.get("OPENROUTER_MODEL", DEFAULT_OPENROUTER_MODEL).strip() or DEFAULT_OPENROUTER_MODEL
        key_ok = bool(os.environ.get("OPENROUTER_API_KEY", "").strip())
        return {"provider": "openrouter", "model": model, "keyConfigured": key_ok}
    model = os.environ.get("OPENAI_MODEL", DEFAULT_OPENAI_MODEL).strip() or DEFAULT_OPENAI_MODEL
    key_ok = bool(os.environ.get("OPENAI_API_KEY", "").strip())
    return {"provider": "openai", "model": model, "keyConfigured": key_ok}


# Backwards-compat for imports that referenced DEFAULT_MODEL
DEFAULT_MODEL = DEFAULT_OPENAI_MODEL


def output_text_responses_api(response: dict) -> str:
    if isinstance(response.get("output_text"), str):
        return response["output_text"]
    parts: list[str] = []
    for item in response.get("output", []):
        for content in item.get("content", []):
            text = content.get("text")
            if isinstance(text, str):
                parts.append(text)
    return "\n".join(parts).strip()


def extract_chat_completion_text(body: dict) -> str:
    choices = body.get("choices") or []
    if not choices:
        return ""
    msg = choices[0].get("message") or {}
    content = msg.get("content")
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        chunks: list[str] = []
        for part in content:
            if not isinstance(part, dict):
                continue
            typ = part.get("type")
            if typ == "text" and isinstance(part.get("text"), str):
                chunks.append(part["text"])
            if isinstance(part.get("text"), str) and typ != "text":
                chunks.append(part["text"])
        return "\n".join(chunks).strip()
    return ""


def parse_json_text(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.S)
        if not match:
            raise
        return json.loads(match.group(0))


def _openai_chat_messages(prompt: str, image_url: str | None) -> list[dict]:
    """OpenRouter / OpenAI Chat Completions message shape."""
    if image_url:
        return [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": image_url}},
                ],
            }
        ]
    return [{"role": "user", "content": prompt}]


def openrouter_request(prompt: str, image_url: str | None = None) -> str:
    api_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not configured")

    base = (os.environ.get("OPENROUTER_API_BASE") or OPENROUTER_BASE_DEFAULT).rstrip("/")
    model = (os.environ.get("OPENROUTER_MODEL") or DEFAULT_OPENROUTER_MODEL).strip() or DEFAULT_OPENROUTER_MODEL

    payload = {
        "model": model,
        "messages": _openai_chat_messages(prompt, image_url),
        "temperature": 0.12,
        "max_tokens": 4096,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    referer = os.environ.get("OPENROUTER_HTTP_REFERER", "").strip()
    if referer:
        headers["HTTP-Referer"] = referer
    title = os.environ.get("OPENROUTER_APP_TITLE", "AutoSpend AI").strip()
    if title:
        headers["X-Title"] = title

    req = urllib.request.Request(
        f"{base}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"OpenRouter API error {error.code}: {detail}") from error
    return extract_chat_completion_text(body)


def openai_responses_request(prompt: str, image_url: str | None = None) -> str:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")

    content = [{"type": "input_text", "text": prompt}]
    if image_url:
        content.append({"type": "input_image", "image_url": image_url, "detail": "auto"})

    payload = {
        "model": os.environ.get("OPENAI_MODEL", DEFAULT_OPENAI_MODEL),
        "store": False,
        "temperature": 0.12,
        "max_output_tokens": 1400,
        "input": [{"role": "user", "content": content}],
    }
    req = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"OpenAI API error {error.code}: {detail}") from error
    return output_text_responses_api(body)


def openai_request(prompt: str, image_url: str | None = None) -> str:
    """Single entrypoint used by ingestion: OpenRouter chat or OpenAI responses."""
    if resolved_provider() == "openrouter":
        return openrouter_request(prompt, image_url)
    return openai_responses_request(prompt, image_url)


def transaction_prompt(text: str, today: str, currency: str) -> str:
    return f"""
You extract exactly ONE personal finance transaction as strict JSON (no markdown, no prose).

Today is {today}. Default currency is {currency}. Prefer ISO date YYYY-MM-DD; if unclear use {today}.

Expense categories (pick one exactly): {", ".join(EXPENSE_CATEGORIES)}
Income categories (pick one exactly): {", ".join(INCOME_CATEGORIES)}
Payment methods (pick one exactly): {", ".join(PAYMENT_METHODS)}

Rules:
- "amount" is a positive number in {currency} (not a string).
- If the user describes salary, refund, or income, set "type" to "income" and pick an income category.
- Map UPI/card/credit/debit/wallet/cash from context into payment_method.
- "confidence" 0.0–1.0: lower if any field is guessed from weak cues.
- "note" short factual summary (<= 120 chars).

Return ONLY this JSON shape:
{{
  "type": "expense",
  "amount": 0,
  "currency": "{currency}",
  "date": "YYYY-MM-DD",
  "merchant": "Unknown",
  "category": "Other expense",
  "payment_method": "Cash",
  "note": "",
  "confidence": 0.85
}}

User input:
{text}
""".strip()


def assistant_prompt(
    question: str,
    transactions: list[dict],
    settings: dict,
    *,
    ledger_history: list[dict] | None = None,
) -> str:
    compact_transactions = transactions[-250:]
    ledger_block = ""
    if ledger_history:
        ledger_block = f"""
Persisted SQLite history (recent normalized rows — use with client transactions for trends/anomalies):
{json.dumps(ledger_history, ensure_ascii=False)}
"""
    return f"""
You are AutoSpend's finance assistant for an Indian household budget app.

Answer using the Settings, Client transactions snapshot, AND any Persisted SQLite history below.

Use History to spot anomalies, repeating merchants, spikes vs recent averages — only cite numbers visible in JSON.

Rules:
- 2–5 short sentences or bullets; cite currency from settings where relevant.
- If lists conflict, prefer Persisted SQLite history for chronological truth and cite both when they disagree.
- Do not invent merchants, amounts, or dates.

Settings:
{json.dumps(settings, ensure_ascii=False)}

Client transactions (from browser snapshot):
{json.dumps(compact_transactions, ensure_ascii=False)}
{ledger_block}
Question:
{question}
""".strip()


def contextual_analysis_prompt(norm_tx: dict, history_summaries: list[dict], currency: str) -> str:
    return f"""
You compare ONE new transaction against prior History ONLY. Do not invent merchants, amounts, or dates.

New transaction (JSON):
{json.dumps(norm_tx, ensure_ascii=False)}

History (latest up to 10 JSON objects, omit fields you do not need; may be empty):
{json.dumps(history_summaries, ensure_ascii=False)}

Return ONLY valid minified JSON with EXACTLY these keys (no markdown, no code fences):
{{
  "category": "",
  "total": "",
  "insights": "",
  "suggestions": []
}}

Rules:
- "category": best label for the new expense/income aligned with New transaction.category.
- "total": human-readable total using currency {currency}, e.g. "{currency} 1,250" matching New transaction.amount.
- "insights": 1–3 sentences. Reference History when useful (merchant/category/date). Mention anomalies vs recent pattern (duplicate spend, unusually high/low, category drift). If History is empty, say there is no prior data to compare yet.
- "suggestions": 2–5 short actionable items based ONLY on measurable patterns vs History (budget caps, review duplicates, consolidate subscriptions). No generic platitudes ("save more money") unless tied to observed numbers.

If unsure, reduce confidence wording in insights; never fabricate numeric comparisons not supported by History.
""".strip()
