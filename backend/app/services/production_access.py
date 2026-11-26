"""Formal HTTPS identity. The proxy maps its allowlist into a private path prefix."""
import asyncio
import base64
import hashlib
import hmac
import json
import os
import re
import time
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, build_opener

from fastapi.responses import JSONResponse

PREFIX = "/internal/production"
ISSUER = "dermatome-https"
AUDIENCE = "dermatome-mini-program"
TOKEN_SECONDS = 900
LOGIN = "/api/v1/access/wechat"
POST_PATH = re.compile(r"/api/v1/(?:evaluate(?:/body-intersection)?|ai/sessions(?:/[a-f0-9]{32}/(?:photo|segment|edit|confirm))?)")
SESSION_PATH = re.compile(r"/api/v1/ai/sessions/[a-f0-9]{32}")
ASSET_PATH = re.compile(r"/api/v1/ai/sessions/[a-f0-9]{32}/assets/[A-Za-z0-9_.-]{1,100}")


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def exchange_code(appid, secret, code):
    query = urlencode({"appid": appid, "secret": secret, "js_code": code,
                       "grant_type": "authorization_code"})
    try:
        with build_opener(NoRedirect()).open(
            "https://api.weixin.qq.com/sns/jscode2session?" + query, timeout=5
        ) as reply:
            result = json.loads(reply.read(8192))
        if isinstance(result, dict) and result.get("errcode", 0) == 0:
            return result.get("openid")
    except (OSError, ValueError, URLError):
        pass
    return None


