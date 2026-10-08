import csv
import io
from collections.abc import Iterator
from datetime import date
from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import Numeric, cast
from sqlalchemy.exc import SQLAlchemyError

from app.api.dependencies import DbSession, get_current_user
from app.db.session import SessionLocal
from app.models import Account, Transaction, User
from app.schemas import (
    PaginatedTransactionsResponse,
    TransactionBalanceResponse,
    TransactionCreate,
    TransactionImportResponse,
    TransactionListItem,
    TransactionModel,
    BulkDeleteRequest, BulkDeleteResponse, TransactionUpdate
)
from app.services.rate_limits import enforce_user_rate_limit
from app.services.transactions import import_transactions_csv

import logging

logger = logging.getLogger(__name__)

legacy_router = APIRouter(tags=["legacy-transactions"])
router = APIRouter(prefix="/api/v1/transactions", tags=["transactions"])

SortField = Literal["date", "description", "category", "account", "type", "amount"]
SortOrder = Literal["asc", "desc"]


def get_or_create_cash_account(db, user_id: int) -> Account:
    account = (
        db.query(Account)
        .filter(Account.user_id == user_id, Account.name == "Cash")
        .first()
    )
    if account is None:
        account = Account(
            user_id=user_id,
            name="Cash",
            account_type="cash",
            opening_balance=Decimal("0.00"),
        )
        db.add(account)
        db.flush()
    return account


@legacy_router.post("/transactions/", response_model=TransactionModel, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    transaction: TransactionCreate,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> TransactionModel:
    transaction_data = transaction.model_dump()
    transaction_data["date"] = transaction.date.isoformat()
    account = (
        db.query(Account)
        .filter(
            Account.id == transaction.account_id,
            Account.user_id == current_user.id,
        )
        .first()
    )
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    db_transaction = Transaction(**transaction_data, user_id=current_user.id)
    db.add(db_transaction)
    try:
        db.commit()
        db.refresh(db_transaction)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Transaction creation failed")
        raise HTTPException(status_code=500, detail="Transaction could not be created") from exc
    return db_transaction


@legacy_router.get("/transactions/", response_model=list[TransactionModel])
async def read_transaction(
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=10, ge=1, le=100),
) -> list[TransactionModel]:
    return (
        db.query(Transaction)
        .filter(Transaction.user_id == current_user.id)
        .order_by(Transaction.date, Transaction.id)
        .offset(skip)
        .limit(limit)
        .all()
    )


def parse_export_date(value: str | None, field_name: str) -> date | None:
    if value is None or not value.strip():
        return None
    try:
        parsed_date = date.fromisoformat(value)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"{field_name} must use YYYY-MM-DD format") from None
    if parsed_date.isoformat() != value:
        raise HTTPException(status_code=422, detail=f"{field_name} must use YYYY-MM-DD format")
    return parsed_date


def safe_csv_text(value: str | None) -> str:
    text_value = value or ""
    if text_value.lstrip(" \t\r\n")[:1] in {"=", "+", "-", "@"}:
        return "'" + text_value
    return text_value


@router.get("/balance", response_model=TransactionBalanceResponse)
async def get_transaction_balance(
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> TransactionBalanceResponse:
    balance = sum(
        (
            account.opening_balance
            for account in db.query(Account.opening_balance)
            .filter(Account.user_id == current_user.id)
        ),
        Decimal("0.00"),
    )
    transactions = (
        db.query(Transaction.amount, Transaction.is_income)
        .filter(Transaction.user_id == current_user.id)
        .yield_per(1000)
    )
    for amount, is_income in transactions:
        balance += amount if is_income else -amount

    return TransactionBalanceResponse(balance=f"{balance:.2f}")


@router.get("/export")
async def export_transactions(
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
    start_date: str | None = Query(default=None, max_length=10),
    end_date: str | None = Query(default=None, max_length=10),
) -> StreamingResponse:
    parsed_start_date = parse_export_date(start_date, "start_date")
    parsed_end_date = parse_export_date(end_date, "end_date")
    if parsed_start_date and parsed_end_date and parsed_start_date > parsed_end_date:
        raise HTTPException(status_code=422, detail="start_date must be on or before end_date")
    enforce_user_rate_limit(db, current_user.id, "transaction_export")

    def generate_csv() -> Iterator[str]:
        buffer = io.StringIO(newline="")
        writer = csv.writer(buffer)
        writer.writerow([
            "id", "date", "category", "description", "amount", "is_income",
            "account_type", "account_name",
        ])
        yield buffer.getvalue()
        buffer.seek(0)
        buffer.truncate(0)

        with SessionLocal() as export_db:
            query = (
                export_db.query(Transaction, Account)
                .outerjoin(Account, Transaction.account_id == Account.id)
                .filter(Transaction.user_id == current_user.id)
            )
            if parsed_start_date:
                query = query.filter(Transaction.date >= parsed_start_date.isoformat())
            if parsed_end_date:
                query = query.filter(Transaction.date <= parsed_end_date.isoformat())

            for transaction, account in query.order_by(Transaction.date, Transaction.id).yield_per(500):
                writer.writerow([
                    transaction.id,
                    safe_csv_text(transaction.date),
                    safe_csv_text(transaction.category),
                    safe_csv_text(transaction.description),
                    transaction.amount,
                    str(transaction.is_income).lower(),
                    account.account_type if account else "",
                    safe_csv_text(account.name if account else ""),
                ])
                yield buffer.getvalue()
                buffer.seek(0)
                buffer.truncate(0)

    return StreamingResponse(
        generate_csv(),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="transactions.csv"',
            "Cache-Control": "no-store",
        },
    )


