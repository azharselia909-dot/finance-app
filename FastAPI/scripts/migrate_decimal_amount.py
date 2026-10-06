import sys
from pathlib import Path

from sqlalchemy import Text, inspect
from sqlalchemy.engine import Connection, Engine

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.session import engine
from app.db.session import Base
from app.models import ApiRateLimitBucket


def _ensure_rate_limit_table(connection: Connection) -> None:
    ApiRateLimitBucket.__table__.create(connection, checkfirst=True)


def upgrade(target_engine: Engine = engine) -> None:
    if target_engine.dialect.name != "sqlite":
        raise RuntimeError("This migration currently supports the configured SQLite database only")

    Base.metadata.create_all(bind=target_engine)

    with target_engine.begin() as connection:
        columns = inspect(connection).get_columns("transactions")
        column_names = {column["name"] for column in columns}
        if "user_id" not in column_names:
            connection.exec_driver_sql("ALTER TABLE transactions ADD COLUMN user_id INTEGER")
            columns = inspect(connection).get_columns("transactions")

        amount_column = next(
            (column for column in columns if column["name"] == "amount"),
            None,
        )
        if amount_column is None:
            raise RuntimeError("The transactions table does not have an amount column")
        if isinstance(amount_column["type"], Text):
            _ensure_rate_limit_table(connection)
            return

        connection.exec_driver_sql(
            """
            CREATE TABLE transactions_decimal (
                id INTEGER NOT NULL PRIMARY KEY,
                user_id INTEGER,
                description VARCHAR,
                amount TEXT,
                date VARCHAR,
                category VARCHAR,
                is_income BOOLEAN
            )
            """
        )
        connection.exec_driver_sql(
            """
            INSERT INTO transactions_decimal
                (id, user_id, description, amount, date, category, is_income)
            SELECT id, user_id, description, CAST(amount AS TEXT), date, category, is_income
            FROM transactions
            """
        )
        connection.exec_driver_sql("DROP TABLE transactions")
        connection.exec_driver_sql("ALTER TABLE transactions_decimal RENAME TO transactions")
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_transactions_id ON transactions (id)"
        )
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_transactions_user_id ON transactions (user_id)"
        )
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_transactions_description ON transactions (description)"
        )
        _ensure_rate_limit_table(connection)


if __name__ == "__main__":
    upgrade()
