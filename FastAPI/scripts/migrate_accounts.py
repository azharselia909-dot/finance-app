import sys
from pathlib import Path

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.session import engine
from app.models import Account


def upgrade(target_engine: Engine = engine) -> None:
    if target_engine.dialect.name != "sqlite":
        raise RuntimeError("This migration currently supports SQLite only")

    Account.__table__.create(bind=target_engine, checkfirst=True)
    with target_engine.begin() as connection:
        if not inspect(connection).has_table("transactions"):
            return

        column_names = {
            column["name"] for column in inspect(connection).get_columns("transactions")
        }
        if "account_id" not in column_names:
            connection.exec_driver_sql(
                "ALTER TABLE transactions ADD COLUMN account_id INTEGER REFERENCES accounts(id)"
            )

        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_transactions_account_id ON transactions (account_id)"
        )
        user_ids = connection.execute(
            text(
                "SELECT DISTINCT user_id FROM transactions "
                "WHERE user_id IS NOT NULL AND account_id IS NULL"
            )
        ).scalars().all()
        for user_id in user_ids:
            connection.execute(
                text(
                    "INSERT OR IGNORE INTO accounts "
                    "(user_id, name, account_type, opening_balance) "
                    "VALUES (:user_id, 'Cash', 'cash', '0.00')"
                ),
                {"user_id": user_id},
            )
            account_id = connection.execute(
                text(
                    "SELECT id FROM accounts WHERE user_id = :user_id AND name = 'Cash'"
                ),
                {"user_id": user_id},
            ).scalar_one()
            connection.execute(
                text(
                    "UPDATE transactions SET account_id = :account_id "
                    "WHERE user_id = :user_id AND account_id IS NULL"
                ),
                {"account_id": account_id, "user_id": user_id},
            )


if __name__ == "__main__":
    upgrade()
