import pytest
from django.utils.dateparse import parse_datetime

from tracker.models import Note

pytestmark = pytest.mark.django_db


def notes_url(application):
    return f"/api/applications/{application.id}/notes/"


def note_url(note):
    return f"/api/applications/{note.application_id}/notes/{note.id}/"


def test_create_update_delete_a_note(auth_client, application):
    created = auth_client.post(notes_url(application), {"text": "Recruiter call"}, format="json")
    assert created.status_code == 201
    note = Note.objects.get(pk=created.json()["id"])
    assert note.text == "Recruiter call"

    updated = auth_client.patch(note_url(note), {"text": "Recruiter call, moving on"}, format="json")
    assert updated.status_code == 200
    assert updated.json()["text"] == "Recruiter call, moving on"

    deleted = auth_client.delete(note_url(note))
    assert deleted.status_code == 204
    assert not Note.objects.filter(pk=note.id).exists()


def test_update_keeps_created_at_and_moves_updated_at(auth_client, application, make_note):
    note = make_note(application, text="Before")
    created_at, updated_at = note.created_at, note.updated_at

    response = auth_client.patch(note_url(note), {"text": "After"}, format="json")

    note.refresh_from_db()
    assert note.created_at == created_at
    assert note.updated_at > updated_at
    assert parse_datetime(response.json()["created_at"]) == created_at


def test_patch_with_the_stored_text_keeps_updated_at(auth_client, application, make_note):
    note = make_note(application, text="Same")
    updated_at = note.updated_at

    response = auth_client.patch(note_url(note), {"text": "Same"}, format="json")

    assert response.status_code == 200
    note.refresh_from_db()
    assert note.updated_at == updated_at