@router.get("", response_model=PaginatedTransactionsResponse)
async def list_transactions(
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
    page: int = Query(default=1, ge=1, le=1_000_000),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None, max_length=100),
    sort_by: SortField = Query(default="date"),
    sort_order: SortOrder = Query(default="desc"),
    category: str | None = Query(default=None, max_length=100),
    date_range: str | None = Query(default=None, max_length=21),
) -> PaginatedTransactionsResponse:
    start_date, end_date = parse_date_range(date_range)
    query = (
        db.query(Transaction, Account)
        .outerjoin(Account, Transaction.account_id == Account.id)
        .filter(Transaction.user_id == current_user.id)
    )
    if search:
        escaped_search = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        query = query.filter(
            Transaction.description.ilike(f"%{escaped_search}%", escape="\\")
            | Transaction.category.ilike(f"%{escaped_search}%", escape="\\")
            | Account.name.ilike(f"%{escaped_search}%", escape="\\")
            | Account.account_type.ilike(f"%{escaped_search}%", escape="\\")
        )
    if category:
        query = query.filter(Transaction.category == category)
    if start_date:
        query = query.filter(Transaction.date >= start_date.isoformat())
    if end_date:
        query = query.filter(Transaction.date <= end_date.isoformat())

    total = query.count()
    sort_columns = {
        "date": Transaction.date,
        "description": Transaction.description,
        "category": Transaction.category,
        "account": Account.name,
        "type": Transaction.is_income,
        "amount": cast(Transaction.amount, Numeric(14, 2)),
    }
    order_expression = sort_columns[sort_by]
    order_expression = order_expression.asc() if sort_order == "asc" else order_expression.desc()
    transactions = (
        query.order_by(order_expression, Transaction.id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    total_pages = max(1, (total + page_size - 1) // page_size)
    items = [
        TransactionListItem(
            id=transaction.id,
            date=date.fromisoformat(transaction.date),
            description=transaction.description,
            category=transaction.category,
            type="income" if transaction.is_income else "expense",
            amount=transaction.amount,
            account_id=transaction.account_id,
            account_name=account.name if account else None,
            account_type=account.account_type if account else None,
        )
        for transaction, account in transactions
    ]
    return PaginatedTransactionsResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )

@router.post("/bulk-delete", response_model=BulkDeleteResponse)
async def bulk_delete_transactions(
    request: BulkDeleteRequest,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> BulkDeleteResponse:
    try:
        deleted = (
            db.query(Transaction)
            .filter(
                Transaction.user_id == current_user.id,
                Transaction.id.in_(request.ids),
            )
            .delete(synchronize_session=False)
        )
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Bulk transaction deletion failed")
        raise HTTPException(status_code=500, detail="Transactions could not be deleted") from exc

    return BulkDeleteResponse(deleted=deleted)


@router.patch("/{transaction_id}", response_model=TransactionModel)
async def update_transaction(
    transaction_id: int,
    update: TransactionUpdate,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> TransactionModel:
    transaction = (
        db.query(Transaction)
        .filter(
            Transaction.id == transaction_id,
            Transaction.user_id == current_user.id,
        )
        .first()
    )
    if transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")

    changes = update.model_dump(exclude_unset=True)
    if "account_id" in changes and not db.query(Account.id).filter(
        Account.id == changes["account_id"],
        Account.user_id == current_user.id,
    ).first():
        raise HTTPException(status_code=404, detail="Account not found")
    if "date" in changes:
        changes["date"] = changes["date"].isoformat()

    for field, value in changes.items():
        setattr(transaction, field, value)

    try:
        db.commit()
        db.refresh(transaction)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Transaction update failed")
        raise HTTPException(status_code=500, detail="Transaction could not be updated") from exc

    return transaction


def parse_date_range(value: str | None) -> tuple[date | None, date | None]:
    if value is None:
        return None, None
    parts = value.split(",")
    if len(parts) != 2 or not any(parts):
        raise HTTPException(
            status_code=422,
            detail="date_range must be start_date,end_date in YYYY-MM-DD format",
        )
    parsed: list[date | None] = []
    for part in parts:
        if not part:
            parsed.append(None)
            continue
        try:
            parsed_date = date.fromisoformat(part)
        except ValueError:
            raise HTTPException(
                status_code=422,
                detail="date_range must use YYYY-MM-DD format",
            ) from None
        if parsed_date.isoformat() != part:
            raise HTTPException(
                status_code=422,
                detail="date_range must use YYYY-MM-DD format",
            )
        parsed.append(parsed_date)
    if parsed[0] and parsed[1] and parsed[0] > parsed[1]:
        raise HTTPException(status_code=422, detail="date_range start must not be after its end")
    return parsed[0], parsed[1]


@router.post("/import", response_model=TransactionImportResponse, status_code=201)
async def import_transactions(
    upload: Annotated[UploadFile, File(...)],
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> TransactionImportResponse:
    enforce_user_rate_limit(db, current_user.id, "transaction_import")
    account = get_or_create_cash_account(db, current_user.id)
    accounts_by_name = {
        owned_account.name: owned_account
        for owned_account in db.query(Account).filter(Account.user_id == current_user.id)
    }
    imported_count = await import_transactions_csv(
        upload,
        current_user.id,
        account.id,
        accounts_by_name,
        db,
    )
    return TransactionImportResponse(imported=imported_count)
