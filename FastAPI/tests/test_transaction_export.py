import csv
import io
import tempfile
import unittest
import atexit
from decimal import Decimal
from io import BytesIO
from pathlib import Path

from fastapi import UploadFile
from fastapi import HTTPException
from fastapi.routing import APIRoute
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from starlette.datastructures import Headers

import app.db.session as database


_test_directory = tempfile.TemporaryDirectory()
_test_engine = create_engine(
    f"sqlite:///{Path(_test_directory.name, 'test.db')}",
    connect_args={"check_same_thread": False},
)
database.engine = _test_engine
database.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_test_engine)

import app.main as main
from app.api.dependencies import get_current_user
from app.api.v1.endpoints.accounts import (
    create_account,
    list_accounts,
    router as accounts_router,
)
from app.api.v1.endpoints.transactions import (
    create_transaction,
    export_transactions,
    get_transaction_balance,
    import_transactions,
    list_transactions,
    router as transactions_router,
)
from app.api.v1.endpoints.auth import (
    router as auth_router,
    update_current_user,
    update_current_user_password,
)
from app.core.security import password_hash
from app.db.session import Base
from app.models import Account, ApiRateLimitBucket, Transaction, User
from app.schemas import (
    AccountCreate,
    PasswordUpdateRequest,
    TransactionCreate,
    TransactionUpdate,
    UserUpdate,
)
from app.services.rate_limits import enforce_user_rate_limit

Base.metadata.create_all(bind=_test_engine)


@atexit.register
def _dispose_test_database():
    _test_engine.dispose()
    _test_directory.cleanup()


class TransactionExportTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.db = database.SessionLocal()
        self.db.query(ApiRateLimitBucket).delete()
        self.db.query(Transaction).delete()
        self.db.query(Account).delete()
        self.db.query(User).delete()
        self.db.commit()

        self.user = User(
            username="export-user",
            designation="Tester",
            mobile_number="123456789",
            email="export@example.com",
            hashed_password="unused",
        )
        other_user = User(
            username="other-user",
            designation="Tester",
            mobile_number="123456789",
            email="other@example.com",
            hashed_password="unused",
        )
        self.db.add_all([self.user, other_user])
        self.db.commit()
        self.db.refresh(self.user)
        self.other_user = other_user
        self.db.refresh(self.other_user)

    def tearDown(self):
        self.db.close()

    async def _response_csv(self, **kwargs):
        response = await export_transactions(
            db=self.db,
            current_user=self.user,
            start_date=kwargs.get("start_date"),
            end_date=kwargs.get("end_date"),
        )
        chunks = [chunk async for chunk in response.body_iterator]
        content = "".join(self._decode_chunk(chunk) for chunk in chunks)
        return response, list(csv.DictReader(io.StringIO(content)))

    @staticmethod
    def _decode_chunk(chunk: str | bytes | memoryview) -> str:
        return chunk if isinstance(chunk, str) else bytes(chunk).decode("utf-8")

    def _add_transaction(
        self,
        user_id,
        transaction_date,
        category,
        description,
        amount=Decimal("12.50"),
    ):
        transaction = Transaction(
            user_id=user_id,
            date=transaction_date,
            category=category,
            description=description,
            amount=amount,
            is_income=False,
        )
        self.db.add(transaction)
        self.db.commit()

    async def test_streams_only_owned_transactions_with_inclusive_date_range(self):
        self._add_transaction(self.user.id, "2025-04-01", "Food", "Lunch")
        self._add_transaction(self.user.id, "2025-04-30", "Travel", "Train")
        self._add_transaction(self.user.id, "2025-05-01", "Other", "Outside range")
        self._add_transaction(self.other_user.id, "2025-04-15", "Private", "Other user's row")

        response, rows = await self._response_csv(
            start_date="2025-04-01",
            end_date="2025-04-30",
        )

        self.assertTrue(response.headers["content-type"].startswith("text/csv;"))
        self.assertIn('attachment; filename="transactions.csv"', response.headers["content-disposition"])
        self.assertEqual([row["category"] for row in rows], ["Food", "Travel"])
        self.assertEqual([row["date"] for row in rows], ["2025-04-01", "2025-04-30"])

    async def test_protects_formula_cells_and_quotes_csv_text(self):
        self._add_transaction(self.user.id, "2025-04-01", "=2+2", 'Dinner, with "friends"')

        _, rows = await self._response_csv()

        self.assertEqual(rows[0]["category"], "'=2+2")
        self.assertEqual(rows[0]["description"], 'Dinner, with "friends"')

    async def test_empty_date_strings_export_all_and_reversed_range_is_rejected(self):
        self._add_transaction(self.user.id, "2025-04-01", "Food", "Lunch")

        _, rows = await self._response_csv(start_date="", end_date="")
        self.assertEqual(len(rows), 1)

        with self.assertRaises(HTTPException) as raised:
            await self._response_csv(start_date="2025-05-01", end_date="2025-04-01")
        self.assertEqual(raised.exception.status_code, 422)

    async def test_malformed_date_is_rejected(self):
        with self.assertRaises(HTTPException) as raised:
            await self._response_csv(start_date="04/01/2025")
        self.assertEqual(raised.exception.status_code, 422)

    def test_export_route_requires_authenticated_user_dependency(self):
        protected_paths = {
            "/api/v1/transactions",
            "/api/v1/transactions/import",
            "/api/v1/transactions/export",
            "/api/v1/transactions/balance",
            "/api/v1/transactions/bulk-delete",
            "/api/v1/transactions/{transaction_id}",
        }
        routes = [
            route for route in transactions_router.routes
            if isinstance(route, APIRoute)
        ]
        self.assertEqual({route.path for route in routes}, protected_paths)
        self.assertTrue(protected_paths.issubset(main.app.openapi()["paths"]))
        for route in routes:
            self.assertTrue(
                any(
                    dependency.call is get_current_user
                    for dependency in route.dependant.dependencies
                ),
                f"{route.path} must require an authenticated user",
            )

    def test_profile_update_route_requires_authenticated_user(self):
        profile_route = next(
            route for route in auth_router.routes
            if isinstance(route, APIRoute) and route.path == "/auth/me"
            and route.methods is not None and "PATCH" in route.methods
        )
        self.assertTrue(
            any(
                dependency.call is get_current_user
                for dependency in profile_route.dependant.dependencies
            )
        )

    def test_account_routes_require_authenticated_user(self):
        routes = [
            route for route in accounts_router.routes
            if isinstance(route, APIRoute)
        ]
        self.assertEqual(len(routes), 2)
        self.assertTrue({"/api/v1/accounts"}.issubset(main.app.openapi()["paths"]))
        for route in routes:
            self.assertTrue(
                any(
                    dependency.call is get_current_user
                    for dependency in route.dependant.dependencies
                ),
                f"{route.path} must require an authenticated user",
            )

    async def test_paginated_listing_filters_sorts_and_scopes_by_owner(self):
        self._add_transaction(self.user.id, "2025-04-01", "Food", "Lunch")
        self._add_transaction(
            self.user.id, "2025-04-03", "Rent", "Apartment", Decimal("100.05")
        )
        self._add_transaction(self.other_user.id, "2025-04-02", "Food", "Private lunch")

        result = await list_transactions(
            db=self.db,
            current_user=self.user,
            page=1,
            page_size=1,
            search="",
            sort_by="amount",
            sort_order="desc",
            category=None,
            date_range=None,
        )

        self.assertEqual(result.total, 2)
        self.assertEqual(result.page_size, 1)
        self.assertEqual(result.total_pages, 2)
        self.assertEqual(result.items[0].description, "Apartment")
        self.assertEqual(result.items[0].amount, Decimal("100.05"))

    async def test_account_balances_follow_owned_income_and_expense_transactions(self):
        cash = await create_account(
            AccountCreate(name="Everyday cash", account_type="cash", opening_balance="25.00"),
            db=self.db,
            current_user=self.user,
        )
        wallet = await create_account(
            AccountCreate(name="Travel wallet", account_type="wallet", opening_balance="10.00"),
            db=self.db,
            current_user=self.user,
        )
        other_account = await create_account(
            AccountCreate(name="Private bank", account_type="bank"),
            db=self.db,
            current_user=self.other_user,
        )

        await create_transaction(
            TransactionCreate(
                description="Payday",
                amount="100.00",
                date="2025-04-01",
                category="Salary",
                is_income=True,
                account_id=cash.id,
            ),
            db=self.db,
            current_user=self.user,
        )
        await create_transaction(
            TransactionCreate(
                description="Coffee",
                amount="7.50",
                date="2025-04-02",
                category="Food",
                is_income=False,
                account_id=cash.id,
            ),
            db=self.db,
            current_user=self.user,
        )
        self._add_transaction(
            self.other_user.id,
            "2025-04-03",
            "Private",
            "Other user's row",
            Decimal("999.00"),
        )

        accounts = await list_accounts(db=self.db, current_user=self.user)
        balances = {account.id: account.balance for account in accounts}
        self.assertEqual(balances, {cash.id: Decimal("117.50"), wallet.id: Decimal("10.00")})
        overall_balance = await get_transaction_balance(db=self.db, current_user=self.user)
        self.assertEqual(overall_balance.balance, "127.50")
        listed = await list_transactions(
            db=self.db,
            current_user=self.user,
            page=1,
            page_size=20,
            search="",
            sort_by="date",
            sort_order="desc",
            category=None,
            date_range=None,
        )
        self.assertEqual(listed.total, 2)
        self.assertEqual(listed.items[0].account_name, "Everyday cash")
        self.assertEqual(listed.items[0].account_type, "cash")
        self.assertNotEqual(other_account.id, cash.id)

    async def test_transaction_rejects_account_owned_by_another_user(self):
        account = await create_account(
            AccountCreate(name="Other user's bank", account_type="bank"),
            db=self.db,
            current_user=self.other_user,
        )

        with self.assertRaises(HTTPException) as raised:
            await create_transaction(
                TransactionCreate(
                    description="Should not be stored",
                    amount="12.00",
                    date="2025-04-01",
                    category="Test",
                    is_income=True,
                    account_id=account.id,
                ),
                db=self.db,
                current_user=self.user,
            )
        self.assertEqual(raised.exception.status_code, 404)
        self.assertEqual(self.db.query(Transaction).filter(Transaction.user_id == self.user.id).count(), 0)

    async def test_paginated_listing_searches_and_filters_inclusive_dates(self):
        self._add_transaction(self.user.id, "2025-04-01", "Food", "Lunch")
        self._add_transaction(self.user.id, "2025-04-02", "Food", "Coffee")
        self._add_transaction(self.user.id, "2025-04-01", "Travel", "Lunch")

        result = await list_transactions(
            db=self.db,
            current_user=self.user,
            page=1,
            page_size=20,
            search="Lunch",
            sort_by="date",
            sort_order="asc",
            category="Food",
            date_range="2025-04-01,2025-04-01",
        )

        self.assertEqual(result.total, 1)
        self.assertEqual(result.items[0].description, "Lunch")
        self.assertEqual(result.items[0].category, "Food")

    async def test_csv_import_validates_decimal_and_rolls_back_staged_rows(self):
        valid_upload = UploadFile(
            file=BytesIO(
                b"date,description,amount,category,type\n"
                b"2025-04-01,Salary,1250.10,Work,income\n"
            ),
            filename="transactions.csv",
            headers=Headers({"content-type": "text/csv"}),
        )
        response = await import_transactions(
            upload=valid_upload,
            db=self.db,
            current_user=self.user,
        )
        self.assertEqual(response.imported, 1)
        transaction = self.db.query(Transaction).filter_by(user_id=self.user.id).one()
        self.assertEqual(transaction.amount, Decimal("1250.10"))
        self.assertTrue(transaction.is_income)

        valid_rows = [
            f"2025-04-02,Valid row {index},25.00,Food,expense"
            for index in range(501)
        ]
        content = (
            "date,description,amount,category,type\n"
            + "\n".join(valid_rows)
            + "\n2025-04-03,Invalid amount,not-a-number,Food,expense\n"
        ).encode()
        invalid_upload = UploadFile(
            file=BytesIO(content),
            filename="invalid.csv",
            headers=Headers({"content-type": "text/csv"}),
        )
        with self.assertRaises(HTTPException) as raised:
            await import_transactions(
                upload=invalid_upload,
                db=self.db,
                current_user=self.user,
            )

        self.assertEqual(raised.exception.status_code, 422)
        detail = raised.exception.detail
        if not isinstance(detail, dict):
            raise AssertionError("Expected detailed row validation errors")
        row_errors = detail.get("errors")
        if not isinstance(row_errors, list) or not row_errors or not isinstance(row_errors[0], dict):
            raise AssertionError("Expected row-indexed CSV validation errors")
        self.assertEqual(row_errors[0].get("row"), 503)
        self.assertEqual(
            self.db.query(Transaction).filter_by(user_id=self.user.id).count(),
            1,
        )

    async def test_csv_import_preserves_selected_account_from_export_columns(self):
        account = await create_account(
            AccountCreate(name="Main checking", account_type="bank"),
            db=self.db,
            current_user=self.user,
        )
        upload = UploadFile(
            file=BytesIO(
                b"id,date,category,description,amount,is_income,account_type,account_name\n"
                b"1,2025-04-01,Salary,Payday,500.00,true,bank,Main checking\n"
            ),
            filename="transactions.csv",
            headers=Headers({"content-type": "text/csv"}),
        )

        result = await import_transactions(
            upload=upload,
            db=self.db,
            current_user=self.user,
        )

        imported = self.db.query(Transaction).filter_by(user_id=self.user.id).one()
        self.assertEqual(result.imported, 1)
        self.assertEqual(imported.account_id, account.id)

    async def test_csv_upload_rejects_wrong_extension(self):
        upload = UploadFile(
            file=BytesIO(b"content"),
            filename="transactions.txt",
            headers=Headers({"content-type": "text/csv"}),
        )

        with self.assertRaises(HTTPException) as raised:
            await import_transactions(
                upload=upload,
                db=self.db,
                current_user=self.user,
            )
        self.assertEqual(raised.exception.status_code, 415)

    async def test_csv_upload_rejects_wrong_mime_type_and_oversized_file(self):
        wrong_mime = UploadFile(
            file=BytesIO(b"date,description,amount,category,type\n"),
            filename="transactions.csv",
            headers=Headers({"content-type": "application/octet-stream"}),
        )
        with self.assertRaises(HTTPException) as mime_error:
            await import_transactions(
                upload=wrong_mime,
                db=self.db,
                current_user=self.user,
            )
        self.assertEqual(mime_error.exception.status_code, 415)

        oversized = UploadFile(
            file=BytesIO(b"x" * (5 * 1024 * 1024 + 1)),
            filename="transactions.csv",
            headers=Headers({"content-type": "text/csv"}),
        )
        with self.assertRaises(HTTPException) as size_error:
            await import_transactions(
                upload=oversized,
                db=self.db,
                current_user=self.user,
            )
        self.assertEqual(size_error.exception.status_code, 413)

    def test_import_rate_limit_is_per_user_and_returns_retry_after(self):
        user_id = self.db.execute(
            select(User.id).where(User.username == "export-user")
        ).scalar_one()
        for _ in range(5):
            enforce_user_rate_limit(self.db, user_id, "transaction_import")

        with self.assertRaises(HTTPException) as raised:
            enforce_user_rate_limit(self.db, user_id, "transaction_import")

        self.assertEqual(raised.exception.status_code, 429)
        headers = raised.exception.headers
        if headers is None:
            raise AssertionError("Rate limit response must include Retry-After")
        self.assertGreater(int(headers["Retry-After"]), 0)

    async def test_profile_update_changes_only_current_users_fields(self):
        update = UserUpdate.model_validate({
            "username": "new-export-user",
            "email": " NEW-EXPORT@EXAMPLE.COM ",
            "designation": "Accountant",
            "mobile_number": "+1 555-123-4567",
        })

        result = await update_current_user(update, self.db, self.user)

        self.assertEqual(result.id, self.user.id)
        self.assertEqual(result.username, "new-export-user")
        self.assertEqual(result.email, "new-export@example.com")
        self.assertEqual(result.designation, "Accountant")
        self.assertEqual(result.mobile_number, "+1 555-123-4567")
        self.assertEqual(
            self.db.query(User).filter(User.id == self.other_user.id).one().email,
            "other@example.com",
        )

    async def test_profile_update_rejects_another_users_email(self):
        update = UserUpdate(email="other@example.com")

        with self.assertRaises(HTTPException) as raised:
            await update_current_user(update, self.db, self.user)

        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(self.user.email, "export@example.com")

    async def test_password_update_rehashes_a_new_password(self):
        self.user.hashed_password = password_hash.hash("CurrentPassword123")
        self.db.commit()

        result = await update_current_user_password(
            PasswordUpdateRequest(
                current_password="CurrentPassword123",
                new_password="UpdatedPassword456",
            ),
            self.db,
            self.user,
        )

        self.assertEqual(result.id, self.user.id)
        self.assertTrue(password_hash.verify("UpdatedPassword456", self.user.hashed_password))
        self.assertFalse(password_hash.verify("CurrentPassword123", self.user.hashed_password))

    async def test_password_update_rejects_wrong_current_password(self):
        self.user.hashed_password = password_hash.hash("CurrentPassword123")
        self.db.commit()

        with self.assertRaises(HTTPException) as raised:
            await update_current_user_password(
                PasswordUpdateRequest(
                    current_password="WrongPassword123",
                    new_password="UpdatedPassword456",
                ),
                self.db,
                self.user,
            )

        self.assertEqual(raised.exception.status_code, 401)

    def test_profile_update_rejects_empty_or_null_updates(self):
        with self.assertRaises(ValueError):
            UserUpdate.model_validate({})
        with self.assertRaises(ValueError):
            UserUpdate.model_validate({"email": None})


if __name__ == "__main__":
    unittest.main()