def _encode(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


class ProductionIdentity:
    def __init__(self, appid, secret, key, allowed, exchange=exchange_code, clock=time.time):
        self.appid, self.secret, self.key = appid, secret, key
        # No list means every user authenticated by this mini-program AppID may
        # enter. A list remains available for an explicitly restricted preview.
        self.allowed = None if allowed is None else frozenset(allowed)
        self.exchange, self.clock = exchange, clock
        self.owners = None if self.allowed is None else {
            self._owner(openid) for openid in self.allowed
        }

    @classmethod
    def from_environment(cls):
        if os.getenv("ENABLE_PRODUCTION_ACCESS") != "1":
            return None
        appid = os.getenv("DERMATOME_WECHAT_APP_ID", "")
        secret = os.getenv("DERMATOME_WECHAT_APP_SECRET", "")
        key = os.getenv("DERMATOME_PRODUCTION_SIGNING_KEY", "")
        allowlist_text = os.getenv("DERMATOME_WECHAT_ALLOWED_OPENIDS", "").strip()
        allowed = set(allowlist_text.split()) if allowlist_text else None
        if (not re.fullmatch(r"wx[0-9a-f]{16}", appid)
            or not re.fullmatch(r"[0-9a-fA-F]{32}", secret)
            or not re.fullmatch(r"[0-9a-fA-F]{64}", key)
            or (allowed is not None
                and any(not re.fullmatch(r"[A-Za-z0-9_-]{16,128}", item)
                        for item in allowed))):
            return None
        return cls(appid, secret, bytes.fromhex(key), allowed)

    def _digest(self, purpose, data):
        return hmac.digest(self.key, purpose + data, hashlib.sha256)

    def _owner(self, openid):
        return "prod:" + self._digest(b"owner:", openid.encode()).hex()

    def login(self, code):
        openid = self.exchange(self.appid, self.secret, code)
        if (not isinstance(openid, str)
                or not re.fullmatch(r"[A-Za-z0-9_-]{16,128}", openid)
                or self.allowed is not None and openid not in self.allowed):
            return None
        expires = int(self.clock()) + TOKEN_SECONDS
        claims = _encode(json.dumps({"iss": ISSUER, "aud": AUDIENCE + ":" + self.appid,
                                    "sub": self._owner(openid), "exp": expires},
                                   separators=(",", ":")).encode())
        signature = _encode(self._digest(b"access:", claims.encode()))
        return {"access_token": f"dm1.{claims}.{signature}", "token_type": "Bearer",
                "access_kind": "production", "expires_at": expires}

    def verify(self, authorization):
        match = re.fullmatch(rb"Bearer dm1\.([A-Za-z0-9_-]{40,450})\.([A-Za-z0-9_-]{43})", authorization)
        if not match:
            return None
        claims, signature = match.groups()
        if not hmac.compare_digest(signature, _encode(self._digest(b"access:", claims)).encode()):
            return None
        try:
            data = json.loads(base64.urlsafe_b64decode(claims + b"=" * (-len(claims) % 4)))
            subject = data["sub"]
            subject_valid = (
                isinstance(subject, str)
                and re.fullmatch(r"prod:[0-9a-f]{64}", subject)
                and (self.owners is None or subject in self.owners)
            )
            if (data["iss"] == ISSUER and data["aud"] == AUDIENCE + ":" + self.appid
                and type(data["exp"]) is int and self.clock() < data["exp"] <= self.clock() + TOKEN_SECONDS
                and subject_valid):
                return subject
        except (ValueError, KeyError, TypeError):
            pass
        return None


class ProductionAccessBoundary:
    def __init__(self, app):
        self.app = app
        self.login_slot = asyncio.Semaphore(2)
        self.window = -1
        self.login_count = 0

    async def __call__(self, scope, receive, send):
        incoming = scope.get("path", "")
        if scope["type"] != "http" or not incoming.startswith(PREFIX + "/"):
            return await self.app(scope, receive, send)
        path, method = incoming[len(PREFIX):], scope["method"]

        async def respond(body, status):
            await JSONResponse(body, status_code=status, headers={"Cache-Control": "no-store"})(scope, receive, send)

        async def reject(code, message, status):
            await respond({"error": {"code": code, "message": message}}, status)

        login = method == "POST" and path == LOGIN
        if not (login or method == "POST" and POST_PATH.fullmatch(path)
                or method == "DELETE" and SESSION_PATH.fullmatch(path)
                or method == "GET" and ASSET_PATH.fullmatch(path)):
            return await reject("NOT_FOUND", "接口不存在", 404)
        identity = getattr(scope["app"].state, "production_identity", None)
        if identity is None:
            return await reject("PRODUCTION_UNAVAILABLE", "正式服务暂不可用", 503)
        headers = dict(scope["headers"])
        if b"origin" in headers:
            return await reject("ORIGIN_DENIED", "不允许跨站访问", 403)
        if login:
            now = int(time.monotonic() // 60)
            if now != self.window:
                self.window, self.login_count = now, 0
            if self.login_count >= 20 or self.login_slot.locked():
                return await reject("RATE_LIMITED", "连接过于频繁，请稍后重试", 429)
            self.login_count += 1
            async with self.login_slot:
                body = bytearray()
                while True:
                    message = await receive()
                    if message["type"] == "http.disconnect":
                        return
                    body.extend(message.get("body", b""))
                    if len(body) > 2048:
                        return await reject("PAYLOAD_TOO_LARGE", "登录请求超出大小限制", 413)
                    if not message.get("more_body", False):
                        break
                try:
                    payload = json.loads(body)
                    code = payload["code"]
                    if set(payload) != {"code"} or not re.fullmatch(r"[A-Za-z0-9_-]{8,128}", code):
                        raise ValueError
                except (KeyError, TypeError, ValueError):
                    return await reject("INVALID_INPUT", "微信登录请求无效", 422)
                result = await asyncio.to_thread(identity.login, code)
            if not result:
                return await reject("PRODUCTION_ACCESS_DENIED", "微信登录未通过", 403)
            return await respond(result, 200)
        owner = identity.verify(headers.get(b"authorization", b""))
        if not owner:
            return await reject("PRODUCTION_LOGIN_REQUIRED", "微信访问已失效，请重试", 401)
        # Use the fixed private route namespace, then dispatch to the existing business handlers.
        routed = {**scope, "path": path, "raw_path": path.encode("ascii"), "production_principal": owner}
        await self.app(routed, receive, send)
