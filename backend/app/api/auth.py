"""认证 API：注册、登录、游客模式和会话管理。"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Request, Response
from pydantic import BaseModel

from app.config import CORS_ORIGINS, COOKIE_SAMESITE, COOKIE_SECURE, JWT_EXPIRE_MINUTES
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
class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _utc_string(hours: int) -> str:
    value = datetime.now(timezone.utc) + timedelta(hours=hours)
    return value.replace(tzinfo=None).strftime("%Y-%m-%d %H:%M:%S")


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
    return rows[0]


def get_admin_user(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return user


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


@router.post("/register")
def register(req: RegisterRequest, response: Response):
    """注册新用户并建立登录会话。"""
    username = " ".join(req.username.strip().split())
    email = req.email.strip().lower()
    if len(username) < 2 or len(username) > 30:
        raise HTTPException(400, "用户名长度2-30个字符")
    if len(email) > 160 or "@" not in email:
        raise HTTPException(400, "请输入有效邮箱")
    if len(req.password) < 6:
        raise HTTPException(400, "密码至少6位")

    existing = query(
        "SELECT id FROM users WHERE email = %s OR username = %s",
        (email, username),
    )
    if existing:
        raise HTTPException(400, "用户名或邮箱已被注册")

    password_hash = hash_password(req.password)
    user_id = insert_with_next_id(
        "users",
        {"username": username, "email": email, "password_hash": password_hash, "role": "user"},
    )

    token = _issue_access_token(user_id, "user", response)
    return {
        "token": token,
        "user": {
            "id": user_id,
            "username": username,
            "email": email,
            "role": "user",
            "avatar_url": "",
        },
    }


@router.post("/login")
def login(req: LoginRequest, response: Response):
    """用户登录并建立可撤销的会话。"""
    email = req.email.strip().lower()
    rows = query(
        "SELECT id, username, email, password_hash, role, avatar_url FROM users "
        "WHERE email = %s AND is_active = TRUE",
        (email,),
    )
    if not rows or not verify_password(req.password, rows[0]["password_hash"]):
        raise HTTPException(401, "邮箱或密码错误")

    user = rows[0]
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
def guest_login(response: Response):
    """游客模式：无需注册，生成 24 小时临时会话。"""
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
def list_users(user: dict = Depends(get_admin_user)):
    """管理员查看用户列表。"""
    rows = query(
        "SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC"
    )
    return {"users": rows}
