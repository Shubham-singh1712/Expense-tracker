from pathlib import Path
import os
from cryptography.fernet import Fernet, InvalidToken

KEY_PATH = Path(__file__).resolve().parents[1] / ".autospend.key"

_cipher = None

def get_cipher() -> Fernet:
    global _cipher
    if _cipher is not None:
        return _cipher
        
    if not KEY_PATH.exists():
        key = Fernet.generate_key()
        KEY_PATH.write_bytes(key)
    else:
        key = KEY_PATH.read_bytes()
        
    _cipher = Fernet(key)
    return _cipher

def encrypt(data: str) -> str:
    return get_cipher().encrypt(data.encode('utf-8')).decode('utf-8')

def decrypt(data: str) -> str:
    try:
        # If it starts with { or [, it's likely plaintext JSON from before encryption
        if data.strip().startswith("{") or data.strip().startswith("["):
            return data
        return get_cipher().decrypt(data.encode('utf-8')).decode('utf-8')
    except (InvalidToken, ValueError):
        # Fallback to plain text if decryption fails (e.g. legacy data)
        return data
