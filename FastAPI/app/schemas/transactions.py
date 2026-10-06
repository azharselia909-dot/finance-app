from __future__ import annotations
from datetime import date as Date
from decimal import Decimal
from typing import Literal, Annotated, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator, field_validator



class TransactionCreate(BaseModel):
    description: str = Field(max_length=500)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    date: Date
    category: str = Field(min_length=1, max_length=100)
    is_income: bool

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class TransactionModel(TransactionCreate):
    id: int

    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)


class TransactionImportRow(BaseModel):
    date: Date
    description: str = Field(max_length=500)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    category: str = Field(min_length=1, max_length=100)
    id: int | None = None
    type: Literal["income", "expense"] | None = None
    is_income: bool | None = None

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @model_validator(mode="after")
    def validate_transaction_type(self):
        if self.type is None and self.is_income is None:
            raise ValueError("Provide either a type column or an is_income column")
        if self.type is not None and self.is_income is not None:
            if self.is_income != (self.type == "income"):
                raise ValueError("type and is_income values do not match")
        return self

    @property
    def is_income_value(self) -> bool:
        return self.is_income if self.is_income is not None else self.type == "income"


class TransactionListItem(BaseModel):
    id: int
    date: Date
    description: str
    category: str
    type: Literal["income", "expense"]
    amount: Decimal


class PaginatedTransactionsResponse(BaseModel):
    items: list[TransactionListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class TransactionBalanceResponse(BaseModel):
    balance: str


class TransactionImportResponse(BaseModel):
    imported: int




class BulkDeleteRequest(BaseModel):
    ids: list[Annotated[int, Field(gt=0)]] = Field(min_length=1, max_length=100)

    @field_validator("ids")
    @classmethod
    def require_unique_ids(cls, ids: list[int]) -> list[int]:
        if len(ids) != len(set(ids)):
            raise ValueError("Transaction IDs must be unique")
        return ids


class BulkDeleteResponse(BaseModel):
    deleted: int


class TransactionUpdate(BaseModel):
    date: Optional[Date] = None
    amount: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    category: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @model_validator(mode="after")
    def require_fields_to_update(self):
        if not self.model_fields_set:
            raise ValueError("Provide at least one field to update")
        if any(getattr(self, field) is None for field in self.model_fields_set):
            raise ValueError("Updated fields cannot be null")
        return self
