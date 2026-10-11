from unittest import mock

import pytest
from django.db import DatabaseError

from tracker.models import Application, Company, Interview, Note

pytestmark = pytest.mark.django_db

LIST = "/api/applications/"

BODY = {"job_title": "Backend engineer", "company_name": "Northwind", "location": "Remote"}


def detail(application_id):
    return f"{LIST}{application_id}/"


def test_create_read_update_delete(auth_client):
    created = auth_client.post(LIST, {**BODY, "status": "APPLIED", "date_applied": "2026-10-01"}, format="json")
    assert created.status_code == 201
    body = created.json()
    assert body["job_title"] == "Backend engineer"
    assert body["company"]["name"] == "Northwind"
    assert body["status"] == "APPLIED"
    assert body["date_applied"] == "2026-10-01"
    assert "company_name" not in body

    read = auth_client.get(detail(body["id"]))
    assert read.status_code == 200
    assert read.json() == body

    updated = auth_client.patch(detail(body["id"]), {"status": "SCREENING"}, format="json")
    assert updated.status_code == 200
    assert updated.json()["status"] == "SCREENING"
    assert updated.json()["job_title"] == "Backend engineer"

    deleted = auth_client.delete(detail(body["id"]))
    assert deleted.status_code == 204
    assert deleted.content == b""
    assert not Application.objects.filter(pk=body["id"]).exists()


def test_status_defaults_to_saved(auth_client):
    response = auth_client.post(LIST, BODY, format="json")

    assert response.status_code == 201
    assert response.json()["status"] == "SAVED"


@pytest.mark.parametrize(
    "overrides, field",
    [
        ({"job_title": "   "}, "job_title"),
        ({"location": ""}, "location"),
        ({"company_name": "   "}, "company_name"),
        ({"job_posting_url": "not a url"}, "job_posting_url"),
        ({"status": "HIRED"}, "status"),
    ],
)
def test_invalid_field_is_400_on_that_field(auth_client, overrides, field):
    response = auth_client.post(LIST, {**BODY, **overrides}, format="json")

    assert response.status_code == 400
    assert list(response.json()) == [field]
    assert not Application.objects.exists()


def test_new_company_name_creates_one_company(auth_client, user):
    auth_client.post(LIST, {**BODY, "company_name": "  Stripe  "}, format="json")

    assert list(Company.objects.filter(user=user).values_list("name", flat=True)) == ["Stripe"]


def test_company_name_in_another_case_reuses_the_stored_company(auth_client, user):
    first = auth_client.post(LIST, {**BODY, "company_name": "Stripe"}, format="json").json()

    second = auth_client.post(LIST, {**BODY, "company_name": "stripe"}, format="json").json()

    assert second["company"] == first["company"]
    assert second["company"]["name"] == "Stripe"
    assert Company.objects.filter(user=user).count() == 1


def test_failed_save_leaves_no_new_company(auth_client, user):
    with mock.patch.object(Application, "save", side_effect=DatabaseError("save failed")):
        # The test client re-raises an unhandled view exception instead of returning 500.
        with pytest.raises(DatabaseError):
            auth_client.post(LIST, {**BODY, "company_name": "Brand New Co"}, format="json")

    assert not Company.objects.filter(user=user, name__iexact="Brand New Co").exists()
    assert not Application.objects.exists()


def test_delete_removes_interviews_and_notes_and_keeps_company(
    auth_client, application, make_interview, make_note
):
    make_interview(application)
    make_note(application)
    company_id = application.company_id

    response = auth_client.delete(detail(application.id))

    assert response.status_code == 204
    assert not Interview.objects.filter(application_id=application.id).exists()
    assert not Note.objects.filter(application_id=application.id).exists()
    assert Company.objects.filter(pk=company_id).exists()
