import re
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

from app.api.dependencies.auth import get_current_admin
from app.core.supabase_admin import get_supabase_admin_client


router = APIRouter(
    prefix="/api/admin/clients",
    tags=["Admin - Client Management"],
)


class CreateClientAccountRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=2, max_length=150)
    business_name: str = Field(min_length=2, max_length=200)
    joining_date: date
    location: str = Field(min_length=2, max_length=500)

    monthly_reels_commitment: int = Field(ge=0)
    monthly_posts_commitment: int = Field(ge=0)

    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)

    contact_number: str = Field(min_length=7, max_length=30)
    logo_url: Optional[str] = None


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
)
def create_client_account(
    payload: CreateClientAccountRequest,
    admin: dict = Depends(get_current_admin),
):
    """
    Create a client company and its linked Supabase login account.
    Only authenticated administrators can create client accounts.
    """

    name = payload.name.strip()
    business_name = payload.business_name.strip()
    location = payload.location.strip()
    email = payload.email.strip().lower()
    contact_number = payload.contact_number.strip()

    if len(name) < 2 or len(business_name) < 2:
        raise HTTPException(
            status_code=422,
            detail="Client name and business name are required.",
        )

    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(
            status_code=422,
            detail="Please provide a valid email address.",
        )

    if not contact_number:
        raise HTTPException(
            status_code=422,
            detail="Contact number is required.",
        )

    db = get_supabase_admin_client()

    client_id = None
    auth_user_id = None

    try:
        # 1. Create the client company.
        client_response = (
            db.table("clients")
            .insert({
                "name": name,
                "business_name": business_name,
                "joining_date": payload.joining_date.isoformat(),
                "location": location,
                "monthly_reels_commitment":
                    payload.monthly_reels_commitment,
                "monthly_posts_commitment":
                    payload.monthly_posts_commitment,
                "contact_number": contact_number,
                "logo_url": payload.logo_url,
            })
            .execute()
        )

        clients = client_response.data or []

        if not clients:
            raise RuntimeError(
                "Client creation returned no database record."
            )

        client = clients[0]
        client_id = client["id"]

        # 2. Create the Supabase Auth account.
        auth_response = db.auth.admin.create_user({
            "email": email,
            "password": payload.password,
            "email_confirm": True,
            "user_metadata": {
                "full_name": name,
            },
        })

        auth_user = auth_response.user

        if auth_user is None:
            raise RuntimeError(
                "Supabase did not return the created user."
            )

        auth_user_id = str(auth_user.id)

        # 3. Link the login account to the client company.
        (
            db.table("profiles")
            .insert({
                "id": auth_user_id,
                "full_name": name,
                "role": "client",
                "client_id": client_id,
            })
            .execute()
        )

        return {
            "message": "Client and login account created successfully.",
            "client": client,
            "login": {
                "user_id": auth_user_id,
                "email": email,
                "role": "client",
            },
        }

    except Exception as exc:

        # Roll back partially created records.
        if auth_user_id:
            try:
                db.auth.admin.delete_user(auth_user_id)
            except Exception:
                pass

        if client_id:
            try:
                (
                    db.table("clients")
                    .delete()
                    .eq("id", client_id)
                    .execute()
                )
            except Exception:
                pass

        error_text = str(exc).lower()

        if (
            "already been registered" in error_text
            or "already exists" in error_text
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists.",
            ) from exc

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Unable to create the client account. "
                "Please check the database before retrying."
            ),
        ) from exc