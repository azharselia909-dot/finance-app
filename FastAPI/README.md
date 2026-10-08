# FastAPI finance API

Install the backend dependencies with `pip install -r requirements.txt`, then run
`python -m scripts.migrate_decimal_amount` followed by
`python -m scripts.migrate_accounts` from this directory before starting the API.
The migration converts the SQLite `transactions.amount` column from floating
point storage to exact decimal text storage, preserves existing rows and
indexes, and creates the persistent rate-limit table. Back up `finance.db`
before applying migrations. The account migration creates the accounts table,
adds `transactions.account_id`, and assigns existing user-owned transactions to
each user's Cash account so existing balances are preserved. Transactions
without a known user remain unassigned.

The backend follows a package layout: `app/api` contains dependencies and
versioned endpoints, `app/core` contains security, `app/db` configures database
sessions, `app/models` and `app/schemas` define persistence and API contracts,
and `app/services` contains transaction and rate-limit logic. Operational
scripts live in `scripts/`; backend tests live in `tests/`.

Set `DATABASE_URL` to override the default database file or
`JWT_SECRET_KEY` before deploying outside local development.

The records API is authenticated and user-scoped:

- `GET /auth/me` returns the signed-in user's profile, and `PATCH /auth/me`
  updates username, email, designation, and mobile number. Email and username
  must remain unique; the updated email is used for future sign-ins.
- `GET /api/v1/transactions` supports `page`, `page_size` (maximum 100),
  `search`, `sort_by` (`date`, `description`, `category`, `account`, `type`,
  or `amount`), `sort_order`, exact `category`, and inclusive
  `date_range` bounds formatted as `YYYY-MM-DD,YYYY-MM-DD`.
- `GET /api/v1/transactions/balance` returns the signed-in user's all-time
  account opening balances plus income-minus-expense as an exact decimal string.
- `GET /api/v1/accounts` returns the signed-in user's cash, wallet, and bank
  accounts with their current balances. `POST /api/v1/accounts` creates an
  account with a unique per-user name and optional starting balance (maximum
  100 accounts per user).
- New transactions require an `account_id` belonging to the signed-in user.
  Income increases the selected account; expenses decrease it. Account name and
  type are included in transaction records and CSV exports. CSV imports without
  account details are assigned to the user's Cash account. Exports include
  optional `account_type` and `account_name` columns; imports validate these
  against the signed-in user's existing accounts and reject unknown names.
- `POST /api/v1/transactions/import` accepts a `text/csv` `.csv` upload up to
  5 MB / 20,000 rows. Required CSV headers are
  `date,description,amount,category,type`, with `type` set to `income` or
  `expense`. Optional `account_type` and `account_name` columns assign rows to
  existing accounts. Existing exports using
  `date,description,amount,category,is_income` can also be imported. Invalid
  rows reject the entire import with row numbers and no records are committed.
  Imports append rows without content-based deduplication; submitting the same
  file again creates another set of transactions.
- CSV imports are limited to 5 attempts per signed-in user per hour and exports
  to 60 per hour. A `429` response includes a `Retry-After` header; rate-limit
  buckets are stored in the shared SQLite database and pruned after 48 hours
  when a subsequent rate-limited request arrives.

The amount-storage migration is one-way because converting exact decimals back
to floating point is lossy. To roll back, stop the API and restore the database
backup created before migration.

The import endpoint returns `201` with the count imported, `413` for upload or
row limits, `415` for the wrong file type, and `422` for invalid CSV or rows.

From the repository root, start the application with
`python FastAPI/run.py --reload`. From the `FastAPI` directory, run
`python run.py --reload`. Both commands resolve the packaged `app` module
without requiring a manually configured `PYTHONPATH`. For direct Uvicorn usage,
run `uvicorn app.main:app --reload` from the `FastAPI` directory. The root
`main.py` remains available as a compatibility entrypoint for `uvicorn main:app`.
