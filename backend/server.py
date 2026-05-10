from __future__ import annotations

import base64
import json
import os
import secrets
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from ai_client import assistant_prompt, llm_health_info, openai_request
from catalog import EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS
from db import (
    connect,
    correct_transaction_ledger,
    init_schema,
    load_snapshot,
    save_snapshot,
    sync_transactions_from_client,
)
from ingest_pipeline import fetch_history_summaries, run_image_pipeline, run_text_pipeline


ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "autospend.db"
_db_conn = None
_oauth_lock = threading.Lock()
_oauth_pending: dict[str, tuple[str, float]] = {}
OAUTH_STATE_TTL_SEC = 600
MAX_BODY_BYTES = 16 * 1024 * 1024
FIGMA_DIST = ROOT / "FIGMA" / "dist"
STATIC_FILES: dict[str, Path] = {
    "/index.html": ROOT / "index.html",
    "/styles.css": ROOT / "styles.css",
    "/app.js": ROOT / "app.js",
}
MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
}
DRIVE_TOKEN_PATH = ROOT / ".drive_tokens.json"
DRIVE_STATE_PATH = ROOT / ".drive_state.json"
DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly"
USER_TOKEN_PATH = ROOT / ".user_tokens.json"
USER_SCOPE = "openid profile email"
REDIRECT_PATH = os.environ.get("GOOGLE_REDIRECT_PATH", "/oauth2callback")

def load_dotenv() -> None:
    for env_path in (ROOT / ".env", Path(__file__).resolve().parent / ".env"):
        if not env_path.exists():
            continue
        for line in env_path.read_text(encoding="utf-8").splitlines():
            clean = line.strip()
            if not clean or clean.startswith("#") or "=" not in clean:
                continue
            key, value = clean.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def clamp_confidence(value: object) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0.75
    return max(0.0, min(1.0, number))


def normalize_choice(value: object, choices: list[str], fallback: str) -> str:
    text = str(value or "").strip()
    lowered = {choice.lower(): choice for choice in choices}
    return lowered.get(text.lower(), fallback)


def normalize_transaction(raw: dict, currency: str) -> dict:
    tx_type = "income" if str(raw.get("type", "")).lower() == "income" else "expense"
    valid_categories = INCOME_CATEGORIES if tx_type == "income" else EXPENSE_CATEGORIES
    fallback_category = "Other income" if tx_type == "income" else "Other expense"
    amount = raw.get("amount")
    try:
        amount = float(amount)
    except (TypeError, ValueError):
        amount = 0
    return {
        "type": tx_type,
        "amount": amount,
        "currency": str(raw.get("currency") or currency or "INR").upper(),
        "date": str(raw.get("date") or ""),
        "merchant": str(raw.get("merchant") or "Unknown").strip() or "Unknown",
        "category": normalize_choice(raw.get("category"), valid_categories, fallback_category),
        "method": normalize_choice(raw.get("payment_method") or raw.get("method"), PAYMENT_METHODS, "Cash"),
        "note": str(raw.get("note") or "").strip(),
        "confidence": clamp_confidence(raw.get("confidence")),
    }


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        return {}


def save_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def normalize_env_value(value: str) -> str:
    if not value:
        return ""
    value = value.strip().strip('"').strip("'")
    if value.startswith("GOOGLE_CLIENT_ID=") or value.startswith("GOOGLE_CLIENT_SECRET=") or value.startswith("GOOGLE_REDIRECT_URI="):
        _, _, value = value.partition("=")
    return value.strip()


def google_oauth_config() -> tuple[str, str, str]:
    client_id = normalize_env_value(os.environ.get("GOOGLE_CLIENT_ID", ""))
    client_secret = normalize_env_value(os.environ.get("GOOGLE_CLIENT_SECRET", ""))
    host = os.environ.get("AUTOSPEND_HOST", "127.0.0.1")
    port = os.environ.get("AUTOSPEND_PORT", "8787")
    redirect_uri = normalize_env_value(os.environ.get("GOOGLE_REDIRECT_URI", f"http://{host}:{port}{REDIRECT_PATH}"))
    return client_id, client_secret, redirect_uri


