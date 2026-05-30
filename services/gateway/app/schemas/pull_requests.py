"""Pull request import and file schemas."""
from __future__ import annotations

from pydantic import BaseModel, Field


class ImportPullRequestBody(BaseModel):
    url: str = Field(min_length=1)


class ImportPullRequestResponse(BaseModel):
    pr_id: str = Field(alias="prId")
    source: str

    model_config = {"populate_by_name": True}


class PullRequestFileSchema(BaseModel):
    id: str
    pull_request_id: str = Field(alias="pullRequestId")
    filename: str
    patch: str = ""
    additions: int = 0
    deletions: int = 0
    status: str = "modified"

    model_config = {"populate_by_name": True}
