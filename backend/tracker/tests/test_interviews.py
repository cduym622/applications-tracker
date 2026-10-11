from datetime import timedelta

import pytest
from django.utils import timezone

from tracker.models import Interview, Outcome

pytestmark = pytest.mark.django_db


def interviews_url(application):
    return f"/api/applications/{application.id}/interviews/"


def interview_url(interview):
    return f"/api/applications/{interview.application_id}/interviews/{interview.id}/"


def test_add_and_delete_an_interview(auth_client, application):
    scheduled_at = (timezone.now() + timedelta(days=2)).isoformat()

    added = auth_client.post(
        interviews_url(application), {"scheduled_at": scheduled_at, "type": "PHONE"}, format="json"
    )
    assert added.status_code == 201
    interview_id = added.json()["id"]
    assert added.json()["type"] == "PHONE"

    deleted = auth_client.delete(f"{interviews_url(application)}{interview_id}/")
    assert deleted.status_code == 204
    assert not Interview.objects.filter(pk=interview_id).exists()


def test_outcome_defaults_to_scheduled(auth_client, application):
    response = auth_client.post(
        interviews_url(application),
        {"scheduled_at": (timezone.now() + timedelta(days=1)).isoformat(), "type": "VIDEO"},
        format="json",
    )

    assert response.status_code == 201
    assert response.json()["outcome"] == "SCHEDULED"


def test_patch_outcome(auth_client, application, make_interview):
    interview = make_interview(application)

    response = auth_client.patch(interview_url(interview), {"outcome": "PASSED"}, format="json")

    assert response.status_code == 200
    assert response.json()["outcome"] == "PASSED"
    interview.refresh_from_db()
    assert interview.outcome == Outcome.PASSED


@pytest.mark.parametrize(
    "body, field",
    [
        ({"type": "ONSITE"}, "type"),
        ({"scheduled_at": "2030-01-01T10:00:00Z"}, "scheduled_at"),
        ({"round_name": "Final"}, "round_name"),
        ({"outcome": "PASSED", "interviewer_name": "Sam"}, "interviewer_name"),
    ],
)
def test_patch_of_another_field_is_400_and_changes_nothing(auth_client, application, make_interview, body, field):
    interview = make_interview(application)

    response = auth_client.patch(interview_url(interview), body, format="json")

    assert response.status_code == 400
    assert field in response.json()
    interview.refresh_from_db()
    assert interview.outcome == Outcome.SCHEDULED


def test_put_is_405(auth_client, application, make_interview):
    interview = make_interview(application)

    response = auth_client.put(interview_url(interview), {"outcome": "PASSED"}, format="json")

    assert response.status_code == 405
