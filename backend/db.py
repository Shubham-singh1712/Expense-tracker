from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path


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
    conn.commit()


def load_snapshot(conn: sqlite3.Connection) -> dict | None:
    row = conn.execute("SELECT payload, updated_at FROM app_snapshot WHERE id = 1").fetchone()
    if not row:
        return None
    try:
        data = json.loads(row["payload"])
    except (TypeError, ValueError):
        return None
    if not isinstance(data, dict):
        return None
    data["savedAt"] = float(row["updated_at"])
    return data


def save_snapshot(conn: sqlite3.Connection, payload: dict) -> float:
    now = time.time()
    body = {k: v for k, v in payload.items() if k != "savedAt"}
    raw = json.dumps(body, ensure_ascii=False)
    conn.execute(
        "INSERT INTO app_snapshot (id, payload, updated_at) VALUES (1, ?, ?) "
        "ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at",
        (raw, now),
    )
    conn.commit()
    return now
