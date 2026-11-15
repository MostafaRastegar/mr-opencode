---
name: djankit-backend
description: >
  Django + DRF backend rules for the Djankit stack. Version constraints, app structure,
  model/viewset/serializer conventions, URL routing, Celery tasks, error handling,
  pytest testing, settings, migrations, and import ordering. Use when writing or editing
  any backend Python code (models, views, serializers, tasks, urls, settings, migrations).
---

# Djankit Backend Rules (Django + DRF)

## When to Use
When writing or editing backend Python code: models, views/ViewSets, serializers, services, Celery tasks, URLs, settings, or migrations. Keeps every app consistent with the canonical project structure and conventions.

## Rules

### Django & DRF Version Constraints
- Django 5.1, djangorestframework 3.15, djangorestframework-simplejwt 5.4.
- Python 3.12+. Use `from __future__ import annotations` for deferred annotation evaluation.

### App Structure
- Each app in `backend/{app_name}/` with standard Django layout: `models.py`, `views.py`, `serializers.py`, `urls.py`, `tests.py`.
- Business logic goes in `services.py` (if <100 lines, inline in views; else extract).
- Background tasks go in `tasks.py` (Celery shared_task).
- Management commands in `management/commands/`.
- Migrations in `migrations/`.

### Models
- Every model MUST have `created_at` and `updated_at` DateTimeFields (auto_now_add / auto_now).
- Use `verbose_name` with `gettext_lazy as _` on every field.
- `class Meta`: define `verbose_name`, `verbose_name_plural`, `ordering`.
- Implement `__str__` returning a concise human-readable representation.
- Override `save()` to call `self.full_clean()` before `super().save()`.
- Use `models.JSONField` for dynamic/config data (default=`dict` or `list`).
- `ForeignKey` to User: use `get_user_model()`, not direct import.
- `related_name` on all ForeignKey/M2M fields — never leave default.

### Views / ViewSets
- ALL ViewSets use `ModelActionPermission` from `core.permissions`.
- `get_queryset()`: always chain `.select_related()` and `.prefetch_related()`.
- Override `perform_create()` to set `created_by=self.request.user`.
- Filtering: use `self.request.query_params.get()` in `get_queryset()`.
- Custom actions: use `@action(detail=True/false, methods=["get"/"post"])`.
- NEVER use DRF `Response()` directly — use `core.response` helpers (`success_response`, `created_response`, `deleted_response`). Exception: `base_exception.py`.
- Custom actions must define `model_permission_mapping` on the ViewSet.

### Serializers
- Extend `TimestampedModelSerializer` from `core.serializers` when model has timestamps.
- `read_only_fields` in Meta: always include `id`, `created_at`, `updated_at`, `created_by`.
- Read-only display fields: use `SerializerMethodField` or `CharField(source=...)`.
- M2M write: `PrimaryKeyRelatedField(many=True)` in input; handle via `create()`/`update()` override popping recipients and calling `.set()`.
- Validation: override `validate_<field>()` methods; raise `serializers.ValidationError`.

### URL Routing
- `app_name = 'app_name'` in `urls.py`.
- `DefaultRouter` for top-level resources, `NestedSimpleRouter` for nested.
- All endpoints under `/api/{lang}/app_name/` with trailing slash.

### Celery Tasks
- Tasks in `tasks.py` decorated with `@shared_task`.
- Use `bind=True` for self-access (retry, logger).
- Task routing via CELERY_TASK_ROUTES in settings.

### Error Handling
- Business exceptions → `DmvnException("message", status_code=N, code="slug")`.
- Never raise DRF exceptions directly (`ValidationError`, `ParseError`, `PermissionDenied`).
- Available `code` values: `invalid_input`, `missing_field`, `invalid_format`, `invalid_value`, `already_exists`, `permission_denied`, `dependency_exists`, `sync_failed`.

### Testing
- Tests in `tests.py` using pytest (not unittest).
- Use `pytest.mark.django_db` on all DB tests.
- Factories: use `factory_boy` (define in `conftest.py` or `factories.py`).
- API tests: use `rest_framework.test.APIClient`.
- Celery tasks: use `CELERY_TASK_ALWAYS_EAGER=True` in test settings.

### Settings
- Base settings in `config/settings/base.py`.
- Environment-specific overrides: `development.py`, `production.py`, `test.py`.
- Never commit secrets to settings — use environment variables or `.env`.

### Migrations
- Always run `makemigrations` and `migrate` after model changes.
- Never edit existing migrations unless absolutely necessary — create new ones.
- Squash migrations when count exceeds 20 per app.

### Imports
- Group: 1) stdlib, 2) Django/DRF, 3) third-party, 4) local (`core.*`, `.models`).
- Absolute imports for cross-app (`from alerts.models import DataAlert`).
- Relative imports for same-app (`from .models import DataAlert`).

## Verification
- Every model has `created_at`/`updated_at`, `__str__`, Meta with ordering/verbose_name, `full_clean()` in save, and `related_name` on FKs/M2M.
- ViewSets use `ModelActionPermission`, chained select/prefetch, and `core.response` helpers.
- Serializers extend `TimestampedModelSerializer` with the standard `read_only_fields`.
- Tasks are `@shared_task` with `bind=True` where needed.
- Imports follow the 4-group order rule.