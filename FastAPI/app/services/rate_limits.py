from datetime import datetime, timezone
from math import ceil
from typing import Literal

from fastapi import HTTPException, status
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.orm import Session

from app.models import ApiRateLimitBucket

RateLimitedAction = Literal["transaction_import", "transaction_export"]
RATE_LIMITS: dict[RateLimitedAction, tuple[int, int]] = {
    "transaction_import": (5, 60 * 60),
    "transaction_export": (60, 60 * 60),
}


def enforce_user_rate_limit(db: Session, user_id: int, action: RateLimitedAction) -> None:
    limit, window_seconds = RATE_LIMITS[action]
    now = int(datetime.now(timezone.utc).timestamp())
    window_start = now - now % window_seconds
    retention_seconds = max(window for _, window in RATE_LIMITS.values()) * 2
    db.query(ApiRateLimitBucket).filter(
        ApiRateLimitBucket.window_start < now - retention_seconds,
    ).delete(synchronize_session=False)

    statement = insert(ApiRateLimitBucket).values(
        user_id=user_id,
        action=action,
        window_start=window_start,
        request_count=1,
    )
    statement = statement.on_conflict_do_update(
        index_elements=[
            ApiRateLimitBucket.user_id,
            ApiRateLimitBucket.action,
            ApiRateLimitBucket.window_start,
        ],
        set_={"request_count": ApiRateLimitBucket.request_count + 1},
    )
    db.execute(statement)
    request_count = db.query(ApiRateLimitBucket.request_count).filter(
        ApiRateLimitBucket.user_id == user_id,
        ApiRateLimitBucket.action == action,
        ApiRateLimitBucket.window_start == window_start,
    ).scalar()
    db.commit()

    if request_count is not None and request_count > limit:
        retry_after = max(1, ceil(window_start + window_seconds - now))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please wait before trying again.",
            headers={"Retry-After": str(retry_after)},
        )
