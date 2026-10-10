from django.shortcuts import get_object_or_404

from .models import Application


class UserOwnedQuerysetMixin:
    """Limit every queryset to the signed-in user's rows.

    Views define owned_queryset(user). Filtering in the queryset, instead of
    loading a row and checking it, means another user's row is a plain 404,
    and the API never shows that the row exists.
    """

    def owned_queryset(self, user):
        raise NotImplementedError

    def get_queryset(self):
        return self.owned_queryset(self.request.user)


def get_owned_application(request, application_id):
    """Load the parent application of a nested route, or 404 if the caller does not own it."""
    return get_object_or_404(Application.objects.filter(user=request.user), pk=application_id)
