from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views

# SimpleRouter, not DefaultRouter: no browsable API root at /api/.
router = SimpleRouter(use_regex_path=False)
router.register("applications", views.ApplicationViewSet, basename="application")

urlpatterns = [
    path("auth/register/", views.RegisterView.as_view(), name="register"),
    path("auth/login/", views.LoginView.as_view(), name="login"),
    path("dashboard/", views.DashboardView.as_view(), name="dashboard"),
    path("companies/", views.CompanyListView.as_view(), name="company-list"),
    path(
        "applications/<int:application_id>/interviews/",
        views.InterviewListCreateView.as_view(),
        name="interview-list",
    ),
    path(
        "applications/<int:application_id>/interviews/<int:pk>/",
        views.InterviewDetailView.as_view(),
        name="interview-detail",
    ),
    path(
        "applications/<int:application_id>/notes/",
        views.NoteListCreateView.as_view(),
        name="note-list",
    ),
    path(
        "applications/<int:application_id>/notes/<int:pk>/",
        views.NoteDetailView.as_view(),
        name="note-detail",
    ),
    path("health/", views.HealthView.as_view(), name="health"),
    path("health/live/", views.HealthLiveView.as_view(), name="health-live"),
    *router.urls,
]
