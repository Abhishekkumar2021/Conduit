from sqlalchemy import Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Declarative Base for all Conduit SQLAlchemy models."""

    type_annotation_map = {
        dict: JSONB,
        list: ARRAY(Text),
    }
