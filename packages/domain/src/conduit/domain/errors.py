"""
Conduit Domain — Error hierarchy.

All domain exceptions inherit from ConduitError.
Each bounded context has its own sub-hierarchy.
"""


class ConduitError(Exception):
    """Base exception for all Conduit domain errors."""

    def __init__(self, message: str, *, code: str = "CONDUIT_ERROR"):
        self.message = message
        self.code = code
        super().__init__(message)


# ── Not Found ──


class NotFoundError(ConduitError):
    """Entity not found."""

    def __init__(self, entity: str, identifier: str):
        super().__init__(
            f"{entity} not found: {identifier}",
            code="NOT_FOUND",
        )
        self.entity = entity
        self.identifier = identifier


# ── Validation ──


class ValidationError(ConduitError):
    """Input validation failed."""

    def __init__(self, message: str, *, field: str | None = None):
        super().__init__(message, code="VALIDATION_ERROR")
        self.field = field


class DuplicateError(ConduitError):
    """Entity already exists."""

    def __init__(self, entity: str, identifier: str):
        super().__init__(
            f"{entity} already exists: {identifier}",
            code="DUPLICATE",
        )


# ── Pipeline ──


class DagCycleError(ValidationError):
    """DAG contains a cycle."""

    def __init__(self):
        super().__init__("Pipeline DAG contains a cycle", field="edges")


class DagDisconnectedError(ValidationError):
    """DAG has disconnected nodes."""

    def __init__(self, orphans: list[str]):
        super().__init__(
            f"Pipeline has disconnected stages: {', '.join(orphans)}",
            field="stages",
        )


# ── Auth ──


class AuthError(ConduitError):
    """Authentication or authorization failure."""

    def __init__(self, message: str = "Authentication required"):
        super().__init__(message, code="AUTH_ERROR")


class PermissionDeniedError(ConduitError):
    """User lacks permission for this action."""

    def __init__(self, action: str):
        super().__init__(
            f"Permission denied: {action}",
            code="PERMISSION_DENIED",
        )


# ── Integration ──


class ConnectionTestError(ConduitError):
    """Integration connection test failed."""

    def __init__(self, integration: str, reason: str):
        super().__init__(
            f"Connection test failed for '{integration}': {reason}",
            code="CONNECTION_TEST_FAILED",
        )


# ── Execution ──


class RunError(ConduitError):
    """Pipeline run execution error."""

    def __init__(self, run_id: str, message: str):
        super().__init__(message, code="RUN_ERROR")
        self.run_id = run_id
