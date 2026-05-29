"""gRPC client for C++ analysis engine with stub + Python parse fallback."""
from __future__ import annotations

import asyncio
import json
import shutil
import subprocess
from typing import Any, AsyncIterator

from app.core.config import settings
from app.grpc_client.diff_parser import parse_unified_diff
from app.mock import seed


class StubEngineClient:
    async def health_check(self) -> dict[str, str]:
        return {"status": "ok", "version": "stub"}

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
        _ = job_id, patch
        total = max(len(file_paths), 1)
        findings = seed.list_findings(pull_request_id)

        for i in range(total):
            await asyncio.sleep(0.2)
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

    async def build_dependency_graph(self, repo_id: str, snapshot_ref: str = "") -> dict[str, Any]:
        _ = snapshot_ref
        return {
            "nodes": [{"id": repo_id, "label": repo_id}],
            "edges": [],
        }


class GrpcEngineClient(StubEngineClient):
    """gRPC engine client with channel probe and subprocess parse fallback."""

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
                    return _parse_engine_cli_output(stdout.decode("utf-8"), patch)
            except OSError:
                pass

        return parse_unified_diff(patch)

    async def build_dependency_graph(self, repo_id: str, snapshot_ref: str = "") -> dict[str, Any]:
        try:
            import grpc  # type: ignore[import-untyped]
            from prism.v1 import engine_pb2, engine_pb2_grpc  # type: ignore[import-not-found]

            channel = grpc.aio.insecure_channel(self._addr)
            stub = engine_pb2_grpc.EngineServiceStub(channel)
            req = engine_pb2.DependencyGraphRequest(repo_id=repo_id, snapshot_ref=snapshot_ref)
            resp = await stub.BuildDependencyGraph(req)
            await channel.close()
            return {
                "nodes": [{"id": n.id, "label": n.label} for n in resp.nodes],
                "edges": [{"from": e.from_, "to": e.to} for e in resp.edges],
            }
        except Exception:
            return await super().build_dependency_graph(repo_id, snapshot_ref)


def _parse_engine_cli_output(stdout: str, patch: str) -> list[dict[str, Any]]:
    """CLI prints file count/lines; fall back to Python parser for JSON API shape."""
    _ = stdout
    return parse_unified_diff(patch)


def get_engine_client() -> StubEngineClient:
    if settings.prism_stub_engine:
        return StubEngineClient()
    return GrpcEngineClient(settings.engine_grpc_addr)
