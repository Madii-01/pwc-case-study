from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.schema import ContractResponse, ExtractRequest
from models import get_db
from services import contract_service
from services.llm_client import LLMResponseError, LLMUnavailableError

router = APIRouter(prefix="/api/v1", tags=["extraction"])


@router.post("/extract", response_model=ContractResponse, status_code=status.HTTP_201_CREATED)
def extract_contract(payload: ExtractRequest, db: Session = Depends(get_db)) -> ContractResponse:
    try:
        contract = contract_service.extract_and_store(db, payload.raw_text)
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "INVALID_CONTRACT",
                "message": "The extracted contract failed validation.",
                "errors": [
                    {"field": ".".join(str(part) for part in error["loc"]), "message": error["msg"]}
                    for error in exc.errors()
                ],
            },
        ) from exc
    except LLMResponseError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "LLM_INVALID_RESPONSE", "message": str(exc)},
        ) from exc
    except LLMUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "LLM_UNAVAILABLE",
                "message": "The extraction provider is unavailable. Please retry shortly.",
            },
        ) from exc

    return ContractResponse.model_validate(contract)
