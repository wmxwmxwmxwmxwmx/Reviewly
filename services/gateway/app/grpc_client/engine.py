"""gRPC client for C++ analysis engine with in-process stub fallback."""
from __future__ import annotations

import asyncio
from typing import Any, AsyncIterator

from app.core.config import settings
from app.mock import seed


class StubEngineClient:
    async def health_check(self) -> dict[str, str]:
        return {"status": "ok", "version": "stub"}

    async def parse_diff(self, patch: str) -> list[dict[str, Any]]:
        _ = patch
        return seed.get_diff(seed.DEFAULT_PR_ID)

    async def run_analysis(
        self,
        *,
        job_id: str,
        pull_request_id: str,
        patch: str,
        file_paths: list[str],
    ) -> AsyncIterator[dict[str, Any]]:
        _ = job_id, patch
        total = max(len(file_paths), 1)
        findings = seed.list_findings(pull_request_id)

        for i in range(total):
            await asyncio.sleep(0.35)
            yield {
                "status": "running",
                "progress": int((i + 1) / total * 100),
                "chunkIndex": i + 1,
                "chunkTotal": total,
                "findings": findings if i == total - 1 else [],
            }

        yield {
            "status": "completed",
            "progress": 100,
            "chunkIndex": total,
            "chunkTotal": total,
            "findings": findings,
        }


class GrpcEngineClient(StubEngineClient):
    """Placeholder for real gRPC — falls back to stub until channel connects."""

    def __init__(self, addr: str) -> None:
        self._addr = addr

    async def health_check(self) -> dict[str, str]:
        try:
            import grpc  # type: ignore[import-untyped]

            channel = grpc.aio.insecure_channel(self._addr)
            await asyncio.wait_for(channel.channel_ready(), timeout=2.0)
            await channel.close()
            return {"status": "ok", "version": "grpc"}
        except Exception:
            return await super().health_check()


def get_engine_client() -> StubEngineClient:
    if settings.prism_stub_engine:
        return StubEngineClient()
    return GrpcEngineClient(settings.engine_grpc_addr)
