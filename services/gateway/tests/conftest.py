import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["PRISM_SEED_DB"] = "0"
os.environ["PRISM_STUB_ENGINE"] = "1"
os.environ["GITHUB_APP_ID"] = ""
os.environ["GITHUB_APP_PRIVATE_KEY"] = ""
os.environ["GITHUB_WEBHOOK_SECRET"] = ""
os.environ["PRISM_AUTH_BYPASS"] = "1"
os.environ["JWT_SECRET"] = "test-jwt-secret-for-pytest-only"

from app.db import session as db_session  # noqa: E402
from app.db.deps import get_db  # noqa: E402
from app.db.models import Base, Repository, User  # noqa: E402
from app.db.seed_loader import load_seed_if_empty  # noqa: E402
from app.main import app  # noqa: E402

_test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSession = sessionmaker(bind=_test_engine, autoflush=False, autocommit=False)

db_session.engine = _test_engine
db_session.SessionLocal = TestingSession


@pytest.fixture()
def client() -> TestClient:
    Base.metadata.drop_all(bind=_test_engine)
    Base.metadata.create_all(bind=_test_engine)

    db = TestingSession()
    try:
        if load_seed_if_empty(db):
            for repo in db.scalars(select(Repository)).all():
                repo.source = "test"
            for user in db.scalars(select(User)).all():
                if user.email.endswith("@acme.local"):
                    user.email = f"{user.id}@pytest.local"
            db.commit()
    finally:
        db.close()

    def override_get_db():
        session = TestingSession()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app, raise_server_exceptions=True) as test_client:
        yield test_client

    app.dependency_overrides.clear()
