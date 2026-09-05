from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.schema import ContractResponse
from models import get_db
from services import contract_service

router = APIRouter(prefix="/api/v1/contracts", tags=["contracts"])


@router.get("", response_model=list[ContractResponse])
def list_contracts(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[ContractResponse]:
    contracts = contract_service.list_contracts(db, limit=limit, offset=offset)
    return [ContractResponse.model_validate(contract) for contract in contracts]


@router.get("/{contract_id}", response_model=ContractResponse)
def get_contract(contract_id: int, db: Session = Depends(get_db)) -> ContractResponse:
    contract = contract_service.get_contract(db, contract_id)
    if contract is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "CONTRACT_NOT_FOUND",
                "message": f"No contract exists with id {contract_id}.",
            },
        )
    return ContractResponse.model_validate(contract)
