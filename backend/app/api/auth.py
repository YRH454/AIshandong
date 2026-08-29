"""认证 API：注册、登录、游客模式和会话管理。"""

from __future__ import annotations

import hashlib
import json
import secrets
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Request, Response
from pydantic import BaseModel

from app.config import (
    ADMIN_EMAIL,
    ADMIN_BOOTSTRAP_PASSWORD,
    ADMIN_USERNAME,
    AUTH_RATE_LIMIT,
    AUTH_RATE_WINDOW_SECONDS,
    CORS_ORIGINS,
    COOKIE_SAMESITE,
    COOKIE_SECURE,
    JWT_EXPIRE_MINUTES,
    PASSWORD_RESET_DEBUG,
)
from app.database import execute, insert_with_next_id, query
from app.utils.auth import (
    create_token,
    decode_token,
    generate_guest_token,
    hash_password,
    ROLE_PERMISSIONS,
    verify_password,
)


router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

ACCESS_COOKIE = "rhyme_access_token"
GUEST_COOKIE = "rhyme_guest_token"

_rate_limit_lock = threading.Lock()
_rate_limit_buckets: dict[str, list[float]] = {}


class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class PasswordResetRequest(BaseModel):
    email: str


class PasswordResetConfirmRequest(BaseModel):
    token: str
    new_password: str


class AdminUserUpdateRequest(BaseModel):
    is_active: bool | None = None
    role: Literal["user", "admin"] | None = None


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _utc_string(hours: int) -> str:
    value = datetime.now(timezone.utc) + timedelta(hours=hours)
    return value.replace(tzinfo=None).strftime("%Y-%m-%d %H:%M:%S")


def _request_key(request: Request | None, scope: str) -> str:
    host = "local"
    if request is not None and request.client is not None:
        host = request.client.host or "unknown"
    return f"{scope}:{host}"


def _enforce_auth_rate_limit(request: Request | None, scope: str) -> None:
    """Apply a small in-process guard to credential endpoints.

    It is deliberately conservative for the local demo and acts as a first
    line of defence before a reverse-proxy rate limiter is configured in
    production.  Bearer clients without a Request object (unit tests and
    internal calls) remain unaffected.
    """
    if request is None:
        return
    now = time.monotonic()
    key = _request_key(request, scope)
    with _rate_limit_lock:
        cutoff = now - AUTH_RATE_WINDOW_SECONDS
        bucket = [stamp for stamp in _rate_limit_buckets.get(key, []) if stamp > cutoff]
        if len(bucket) >= AUTH_RATE_LIMIT:
            retry_after = max(1, int(bucket[0] + AUTH_RATE_WINDOW_SECONDS - now))
            _rate_limit_buckets[key] = bucket
            raise HTTPException(
                status_code=429,
                detail="请求过于频繁，请稍后再试",
                headers={"Retry-After": str(retry_after)},
            )
        bucket.append(now)
        _rate_limit_buckets[key] = bucket
        # Keep the process-local map bounded when many clients touch auth.
        if len(_rate_limit_buckets) > 2048:
            for stale_key, stamps in list(_rate_limit_buckets.items())[:256]:
                if not stamps or stamps[-1] <= cutoff:
                    _rate_limit_buckets.pop(stale_key, None)


def _validate_password(password: str) -> None:
    if len(password) < 8:
        raise HTTPException(400, "密码至少8位")
    if len(password) > 128:
        raise HTTPException(400, "密码不能超过128位")


def _revoke_user_sessions(user_id: int) -> None:
    execute(
        "UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP "
        "WHERE user_id = %s AND revoked_at IS NULL",
        (user_id,),
    )


def _effective_user_role(row: dict) -> str:
    role = str(row.get("role") or "user")
    if role == "admin" and str(row.get("email") or "").lower() != ADMIN_EMAIL:
        return "user"
    return role


def _set_cookie(response: Response, name: str, value: str, max_age: int) -> None:
    response.set_cookie(
        key=name,
        value=value,
        max_age=max_age,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path="/",
    )


def _clear_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE, path="/")
    response.delete_cookie(GUEST_COOKIE, path="/")


