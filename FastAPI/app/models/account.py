from sqlalchemy import Column, ForeignKey, Integer, String, UniqueConstraint

from app.db.session import Base
from app.models.transaction import DecimalText


class Account(Base):
    __tablename__ = "accounts"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_accounts_user_name"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    account_type = Column(String(20), nullable=False)
    opening_balance = Column(DecimalText(), nullable=False, default=0)
