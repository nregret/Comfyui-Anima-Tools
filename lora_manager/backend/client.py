from __future__ import annotations

import gzip
import http.client
import json
import threading
import urllib.parse


USER_AGENT = "AnimaTools/1.0"
REDIRECT_STATUSES = {301, 302, 303, 307, 308}
# RemoteDisconnected is a ConnectionResetError; Windows reports dropped sockets as ConnectionAbortedError.
STALE_CONNECTION_ERRORS = (http.client.CannotSendRequest, ConnectionError)
# One keep-alive connection per host and worker thread; Civitai API calls skip
# a ~0.3s TLS handshake when the same thread asks again.
_thread_connections = threading.local()


def fetch(url: str, headers: dict[str, str], timeout: float, redirects: int = 3) -> tuple[int, str, bytes]:
    """GET ``url`` over a reused connection and return (status, reason, decoded body)."""
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError(f"Unsupported URL: {url}")
    connections = _thread_connections.__dict__.setdefault("pool", {})
    key = (parsed.scheme, parsed.netloc)
    path = f"{parsed.path or '/'}{'?' + parsed.query if parsed.query else ''}"
    connection = connections.pop(key, None)
    while True:
        reused = connection is not None
        if connection is None:
            connection_class = http.client.HTTPSConnection if parsed.scheme == "https" else http.client.HTTPConnection
            connection = connection_class(parsed.netloc, timeout=timeout)
        elif connection.sock is not None:
            connection.sock.settimeout(timeout)
        try:
            connection.request("GET", path, headers={**headers, "Accept-Encoding": "gzip"})
            response = connection.getresponse()
            body = response.read()
            break
        except STALE_CONNECTION_ERRORS:
            connection.close()
            connection = None
            if not reused:
                raise
        except Exception:
            connection.close()
            raise
    if response.will_close:
        connection.close()
    else:
        connections[key] = connection
    if (response.getheader("Content-Encoding") or "").lower() == "gzip":
        body = gzip.decompress(body)
    location = response.getheader("Location")
    if response.status in REDIRECT_STATUSES and location and redirects:
        target = urllib.parse.urljoin(url, location)
        if urllib.parse.urlsplit(target).netloc != parsed.netloc:
            headers = {name: value for name, value in headers.items() if name.lower() != "authorization"}
        return fetch(target, headers, timeout, redirects - 1)
    return response.status, response.reason, body


def request_headers(api_key: str | None = None, json_content: bool = True) -> dict[str, str]:
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json" if json_content else "*/*",
    }
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    return headers


def http_error_message(body: str, fallback: str) -> str:
    if body:
        try:
            data = json.loads(body)
            if isinstance(data, dict):
                return str(data.get("error") or data.get("message") or data.get("detail") or fallback)
        except Exception:
            pass
    return fallback


def civitai_red_url(url: str) -> str:
    """Point civitai.com site links (e.g. saved retry payloads) at civitai.red."""
    parsed = urllib.parse.urlparse(url)
    if (parsed.hostname or "").lower() not in {"civitai.com", "www.civitai.com"}:
        return url
    return urllib.parse.urlunparse(parsed._replace(netloc="civitai.red"))


def validate_civitai_https(url: str) -> bool:
    try:
        parsed = urllib.parse.urlparse(url)
    except Exception:
        return False
    host = parsed.netloc.lower()
    return parsed.scheme == "https" and (host == "civitai.red" or host.endswith(".civitai.red"))
