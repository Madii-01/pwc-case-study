from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.schema import ValidatedContract
from models import Contract


def create(db: Session, contract: ValidatedContract, raw_text: str) -> Contract:
    record = Contract(**contract.model_dump(), raw_text=raw_text)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def list_all(db: Session, limit: int, offset: int) -> list[Contract]:
    statement = (
        select(Contract).order_by(Contract.created_at.desc(), Contract.id.desc()).limit(limit).offset(offset)
    )
    return list(db.scalars(statement))


def count(db: Session) -> int:
    return db.scalar(select(func.count()).select_from(Contract)) or 0


def get_by_id(db: Session, contract_id: int) -> Contract | None:
    return db.get(Contract, contract_id)
