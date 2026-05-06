from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path

import crypto


def connect(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS app_snapshot (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            payload TEXT NOT NULL,
            updated_at REAL NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS tx_ledger (
            id TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            analysis TEXT NOT NULL DEFAULT '{}',
            source TEXT NOT NULL DEFAULT '',
            created_at REAL NOT NULL,
            updated_at REAL NOT NULL
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_tx_ledger_updated ON tx_ledger (updated_at DESC)")
    conn.commit()


def load_snapshot(conn: sqlite3.Connection) -> dict | None:
    row = conn.execute("SELECT payload, updated_at FROM app_snapshot WHERE id = 1").fetchone()
    if not row:
        return None
    try:
        data = json.loads(crypto.decrypt(row["payload"]))
    except (TypeError, ValueError):
        return None
    if not isinstance(data, dict):
        return None
    data["savedAt"] = float(row["updated_at"])
    return data


def save_snapshot(conn: sqlite3.Connection, payload: dict) -> float:
    now = time.time()
    body = {k: v for k, v in payload.items() if k != "savedAt"}
    raw = crypto.encrypt(json.dumps(body, ensure_ascii=False))
    conn.execute(
        "INSERT INTO app_snapshot (id, payload, updated_at) VALUES (1, ?, ?) "
        "ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at",
        (raw, now),
    )
    conn.commit()
    return now


def upsert_transaction_ledger(
    conn: sqlite3.Connection,
    tx_id: str,
    payload: dict,
    analysis: dict,
    source: str,
    *,
    created_seed: float | None = None,
) -> None:
    now = time.time()
    created = float(created_seed) if created_seed is not None else now
    raw_payload = crypto.encrypt(json.dumps(payload, ensure_ascii=False))
    raw_analysis = crypto.encrypt(json.dumps(analysis, ensure_ascii=False))
    existing = conn.execute("SELECT created_at FROM tx_ledger WHERE id = ?", (tx_id,)).fetchone()
    insert_created = existing["created_at"] if existing else created
    conn.execute(
        """
        INSERT INTO tx_ledger (id, payload, analysis, source, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          payload = excluded.payload,
          analysis = excluded.analysis,
          source = excluded.source,
          updated_at = excluded.updated_at
        """,
        (tx_id, raw_payload, raw_analysis, source, insert_created, now),
    )
    conn.commit()


def sync_transactions_from_client(conn: sqlite3.Connection, transactions: list[object]) -> None:
    """Keeps SQLite ledger aligned with the browser/UI snapshot after edits or merges."""
    if not isinstance(transactions, list):
        return
    active_ids = set()
    for item in transactions:
        if not isinstance(item, dict):
            continue
        tx_id = str(item.get("id") or "").strip()
        if not tx_id:
            continue
        active_ids.add(tx_id)
        analysis = item.get("aiAnalysis") if isinstance(item.get("aiAnalysis"), dict) else {}
        upsert_transaction_ledger(
            conn,
            tx_id,
            item,
            analysis,
            str(item.get("sourceType") or "sync"),
        )
    
    # Delete ghost records not present in the frontend
    if active_ids:
        placeholders = ",".join(["?"] * len(active_ids))
        conn.execute(f"DELETE FROM tx_ledger WHERE id NOT IN ({placeholders})", list(active_ids))
    else:
        conn.execute("DELETE FROM tx_ledger")
    conn.commit()


def correct_transaction_ledger(conn: sqlite3.Connection, tx_id: str, payload: dict, analysis: dict | None = None) -> bool:
    """Merge user-approved/edited fields into SQLite. Upserts even if ingest row was missing (e.g. older clients)."""
    row = conn.execute("SELECT payload, analysis FROM tx_ledger WHERE id = ?", (tx_id,)).fetchone()
    current: dict = {}
    old_analysis: dict = {}
    if row:
        try:
            parsed = json.loads(crypto.decrypt(row["payload"]))
            if isinstance(parsed, dict):
                current = parsed
        except (TypeError, ValueError):
            pass
        try:
            ap = json.loads(crypto.decrypt(row["analysis"]))
            if isinstance(ap, dict):
                old_analysis = ap
        except (TypeError, ValueError):
            pass
    merged = {**current, **payload}
    merged["id"] = tx_id
    next_analysis = {**old_analysis}
    if isinstance(analysis, dict):
        next_analysis.update(analysis)
    next_analysis["feedbackAt"] = time.time()
    upsert_transaction_ledger(conn, tx_id, merged, next_analysis, str(merged.get("sourceType") or "correct"))
    return True


def ledger_rows_for_dashboard(conn: sqlite3.Connection, limit: int = 200) -> list[dict]:
    rows = conn.execute(
        "SELECT id, payload, analysis, updated_at FROM tx_ledger ORDER BY updated_at DESC LIMIT ?",
        (limit,),
    ).fetchall()
    out = []
    for row in rows:
        try:
            payload = json.loads(crypto.decrypt(row["payload"]))
            analysis = json.loads(crypto.decrypt(row["analysis"]))
        except (TypeError, ValueError):
            continue
        if isinstance(payload, dict):
            out.append({"payload": payload, "analysis": analysis})
    return out