def _extract_access_token(authorization: str | None, access_cookie: str | None) -> str | None:
    if authorization and authorization.startswith("Bearer "):
        return authorization[7:].strip() or None
    if isinstance(access_cookie, str) and access_cookie.strip():
        return access_cookie.strip()
    return None


def _extract_guest_token(authorization: str | None, guest_cookie: str | None) -> str | None:
    if authorization and authorization.startswith("Guest "):
        return authorization[6:].strip() or None
    if isinstance(guest_cookie, str) and guest_cookie.strip():
        return guest_cookie.strip()
    return None


def _issue_access_token(user_id: int, role: str, response: Response) -> str:
    token = create_token(user_id, role)
    execute(
        "INSERT INTO auth_sessions (user_id, token_hash, expires_at) VALUES (%s, %s, %s)",
        (user_id, _token_hash(token), _utc_string(max(1, JWT_EXPIRE_MINUTES // 60 + 1))),
    )
    _set_cookie(response, ACCESS_COOKIE, token, JWT_EXPIRE_MINUTES * 60)
    return token


def _decode_active_access_token(token: str) -> dict:
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="登录已过期")

    rows = query(
        "SELECT id FROM auth_sessions "
        "WHERE token_hash = %s AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP",
        (_token_hash(token),),
    )
    if not rows:
        raise HTTPException(status_code=401, detail="登录会话已失效，请重新登录")
    execute("UPDATE auth_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE id = %s", (rows[0]["id"],))
    return payload


def cleanup_expired_sessions() -> None:
    """Remove expired/revoked session rows so the auth tables stay small."""
    execute(
        "DELETE FROM auth_sessions WHERE expires_at <= CURRENT_TIMESTAMP"
    )
    execute(
        "DELETE FROM auth_sessions WHERE revoked_at IS NOT NULL AND revoked_at < %s",
        (_utc_string(-24 * 30),),
    )
    execute(
        "DELETE FROM guest_sessions WHERE expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP"
    )


def _find_guest_session(token: str) -> dict | None:
    hashed = query(
        "SELECT * FROM guest_sessions "
        "WHERE session_token_hash = %s AND remaining_questions > 0 "
        "AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)",
        (_token_hash(token),),
    )
    if hashed:
        return hashed[0]
    # Compatibility for guest sessions created before token hashes were added.
    legacy = query(
        "SELECT * FROM guest_sessions "
        "WHERE session_token = %s AND remaining_questions > 0 "
        "AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)",
        (token,),
    )
    return legacy[0] if legacy else None


def get_current_user(
    authorization: str | None = Header(default=None),
    access_cookie: str | None = Cookie(default=None, alias=ACCESS_COOKIE),
) -> dict:
    """从 Bearer token 或 HttpOnly cookie 解析当前注册用户。"""
    token = _extract_access_token(authorization, access_cookie)
    if not token:
        raise HTTPException(status_code=401, detail="未登录")

    payload = _decode_active_access_token(token)
    try:
        user_id = int(payload["sub"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status_code=401, detail="登录凭证无效") from None

    rows = query(
        "SELECT id, username, email, role, avatar_url FROM users "
        "WHERE id = %s AND is_active = TRUE",
        (user_id,),
    )
    if not rows:
        raise HTTPException(status_code=401, detail="用户不存在或已停用")
    user = rows[0]
    user["role"] = _effective_user_role(user)
    return user


def get_admin_user(user: dict = Depends(get_current_user)) -> dict:
    # This deployment intentionally has one administrator account.  Checking
    # the configured address as well as the role prevents a stale/manual role
    # value from exposing the admin surface to another account.
    if user.get("role") != "admin" or str(user.get("email", "")).lower() != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return user


def ensure_primary_admin() -> None:
    """Promote the configured owner account on every startup.

    This is idempotent and also repairs the existing local demo database where
    the owner account was created before role support existed.  Registration
    still assigns the same role for a newly created owner account.
    """
    if not ADMIN_EMAIL:
        return
    existing = query("SELECT id FROM users WHERE lower(email) = %s", (ADMIN_EMAIL,))
    if not existing and ADMIN_BOOTSTRAP_PASSWORD:
        _validate_password(ADMIN_BOOTSTRAP_PASSWORD)
        insert_with_next_id(
            "users",
            {
                "username": ADMIN_USERNAME,
                "email": ADMIN_EMAIL,
                "password_hash": hash_password(ADMIN_BOOTSTRAP_PASSWORD),
                "role": "admin",
            },
        )
    execute(
        "UPDATE users SET role = 'admin', is_active = TRUE WHERE lower(email) = %s",
        (ADMIN_EMAIL,),
    )
    execute(
        "UPDATE users SET role = 'user' WHERE role = 'admin' AND lower(email) <> %s",
        (ADMIN_EMAIL,),
    )


async def enforce_registered_request(
    request: Request,
    user: dict = Depends(get_current_user),
) -> dict:
    """Require a registered session and reject forged ``user_id`` values.

    The first version of the API accepted ``user_id`` in every request body or
    query string and trusted it.  That is convenient for a local mock, but it
    lets an authenticated user read or mutate another user's records.  This
    router dependency keeps the existing request shapes backward compatible
    while making the session the source of truth: any declared user id must
    match the authenticated account.

    ``Request.body()`` is safe here because Starlette caches the body; FastAPI
    can still parse the same payload for the endpoint after this dependency
    completes.
    """
    if user.get("role") not in {"user", "admin"}:
        raise HTTPException(status_code=403, detail="该功能需要注册用户登录")

    # Credentialed browser requests must originate from a configured frontend.
    # This is a lightweight CSRF boundary for the cookie-backed API and still
    # permits non-browser Bearer clients whose requests do not carry Origin.
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        origin = request.headers.get("origin", "").strip().rstrip("/")
        if origin and origin not in CORS_ORIGINS:
            raise HTTPException(status_code=403, detail="请求来源未被允许")

    declared_ids: list[int] = []
    query_user_ids = request.query_params.getlist("user_id")
    for query_user_id in query_user_ids:
        try:
            declared_ids.append(int(query_user_id))
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="user_id 格式无效") from None

    content_type = request.headers.get("content-type", "").lower()
    if request.method in {"POST", "PUT", "PATCH", "DELETE"} and "application/json" in content_type:
        raw_body = await request.body()
        if raw_body.strip():
            try:
                payload = json.loads(raw_body)
            except json.JSONDecodeError:
                # Let FastAPI return its normal validation error for malformed
                # JSON; there is no user id to validate at this layer.
                payload = None
            if isinstance(payload, dict) and payload.get("user_id") is not None:
                try:
                    declared_ids.append(int(payload["user_id"]))
                except (TypeError, ValueError):
                    raise HTTPException(status_code=400, detail="user_id 格式无效") from None

    current_id = int(user["id"])
    if any(value != current_id for value in declared_ids):
        raise HTTPException(status_code=403, detail="不能操作其他用户的数据")

    request.state.current_user = user
    return user


@router.post("/change-password")
def change_password(
    req: ChangePasswordRequest,
    response: Response,
    user: dict = Depends(get_current_user),
):
    """Change the current account password and rotate its sessions."""
    _validate_password(req.new_password)
    if req.current_password == req.new_password:
        raise HTTPException(400, "新密码不能与当前密码相同")
    rows = query("SELECT password_hash FROM users WHERE id = %s AND is_active = TRUE", (user["id"],))
    if not rows:
        raise HTTPException(401, "用户不存在或已停用")
    try:
        valid = verify_password(req.current_password, rows[0]["password_hash"])
    except Exception:
        valid = False
    if not valid:
        raise HTTPException(400, "当前密码不正确")

    execute(
        "UPDATE users SET password_hash = %s WHERE id = %s",
        (hash_password(req.new_password), user["id"]),
    )
    _revoke_user_sessions(int(user["id"]))
    token = _issue_access_token(int(user["id"]), str(user.get("role", "user")), response)
    return {"status": "password_changed", "token": token}


@router.post("/password-reset/request")
def request_password_reset(req: PasswordResetRequest, request: Request = None):
    """Start a password reset without revealing whether an email exists.

    A mail provider can consume the generated token in production.  Local
    development may opt into returning the token through PASSWORD_RESET_DEBUG;
    the default is disabled for production deployments.
    """
    _enforce_auth_rate_limit(request, "password-reset")
    email = req.email.strip().lower()
    response: dict[str, str] = {
        "status": "accepted",
        "message": "如果邮箱已注册，重置说明会发送到邮箱。",
    }
    rows = query("SELECT id FROM users WHERE email = %s AND is_active = TRUE", (email,))
    if not rows:
        return response
    token = secrets.token_urlsafe(32)
    execute(
        "UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP "
        "WHERE user_id = %s AND used_at IS NULL",
        (rows[0]["id"],),
    )
    execute(
        "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (%s, %s, %s)",
        (rows[0]["id"], _token_hash(token), _utc_string(1)),
    )
    if PASSWORD_RESET_DEBUG:
        response["debug_token"] = token
    return response


@router.post("/password-reset/confirm")
def confirm_password_reset(req: PasswordResetConfirmRequest):
    _validate_password(req.new_password)
    if len(req.token.strip()) < 20:
        raise HTTPException(400, "重置链接无效或已过期")
    rows = query(
        "SELECT id, user_id FROM password_reset_tokens "
        "WHERE token_hash = %s AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP",
        (_token_hash(req.token.strip()),),
    )
    if not rows:
        raise HTTPException(400, "重置链接无效或已过期")
    token_row = rows[0]
    execute("UPDATE users SET password_hash = %s WHERE id = %s AND is_active = TRUE", (hash_password(req.new_password), token_row["user_id"]))
    execute("UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = %s", (token_row["id"],))
    _revoke_user_sessions(int(token_row["user_id"]))
    return {"status": "password_reset"}


@router.post("/register")
def register(req: RegisterRequest, response: Response, request: Request = None):
    """注册新用户并建立登录会话。"""
    _enforce_auth_rate_limit(request, "register")
    username = " ".join(req.username.strip().split())
    email = req.email.strip().lower()
    if len(username) < 2 or len(username) > 30:
        raise HTTPException(400, "用户名长度2-30个字符")
    if len(email) > 160 or "@" not in email:
        raise HTTPException(400, "请输入有效邮箱")
    _validate_password(req.password)
    if email == ADMIN_EMAIL:
        raise HTTPException(403, "该管理员账号需要由部署初始化，不能通过公开注册创建")

    existing = query(
        "SELECT id FROM users WHERE email = %s OR username = %s",
        (email, username),
    )
    if existing:
        raise HTTPException(400, "用户名或邮箱已被注册")

    password_hash = hash_password(req.password)
    # Public registration never grants admin privileges.  The configured
    # owner is promoted only by the startup reconciliation below, after the
    # account already exists in the database.
    role = "user"
    user_id = insert_with_next_id(
        "users",
        {"username": username, "email": email, "password_hash": password_hash, "role": role},
    )
    token = _issue_access_token(user_id, role, response)
    return {
        "token": token,
        "user": {
            "id": user_id,
            "username": username,
            "email": email,
            "role": role,
            "avatar_url": "",
        },
    }


@router.post("/login")
def login(req: LoginRequest, response: Response, request: Request = None):
    """用户登录并建立可撤销的会话。"""
    _enforce_auth_rate_limit(request, "login")
    email = req.email.strip().lower()
    rows = query(
        "SELECT id, username, email, password_hash, role, avatar_url FROM users "
        "WHERE email = %s AND is_active = TRUE",
        (email,),
    )
    if not rows or not verify_password(req.password, rows[0]["password_hash"]):
        raise HTTPException(401, "邮箱或密码错误")

    user = rows[0]
    user["role"] = _effective_user_role(user)
    token = _issue_access_token(user["id"], user["role"], response)
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "role": user["role"],
            "avatar_url": user.get("avatar_url", ""),
        },
    }


