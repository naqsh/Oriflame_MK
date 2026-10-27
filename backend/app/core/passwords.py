"""Admin password hashing with the standard library's scrypt (ADR-003).

Format: ``scrypt$<n>$<r>$<p>$<salt b64>$<hash b64>``. The parameters travel with the
hash, so they can be raised later without invalidating existing passwords.
"""

import base64
import hashlib
import hmac
import secrets

SCRYPT_N = 2**15
SCRYPT_R = 8
SCRYPT_P = 1
SALT_BYTES = 16
KEY_BYTES = 32
# 128 * n * r bytes are needed; leave headroom over OpenSSL's 32 MiB default.
_MAXMEM = 64 * 1024 * 1024
MIN_PASSWORD_LENGTH = 12
MAX_PASSWORD_LENGTH = 1024


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def _derive(password: str, salt: bytes, n: int, r: int, p: int) -> bytes:
    return hashlib.scrypt(
        password.encode("utf-8"), salt=salt, n=n, r=r, p=p, maxmem=_MAXMEM, dklen=KEY_BYTES
    )


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(SALT_BYTES)
    key = _derive(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P)
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${_b64(salt)}${_b64(key)}"


def verify_password(password: str, encoded: str) -> bool:
    """Constant-time check; a malformed stored hash simply fails."""
    try:
        scheme, n, r, p, salt, expected = encoded.split("$")
        if scheme != "scrypt":
            return False
        key = _derive(password, base64.b64decode(salt), int(n), int(r), int(p))
        return hmac.compare_digest(key, base64.b64decode(expected))
    except (ValueError, TypeError):
        return False


# Verified against when the email is unknown, so a miss costs the same time as a hit.
DUMMY_HASH = hash_password(secrets.token_urlsafe(16))
