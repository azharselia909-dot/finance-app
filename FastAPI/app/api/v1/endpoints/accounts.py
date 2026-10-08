import logging
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.api.dependencies import DbSession, get_current_user
from app.models import Account, Transaction, User
from app.schemas import AccountCreate, AccountResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/accounts", tags=["accounts"])
MAX_ACCOUNTS_PER_USER = 100


@router.get("", response_model=list[AccountResponse])
async def list_accounts(
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[AccountResponse]:
    accounts = (
        db.query(Account)
        .filter(Account.user_id == current_user.id)
        .order_by(Account.account_type, Account.name, Account.id)
        .all()
    )
    balances = {account.id: account.opening_balance for account in accounts}
    for transaction in (
        db.query(Transaction.account_id, Transaction.amount, Transaction.is_income)
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.account_id.in_(balances) if balances else False,
        )
        .yield_per(1000)
    ):
        if transaction.account_id in balances:
            balances[transaction.account_id] += (
                transaction.amount if transaction.is_income else -transaction.amount
            )

    return [
        AccountResponse(
            id=account.id,
            name=account.name,
            account_type=account.account_type,
            opening_balance=account.opening_balance,
            balance=balances[account.id],
        )
        for account in accounts
    ]


@router.post("", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(
    account_data: AccountCreate,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> AccountResponse:
    if db.query(Account.id).filter(Account.user_id == current_user.id).count() >= MAX_ACCOUNTS_PER_USER:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Account limit reached")

    account = Account(
        user_id=current_user.id,
        name=account_data.name,
        account_type=account_data.account_type,
        opening_balance=account_data.opening_balance,
    )
    db.add(account)
    try:
        db.commit()
        db.refresh(account)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this name already exists",
        ) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Account creation failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Account could not be created",
        ) from exc

    return AccountResponse(
        id=account.id,
        name=account.name,
        account_type=account.account_type,
        opening_balance=account.opening_balance,
        balance=Decimal(account.opening_balance),
    )