def is_google_configured(value: str) -> bool:
    return bool(value and not value.startswith("replace_with") and "YOUR_" not in value)


def google_oauth_enabled() -> bool:
    client_id, client_secret, _ = google_oauth_config()
    return is_google_configured(client_id) and is_google_configured(client_secret)


def register_oauth_state(kind: str) -> str:
    token = secrets.token_urlsafe(32)
    now = time.time()
    with _oauth_lock:
        dead = [k for k, (_, t) in _oauth_pending.items() if now - t > OAUTH_STATE_TTL_SEC]
        for k in dead:
            del _oauth_pending[k]
        _oauth_pending[token] = (kind, now)
    return token


def consume_oauth_state(state: str) -> str | None:
    if not state:
        return None
    now = time.time()
    with _oauth_lock:
        item = _oauth_pending.pop(state, None)
    if not item:
        return None
    kind, started = item
    if now - started > OAUTH_STATE_TTL_SEC:
        return None
    return kind


def app_origin() -> str:
    host = os.environ.get("AUTOSPEND_HOST", "127.0.0.1")
    port = os.environ.get("AUTOSPEND_PORT", "8787")
    return f"http://{host}:{port}"


def google_auth_url(scope: str, kind: str) -> str:
    client_id, _, redirect_uri = google_oauth_config()
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": scope,
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
        "state": register_oauth_state(kind),
    }
    return f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"


