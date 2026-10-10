from django.db.models import Q
from rest_framework import serializers
from rest_framework.pagination import PageNumberPagination

from .models import Status


class ApplicationListQuerySerializer(serializers.Serializer):
    """Query parameters for GET /api/applications/. A bad value is a 400 on that parameter."""

    def get_fields(self):
        # Built here because `from` is a Python keyword and cannot be a class attribute.
        return {
            "q": serializers.CharField(required=False, allow_blank=True),
            "from": serializers.DateField(required=False),
            "to": serializers.DateField(required=False),
            "status": serializers.ChoiceField(choices=Status.choices, required=False),
        }

    def validate(self, attrs):
        date_from, date_to = attrs.get("from"), attrs.get("to")
        if date_from and date_to and date_from > date_to:
            raise serializers.ValidationError({"from": ["Must be on or before `to`."]})
        return attrs


def filter_applications(queryset, params):
    """Apply validated list parameters. Date filters leave out rows with no date_applied."""
    q = params.get("q", "").strip()
    if q:
        queryset = queryset.filter(Q(job_title__icontains=q) | Q(company__name__icontains=q))
    if "from" in params:
        queryset = queryset.filter(date_applied__gte=params["from"])
    if "to" in params:
        queryset = queryset.filter(date_applied__lte=params["to"])
    if "status" in params:
        queryset = queryset.filter(status=params["status"])
    return queryset


class ApplicationPagination(PageNumberPagination):
    page_size = 10
    # Fixed size: a client cannot ask for a different one.
    page_size_query_param = None