@router.post("/guest")
def guest_login(response: Response, request: Request = None):
    """游客模式：无需注册，生成 24 小时临时会话。"""
    _enforce_auth_rate_limit(request, "guest")
    token = generate_guest_token()
    expires_at = _utc_string(24)
    session_id = insert_with_next_id(
        "guest_sessions",
        {
            "session_token": "",
            "session_token_hash": _token_hash(token),
            "remaining_questions": 3,
            "expires_at": expires_at,
        },
    )
    _set_cookie(response, GUEST_COOKIE, token, 24 * 60 * 60)
    return {
        "token": token,
        "user": {"id": 0, "username": "游客", "role": "guest", "session_id": session_id},
        "notice": "游客模式可体验3个维度的画像构建，数据24小时后自动清除",
        "expires_at": expires_at,
    }


@router.post("/logout")
def logout(
    response: Response,
    authorization: str | None = Header(default=None),
    access_cookie: str | None = Cookie(default=None, alias=ACCESS_COOKIE),
    guest_cookie: str | None = Cookie(default=None, alias=GUEST_COOKIE),
):
    """撤销当前会话并清理浏览器 cookie。"""
    token = _extract_access_token(authorization, access_cookie)
    if token:
        execute(
            "UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP "
            "WHERE token_hash = %s AND revoked_at IS NULL",
            (_token_hash(token),),
        )
    guest_token = _extract_guest_token(authorization, guest_cookie)
    if guest_token:
        # Guest sessions are intentionally disposable. Removing the row on
        # logout makes a copied guest token invalid immediately instead of
        # leaving it usable until the normal 24-hour expiry.
        execute(
            "DELETE FROM guest_sessions WHERE session_token_hash = %s OR session_token = %s",
            (_token_hash(guest_token), guest_token),
        )
    _clear_cookies(response)
    return {"status": "logged_out"}


