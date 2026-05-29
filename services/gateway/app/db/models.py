"""SQLAlchemy models (B2+) — aligned with docs/plan.md appendix B."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.types import JSON


class Base(DeclarativeBase):
    pass


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255))


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    team_id: Mapped[str] = mapped_column(ForeignKey("teams.id"))
    email: Mapped[str] = mapped_column(String(255))
    payload: Mapped[dict | None] = mapped_column(JSON)


class Repository(Base):
    __tablename__ = "repositories"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    team_id: Mapped[str | None] = mapped_column(ForeignKey("teams.id"), nullable=True)
    installation_id: Mapped[str | None] = mapped_column(String(64))
    full_name: Mapped[str] = mapped_column(String(512))
    ai_review_enabled: Mapped[bool] = mapped_column(default=True)
    settings: Mapped[dict | None] = mapped_column(JSON)
    payload: Mapped[dict | None] = mapped_column(JSON)


class PullRequest(Base):
    __tablename__ = "pull_requests"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    repository_id: Mapped[str] = mapped_column(ForeignKey("repositories.id"))
    number: Mapped[int] = mapped_column(Integer)
    github_id: Mapped[str] = mapped_column(String(64), unique=True)
    state: Mapped[str] = mapped_column(String(32))
    risk_score: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    payload: Mapped[dict | None] = mapped_column(JSON)

    analysis_jobs: Mapped[list[AnalysisJob]] = relationship(back_populates="pull_request")


class PullRequestDiff(Base):
    __tablename__ = "pull_request_diffs"

    pull_request_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("pull_requests.id"), primary_key=True
    )
    files: Mapped[list] = mapped_column(JSON)
    patch: Mapped[str | None] = mapped_column(Text)


class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    pull_request_id: Mapped[str] = mapped_column(ForeignKey("pull_requests.id"))
    status: Mapped[str] = mapped_column(String(32))
    progress: Mapped[int] = mapped_column(Integer, default=0)
    chunk_index: Mapped[int] = mapped_column(Integer, default=0)
    chunk_total: Mapped[int] = mapped_column(Integer, default=0)
    usage: Mapped[dict | None] = mapped_column(JSON)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    result_summary: Mapped[dict | None] = mapped_column(JSON)
    error_message: Mapped[str | None] = mapped_column(String(1024))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    pull_request: Mapped[PullRequest] = relationship(back_populates="analysis_jobs")
    findings: Mapped[list[AnalysisFinding]] = relationship(back_populates="job")


class AnalysisFinding(Base):
    __tablename__ = "analysis_findings"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("analysis_jobs.id"))
    type: Mapped[str] = mapped_column(String(32))
    severity: Mapped[str] = mapped_column(String(16))
    title: Mapped[str] = mapped_column(String(512))
    file: Mapped[str] = mapped_column(String(512))
    line: Mapped[int] = mapped_column(Integer)
    payload: Mapped[dict | None] = mapped_column(JSON)

    job: Mapped[AnalysisJob] = relationship(back_populates="findings")


class Setting(Base):
    __tablename__ = "settings"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default="default")
    data: Mapped[dict] = mapped_column(JSON)
    encrypted_secrets: Mapped[str | None] = mapped_column(Text)


class GovernanceRule(Base):
    __tablename__ = "governance_rules"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    rule: Mapped[str] = mapped_column(String(1024))
    severity: Mapped[str] = mapped_column(String(16))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    payload: Mapped[dict | None] = mapped_column(JSON)


class GovernanceViolation(Base):
    __tablename__ = "governance_violations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    rule_id: Mapped[str] = mapped_column(ForeignKey("governance_rules.id"))
    pull_request_id: Mapped[str | None] = mapped_column(ForeignKey("pull_requests.id"), nullable=True)
    file: Mapped[str | None] = mapped_column(String(512))
    violated: Mapped[bool] = mapped_column(Boolean, default=True)
    payload: Mapped[dict | None] = mapped_column(JSON)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    action: Mapped[str] = mapped_column(String(128))
    actor_id: Mapped[str | None] = mapped_column(String(64))
    payload: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ActivityEvent(Base):
    __tablename__ = "activity_events"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    type: Mapped[str] = mapped_column(String(64))
    actor: Mapped[str] = mapped_column(String(128))
    action: Mapped[str] = mapped_column(String(512))
    repo: Mapped[str] = mapped_column(String(256))
    pull_request_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("pull_requests.id"), nullable=True
    )
    payload: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
