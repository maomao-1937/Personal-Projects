import hashlib
import hmac
import secrets

SESSION_COOKIE_NAME = "meetingmemo_session"


def normalize_invite_code(code: str) -> str:
    return code.strip().upper()


def hash_invite_code(code: str, secret_key: str) -> str:
    normalized = normalize_invite_code(code)
    return hmac.new(
        secret_key.encode("utf-8"),
        f"invite:{normalized}".encode(),
        hashlib.sha256,
    ).hexdigest()


def generate_invite_code() -> str:
    return f"MM-{secrets.token_hex(12).upper()}"


def generate_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def fingerprint_value(namespace: str, value: str, secret_key: str) -> str:
    return hmac.new(
        secret_key.encode("utf-8"),
        f"{namespace}:{value}".encode(),
        hashlib.sha256,
    ).hexdigest()
