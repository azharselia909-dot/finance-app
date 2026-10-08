from decimal import Decimal, InvalidOperation

from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text
from sqlalchemy.types import TypeDecorator

from app.db.session import Base


class DecimalText(TypeDecorator[Decimal]):
    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        try:
            decimal_value = value if isinstance(value, Decimal) else Decimal(str(value))
        except (InvalidOperation, ValueError) as exc:
            raise ValueError("Transaction amount must be a decimal value") from exc
        return format(decimal_value, "f")

    def process_result_value(self, value, dialect):
        return Decimal(str(value)) if value is not None else None


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True, index=True)
    description = Column(String, index=True)
    amount = Column(DecimalText(), nullable=False)
    date = Column(String)
    category = Column(String)
    is_income = Column(Boolean, default=False)
