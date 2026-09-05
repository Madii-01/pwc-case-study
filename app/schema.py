from datetime import date, datetime
from decimal import Decimal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    computed_field,
    field_serializer,
    field_validator,
    model_validator,
)


class ExtractRequest(BaseModel):
    raw_text: str = Field(min_length=1, max_length=50_000)


class LeaseExtraction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    lessor: str = Field(description="Full legal name of the landlord / lessor.")
    lessee: str = Field(description="Full legal name of the tenant / lessee.")
    commencement_date: str = Field(description="Lease start date as YYYY-MM-DD.")
    expiration_date: str = Field(description="Lease end date as YYYY-MM-DD.")
    monthly_rent: float = Field(
        description="Monthly rent amount as a number, without currency symbols."
    )
    currency: str = Field(description="Three-letter ISO 4217 currency code, e.g. USD or AED.")
    termination_notice_days: int = Field(
        description="Early termination notice period, as a whole number of days."
    )


class ValidatedContract(BaseModel):
    lessor: str = Field(min_length=1, max_length=255)
    lessee: str = Field(min_length=1, max_length=255)
    commencement_date: date
    expiration_date: date
    monthly_rent: Decimal = Field(max_digits=14, decimal_places=2)
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    termination_notice_days: int = Field(ge=0)

    @field_validator("lessor", "lessee", mode="before")
    @classmethod
    def strip_whitespace(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value

    @field_validator("currency", mode="before")
    @classmethod
    def normalise_currency(cls, value: str) -> str:
        return value.strip().upper() if isinstance(value, str) else value

    @field_validator("monthly_rent")
    @classmethod
    def rent_must_not_be_negative(cls, value: Decimal) -> Decimal:
        if value < 0:
            raise ValueError("Monthly rent must not be negative.")
        return value

    @model_validator(mode="after")
    def expiration_must_not_precede_commencement(self) -> "ValidatedContract":
        if self.expiration_date < self.commencement_date:
            raise ValueError(
                "Expiration date must not be earlier than commencement date "
                f"(got {self.expiration_date.isoformat()} before "
                f"{self.commencement_date.isoformat()})."
            )
        return self


class ContractResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    lessor: str
    lessee: str
    commencement_date: date
    expiration_date: date
    monthly_rent: Decimal
    currency: str
    termination_notice_days: int
    created_at: datetime

    @computed_field
    @property
    def contract_duration_days(self) -> int:
        return (self.expiration_date - self.commencement_date).days

    @field_serializer("monthly_rent")
    def serialize_monthly_rent(self, value: Decimal) -> float:
        return float(value)
