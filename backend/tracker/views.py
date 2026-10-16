from django.contrib.auth import authenticate
from django.contrib.auth.models import update_last_login
from django.db import Error as DatabaseError
from django.db import connection
from django.db.models import Count, F, Prefetch
from django.db.models.functions import Lower
from django.http import Http404, JsonResponse
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import generics, status, viewsets
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView, exception_handler
from rest_framework_simplejwt.tokens import AccessToken

from .filters import ApplicationListQuerySerializer, ApplicationPagination, filter_applications
from .models import Application, Company, Interview, Note, Outcome, Status, normalize_email
from .permissions import UserOwnedQuerysetMixin, get_owned_application
from .serializers import (
    ApplicationReadSerializer,
    ApplicationWriteSerializer,
    CompanySerializer,
    DashboardSerializer,
    HealthSerializer,
    InterviewOutcomeSerializer,
    InterviewSerializer,
    LoginSerializer,
    NoteSerializer,
    RegisterSerializer,
    TokenSerializer,
    UpcomingInterviewSerializer,
)

LOGIN_FAILED = "Email or password is incorrect."


def token_response(user, status_code):
    return Response({"access": str(AccessToken.for_user(user))}, status=status_code)


def upcoming_interviews():
    """Interviews still ahead with outcome SCHEDULED, soonest first. Ties go to the lower id."""
    return Interview.objects.filter(outcome=Outcome.SCHEDULED, scheduled_at__gt=timezone.now()).order_by(
        "scheduled_at", "id"
    )


# Auth


class RegisterView(APIView):
    # No authentication classes, so a stale token on a public route is not a 401.
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "register"

    @extend_schema(request=RegisterSerializer, responses={201: TokenSerializer})
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return token_response(serializer.save(), status.HTTP_201_CREATED)


class LoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    @extend_schema(request=LoginSerializer, responses={200: TokenSerializer})
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # ModelBackend runs the password hasher even when the email is unknown,
        # so both failures take about the same time and get the same message.
        user = authenticate(
            request,
            email=normalize_email(serializer.validated_data["email"]),
            password=serializer.validated_data["password"],
        )
        if user is None:
            # Returned, not raised: DRF turns AuthenticationFailed into 403 on
            # a view with no authentication class.
            return Response({"detail": LOGIN_FAILED}, status=status.HTTP_401_UNAUTHORIZED)
        update_last_login(None, user)
        return token_response(user, status.HTTP_200_OK)


# Applications


