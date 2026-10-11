import pytest

from tracker.models import Company

pytestmark = pytest.mark.django_db

NOT_FOUND = {"detail": "Not found."}
BODY = {"job_title": "Backend engineer", "company_name": "Northwind", "location": "Remote"}


@pytest.fixture
def alice(auth_client):
    return auth_client


@pytest.fixture
def bob(client_for, other_user):
    return client_for(other_user)


def test_each_user_sees_only_their_own_applications_and_companies(alice, bob):
    a = alice.post("/api/applications/", {**BODY, "company_name": "Alpha"}, format="json").json()
    b = bob.post("/api/applications/", {**BODY, "company_name": "Beta"}, format="json").json()

    assert [row["id"] for row in alice.get("/api/applications/").json()["results"]] == [a["id"]]
    assert [row["id"] for row in bob.get("/api/applications/").json()["results"]] == [b["id"]]
    assert [c["name"] for c in alice.get("/api/companies/").json()] == ["Alpha"]
    assert [c["name"] for c in bob.get("/api/companies/").json()] == ["Beta"]


def test_shared_company_name_is_two_rows(alice, bob, user, other_user):
    a = alice.post("/api/applications/", BODY, format="json").json()
    b = bob.post("/api/applications/", BODY, format="json").json()

    alice_company = Company.objects.get(user=user, name="Northwind")
    bob_company = Company.objects.get(user=other_user, name="Northwind")
    assert alice_company.id != bob_company.id
    assert a["company"]["id"] == alice_company.id
    assert b["company"]["id"] == bob_company.id


def test_another_users_application_is_the_same_404_as_a_missing_one(bob, user, make_application):
    application = make_application(user)
    missing_id = application.id + 1000

    for method in ("get", "patch", "delete"):
        response = getattr(bob, method)(f"/api/applications/{application.id}/", {}, format="json")
        assert response.status_code == 404
        assert response.json() == NOT_FOUND

    missing = bob.get(f"/api/applications/{missing_id}/")
    assert missing.status_code == 404
    assert missing.json() == NOT_FOUND


def test_another_users_interviews_and_notes_are_404(bob, user, make_application, make_interview, make_note):
    application = make_application(user)
    interview = make_interview(application)
    note = make_note(application)
    base = f"/api/applications/{application.id}"

    responses = [
        bob.get(f"{base}/interviews/"),
        bob.post(f"{base}/interviews/", {"scheduled_at": "2030-01-01T10:00:00Z", "type": "PHONE"}, format="json"),
        bob.patch(f"{base}/interviews/{interview.id}/", {"outcome": "PASSED"}, format="json"),
        bob.delete(f"{base}/interviews/{interview.id}/"),
        bob.get(f"{base}/notes/"),
        bob.post(f"{base}/notes/", {"text": "Mine now"}, format="json"),
        bob.patch(f"{base}/notes/{note.id}/", {"text": "Mine now"}, format="json"),
        bob.delete(f"{base}/notes/{note.id}/"),
    ]

    for response in responses:
        assert response.status_code == 404
        assert response.json() == NOT_FOUND


def test_child_id_under_the_callers_other_application_is_404(
    alice, user, make_application, make_interview, make_note
):
    first = make_application(user)
    second = make_application(user)
    interview = make_interview(first)
    note = make_note(first)
    base = f"/api/applications/{second.id}"

    responses = [
        alice.patch(f"{base}/interviews/{interview.id}/", {"outcome": "PASSED"}, format="json"),
        alice.delete(f"{base}/interviews/{interview.id}/"),
        alice.patch(f"{base}/notes/{note.id}/", {"text": "Moved"}, format="json"),
        alice.delete(f"{base}/notes/{note.id}/"),
    ]

    for response in responses:
        assert response.status_code == 404
        assert response.json() == NOT_FOUND
