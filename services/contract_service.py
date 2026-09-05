from sqlalchemy.orm import Session

from app.schema import ValidatedContract
from models import Contract
from repos import contract_repo
from services.llm_client import extract_lease_fields


def extract_and_store(db: Session, raw_text: str) -> Contract:
    extraction = extract_lease_fields(raw_text)
    contract = ValidatedContract.model_validate(extraction.model_dump())
    return contract_repo.create(db, contract, raw_text)


def list_contracts(db: Session, limit: int, offset: int) -> list[Contract]:
    return contract_repo.list_all(db, limit=limit, offset=offset)


def count_contracts(db: Session) -> int:
    return contract_repo.count(db)


def get_contract(db: Session, contract_id: int) -> Contract | None:
    return contract_repo.get_by_id(db, contract_id)