@router.get("/me")
def me(
    authorization: str | None = Header(default=None),
    access_cookie: str | None = Cookie(default=None, alias=ACCESS_COOKIE),
    guest_cookie: str | None = Cookie(default=None, alias=GUEST_COOKIE),
):
    """获取当前用户；无凭证时返回匿名状态。"""
    access_token = _extract_access_token(authorization, access_cookie)
    if access_token:
        payload = _decode_active_access_token(access_token)
        try:
            user_id = int(payload["sub"])
        except (KeyError, TypeError, ValueError):
            raise HTTPException(status_code=401, detail="登录凭证无效") from None
        rows = query(
            "SELECT id, username, email, role, avatar_url FROM users "
            "WHERE id = %s AND is_active = TRUE",
            (user_id,),
        )
        if not rows:
            raise HTTPException(status_code=401, detail="用户不存在或已停用")
        rows[0]["role"] = _effective_user_role(rows[0])
        return {
            "user": rows[0],
            "permissions": dict(ROLE_PERMISSIONS.get(rows[0].get("role", "user"), {})),
        }

    guest_token = _extract_guest_token(authorization, guest_cookie)
    if guest_token:
        session = _find_guest_session(guest_token)
        if not session:
            raise HTTPException(status_code=401, detail="游客会话已过期，请重新开始体验")
        return {
            "user": {
                "id": 0,
                "username": "游客",
                "role": "guest",
                "session_id": session["id"],
                "remaining": session["remaining_questions"],
            },
            "permissions": {"profile_build": True, "resource_generate": False},
        }

    return {"user": {"role": "anonymous"}, "notice": "请登录或使用游客模式"}


