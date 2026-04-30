from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MAX_BODY_BYTES = 16 * 1024 * 1024
DEFAULT_MODEL = "gpt-4.1-mini"

EXPENSE_CATEGORIES = [
    "Food",
    "Transport",
    "Rent",
    "Shopping",
    "Bills",
    "Health",
    "Education",
    "Entertainment",
    "Travel",
    "Subscription",
    "Other expense",
]
INCOME_CATEGORIES = ["Salary", "Freelance", "Investment", "Gift", "Refund", "Other income"]
PAYMENT_METHODS = ["Cash", "UPI", "Debit card", "Credit card", "Bank transfer", "Wallet"]


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


def output_text(response: dict) -> str:
    if isinstance(response.get("output_text"), str):
        return response["output_text"]
    parts: list[str] = []
    for item in response.get("output", []):
        for content in item.get("content", []):
            text = content.get("text")
            if isinstance(text, str):
                parts.append(text)
    return "\n".join(parts).strip()


def parse_json_text(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.S)
        if not match:
            raise
        return json.loads(match.group(0))


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


def openai_request(prompt: str, image_url: str | None = None) -> str:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")

    content = [{"type": "input_text", "text": prompt}]
    if image_url:
        content.append({"type": "input_image", "image_url": image_url, "detail": "auto"})

    payload = {
        "model": os.environ.get("OPENAI_MODEL", DEFAULT_MODEL),
        "store": False,
        "input": [{"role": "user", "content": content}],
    }
    request = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"OpenAI API error {error.code}: {detail}") from error
    return output_text(body)


def transaction_prompt(text: str, today: str, currency: str) -> str:
    return f"""
Extract a personal finance transaction from the user input.
Today is {today}. Default currency is {currency}.

Expense categories: {", ".join(EXPENSE_CATEGORIES)}
Income categories: {", ".join(INCOME_CATEGORIES)}
Payment methods: {", ".join(PAYMENT_METHODS)}

Return only compact JSON with this shape:
{{
  "type": "expense",
  "amount": 0,
  "currency": "{currency}",
  "date": "YYYY-MM-DD",
  "merchant": "Unknown",
  "category": "Other expense",
  "payment_method": "Cash",
  "note": "",
  "confidence": 0.0
}}

User input:
{text}
""".strip()


def assistant_prompt(question: str, transactions: list[dict], settings: dict) -> str:
    compact_transactions = transactions[-250:]
    return f"""
You are AutoSpend's finance assistant. Answer only from the transaction data supplied.
Keep the answer short and practical. If the data is missing, say what is missing.

Settings:
{json.dumps(settings, ensure_ascii=False)}

Transactions:
{json.dumps(compact_transactions, ensure_ascii=False)}

Question:
{question}
""".strip()


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

    def do_GET(self) -> None:
        if self.path.rstrip("/") in ("", "/api/health"):
            self.json_response({
                "ok": True,
                "provider": "openai",
                "model": os.environ.get("OPENAI_MODEL", DEFAULT_MODEL),
                "keyConfigured": bool(os.environ.get("OPENAI_API_KEY")),
            })
            return
        self.json_response({"error": "Not found"}, status=404)

    def do_POST(self) -> None:
        try:
            payload = self.read_json()
            if self.path == "/api/parse-text":
                self.handle_parse_text(payload)
            elif self.path == "/api/parse-image":
                self.handle_parse_image(payload)
            elif self.path == "/api/assistant":
                self.handle_assistant(payload)
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
        parsed = parse_json_text(openai_request(transaction_prompt(text, today, currency)))
        self.json_response({"transaction": normalize_transaction(parsed, currency)})

    def handle_parse_image(self, payload: dict) -> None:
        hint = str(payload.get("textHint") or "")
        filename = str(payload.get("filename") or "uploaded file")
        currency = str(payload.get("currency") or "INR").upper()
        today = str(payload.get("today") or "")
        image_url = str(payload.get("dataUrl") or "")
        text = f"Filename: {filename}\nVisible text hint: {hint}".strip()
        parsed = parse_json_text(openai_request(transaction_prompt(text, today, currency), image_url=image_url))
        self.json_response({"transaction": normalize_transaction(parsed, currency)})

    def handle_assistant(self, payload: dict) -> None:
        question = str(payload.get("question") or "")
        transactions = payload.get("transactions") if isinstance(payload.get("transactions"), list) else []
        settings = payload.get("settings") if isinstance(payload.get("settings"), dict) else {}
        answer = openai_request(assistant_prompt(question, transactions, settings))
        self.json_response({"answer": answer})

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
    load_dotenv()
    host = os.environ.get("AUTOSPEND_HOST", "127.0.0.1")
    port = int(os.environ.get("AUTOSPEND_PORT", "8787"))
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"AutoSpend AI backend running at http://{host}:{port}")
    print(f"OpenAI key configured: {bool(os.environ.get('OPENAI_API_KEY'))}")
    server.serve_forever()


if __name__ == "__main__":
    main()
