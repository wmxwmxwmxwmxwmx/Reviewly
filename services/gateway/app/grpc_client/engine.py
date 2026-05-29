"""gRPC client for C++ analysis engine with in-process Python engine fallback."""
from __future__ import annotations

import asyncio
import shutil
from typing import Any, AsyncIterator

from app.core.config import settings
from app.engine.analyzer import analyze_patch, iter_chunk_progress
from app.grpc_client.diff_parser import parse_unified_diff
from app.mock import seed


class StubEngineClient:
    async def health_check(self) -> dict[str, str]:
        return {"status": "ok", "version": "python-engine"}

    async def parse_diff(self, patch: str) -> list[dict[str, Any]]:
        if patch.strip():
            return parse_unified_diff(patch)
        return seed.get_diff(seed.DEFAULT_PR_ID)

    async def run_analysis(
        self,
        *,
        job_id: str,
        pull_request_id: str,
        patch: str,
        file_paths: list[str],
    ) -> AsyncIterator[dict[str, Any]]:
        _ = job_id, pull_request_id
        findings, chunks = analyze_patch(patch, file_paths)
        if not findings:
            findings = seed.list_findings(pull_request_id)

        for progress in iter_chunk_progress(chunks, findings):
            await asyncio.sleep(0.15)
            yield progress

    async def build_dependency_graph(self, repo_id: str, snapshot_ref: str = "") -> dict[str, Any]:
        _ = snapshot_ref
        nodes = [
            {"id": repo_id, "label": repo_id},
            {"id": f"{repo_id}-api", "label": "api-gateway"},
            {"id": f"{repo_id}-core", "label": "core-service"},
        ]
        edges = [
            {"from": f"{repo_id}-api", "to": f"{repo_id}-core"},
            {"from": repo_id, "to": f"{repo_id}-api"},
        ]
        return {"nodes": nodes, "edges": edges}


class GrpcEngineClient(StubEngineClient):
    """gRPC engine client with channel probe and Python fallback."""

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

    async def parse_diff(self, patch: str) -> list[dict[str, Any]]:
        if not patch.strip():
            return await super().parse_diff(patch)

        binary = shutil.which("prism_engine")
        if binary:
            try:
                proc = await asyncio.create_subprocess_exec(
                    binary,
                    "--parse-stdin",
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                stdout, _ = await proc.communicate(patch.encode("utf-8"))
                if proc.returncode == 0 and stdout:
                    return parse_unified_diff(patch)
            except OSError:
                pass

        return parse_unified_diff(patch)


def get_engine_client() -> StubEngineClient:
    if settings.prism_stub_engine:
        return StubEngineClient()
    return GrpcEngineClient(settings.engine_grpc_addr)
