import re

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    designation: str = Field(min_length=2, max_length=100)
    mobile_number: str = Field(min_length=7, max_length=20)
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Enter a valid email address")
        return value

    @field_validator("mobile_number")
    @classmethod
    def validate_mobile_number(cls, value: str) -> str:
        value = value.strip()
        if not re.fullmatch(r"\+?[0-9][0-9\s-]{6,18}[0-9]", value):
            raise ValueError("Enter a valid mobile number")
        return value


class UserResponse(BaseModel):
    id: int
    username: str
    designation: str
    mobile_number: str
    email: str

    model_config = ConfigDict(from_attributes=True)


class UserUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=50)
    designation: str | None = Field(default=None, min_length=2, max_length=100)
    mobile_number: str | None = Field(default=None, min_length=7, max_length=20)
    email: str | None = Field(default=None, min_length=5, max_length=254)

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Enter a valid email address")
        return value

    @field_validator("mobile_number")
    @classmethod
    def validate_mobile_number(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if not re.fullmatch(r"\+?[0-9][0-9\s-]{6,18}[0-9]", value):
            raise ValueError("Enter a valid mobile number")
        return value

    @model_validator(mode="after")
    def require_update_fields(self) -> "UserUpdate":
        if not self.model_fields_set:
            raise ValueError("Provide at least one profile field to update")
        if any(getattr(self, field) is None for field in self.model_fields_set):
            raise ValueError("Updated profile fields cannot be null")
        return self


class PasswordUpdateRequest(BaseModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @model_validator(mode="after")
    def validate_password_change(self) -> "PasswordUpdateRequest":
        if self.current_password == self.new_password:
            raise ValueError("New password must be different from the current password")
        return self


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


class LoginRequest(BaseModel):
    email: str
    password: str
