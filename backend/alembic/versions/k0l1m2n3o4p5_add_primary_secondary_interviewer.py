"""add primary_interviewer and secondary_interviewer to positions

Revision ID: k0l1m2n3o4p5
Revises: j9k0l1m2n3o4
Create Date: 2026-04-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "k0l1m2n3o4p5"
down_revision: Union[str, None] = "j9k0l1m2n3o4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('positions', sa.Column('primary_interviewer', sa.String(), nullable=True, server_default='杜雁玲'))
    op.add_column('positions', sa.Column('secondary_interviewer', sa.String(), nullable=True, server_default='何雨菱'))


def downgrade() -> None:
    op.drop_column('positions', 'secondary_interviewer')
    op.drop_column('positions', 'primary_interviewer')
