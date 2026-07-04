"""
Mortgage AI — Authentication & Role-Based Access Control (RBAC)

Roles:
  - loan_officer:  Submit applications, view own history, borrower tools
  - underwriter:   View all applications, risk scores, approve/flag
  - admin:         Full access including audit log, anomaly alerts, user management

JWT-based session tokens with role enforcement on every API route.
"""

import os
import sqlite3
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional
from pathlib import Path

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
import json

# ─── Config ───────────────────────────────────────────────────────────────────
SECRET_KEY = os.environ.get("JWT_SECRET", "mortgage-ai-secret-key-change-in-production")
TOKEN_EXPIRE_HOURS = 24
DATABASE_PATH = str(Path(__file__).parent / "mortgage.db")

ROLES = ["loan_officer", "underwriter", "admin"]
ROLE_HIERARCHY = {"admin": 3, "underwriter": 2, "loan_officer": 1}

security = HTTPBearer(auto_error=False)


# ─── Models ───────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=50)
    password: str = Field(..., min_length=4, max_length=100)


class UserCreate(BaseModel):
    username: str = Field(..., min_length=2, max_length=50)
    email: str = Field(..., min_length=5, max_length=100)
    password: str = Field(..., min_length=4, max_length=100)
    role: str = Field(..., pattern="^(loan_officer|underwriter|admin)$")
    full_name: str = Field(default="", max_length=100)


class ResetPasswordRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=50)
    full_name: str = Field(..., min_length=2, max_length=100)
    new_password: str = Field(..., min_length=4, max_length=100)
class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=4)
    new_password: str = Field(..., min_length=4)

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str
    full_name: str
    created_at: str
    is_active: bool


# ─── Password Hashing ────────────────────────────────────────────────────────
def hash_password(password: str, salt: Optional[str] = None) -> tuple:
    if salt is None:
        salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100000)
    return hashed.hex(), salt


def verify_password(password: str, hashed: str, salt: str) -> bool:
    check_hash, _ = hash_password(password, salt)
    return secrets.compare_digest(check_hash, hashed)


# ─── Simple Token System (no external JWT dependency) ────────────────────────
# Using a server-side token store for simplicity and security
_token_store = {}  # token -> {user_id, username, role, expires}


def create_token(user_id: int, username: str, role: str) -> str:
    token = secrets.token_urlsafe(48)
    _token_store[token] = {
        "user_id": user_id,
        "username": username,
        "role": role,
        "full_name": "",
        "expires": datetime.now() + timedelta(hours=TOKEN_EXPIRE_HOURS),
        "created_at": datetime.now().isoformat(),
    }
    # Clean expired tokens
    now = datetime.now()
    expired = [t for t, d in _token_store.items() if d["expires"] < now]
    for t in expired:
        del _token_store[t]
    return token


def validate_token(token: str) -> Optional[dict]:
    data = _token_store.get(token)
    if not data:
        return None
    if datetime.now() > data["expires"]:
        del _token_store[token]
        return None
    return data


def revoke_token(token: str):
    _token_store.pop(token, None)


# ─── Rate Limiting ───────────────────────────────────────────────────────────
_attempt_store = {}  # username -> {count, lockout_until}


def check_lockout(username: str) -> tuple[bool, str]:
    """Returns (is_locked, message)"""
    data = _attempt_store.get(username)
    if not data:
        return False, ""
    
    now = datetime.now()
    if data["lockout_until"] and now < data["lockout_until"]:
        mins_left = int((data["lockout_until"] - now).total_seconds() / 60) + 1
        return True, f"Too many failed attempts. Account locked for {mins_left} more minutes."
    
    # If lockout expired, reset
    if data["lockout_until"] and now >= data["lockout_until"]:
        del _attempt_store[username]
        
    return False, ""


def record_failed_attempt(username: str):
    now = datetime.now()
    data = _attempt_store.get(username, {"count": 0, "lockout_until": None})
    
    data["count"] += 1
    if data["count"] >= 5:
        data["lockout_until"] = now + timedelta(minutes=15)
        # We don't reset count here so lockout persists until expiration
    
    _attempt_store[username] = data


