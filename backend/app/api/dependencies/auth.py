from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.supabase_admin import get_supabase_admin_client


bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
):
    """Validate the Supabase token and return the user's database profile."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    db = get_supabase_admin_client()

    try:
        auth_response = db.auth.get_user(credentials.credentials)
        user = auth_response.user

        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token.",
            )

        profile_response = (
            db.table("profiles")
            .select("id,role,client_id")
            .eq("id", str(user.id))
            .limit(1)
            .execute()
        )
        profiles = profile_response.data or []

        if not profiles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User profile was not found.",
            )

        profile = profiles[0]
        role = profile.get("role")
        client_id = profile.get("client_id")

        if role not in ("admin", "client"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User role is not permitted.",
            )

        if role == "client" and not client_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Client profile is missing its client assignment.",
            )

        return {
            "id": str(user.id),
            "email": user.email,
            "role": role,
            "client_id": str(client_id) if client_id else None,
        }

    except HTTPException:
        raise
    except Exception as exc:
        # Keep provider/database internals out of the API response.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def get_current_admin(
    current_user: dict = Depends(get_current_user),
):
    """Require an authenticated administrator."""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access is required.",
        )

    return current_user