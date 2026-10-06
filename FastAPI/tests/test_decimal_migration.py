import unittest

from sqlalchemy import create_engine, inspect, text

from scripts.migrate_decimal_amount import upgrade


class DecimalMigrationTests(unittest.TestCase):
    def _make_legacy_engine(self, include_user_id=True):
        engine = create_engine("sqlite://")
        user_column = "user_id INTEGER," if include_user_id else ""
        with engine.begin() as connection:
            connection.execute(text(
                f"""
                CREATE TABLE transactions (
                    id INTEGER PRIMARY KEY,
                    {user_column}
                    description VARCHAR,
                    amount FLOAT,
                    date VARCHAR,
                    category VARCHAR,
                    is_income BOOLEAN
                )
                """
            ))
            values = (
                "(1, 7, 'Lunch', 12.34, '2025-04-01', 'Food', 0)"
                if include_user_id
                else "(1, 'Lunch', 12.34, '2025-04-01', 'Food', 0)"
            )
            connection.execute(text(f"INSERT INTO transactions VALUES {values}"))
        return engine

    def test_upgrade_preserves_rows_and_changes_amount_column_to_text(self):
        engine = self._make_legacy_engine()
        try:
            upgrade(engine)
            upgrade(engine)

            with engine.connect() as connection:
                amount_type = connection.execute(
                    text("PRAGMA table_info(transactions)")
                ).all()
                amount_column = next(column for column in amount_type if column[1] == "amount")
                transaction = connection.execute(
                    text("SELECT id, user_id, amount FROM transactions")
                ).one()

            self.assertEqual(amount_column[2], "TEXT")
            self.assertEqual(tuple(transaction), (1, 7, "12.34"))
            self.assertTrue(inspect(engine).has_table("api_rate_limit_buckets"))
        finally:
            engine.dispose()

    def test_upgrade_handles_legacy_table_without_user_id(self):
        engine = self._make_legacy_engine(include_user_id=False)
        try:
            upgrade(engine)
            self.assertTrue(inspect(engine).has_table("api_rate_limit_buckets"))
            with engine.connect() as connection:
                transaction = connection.execute(
                    text("SELECT id, user_id, amount FROM transactions")
                ).one()
            self.assertEqual(tuple(transaction), (1, None, "12.34"))
        finally:
            engine.dispose()

    def test_upgrade_is_safe_before_first_database_creation(self):
        engine = create_engine("sqlite://")
        try:
            upgrade(engine)
        finally:
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
