"""/users: listing and changing accounts is admin-only (review finding KI-01).

Regression: both routes only required a signed-in user, so any creator could list
every account's email and role, and change another account's email and status.
"""

import types

import pytest
from fastapi.testclient import TestClient

from app import core
from app.main import app
from app.users import router as users_router

client = TestClient(app)
AUTH = {"Authorization": "Bearer creator-token"}


class FakeResp:
    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code
        self.ok = 200 <= status_code < 300
        self.text = str(payload)

    def json(self):
        return self._payload


@pytest.fixture
def supabase(monkeypatch):
    """Records calls to Supabase from the users router and the admin role check."""
    monkeypatch.setattr(core, "SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setattr(core, "SUPABASE_ANON_KEY", "anon-key")
    monkeypatch.setattr(core, "SUPABASE_SERVICE_ROLE_KEY", "service-key")
    calls = {"admin_api": [], "role": "creator"}

    def get(url, **kwargs):
        if url.endswith("/rest/v1/profiles"):
            return FakeResp([{"role": calls["role"]}])
        calls["admin_api"].append(("GET", url))
        return FakeResp({"users": [{"id": "u-1", "email": "mia@example.com", "app_metadata": {"role": "creator"}}]})

    def put(url, **kwargs):
        calls["admin_api"].append(("PUT", url))
        return FakeResp({"id": "u-1"})

    fake = types.SimpleNamespace(get=get, put=put, RequestException=Exception)
    monkeypatch.setattr(core, "requests", fake)
    monkeypatch.setattr(users_router, "requests", fake)
    # A real signed-in creator: only the token check is stubbed.
    monkeypatch.setattr(core, "validate_user", lambda authorization: {"id": "u-creator"})
    yield calls


def test_listing_users_requires_sign_in(monkeypatch):
    monkeypatch.setattr(core, "SUPABASE_ANON_KEY", "anon-key")
    assert client.get("/users").status_code == 401


def test_a_non_admin_cannot_list_users(supabase):
    resp = client.get("/users", headers=AUTH)
    assert resp.status_code == 403
    assert supabase["admin_api"] == [], "no account data may be fetched for a non-admin"


def test_a_non_admin_cannot_change_another_account(supabase):
    resp = client.patch("/users/u-1", json={"email": "attacker@example.com", "status": "active"}, headers=AUTH)
    assert resp.status_code == 403
    assert supabase["admin_api"] == [], "no account may be changed for a non-admin"


def test_an_admin_can_list_and_update_users(supabase):
    supabase["role"] = "admin"
    listed = client.get("/users", headers=AUTH)
    assert listed.status_code == 200
    assert listed.json()["users"][0]["email"] == "mia@example.com"
    updated = client.patch("/users/u-1", json={"status": "suspended"}, headers=AUTH)
    assert updated.status_code == 200
    assert [method for method, _ in supabase["admin_api"]] == ["GET", "PUT"]