@router.get("/admin/users")
def list_users(user: dict = Depends(get_admin_user), limit: int = 100, offset: int = 0):
    """管理员查看用户列表。"""
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    rows = query(
        "SELECT id, username, email, role, avatar_url, is_active, email_verified, created_at "
        "FROM users ORDER BY created_at DESC LIMIT %s OFFSET %s",
        (limit, offset),
    )
    counts = query(
        "SELECT COUNT(*) AS total, "
        "SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) AS active, "
        "SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS admins FROM users"
    )
    return {"users": rows, "total": int((counts[0] if counts else {}).get("total") or 0), "summary": counts[0] if counts else {}}


@router.get("/admin/overview")
def admin_overview(user: dict = Depends(get_admin_user)):
    """Small operational snapshot for the administrator dashboard."""
    users = query(
        "SELECT COUNT(*) AS total, "
        "SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) AS active, "
        "SUM(CASE WHEN is_active = FALSE THEN 1 ELSE 0 END) AS inactive "
        "FROM users"
    )
    sessions = query(
        "SELECT COUNT(*) AS active_sessions FROM auth_sessions "
        "WHERE revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP"
    )
    try:
        jobs = query(
            "SELECT status, COUNT(*) AS count FROM generation_jobs "
            "GROUP BY status ORDER BY status"
        )
    except Exception:
        jobs = []
    try:
        audit = query("SELECT COUNT(*) AS count FROM audit_logs")
        audit_count = int((audit[0] if audit else {}).get("count") or 0)
    except Exception:
        audit_count = 0
    return {
        "users": users[0] if users else {"total": 0, "active": 0, "inactive": 0},
        "active_sessions": int((sessions[0] if sessions else {}).get("active_sessions") or 0),
        "generation_jobs": jobs,
        "audit_events": audit_count,
    }


