"""Validation helpers for user-supplied remote media references."""

from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse

from fastapi import HTTPException


def _is_private_host(hostname: str) -> bool:
    normalized = hostname.strip().lower().rstrip(".")
    if normalized in {"localhost", "localhost.localdomain", "metadata.google.internal"}:
        return True
    try:
        address = ipaddress.ip_address(normalized)
        return bool(
            address.is_private
            or address.is_loopback
            or address.is_link_local
            or address.is_multicast
            or address.is_reserved
            or address.is_unspecified
        )
    except ValueError:
        pass
    try:
        resolved = socket.getaddrinfo(normalized, None, type=socket.SOCK_STREAM)
    except (OSError, socket.gaierror):
        # The downstream provider will return a useful error for an unresolved
        # public hostname; do not block ordinary CDN URLs here.
        return False
    return any(_is_private_host(item[4][0]) for item in resolved if item and item[4])


def validate_remote_media_reference(value: str, *, field: str = "媒体地址") -> str:
    """Allow public HTTP(S) URLs while rejecting SSRF-prone targets."""
    value = value.strip()
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise HTTPException(400, f"{field}必须是 http 或 https 地址")
    if parsed.username or parsed.password:
        raise HTTPException(400, f"{field}不能包含账号密码")
    if len(value) > 2048:
        raise HTTPException(400, f"{field}过长")
    if _is_private_host(parsed.hostname):
        raise HTTPException(400, f"{field}不能指向本机或内网地址")
    return value


def validate_media_reference(value: str, *, field: str = "媒体") -> str:
    """Validate an image/audio reference without rejecting local data URIs."""
    value = value.strip()
    if value.startswith("data:"):
        if len(value) > 12 * 1024 * 1024:
            raise HTTPException(400, f"{field}数据过大")
        return value
    if value.startswith(("file:", "/", "\\")):
        # Local file references are only useful for trusted server-side ASR
        # calls.  The caller still applies its own filesystem policy.
        if len(value) > 2048:
            raise HTTPException(400, f"{field}地址过长")
        return value
    return validate_remote_media_reference(value, field=field)