def exchange_google_code(code: str) -> dict:
    client_id, client_secret, redirect_uri = google_oauth_config()
    data = urllib.parse.urlencode({
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }).encode("utf-8")
    request = urllib.request.Request(
        "https://oauth2.googleapis.com/token",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Failed to exchange Google code: {detail}") from error


def refresh_google_token(refresh_token: str) -> dict:
    client_id, client_secret, _ = google_oauth_config()
    data = urllib.parse.urlencode({
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }).encode("utf-8")
    request = urllib.request.Request(
        "https://oauth2.googleapis.com/token",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Failed to refresh Google token: {detail}") from error


def get_drive_tokens() -> dict:
    tokens = load_json(DRIVE_TOKEN_PATH)
    if not tokens:
        raise RuntimeError("Google Drive is not connected")
    expires_at = float(tokens.get("expires_at", 0))
    if expires_at <= time.time() - 60 and tokens.get("refresh_token"):
        refreshed = refresh_google_token(tokens["refresh_token"])
        tokens["access_token"] = refreshed.get("access_token", tokens.get("access_token"))
        tokens["expires_at"] = time.time() + float(refreshed.get("expires_in", 0))
        if refreshed.get("refresh_token"):
            tokens["refresh_token"] = refreshed["refresh_token"]
        save_json(DRIVE_TOKEN_PATH, tokens)
    return tokens


def drive_api_request(path: str, query: dict | None = None, method: str = "GET", data: bytes | None = None) -> dict:
    access_token = get_drive_tokens()["access_token"]
    url = f"https://www.googleapis.com/drive/v3/{path}"
    if query:
        url = f"{url}?{urllib.parse.urlencode(query)}"
    request = urllib.request.Request(url, data=data, method=method)
    request.add_header("Authorization", f"Bearer {access_token}")
    if data is not None:
        request.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Drive API error: {detail}") from error


def drive_file_media(file_id: str) -> tuple[bytes, str]:
    access_token = get_drive_tokens()["access_token"]
    url = f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media"
    request = urllib.request.Request(url, method="GET")
    request.add_header("Authorization", f"Bearer {access_token}")
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return response.read(), response.info().get_content_type()
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Drive download error: {detail}") from error


def escape_drive_query(value: str) -> str:
    return value.replace("'", "\'\"")


def find_drive_folder(folder_name: str) -> str | None:
    name = folder_name.strip() or "Expense Screenshots"
    query = f"name = '{name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    result = drive_api_request("files", {"q": query, "fields": "files(id,name)", "pageSize": 10})
    files = result.get("files", [])
    return files[0].get("id") if files else None


def list_drive_files(folder_id: str) -> list[dict]:
    query = f"'{folder_id}' in parents and trashed = false and (mimeType contains 'image/' or mimeType = 'application/pdf')"
    result = drive_api_request("files", {"q": query, "fields": "files(id,name,mimeType)", "pageSize": 100})
    return result.get("files", [])


def load_drive_state() -> dict:
    state = load_json(DRIVE_STATE_PATH)
    if "processed_file_ids" not in state:
        state["processed_file_ids"] = []
    return state


def save_drive_state(state_data: dict) -> None:
    save_json(DRIVE_STATE_PATH, state_data)


def save_drive_tokens(tokens: dict) -> None:
    tokens = tokens.copy()
    expires_in = float(tokens.get("expires_in", 0))
    tokens["expires_at"] = time.time() + expires_in
    save_json(DRIVE_TOKEN_PATH, tokens)


def clear_drive_tokens() -> None:
    if DRIVE_TOKEN_PATH.exists():
        DRIVE_TOKEN_PATH.unlink()


def save_user_tokens(tokens: dict) -> None:
    tokens = tokens.copy()
    expires_in = float(tokens.get("expires_in", 0))
    tokens["expires_at"] = time.time() + expires_in
    save_json(USER_TOKEN_PATH, tokens)


def clear_user_tokens() -> None:
    if USER_TOKEN_PATH.exists():
        USER_TOKEN_PATH.unlink()


def get_user_profile() -> dict | None:
    tokens = load_json(USER_TOKEN_PATH)
    if not tokens or not tokens.get("access_token"):
        return None
    expires_at = float(tokens.get("expires_at", 0))
    if expires_at <= time.time() - 60:
        if tokens.get("refresh_token"):
            refreshed = refresh_google_token(tokens["refresh_token"])
            tokens["access_token"] = refreshed.get("access_token", tokens.get("access_token"))
            tokens["expires_at"] = time.time() + float(refreshed.get("expires_in", 0))
            if refreshed.get("refresh_token"):
                tokens["refresh_token"] = refreshed["refresh_token"]
            save_json(USER_TOKEN_PATH, tokens)
        else:
            return None
    access_token = tokens["access_token"]
    request = urllib.request.Request("https://www.googleapis.com/oauth2/v2/userinfo")
    request.add_header("Authorization", f"Bearer {access_token}")
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError:
        return None


def user_auth_status() -> dict:
    profile = get_user_profile()
    if profile:
        return {
            "authenticated": True,
            "profile": {
                "name": profile.get("name", ""),
                "email": profile.get("email", ""),
                "picture": profile.get("picture", ""),
            }
        }
    return {"authenticated": False}


def drive_status() -> dict:
    connected = False
    folder_id = None
    folder_name = os.environ.get("DEFAULT_DRIVE_FOLDER", "Expense Screenshots")
    try:
        tokens = load_json(DRIVE_TOKEN_PATH)
        connected = bool(tokens.get("access_token") or tokens.get("refresh_token"))
    except Exception:
        connected = False
    return {"configured": google_oauth_enabled(), "connected": connected, "folderName": folder_name, "folderId": folder_id}


def drive_scan_payload(folder_name: str, currency: str, today: str) -> list[dict]:
    global _db_conn
    folder_id = find_drive_folder(folder_name)
    if not folder_id:
        raise RuntimeError(f"Drive folder '{folder_name}' not found")
    files = list_drive_files(folder_id)
    snapshot = load_snapshot(_db_conn) or {}
    processed = set()
    for tx in snapshot.get("transactions", []):
        if isinstance(tx, dict) and tx.get("driveFileId"):
            processed.add(tx["driveFileId"])
    for q in snapshot.get("queue", []):
        if isinstance(q, dict) and q.get("driveFileId"):
            processed.add(q["driveFileId"])
    
    new_items = []
    for file_info in files:
        if file_info["id"] in processed:
            continue
        data, mime_type = drive_file_media(file_info["id"])
        encoded = base64.b64encode(data).decode("ascii")
        data_url = f"data:{mime_type};base64,{encoded}"
        batch = run_image_pipeline(
            _db_conn,
            normalize_transaction,
            hint=file_info["name"],
            filename=file_info["name"],
            mime=mime_type or "image/jpeg",
            data_url=data_url,
            currency=currency,
            today=today,
            source="drive_scan",
        )
        new_items.append({
            "fileId": file_info["id"],
            "name": file_info["name"],
            "transaction": batch["transaction"],
            "analysis": batch.get("analysis"),
        })
        processed.add(file_info["id"])
    return new_items


def oauth_callback_response(message: str, success: bool = True, auth_type: str = "drive") -> bytes:
    message_js = json.dumps(message)
    status_text = "success" if success else "error"
    type_text = "autospend-drive-auth" if auth_type == "drive" else "autospend-user-auth"
    html = f"""
<html>
  <head><meta charset=\"utf-8\"></head>
  <body>
    <script>
      if (window.opener) {{
        window.opener.postMessage({{type: '{type_text}', status: '{status_text}', message: {message_js}}}, '*');
      }}
      document.title = 'Authorization complete';
      setTimeout(() => window.close(), 100);
    </script>
    <p>{message}</p>
    <p>You can close this window.</p>
  </body>
</html>
"""
    return html.encode("utf-8")


class Handler(BaseHTTPRequestHandler):
    server_version = "AutoSpendAI/1.0"

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.end_headers()

    def serve_static(self, file_path: Path) -> None:
        try:
            body = file_path.read_bytes()
        except OSError:
            self.json_response({"error": "Not found"}, status=404)
            return
        mime = MIME_TYPES.get(file_path.suffix.lower(), "application/octet-stream")
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def figma_static_path(self, req_path: str) -> Path | None:
        if not FIGMA_DIST.exists():
            return None
        relative = urllib.parse.unquote(req_path).lstrip("/")
        candidate = (FIGMA_DIST / relative).resolve()
        try:
            candidate.relative_to(FIGMA_DIST.resolve())
        except ValueError:
            return None
        return candidate if candidate.is_file() else None

    def serve_app_index(self) -> None:
        figma_index = FIGMA_DIST / "index.html"
        if figma_index.exists():
            self.serve_static(figma_index)
            return
        self.serve_static(ROOT / "index.html")

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        req_path = parsed.path
        route = req_path.rstrip("/") or "/"
        if route in {"/", "/index.html"}:
            self.serve_app_index()
            return
        if route == "/api/health":
            global _db_conn
            ledger_rows = 0
            try:
                lc = _db_conn.execute("SELECT COUNT(*) AS c FROM tx_ledger").fetchone()
                ledger_rows = int(lc["c"]) if lc else 0
            except Exception:
                pass
            llm = llm_health_info()
            self.json_response({
                "ok": True,
                "provider": llm["provider"],
                "model": llm["model"],
                "keyConfigured": llm["keyConfigured"],
                "database": str(DB_PATH.name),
                "ledgerRows": ledger_rows,
            })
            return
        if route in STATIC_FILES:
            self.serve_static(STATIC_FILES[route])
            return
        path = route
        if path == "/api/drive/status":
            self.handle_drive_status()
            return
        if path == "/api/drive/auth-url":
            self.handle_drive_auth_url()
            return
        if path == "/api/drive/disconnect":
            self.handle_drive_disconnect()
            return
        if path == "/api/auth/status":
            self.handle_auth_status()
            return
        if path == "/api/auth/login-url":
            self.handle_auth_login_url()
            return
        if path == "/api/auth/logout":
            self.handle_auth_logout()
            return
        if path == "/api/data":
            self.handle_data_get()
            return
        if path == "/oauth2callback":
            self.handle_oauth2_callback(parsed.query)
            return
        figma_asset = self.figma_static_path(req_path)
        if figma_asset:
            self.serve_static(figma_asset)
            return
        if not path.startswith("/api/"):
            self.serve_app_index()
            return
        self.json_response({"error": "Not found"}, status=404)

    def do_POST(self) -> None:
        try:
            route = urllib.parse.urlparse(self.path).path.rstrip("/") or "/"
            payload = self.read_json()
            if route == "/api/parse-text":
                self.handle_parse_text(payload)
            elif route == "/api/parse-image":
                self.handle_parse_image(payload)
            elif route == "/api/assistant":
                self.handle_assistant(payload)
            elif route == "/api/drive/scan":
                self.handle_drive_scan(payload)
            elif route == "/api/data":
                self.handle_data_post(payload)
            elif route == "/api/transaction/correct":
                self.handle_transaction_correct(payload)
            else:
                self.json_response({"error": "Not found"}, status=404)
        except RuntimeError as error:
            self.json_response({"error": str(error)}, status=503)
        except Exception as error:  # noqa: BLE001 - surface local backend failures clearly.
            self.json_response({"error": f"Backend error: {error}"}, status=500)

    def read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if length > MAX_BODY_BYTES:
            raise RuntimeError("Request body is too large")
        raw = self.rfile.read(length).decode("utf-8")
        return json.loads(raw or "{}")

    def handle_parse_text(self, payload: dict) -> None:
        text = str(payload.get("text") or "")
        currency = str(payload.get("currency") or "INR").upper()
        today = str(payload.get("today") or "")
        global _db_conn
        result = run_text_pipeline(_db_conn, normalize_transaction, text, currency, today, source="parse_text")
        self.json_response(result)

    def handle_parse_image(self, payload: dict) -> None:
        hint = str(payload.get("textHint") or "")
        filename = str(payload.get("filename") or "uploaded file")
        currency = str(payload.get("currency") or "INR").upper()
        today = str(payload.get("today") or "")
        image_url = str(payload.get("dataUrl") or "")
        mime = str(payload.get("mimeType") or "").lower()
        global _db_conn
        result = run_image_pipeline(
            _db_conn,
            normalize_transaction,
            hint=hint,
            filename=filename,
            mime=mime,
            data_url=image_url,
            currency=currency,
            today=today,
            source="upload",
        )
        self.json_response(result)

    def handle_assistant(self, payload: dict) -> None:
        question = str(payload.get("question") or "")
        transactions = payload.get("transactions") if isinstance(payload.get("transactions"), list) else []
        settings = payload.get("settings") if isinstance(payload.get("settings"), dict) else {}
        global _db_conn
        ledger_hint = fetch_history_summaries(_db_conn, 10)
        answer = openai_request(assistant_prompt(question, transactions, settings, ledger_history=ledger_hint))
        self.json_response({"answer": answer})

    def handle_drive_status(self) -> None:
        self.json_response(drive_status())

    def handle_drive_auth_url(self) -> None:
        if not google_oauth_enabled():
            self.json_response({"error": "Google OAuth is not configured."}, status=503)
            return
        self.json_response({"authUrl": google_auth_url(DRIVE_SCOPE, "drive")})

    def handle_drive_disconnect(self) -> None:
        clear_drive_tokens()
        self.json_response({"ok": True, "connected": False})

    def handle_drive_scan(self, payload: dict) -> None:
        folder_name = str(payload.get("folderName") or os.environ.get("DEFAULT_DRIVE_FOLDER", "Expense Screenshots"))
        currency = str(payload.get("currency") or "INR").upper()
        today = str(payload.get("today") or "")
        files = drive_scan_payload(folder_name, currency, today)
        self.json_response({"files": files})

    def handle_auth_status(self) -> None:
        self.json_response(user_auth_status())

    def handle_auth_login_url(self) -> None:
        if not google_oauth_enabled():
            self.json_response({"error": "Google OAuth is not configured."}, status=503)
            return
        self.json_response({"loginUrl": google_auth_url(USER_SCOPE, "user")})

    def handle_auth_logout(self) -> None:
        clear_user_tokens()
        self.json_response({"authenticated": False})

    def handle_data_get(self) -> None:
        global _db_conn
        row = load_snapshot(_db_conn)
        if not row:
            self.json_response({"transactions": [], "queue": [], "chat": [], "settings": {}, "savedAt": None})
            return
        self.json_response(row)

    def handle_data_post(self, payload: dict) -> None:
        global _db_conn
        if not isinstance(payload, dict):
            self.json_response({"error": "Expected JSON object"}, status=400)
            return
        tx = payload.get("transactions")
        if tx is not None and not isinstance(tx, list):
            self.json_response({"error": "transactions must be a list"}, status=400)
            return
        queue = payload.get("queue")
        if queue is not None and not isinstance(queue, list):
            self.json_response({"error": "queue must be a list"}, status=400)
            return
        chat = payload.get("chat")
        if chat is not None and not isinstance(chat, list):
            self.json_response({"error": "chat must be a list"}, status=400)
            return
        settings = payload.get("settings")
        if settings is not None and not isinstance(settings, dict):
            self.json_response({"error": "settings must be an object"}, status=400)
            return
        to_save = {
            "transactions": list(tx) if isinstance(tx, list) else [],
            "queue": list(queue) if isinstance(queue, list) else [],
            "chat": list(chat) if isinstance(chat, list) else [],
            "settings": dict(settings) if isinstance(settings, dict) else {},
        }
        saved_at = save_snapshot(_db_conn, to_save)
        sync_transactions_from_client(_db_conn, to_save["transactions"])
        self.json_response({"ok": True, "savedAt": saved_at})

    def handle_transaction_correct(self, payload: dict) -> None:
        global _db_conn
        tx_id = str(payload.get("id") or "").strip()
        tx_payload = payload.get("transaction")
        if not tx_id or not isinstance(tx_payload, dict):
            self.json_response({"error": "Provide id and transaction object"}, status=400)
            return
        analysis = payload.get("analysis") if isinstance(payload.get("analysis"), dict) else None
        ok = correct_transaction_ledger(_db_conn, tx_id, tx_payload, analysis)
        self.json_response({"ok": bool(ok), "synced": ok})

    def handle_oauth2_callback(self, query: str) -> None:
        params = urllib.parse.parse_qs(query)
        error = params.get("error", [""])[0]
        state_raw = params.get("state", [""])[0]
        kind = consume_oauth_state(state_raw)
        auth_type = "drive" if kind == "drive" else "user"
        if error:
            content = oauth_callback_response(f"Authorization failed: {error}", success=False, auth_type=auth_type)
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            return
        code = params.get("code", [""])[0]
        if not code:
            self.json_response({"error": "Missing authorization code."}, status=400)
            return
        if kind not in ("drive", "user"):
            content = oauth_callback_response(
                "Invalid or expired authorization state. Close this window and try signing in again.",
                success=False,
                auth_type="user",
            )
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            return
        tokens = exchange_google_code(code)
        if kind == "drive":
            save_drive_tokens(tokens)
            message = "Drive authorization completed successfully."
            auth_type = "drive"
        else:
            save_user_tokens(tokens)
            message = "User authorization completed successfully."
            auth_type = "user"
        content = oauth_callback_response(message, success=True, auth_type=auth_type)
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def json_response(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), format % args))


def main() -> None:
    global _db_conn
    load_dotenv()
    host = os.environ.get("AUTOSPEND_HOST", "127.0.0.1")
    port = int(os.environ.get("AUTOSPEND_PORT", "8787"))
    _db_conn = connect(DB_PATH)
    init_schema(_db_conn)
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"AutoSpend AI backend running at http://{host}:{port}")
    print(f"Open the app in your browser: http://{host}:{port}/")
    print(f"SQLite data: {DB_PATH}")
    hi = llm_health_info()
    print(f"LLM provider={hi['provider']} model={hi['model']} key_configured={hi['keyConfigured']}")
    server.serve_forever()


if __name__ == "__main__":
    main()