@router.get("/admin/jobs")
def list_generation_jobs(user: dict = Depends(get_admin_user), limit: int = 80):
    """查看最近生成任务，便于定位云端模型或队列故障。"""
    limit = max(1, min(limit, 200))
    try:
        rows = query(
            "SELECT job_id, user_id, kind, status, error_code, retryable, progress, "
            "created_at, started_at, finished_at FROM generation_jobs "
            "ORDER BY created_at DESC LIMIT %s",
            (limit,),
        )
    except Exception:
        rows = []
    for row in rows:
        progress = row.get("progress")
        if isinstance(progress, str):
            try:
                row["progress"] = json.loads(progress)
            except json.JSONDecodeError:
                row["progress"] = {}
    return {"jobs": rows}


@router.get("/admin/audit")
def list_audit_events(user: dict = Depends(get_admin_user), limit: int = 80):
    """查看安全过滤与模型调用审计摘要。"""
    limit = max(1, min(limit, 200))
    try:
        rows = query(
            "SELECT id, user_id, agent_name, passed, score, detail, created_at "
            "FROM audit_logs ORDER BY created_at DESC LIMIT %s",
            (limit,),
        )
    except Exception:
        rows = []
    for row in rows:
        detail = row.get("detail")
        if isinstance(detail, str):
            try:
                row["detail"] = json.loads(detail)
            except json.JSONDecodeError:
                pass
    return {"events": rows}


@router.patch("/admin/users/{user_id}")
def update_user(user_id: int, req: AdminUserUpdateRequest, user: dict = Depends(get_admin_user)):
    """Enable/disable accounts while keeping the configured owner protected."""
    rows = query("SELECT id, email, role, is_active FROM users WHERE id = %s", (user_id,))
    if not rows:
        raise HTTPException(404, "用户不存在")
    target = rows[0]
    target_email = str(target.get("email", "")).lower()
    if target_email == ADMIN_EMAIL:
        if req.role == "user" or req.is_active is False:
            raise HTTPException(400, "主管理员账号不能降级或停用")
    if int(target["id"]) == int(user["id"]) and req.is_active is False:
        raise HTTPException(400, "不能停用当前管理员账号")
    if req.role == "admin" and target_email != ADMIN_EMAIL:
        raise HTTPException(400, "当前部署只允许配置的主管理员账号使用管理员权限")

    fields: list[str] = []
    params: list[object] = []
    if req.is_active is not None:
        fields.append("is_active = %s")
        params.append(req.is_active)
    if req.role is not None:
        fields.append("role = %s")
        params.append(req.role)
    if not fields:
        return {"user": target}
    params.append(user_id)
    execute(f"UPDATE users SET {', '.join(fields)} WHERE id = %s", tuple(params))
    updated = query(
        "SELECT id, username, email, role, avatar_url, is_active, email_verified, created_at FROM users WHERE id = %s",
        (user_id,),
    )
    if req.is_active is False:
        _revoke_user_sessions(user_id)
    return {"user": updated[0] if updated else None}