@extend_schema_view(
    list=extend_schema(
        parameters=[
            OpenApiParameter("q", OpenApiTypes.STR, description="Case-insensitive match on job title or company name"),
            OpenApiParameter("from", OpenApiTypes.DATE, description="Keep date_applied on or after this day"),
            OpenApiParameter("to", OpenApiTypes.DATE, description="Keep date_applied on or before this day"),
            OpenApiParameter("status", OpenApiTypes.STR, enum=Status.values, description="One status"),
        ]
    ),
    create=extend_schema(request=ApplicationWriteSerializer, responses={201: ApplicationReadSerializer}),
    partial_update=extend_schema(request=ApplicationWriteSerializer, responses=ApplicationReadSerializer),
)
class ApplicationViewSet(UserOwnedQuerysetMixin, viewsets.ModelViewSet):
    serializer_class = ApplicationReadSerializer
    pagination_class = ApplicationPagination
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    lookup_value_converter = "int"

    def owned_queryset(self, user):
        return (
            Application.objects.filter(user=user)
            .select_related("company")
            .prefetch_related(Prefetch("interviews", queryset=upcoming_interviews()[:1], to_attr="upcoming"))
            .order_by(F("date_applied").desc(nulls_last=True), "-id")
        )

    def read_response(self, application, status_code=status.HTTP_200_OK):
        # Reload through the queryset so the response has company and next_interview.
        application = self.get_queryset().get(pk=application.pk)
        return Response(ApplicationReadSerializer(application).data, status=status_code)

    def list(self, request, *args, **kwargs):
        params = ApplicationListQuerySerializer(data=request.query_params)
        params.is_valid(raise_exception=True)
        page = self.paginate_queryset(filter_applications(self.get_queryset(), params.validated_data))
        return self.get_paginated_response(ApplicationReadSerializer(page, many=True).data)

    def create(self, request, *args, **kwargs):
        serializer = ApplicationWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        application = serializer.save(user=request.user)
        return self.read_response(application, status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        serializer = ApplicationWriteSerializer(self.get_object(), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return self.read_response(serializer.save())


# Interviews and notes


class ApplicationChildMixin:
    """Nested routes load the parent application first, scoped to the caller.

    Children are then filtered to that application, so another user's
    application, or a child id under the wrong application, is a 404.
    """

    model = None
    ordering = ()

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        self.application = get_owned_application(request, kwargs["application_id"])

    def get_queryset(self):
        return self.model.objects.filter(application=self.application).order_by(*self.ordering)

    def perform_create(self, serializer):
        serializer.save(application=self.application)


class InterviewListCreateView(ApplicationChildMixin, generics.ListCreateAPIView):
    model = Interview
    ordering = ("scheduled_at", "id")
    serializer_class = InterviewSerializer
    pagination_class = None


class InterviewDetailView(ApplicationChildMixin, generics.GenericAPIView):
    model = Interview
    serializer_class = InterviewSerializer
    # No PUT and no GET: only outcome changes, through PATCH.
    http_method_names = ["patch", "delete"]

    @extend_schema(request=InterviewOutcomeSerializer, responses=InterviewSerializer)
    def patch(self, request, *args, **kwargs):
        interview = self.get_object()
        serializer = InterviewOutcomeSerializer(interview, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(InterviewSerializer(interview).data)

    def delete(self, request, *args, **kwargs):
        self.get_object().delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class NoteListCreateView(ApplicationChildMixin, generics.ListCreateAPIView):
    model = Note
    ordering = ("-created_at", "-id")
    serializer_class = NoteSerializer
    pagination_class = None


class NoteDetailView(ApplicationChildMixin, generics.GenericAPIView):
    model = Note
    serializer_class = NoteSerializer
    http_method_names = ["patch", "delete"]

    def patch(self, request, *args, **kwargs):
        serializer = NoteSerializer(self.get_object(), data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, *args, **kwargs):
        self.get_object().delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# Companies


class CompanyListView(UserOwnedQuerysetMixin, generics.ListAPIView):
    serializer_class = CompanySerializer
    pagination_class = None

    def owned_queryset(self, user):
        return Company.objects.filter(user=user).order_by(Lower("name"), "id")


# Dashboard


class DashboardView(APIView):
    @extend_schema(responses=DashboardSerializer)
    def get(self, request):
        # One grouped query. Statuses with no rows are missing from it, so fill them with 0.
        rows = Application.objects.filter(user=request.user).values("status").annotate(n=Count("id")).order_by()
        found = {row["status"]: row["n"] for row in rows}
        counts = {s.value: found.get(s.value, 0) for s in Status}

        upcoming = (
            upcoming_interviews().filter(application__user=request.user).select_related("application__company")[:10]
        )
        return Response(
            {"counts": counts, "upcoming_interviews": UpcomingInterviewSerializer(upcoming, many=True).data}
        )


# Health


class HealthLiveView(APIView):
    """Load balancer check. Never touches the database, so an RDS outage does not restart tasks."""

    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(responses=HealthSerializer)
    def get(self, request):
        return Response({"status": "ok"})


class HealthView(APIView):
    """Monitoring check. 503 when PostgreSQL cannot be queried."""

    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(responses={200: HealthSerializer, 503: HealthSerializer})
    def get(self, request):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
        except DatabaseError:
            return Response({"status": "error"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({"status": "ok"})


def api_exception_handler(exc, context):
    """Every 404 has one body: a missing record, another user's record, and a page past the end.

    DRF otherwise uses "No Application matches the given query." for a missing
    row and "Invalid page." for a page past the end.
    """
    if isinstance(exc, (Http404, NotFound)):
        exc = NotFound()
    return exception_handler(exc, context)


def not_found(request, exception):
    """Unknown routes return the same JSON 404 body as a missing record."""
    return JsonResponse({"detail": "Not found."}, status=404)
