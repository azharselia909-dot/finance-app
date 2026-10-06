from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.api.dependencies import DbSession, get_current_user
from app.core.security import create_access_token, password_hash
from app.models import User
from app.schemas import LoginRequest, TokenResponse, UserCreate, UserResponse, UserUpdate

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(user: UserCreate, db: DbSession) -> TokenResponse:
    if db.query(User).filter(User.email == user.email).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    if db.query(User).filter(User.username == user.username.strip()).first():
        raise HTTPException(status_code=409, detail="This username is already in use")

    db_user = User(
        username=user.username.strip(),
        designation=user.designation.strip(),
        mobile_number=user.mobile_number.strip(),
        email=user.email,
        hashed_password=password_hash.hash(user.password),
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return {
        "access_token": create_access_token(db_user.id),
        "token_type": "bearer",
        "user": db_user,
    }


@router.post("/login", response_model=TokenResponse)
async def login(credentials: LoginRequest, db: DbSession) -> TokenResponse:
    user = db.query(User).filter(User.email == credentials.email.strip().lower()).first()
    if user is None or not password_hash.verify(credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return {"access_token": create_access_token(user.id), "token_type": "bearer", "user": user}


@router.get("/me", response_model=UserResponse)
async def read_current_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserResponse:
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_current_user(
    update: UserUpdate,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserResponse:
    changes = update.model_dump(exclude_unset=True)

    if "email" in changes and db.query(User).filter(
        User.email == changes["email"],
        User.id != current_user.id,
    ).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )
    if "username" in changes:
        changes["username"] = changes["username"].strip()
        if db.query(User).filter(
            User.username == changes["username"],
            User.id != current_user.id,
        ).first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This username is already in use",
            )
    for field in ("designation", "mobile_number"):
        if field in changes:
            changes[field] = changes[field].strip()

    for field, value in changes.items():
        setattr(current_user, field, value)

    try:
        db.commit()
        db.refresh(current_user)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email or username is already in use",
        ) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Profile could not be updated",
        ) from exc

    return current_user
