"""Expand asset_type check constraint for storage adapters

Revision ID: a1b2c3d4e5f6
Revises: 0934c3ad49ae
Create Date: 2026-03-28 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "0934c3ad49ae"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("ck_asset_type", "assets", type_="check")
    op.create_check_constraint(
        "ck_asset_type",
        "assets",
        "asset_type IN ('table', 'view', 'file', 'collection', 'endpoint', 'object', 'index', 'key')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_asset_type", "assets", type_="check")
    op.create_check_constraint(
        "ck_asset_type",
        "assets",
        "asset_type IN ('table', 'view', 'file', 'collection', 'endpoint')",
    )
