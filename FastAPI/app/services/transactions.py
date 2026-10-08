import csv
import io
import logging
from tempfile import SpooledTemporaryFile
from typing import BinaryIO

from fastapi import HTTPException, UploadFile
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models import Account, Transaction
from app.schemas import TransactionImportRow

logger = logging.getLogger(__name__)
MAX_IMPORT_BYTES = 5 * 1024 * 1024
MAX_IMPORT_ROWS = 20_000
UPLOAD_CHUNK_SIZE = 64 * 1024
MAX_REPORTED_ERRORS = 100
REQUIRED_HEADERS = {"date", "description", "amount", "category"}
ALLOWED_HEADERS = REQUIRED_HEADERS | {
    "id", "type", "is_income", "account_type", "account_name",
}


def _format_validation_error(error: ValidationError) -> str:
    messages = []
    for item in error.errors(include_url=False):
        field = ".".join(str(part) for part in item["loc"])
        messages.append(f"{field}: {item['msg']}" if field else item["msg"])
    return "; ".join(messages)


async def _spool_upload(upload: UploadFile) -> BinaryIO:
    spool = SpooledTemporaryFile(max_size=1024 * 1024, mode="w+b")
    total_bytes = 0
    try:
        while chunk := await upload.read(UPLOAD_CHUNK_SIZE):
            total_bytes += len(chunk)
            if total_bytes > MAX_IMPORT_BYTES:
                raise HTTPException(status_code=413, detail="CSV file must be 5 MB or smaller")
            spool.write(chunk)
        spool.seek(0)
        return spool
    except Exception:
        spool.close()
        raise


async def import_transactions_csv(
    upload: UploadFile,
    user_id: int,
    account_id: int,
    accounts_by_name: dict[str, Account],
    db: Session,
) -> int:
    filename = (upload.filename or "").strip()
    content_type = (upload.content_type or "").split(";", 1)[0].strip().casefold()
    if not filename.casefold().endswith(".csv"):
        await upload.close()
        raise HTTPException(status_code=415, detail="Upload a file with a .csv extension")
    if content_type != "text/csv":
        await upload.close()
        raise HTTPException(status_code=415, detail="CSV uploads must use the text/csv media type")

    try:
        spool = await _spool_upload(upload)
    except Exception:
        await upload.close()
        raise
    errors: list[dict[str, str | int]] = []
    error_count = 0
    imported_count = 0
    pending_transactions: list[Transaction] = []
    text_stream = io.TextIOWrapper(spool, encoding="utf-8-sig", newline="")

    try:
        reader = csv.DictReader(text_stream, strict=True)
        original_headers = reader.fieldnames
        headers = [header.strip().casefold() for header in original_headers or []]
        if not headers:
            raise HTTPException(status_code=422, detail="CSV file must include a header row")
        if len(headers) != len(set(headers)):
            raise HTTPException(status_code=422, detail="CSV header names must be unique")
        unexpected_headers = set(headers) - ALLOWED_HEADERS
        if unexpected_headers:
            raise HTTPException(
                status_code=422,
                detail=f"Unexpected CSV columns: {', '.join(sorted(unexpected_headers))}",
            )
        missing_headers = REQUIRED_HEADERS - set(headers)
        if "type" not in headers and "is_income" not in headers:
            missing_headers.add("type (or is_income)")
        if missing_headers:
            raise HTTPException(
                status_code=422,
                detail=f"Missing required CSV columns: {', '.join(sorted(missing_headers))}",
            )
        reader.fieldnames = headers

        for row_number, raw_row in enumerate(reader, start=2):
            if row_number - 1 > MAX_IMPORT_ROWS:
                raise HTTPException(status_code=413, detail="CSV file exceeds the 20,000 row limit")
            if None in raw_row:
                row_errors = ["row has more values than the header"]
            else:
                row = {key: (value or "").strip() for key, value in raw_row.items()}
                for optional_field in ("account_name", "account_type"):
                    if not row.get(optional_field):
                        row.pop(optional_field, None)
                if "is_income" in headers:
                    bool_value = row.get("is_income", "").casefold()
                    if bool_value not in {"true", "false", "1", "0"}:
                        row_errors = ["is_income must be true, false, 1, or 0"]
                    else:
                        row["is_income"] = bool_value in {"true", "1"}
                        row_errors = []
                else:
                    row_errors = []

                if not row_errors:
                    try:
                        parsed = TransactionImportRow.model_validate(row)
                    except ValidationError as exc:
                        row_errors = [_format_validation_error(exc)]
                    else:
                        account = accounts_by_name.get(parsed.account_name) if parsed.account_name else None
                        if parsed.account_name and account is None:
                            row_errors = [f"account_name: unknown account '{parsed.account_name}'"]
                        elif parsed.account_type and not parsed.account_name:
                            row_errors = ["account_name is required when account_type is provided"]
                        elif account and parsed.account_type and account.account_type != parsed.account_type:
                            row_errors = ["account_type does not match the selected account"]
                        else:
                            pending_transactions.append(
                                Transaction(
                                    user_id=user_id,
                                    account_id=account.id if account else account_id,
                                    date=parsed.date.isoformat(),
                                    description=parsed.description,
                                    amount=parsed.amount,
                                    category=parsed.category,
                                    is_income=parsed.is_income_value,
                                )
                            )
                            if len(pending_transactions) >= 500:
                                db.add_all(pending_transactions)
                                db.flush()
                                imported_count += len(pending_transactions)
                                pending_transactions.clear()

            for message in row_errors:
                error_count += 1
                if len(errors) < MAX_REPORTED_ERRORS:
                    errors.append({"row": row_number, "message": message})

        if errors:
            db.rollback()
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "No transactions were imported because the CSV contains invalid rows",
                    "error_count": error_count,
                    "errors": errors,
                    "errors_truncated": error_count > len(errors),
                },
            )

        if pending_transactions:
            db.add_all(pending_transactions)
            imported_count += len(pending_transactions)
        if imported_count == 0:
            raise HTTPException(status_code=422, detail="CSV file contains no transaction rows")
        db.commit()
        return imported_count
    except csv.Error as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=f"Invalid CSV format: {exc}") from None
    except UnicodeDecodeError:
        db.rollback()
        raise HTTPException(status_code=422, detail="CSV file must be valid UTF-8 text") from None
    except HTTPException:
        if db.in_transaction():
            db.rollback()
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.error("Transaction CSV import failed during database persistence")
        raise HTTPException(status_code=500, detail="CSV import could not be completed") from exc
    finally:
        text_stream.detach()
        spool.close()
        await upload.close()
