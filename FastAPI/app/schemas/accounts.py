from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


AccountType = Literal["cash", "wallet", "bank"]


class AccountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    account_type: AccountType
    opening_balance: Decimal = Field(default=Decimal("0.00"), max_digits=12, decimal_places=2)

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class AccountResponse(BaseModel):
    id: int
    name: str
    account_type: AccountType
    opening_balance: Decimal
    balance: Decimal

    model_config = ConfigDict(from_attributes=True)
