"""The OpenAPI schema served at /api/schema/ matches the routes and request shapes in docs/api.md."""

import re

import pytest
from django.conf import settings

pytestmark = pytest.mark.django_db

API_MD = settings.BASE_DIR.parent / "docs" / "api.md"
ROUTE_HEADING = re.compile(r"^### (GET|POST|PATCH|PUT|DELETE) (/api/\S+)$", re.MULTILINE)
PATH_PARAM = re.compile(r"\{[^}]+\}")


def normalize(path):
    # api.md says {id}. Spectacular uses the URL pattern's name, such as {application_id} or {pk}.
    return PATH_PARAM.sub("{}", path)


@pytest.fixture
def schema(api_client):
    response = api_client.get("/api/schema/", {"format": "json"})
    assert response.status_code == 200
    return response.json()


def resolve(schema, node):
    while "$ref" in node:
        name = node["$ref"].rsplit("/", 1)[-1]
        node = schema["components"]["schemas"][name]
    return node


def request_properties(schema, path, method):
    content = schema["paths"][path][method]["requestBody"]["content"]["application/json"]
    return resolve(schema, content["schema"])["properties"]


def response_properties(schema, path, method, code):
    content = schema["paths"][path][method]["responses"][code]["content"]["application/json"]
    return resolve(schema, content["schema"])["properties"]


def test_schema_and_swagger_ui_are_public(api_client):
    assert api_client.get("/api/schema/").status_code == 200
    assert api_client.get("/api/schema/swagger-ui/").status_code == 200


def test_every_route_in_api_md_is_in_the_schema(schema):
    documented = ROUTE_HEADING.findall(API_MD.read_text())
    assert documented, f"no route headings found in {API_MD}"

    served = {normalize(path): ops for path, ops in schema["paths"].items()}
    missing = [
        f"{method} {path}" for method, path in documented if method.lower() not in served.get(normalize(path), {})
    ]
    assert missing == []


def test_application_writes_take_company_name(schema):
    for path, method in [("/api/applications/", "post"), ("/api/applications/{id}/", "patch")]:
        properties = request_properties(schema, path, method)
        assert "company_name" in properties
        assert "company" not in properties


def test_application_reads_return_company(schema):
    properties = response_properties(schema, "/api/applications/{id}/", "get", "200")

    assert "company" in properties
    assert "company_name" not in properties
