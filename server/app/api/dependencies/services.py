"""
Conduit Server — FastAPI dependency injection for services.

Session is injected into repositories, repositories into services.
Endpoints never see AsyncSession directly.
"""

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.database.repositories.asset import AssetRepository
from app.infra.database.repositories.audit_log import AuditLogRepository
from app.infra.database.repositories.integration import IntegrationRepository
from app.infra.database.repositories.member import MemberRepository
from app.infra.database.repositories.quarantine import QuarantineRepository
from app.infra.database.repositories.run import RunRepository, StepRepository
from app.infra.database.repositories.runner import RunnerRepository
from app.infra.database.repositories.pipeline import (
    EdgeRepository,
    PipelineRepository,
    RevisionRepository,
    StageRepository,
)
from app.infra.database.repositories.user import UserRepository
from app.infra.database.repositories.workspace import WorkspaceRepository
from app.infra.database.session import get_db_session
from app.services.audit import AuditService
from app.services.auth import AuthService
from app.services.integration import IntegrationService
from app.services.lineage import LineageService
from app.services.metrics import MetricsService
from app.services.pipeline import PipelineService
from app.services.quarantine import QuarantineService
from app.services.run import RunService
from app.services.scheduler import SchedulerService
from app.services.user import UserService
from app.services.vault import VaultService
from app.services.workspace import WorkspaceService


def get_vault_service() -> VaultService:
    return VaultService()


def get_user_service(
    session: AsyncSession = Depends(get_db_session),
) -> UserService:
    return UserService(user_repo=UserRepository(session))


def get_auth_service(
    session: AsyncSession = Depends(get_db_session),
) -> AuthService:
    return AuthService(user_repo=UserRepository(session))


def get_workspace_service(
    session: AsyncSession = Depends(get_db_session),
) -> WorkspaceService:
    return WorkspaceService(
        workspace_repo=WorkspaceRepository(session),
        member_repo=MemberRepository(session),
    )


def get_pipeline_service(
    session: AsyncSession = Depends(get_db_session),
) -> PipelineService:
    return PipelineService(
        pipeline_repo=PipelineRepository(session),
        revision_repo=RevisionRepository(session),
        stage_repo=StageRepository(session),
        edge_repo=EdgeRepository(session),
    )


def get_integration_service(
    session: AsyncSession = Depends(get_db_session),
    vault_service: VaultService = Depends(get_vault_service),
) -> IntegrationService:
    return IntegrationService(
        integration_repo=IntegrationRepository(session),
        asset_repo=AssetRepository(session),
        vault_service=vault_service,
    )


def get_run_service(
    session: AsyncSession = Depends(get_db_session),
    vault_service: VaultService = Depends(get_vault_service),
) -> RunService:
    return RunService(
        run_repo=RunRepository(session),
        step_repo=StepRepository(session),
        vault_service=vault_service,
    )


def get_audit_service(
    session: AsyncSession = Depends(get_db_session),
) -> AuditService:
    return AuditService(audit_repo=AuditLogRepository(session))


def get_quarantine_service(
    session: AsyncSession = Depends(get_db_session),
) -> QuarantineService:
    return QuarantineService(quarantine_repo=QuarantineRepository(session))


def get_metrics_service(
    session: AsyncSession = Depends(get_db_session),
) -> MetricsService:
    return MetricsService(session=session)


def get_scheduler_service(
    session: AsyncSession = Depends(get_db_session),
) -> SchedulerService:
    return SchedulerService(session=session)


def get_lineage_service(
    session: AsyncSession = Depends(get_db_session),
) -> LineageService:
    return LineageService(session=session)
