from __future__ import annotations

import copy
import threading
import time
from collections.abc import Callable
from typing import Any


class LibraryIndex:
    def __init__(self, ttl_seconds: int = 30) -> None:
        self.ttl_seconds = max(1, int(ttl_seconds))
        self._lock = threading.Lock()
        self._snapshot: dict[str, Any] | None = None
        self._expires_at = 0.0

    def get(self, loader: Callable[[], dict[str, Any]], force: bool = False) -> dict[str, Any]:
        now = time.monotonic()
        with self._lock:
            if not force and self._snapshot is not None and now < self._expires_at:
                return copy.deepcopy(self._snapshot)
            snapshot = loader()
            self._snapshot = copy.deepcopy(snapshot)
            self._expires_at = now + self.ttl_seconds
            return copy.deepcopy(snapshot)

    def invalidate(self) -> None:
        with self._lock:
            self._snapshot = None
            self._expires_at = 0.0
