from __future__ import annotations

import copy
import json
import os
import threading
import time
import uuid
from typing import Any


ACTIVE_STATUSES = {"pending", "downloading", "cancelling"}
TERMINAL_STATUSES = {"completed", "failed", "cancelled"}


class DownloadJobStore:
    def __init__(
        self,
        path: str,
        history_limit: int = 100,
        retention_seconds: int = 24 * 60 * 60,
    ) -> None:
        self.path = path
        self.history_limit = max(1, int(history_limit))
        self.retention_seconds = max(1, int(retention_seconds))
        self.lock = threading.RLock()
        self.jobs: dict[str, dict[str, Any]] = {}
        self._cancel_events: dict[str, threading.Event] = {}
        self._load()

    @staticmethod
    def _now() -> int:
        return int(time.time())

    @staticmethod
    def _finished_at(job: dict[str, Any]) -> int:
        return int(
            job.get("completed_at")
            or job.get("failed_at")
            or job.get("cancelled_at")
            or job.get("created_at")
            or 0
        )

    def _load(self) -> None:
        if not os.path.isfile(self.path):
            return
        try:
            with open(self.path, "r", encoding="utf-8") as handle:
                raw = json.load(handle)
            jobs = raw.get("jobs") if isinstance(raw, dict) else None
            if not isinstance(jobs, dict):
                return
            now = self._now()
            for task_id, value in jobs.items():
                if not isinstance(value, dict):
                    continue
                job = dict(value)
                job["id"] = str(job.get("id") or task_id)
                if job.get("status") in ACTIVE_STATUSES:
                    job["status"] = "failed"
                    job["error"] = "Download interrupted by ComfyUI restart"
                    job["failed_at"] = now
                self.jobs[str(task_id)] = job
            with self.lock:
                self._prune_locked(now)
                self._persist_locked()
        except Exception:
            self.jobs = {}

    def _persist_locked(self) -> None:
        directory = os.path.dirname(self.path)
        if directory:
            os.makedirs(directory, exist_ok=True)
        temp_path = f"{self.path}.{uuid.uuid4().hex}.tmp"
        try:
            with open(temp_path, "w", encoding="utf-8") as handle:
                json.dump({"version": 1, "jobs": self.jobs}, handle, indent=2, ensure_ascii=False)
            os.replace(temp_path, self.path)
        finally:
            if os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except OSError:
                    pass

    def _prune_locked(self, now: int | None = None) -> bool:
        changed = False
        current_time = self._now() if now is None else int(now)
        for task_id, job in list(self.jobs.items()):
            if job.get("status") not in TERMINAL_STATUSES:
                continue
            finished_at = self._finished_at(job)
            if finished_at and current_time - finished_at > self.retention_seconds:
                self.jobs.pop(task_id, None)
                self._cancel_events.pop(task_id, None)
                changed = True
        retained = sorted(
            (
                (task_id, job)
                for task_id, job in self.jobs.items()
                if job.get("status") in TERMINAL_STATUSES
            ),
            key=lambda item: self._finished_at(item[1]),
            reverse=True,
        )
        for task_id, _ in retained[self.history_limit:]:
            self.jobs.pop(task_id, None)
            self._cancel_events.pop(task_id, None)
            changed = True
        return changed

    @staticmethod
    def _public_job(job: dict[str, Any]) -> dict[str, Any]:
        public = dict(job)
        public.pop("retry_payload", None)
        return public

    def add(self, job: dict[str, Any], retry_payload: dict[str, Any]) -> None:
        task_id = str(job["id"])
        with self.lock:
            self._prune_locked()
            stored = copy.deepcopy(job)
            stored["retry_payload"] = copy.deepcopy(retry_payload)
            self.jobs[task_id] = stored
            self._cancel_events[task_id] = threading.Event()
            self._persist_locked()

    def add_if_capacity(
        self,
        job: dict[str, Any],
        retry_payload: dict[str, Any],
        max_active: int,
    ) -> bool:
        task_id = str(job["id"])
        with self.lock:
            self._prune_locked()
            active_count = sum(
                1 for current in self.jobs.values() if current.get("status") in ACTIVE_STATUSES
            )
            if active_count >= max(1, int(max_active)):
                return False
            stored = copy.deepcopy(job)
            stored["retry_payload"] = copy.deepcopy(retry_payload)
            self.jobs[task_id] = stored
            self._cancel_events[task_id] = threading.Event()
            self._persist_locked()
            return True

    def remove(self, task_id: str) -> None:
        with self.lock:
            self.jobs.pop(task_id, None)
            self._cancel_events.pop(task_id, None)
            self._persist_locked()

    def remove_finished_many(self, task_ids: list[str] | None = None) -> int:
        """Remove selected terminal jobs, or every terminal job when no IDs are given."""
        with self.lock:
            if task_ids is not None:
                selected_ids = {
                    str(task_id)
                    for task_id in task_ids
                    if str(task_id) in self.jobs
                    and self.jobs[str(task_id)].get("status") in TERMINAL_STATUSES
                }
            else:
                selected_ids = {
                    current_id
                    for current_id, job in self.jobs.items()
                    if job.get("status") in TERMINAL_STATUSES
                }
            for current_id in selected_ids:
                self.jobs.pop(current_id, None)
                self._cancel_events.pop(current_id, None)
            if selected_ids:
                self._persist_locked()
            return len(selected_ids)

    def remove_finished(self, task_id: str = "") -> int:
        """Remove one or all terminal jobs without disturbing active downloads."""
        return self.remove_finished_many([task_id] if task_id else None)

    def update(self, task_id: str, persist: bool = True, **changes: Any) -> dict[str, Any] | None:
        with self.lock:
            job = self.jobs.get(task_id)
            if not job:
                return None
            job.update(changes)
            if job.get("status") in TERMINAL_STATUSES:
                self._cancel_events.pop(task_id, None)
            if persist:
                self._persist_locked()
            return self._public_job(job)

    def active_count(self) -> int:
        with self.lock:
            return sum(1 for job in self.jobs.values() if job.get("status") in ACTIVE_STATUSES)

    def snapshot(self, task_id: str = "") -> dict[str, Any]:
        with self.lock:
            if self._prune_locked():
                self._persist_locked()
            if task_id:
                job = self.jobs.get(task_id)
                return self._public_job(job) if job else {"status": "not_found"}
            return {task_id: self._public_job(job) for task_id, job in self.jobs.items()}

    def cancel_event(self, task_id: str) -> threading.Event:
        with self.lock:
            return self._cancel_events.setdefault(task_id, threading.Event())

    def request_cancel(self, task_id: str) -> dict[str, Any] | None:
        with self.lock:
            job = self.jobs.get(task_id)
            if not job or job.get("status") not in ACTIVE_STATUSES:
                return None
            self._cancel_events.setdefault(task_id, threading.Event()).set()
            job["status"] = "cancelling"
            job["cancel_requested_at"] = self._now()
            self._persist_locked()
            return self._public_job(job)

    def retry_payload(self, task_id: str) -> dict[str, Any] | None:
        with self.lock:
            job = self.jobs.get(task_id)
            if not job or job.get("status") not in {"failed", "cancelled"}:
                return None
            payload = job.get("retry_payload")
            return copy.deepcopy(payload) if isinstance(payload, dict) else None