def clear_attempts(username: str):
    _attempt_store.pop(username, None)



# ─── Database ─────────────────────────────────────────────────────────────────
def init_users_table():
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE,
            password_hash TEXT NOT NULL,
            password_salt TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'loan_officer',
            full_name TEXT DEFAULT '',
            is_active INTEGER DEFAULT 1,
            created_at TEXT NOT NULL,
            last_login TEXT
        )
    """)
    
    # Add email column if it doesn't exist (migration for existing DB)
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN email TEXT")
        conn.commit()
    except sqlite3.OperationalError:
        pass # Already exists
    
    # Try to add unique index (might fail if duplicate nulls exist in some SQLite versions, 
    # but usually UNIQUE indexes allow multiple NULLs)
    try:
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_user_email ON users(email)")
        conn.commit()
    except sqlite3.OperationalError:
        pass

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS blacklist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            identifier TEXT UNIQUE NOT NULL,
            type TEXT NOT NULL, -- 'USERNAME' or 'EMAIL'
            created_at TEXT NOT NULL
        )
    """)
    conn.commit()

    # Seed default users if table is empty
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        seed_users = [
            ("admin", "admin@mortgage.ai", "admin123", "admin", "System Administrator"),
            ("underwriter", "uw@mortgage.ai", "uw2024", "underwriter", "Senior Underwriter"),
            ("officer", "lo@mortgage.ai", "lo2024", "loan_officer", "Loan Officer"),
        ]
        for username, email, password, role, full_name in seed_users:
            pw_hash, salt = hash_password(password)
            cursor.execute(
                "INSERT INTO users (username, email, password_hash, password_salt, role, full_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (username, email, pw_hash, salt, role, full_name, datetime.now().isoformat()),
            )
        conn.commit()
        print(f"[Auth] Seeded {len(seed_users)} default users")

    conn.close()


def authenticate_user(username: str, password: str) -> dict:
    """
    Authenticate user and handle rate limiting.
    Raises HTTPException if locked or invalid.
    """
    is_locked, msg = check_lockout(username)
    if is_locked:
        raise HTTPException(status_code=429, detail=msg)

    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
    user = cursor.fetchone()
    conn.close()

    if not user:
        record_failed_attempt(username)
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if not user["is_active"]:
        raise HTTPException(status_code=403, detail="Your account has been locked by an administrator. Please contact support.")

    if not verify_password(password, user["password_hash"], user["password_salt"]):
        record_failed_attempt(username)
        # Check if they just got locked out
        is_locked, msg = check_lockout(username)
        if is_locked:
            raise HTTPException(status_code=429, detail=msg)
        
        data = _attempt_store.get(username, {"count": 0})
        attempts_left = 5 - data["count"]
        raise HTTPException(status_code=401, detail=f"Invalid credentials. {attempts_left} attempts remaining.")

    clear_attempts(username)
    return dict(user)



def get_all_users() -> list:
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, email, role, full_name, is_active, created_at, last_login FROM users ORDER BY id")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def create_user_db(data: UserCreate) -> dict:
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    # Check blacklist
    cursor.execute("SELECT 1 FROM blacklist WHERE identifier = ? OR identifier = ?", (data.username, data.email))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=403, detail="This username or email is permanently blocked.")

    pw_hash, salt = hash_password(data.password)
    try:
        cursor.execute(
            "INSERT INTO users (username, email, password_hash, password_salt, role, full_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (data.username, data.email, pw_hash, salt, data.role, data.full_name, datetime.now().isoformat()),
        )
        conn.commit()
        user_id = cursor.lastrowid
    except sqlite3.IntegrityError as e:
        conn.close()
        if "email" in str(e).lower():
            raise HTTPException(status_code=409, detail="Email already exists")
        raise HTTPException(status_code=409, detail="Username already exists")
    conn.close()
    return {"id": user_id, "username": data.username, "email": data.email, "role": data.role, "full_name": data.full_name}


