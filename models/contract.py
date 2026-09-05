from datetime import date, datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from models.db import Base

class Contract(Base):
    __tablename__ = "contracts"
    __table_args__ = (
        CheckConstraint("expiration_date >= commencement_date", name="ck_contracts_dates_ordered"),
        CheckConstraint("monthly_rent >= 0", name="ck_contracts_rent_non_negative"),
        CheckConstraint("termination_notice_days >= 0", name="ck_contracts_notice_non_negative"),
        Index("ix_contracts_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    lessor: Mapped[str] = mapped_column(String(255), nullable=False)
    lessee: Mapped[str] = mapped_column(String(255), nullable=False)
    commencement_date: Mapped[date] = mapped_column(Date, nullable=False)
    expiration_date: Mapped[date] = mapped_column(Date, nullable=False)
    monthly_rent: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    termination_notice_days: Mapped[int] = mapped_column(Integer, nullable=False)

    raw_text: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=lambda: datetime.now(timezone.utc),
    )
