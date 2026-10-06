from sqlalchemy import Column, Index, Integer, PrimaryKeyConstraint, String

from app.db.session import Base


class ApiRateLimitBucket(Base):
    __tablename__ = "api_rate_limit_buckets"
    __table_args__ = (
        PrimaryKeyConstraint("user_id", "action", "window_start"),
        Index("ix_api_rate_limit_window_start", "window_start"),
    )

    user_id = Column(Integer, nullable=False)
    action = Column(String, nullable=False)
    window_start = Column(Integer, nullable=False)
    request_count = Column(Integer, nullable=False)