def toggle_user_status_db(user_id: int) -> bool:
    """Toggle a user's active status. If locked, also terminate sessions."""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT is_active FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return False
    
    new_status = 0 if row[0] == 1 else 1
    cursor.execute("UPDATE users SET is_active = ? WHERE id = ?", (new_status, user_id))
    conn.commit()
    conn.close()
    
    # If we just locked them, kick them out
    if new_status == 0:
        terminate_user_sessions(user_id)
        
    return True


def permanently_delete_user_db(user_id: int) -> bool:
    """Delete user permanently and add to blacklist."""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    # 1. Get user details for blacklisting
    cursor.execute("SELECT username, email FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        return False
    
    username, email = user
    now = datetime.now().isoformat()
    
    # 2. Add to blacklist
    try:
        cursor.execute("INSERT OR IGNORE INTO blacklist (identifier, type, created_at) VALUES (?, ?, ?)", 
                       (username, 'USERNAME', now))
        if email:
            cursor.execute("INSERT OR IGNORE INTO blacklist (identifier, type, created_at) VALUES (?, ?, ?)", 
                           (email, 'EMAIL', now))
    except Exception as e:
        print(f"Blacklisting error: {e}")

    # 3. Delete from users table
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    
    # 4. (Optional) Delete their history records? 
    # User said "permanently", usually means data too.
    cursor.execute("DELETE FROM decisions WHERE user_id = ?", (user_id,))
    
    conn.commit()
    conn.close()
    
    # 5. Kick them out
    terminate_user_sessions(user_id)
    
    return True


def terminate_user_sessions(user_id: int):
    """Force logout for all sessions of a specific user."""
    tokens_to_remove = [t for t, d in _token_store.items() if d["user_id"] == user_id]
    for t in tokens_to_remove:
        _token_store.pop(t, None)


def update_last_login(user_id: int):
    conn = sqlite3.connect(DATABASE_PATH)
    conn.execute("UPDATE users SET last_login = ? WHERE id = ?", (datetime.now().isoformat(), user_id))
    conn.commit()
    conn.close()


def reset_password_db(data: ResetPasswordRequest) -> bool:
    """Reset user password if username and full name match."""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Verification: check if username and full name match
    cursor.execute(
        "SELECT id FROM users WHERE username = ? AND full_name = ? AND is_active = 1", 
        (data.username, data.full_name)
    )
    user = cursor.fetchone()
    
    if not user:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found or verification failed")
    
    # Update password
    pw_hash, salt = hash_password(data.new_password)
    cursor.execute(
        "UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?",
        (pw_hash, salt, user["id"])
    )
    conn.commit()
    conn.close()
    return True


def change_password_db(user_id: int, current_password: str, new_password: str) -> bool:
    """Change password for a logged-in user after verifying current password."""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT password_hash, password_salt FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    
    if not user:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")
    
    if not verify_password(current_password, user["password_hash"], user["password_salt"]):
        conn.close()
        raise HTTPException(status_code=401, detail="Current password incorrect")
    
    # Update password
    pw_hash, salt = hash_password(new_password)
    cursor.execute(
        "UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?",
        (pw_hash, salt, user_id)
    )
    conn.commit()
    conn.close()
    return True


# ─── FastAPI Dependencies ─────────────────────────────────────────────────────
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Extract and validate the current user from the Bearer token."""
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    user_data = validate_token(credentials.credentials)
    if user_data is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user_data


async def get_optional_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Optional[dict]:
    """Same as get_current_user but returns None instead of raising."""
    if credentials is None:
        return None
    return validate_token(credentials.credentials)


def require_role(*allowed_roles):
    """Dependency factory that enforces role-based access."""
    async def role_checker(user: dict = Depends(get_current_user)):
        if user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. Required role: {', '.join(allowed_roles)}. Your role: {user['role']}"
            )
        return user
    return role_checker


def require_min_role(min_role: str):
    """Dependency factory that enforces minimum role level."""
    async def role_checker(user: dict = Depends(get_current_user)):
        user_level = ROLE_HIERARCHY.get(user["role"], 0)
        required_level = ROLE_HIERARCHY.get(min_role, 0)
        if user_level < required_level:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. Minimum role required: {min_role}. Your role: {user['role']}"
            )
        return user
    return role_checker
