"""
Unified ingestion: extract transaction → contextual AI analysis → SQLite ledger persistence.

Keeps OAuth and auth untouched; wired from server route handlers only.
"""

from __future__ import annotations

import json
import secrets
import time
from collections.abc import Callable
from typing import Any

import sqlite3

from db import upsert_transaction_ledger

from ai_client import (
    contextual_analysis_prompt,
    openai_request,
    parse_json_text,
    transaction_prompt,
)

# normalize_transaction injected from server.py to avoid duplicating clamps.

_INGEST_NS = "ing"


def new_ingest_id() -> str:
    return f"{_INGEST_NS}-{secrets.token_hex(10)}"


def _summarize_payload(row_payload: dict) -> dict:
    """Strip PII-heavy fields while keeping comparisons useful for AI context."""
    return {
        "type": row_payload.get("type"),
        "amount": row_payload.get("amount"),
        "currency": row_payload.get("currency"),
        "date": row_payload.get("date"),
        "merchant": row_payload.get("merchant"),
        "category": row_payload.get("category"),
        "method": row_payload.get("method"),
        "status": row_payload.get("status"),
    }


def fetch_history_summaries(conn: sqlite3.Connection, limit: int = 10) -> list[dict]:
    rows = conn.execute(
        """
        SELECT payload FROM tx_ledger ORDER BY updated_at DESC LIMIT ?
        """,
        (limit,),
    ).fetchall()
    out = []
    for row in rows:
        try:
            import crypto
            payload = json.loads(crypto.decrypt(row["payload"]))
        except (TypeError, ValueError):
            continue
        if isinstance(payload, dict):
            out.append(_summarize_payload(payload))
    return out


def coerce_analysis(norm_tx: dict, raw: object, currency: str) -> dict:
    amt = norm_tx.get("amount", "")
    fallback_total = f"{currency} {amt}".strip()
    if not isinstance(raw, dict):
        return {
            "category": str(norm_tx.get("category") or ""),
            "total": fallback_total,
            "insights": "Unable to produce structured insights for this extraction.",
            "suggestions": [
                "Review amount, category, and merchant in the Review tab before approving.",
            ],
        }
    suggestions = raw.get("suggestions")
    if isinstance(suggestions, str):
        suggestions = [suggestions]
    if not isinstance(suggestions, list):
        suggestions = []
    suggestions = [str(s).strip() for s in suggestions if str(s).strip()][:8]
    if len(suggestions) < 2:
        suggestions.extend(
            [
                "Confirm this entry matches your bank/UPI SMS before approving.",
                "Adjust category if splits across budget lines.",
            ]
        )
    suggestions = list(dict.fromkeys(suggestions))[:6]
    cat = str(raw.get("category") or norm_tx.get("category") or "").strip()
    total = str(raw.get("total") or fallback_total).strip()
    insight = str(raw.get("insights") or "").strip() or (
        "No comparable history in the database yet; approve after spot-checking the extracted fields."
    )
    return {"category": cat, "total": total, "insights": insight, "suggestions": suggestions}


def run_contextual_analysis(
    norm_before_id: dict, history: list[dict], currency: str
) -> dict:
    try:
        text = openai_request(contextual_analysis_prompt(norm_before_id, history, currency))
        parsed = parse_json_text(text)
    except Exception:
        return coerce_analysis(norm_before_id, {}, currency)
    return coerce_analysis(norm_before_id, parsed, currency)


def merge_normalized_with_id(norm: dict, ingest_id: str) -> dict:
    out = dict(norm)
    out["id"] = ingest_id
    return out


def persist_ledger(conn: sqlite3.Connection, tx_payload: dict, analysis: dict, source: str) -> None:
    ingest_id = tx_payload["id"]
    upsert_transaction_ledger(conn, ingest_id, tx_payload, analysis, source, created_seed=time.time())


def run_text_pipeline(
    conn: sqlite3.Connection,
    normalize_transaction: Callable[[dict, str], dict],
    text: str,
    currency: str,
    today: str,
    *,
    source: str,
) -> dict[str, Any]:
    parsed = parse_json_text(openai_request(transaction_prompt(text, today, currency)))
    norm = normalize_transaction(parsed, currency)
    history = fetch_history_summaries(conn, 10)
    analysis = run_contextual_analysis(norm, history, currency)
    ingest_id = new_ingest_id()
    full = merge_normalized_with_id(norm, ingest_id)
    persist_ledger(conn, full, analysis, source)
    return {"transaction": full, "analysis": analysis}


def run_image_pipeline(
    conn: sqlite3.Connection,
    normalize_transaction: Callable[[dict, str], dict],
    *,
    hint: str,
    filename: str,
    mime: str,
    data_url: str,
    currency: str,
    today: str,
    source: str,
) -> dict[str, Any]:
    text_base = f"Filename: {filename}\nVisible text hint: {hint}".strip()
    is_pdf = mime == "application/pdf" or (data_url and data_url.startswith("data:application/pdf"))
    if is_pdf:
        pdf_note = (
            f"The user uploaded a PDF named {filename}. There is no rendered page image; "
            "infer one transaction only from the filename and hint."
        )
        parsed = parse_json_text(
            openai_request(transaction_prompt(f"{pdf_note}\n\n{text_base}", today, currency))
        )
    elif data_url and mime.startswith("image/"):
        parsed = parse_json_text(
            openai_request(transaction_prompt(text_base, today, currency), image_url=data_url)
        )
    else:
        parsed = parse_json_text(openai_request(transaction_prompt(text_base, today, currency)))
    norm = normalize_transaction(parsed, currency)
    history = fetch_history_summaries(conn, 10)
    analysis = run_contextual_analysis(norm, history, currency)
    ingest_id = new_ingest_id()
    full = merge_normalized_with_id(norm, ingest_id)
    persist_ledger(conn, full, analysis, source)
    return {"transaction": full, "analysis": analysis}
