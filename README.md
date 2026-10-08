# Finance App

A full-stack personal finance application built with FastAPI on the backend and React + Vite on the frontend. The app helps users track income and expenses, manage account balances, import/export CSV data, and maintain a secure profile with password management.

## Features

- User registration and login with secure password hashing
- Authenticated profile management
- Password update flow with current-password verification
- Transaction tracking for income and expense entries
- Account management with cash, wallet, and bank support
- CSV import and export for transaction data
- Search, filtering, sorting, and pagination for transaction records
- Balance calculations based on user-owned transactions and accounts
- SQLite-backed persistence for local development

## Tech Stack

### Backend
- Python 3.13
- FastAPI
- SQLAlchemy
- Pydantic
- pwdlib with Argon2 password hashing
- JWT-based authentication via python-jose
- SQLite database

### Frontend
- React 19
- Vite
- React Router
- Axios
- CSS-based UI styling

## Project Structure

```text
.
├── FastAPI/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── db/
│   │   ├── models/
│   │   ├── schemas/
│   │   └── services/
│   ├── scripts/
│   ├── tests/
│   ├── requirements.txt
│   ├── run.py
│   └── README.md
├── React/
│   └── finance-app/
│       ├── src/
│       ├── package.json
│       └── vite.config.js
├── README.md
└── .gitignore
```

## Prerequisites

Before running the project, install:

- Python 3.13
- Node.js 18+ and npm
- Git

## Backend Setup

1. Open a terminal in the `FastAPI` directory.
2. Create and activate a virtual environment if desired.
3. Install backend dependencies:

```bash
pip install -r requirements.txt
```

4. Run the database migration scripts before starting the API:

```bash
python -m scripts.migrate_decimal_amount
python -m scripts.migrate_accounts
```

The migrations preserve existing transaction data and ensure the app works with the decimal-safe storage and account model.

5. Start the API:

```bash
python run.py --reload
```

Or from the repo root:

```bash
python FastAPI/run.py --reload
```

The app will run on the default local FastAPI port (typically `http://localhost:8000`).

## Frontend Setup

1. Open a terminal in the `React/finance-app` directory.
2. Install frontend dependencies:

```bash
npm install
```

3. Start the Vite dev server:

```bash
npm run dev
```

This starts the frontend UI, usually available at `http://localhost:5173`.

## Environment Variables

The project supports the following environment overrides for deployment or local customization:

```bash
JWT_SECRET_KEY=your-secret-key
DATABASE_URL=sqlite:///./finance.db
```

Default local development uses the SQLite database shipped with the backend project.

## Application Flow

### Authentication
- Register a user account
- Sign in with email and password
- Access protected endpoints and profile data only after authentication

### Profile and Security
- View the authenticated profile
- Update username, email, designation, and mobile number
- Change your password by providing the current password and a new password

### Transactions and Accounts
- Create and manage personal transactions
- Assign transactions to account entries
- Review income vs expense totals and balances
- Filter and page transaction lists efficiently

### CSV Tools
- Export transaction data to CSV
- Import CSV files with validated transaction rows
- Uploads are protected with account ownership and row validation checks

## API Highlights

Key backend routes include:

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `PATCH /auth/me`
- `PATCH /auth/me/password`
- `GET /api/v1/transactions`
- `GET /api/v1/transactions/balance`
- `POST /api/v1/transactions/import`
- `GET /api/v1/transactions/export`
- `GET /api/v1/accounts`
- `POST /api/v1/accounts`

## Development Notes

- The backend is organized into `api`, `core`, `db`, `models`, `schemas`, and `services` packages.
- Validation is handled with Pydantic models for request and response data.
- Rate limiting is enforced on high-frequency transaction import/export operations.
- Transaction amounts are stored using decimal-safe handling to avoid floating-point precision issues.

## Testing

Run backend tests from the `FastAPI` directory:

```bash
python -m pytest tests/test_transaction_export.py -q
```

Build the frontend for production:

```bash
cd React/finance-app
npm run build
```

## License

This project is intended for personal finance tracking and local development use. Adjust licensing if you plan to deploy it in a production or distributed environment.

## Summary

This application is a practical personal-finance dashboard with secure authentication, detailed account tracking, CSV import/export tools, and a modern React interface. It is designed to be easy to run locally while offering production-minded validation and structured backend services.

