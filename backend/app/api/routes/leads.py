import re

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.dependencies.auth import get_current_user
from app.core.supabase_admin import get_supabase_admin_client


router = APIRouter(
    prefix="/api/leads",
    tags=["Lead Management"],
)

LEAD_LIST_FIELDS = (
    "id,campaign_id,source_lead_id,full_name,phone_number,email,area,"
    "created_time,platform,meta_campaign_id,meta_campaign_name,ad_id,"
    "ad_name,adset_id,adset_name,form_id,form_name,source_status,priority,"
    "call_done_date,response,comments,reviewed_at,created_at,updated_at"
)

LEAD_DETAIL_FIELDS = LEAD_LIST_FIELDS + ",raw_data"


def _safe_search_term(value: str) -> str:
    """Normalize search text before placing it in a PostgREST filter."""
    # Keep search input short and remove PostgREST expression delimiters.
    cleaned = value.strip()[:100]
    cleaned = re.sub(r"[,()]", " ", cleaned)
    cleaned = cleaned.replace("%", "").replace("_", r"\_")
    return cleaned.strip()


def _campaign_ids_for_client(db, client_id: str) -> list[str]:
    response = (
        db.table("campaigns")
        .select("id")
        .eq("client_id", client_id)
        .execute()
    )
    return [row["id"] for row in (response.data or [])]


def _apply_search(query, search_term: str):
    term = _safe_search_term(search_term)
    if not term:
        return query

    # The search string is length-limited and stripped of PostgREST
    # expression delimiters above.
    pattern = f"%{term}%"
    return query.or_(
        f"full_name.ilike.{pattern},"
        f"phone_number.ilike.{pattern},"
        f"email.ilike.{pattern}"
    )


@router.get("")
def list_leads(
    search: str | None = Query(default=None, max_length=100),
    campaign_id: str | None = Query(default=None),
    client_id: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    """List leads within the authenticated user's permitted campaign scope."""
    db = get_supabase_admin_client()

    try:
        effective_client_id = None

        if current_user["role"] == "client":
            effective_client_id = current_user["client_id"]
        elif client_id:
            effective_client_id = client_id

        if effective_client_id:
            campaign_ids = _campaign_ids_for_client(db, effective_client_id)
            if not campaign_ids:
                return {
                    "items": [],
                    "page": page,
                    "page_size": page_size,
                    "total": 0,
                    "total_pages": 0,
                }

            if campaign_id and campaign_id not in campaign_ids:
                # Do not reveal whether a campaign belonging to another
                # client exists.
                if current_user["role"] == "client":
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Campaign was not found.",
                    )
                return {
                    "items": [],
                    "page": page,
                    "page_size": page_size,
                    "total": 0,
                    "total_pages": 0,
                }

        query = (
            db.table("leads")
            .select(LEAD_LIST_FIELDS, count="exact")
            .order("created_time", desc=True)
            .order("id", desc=True)
        )

        if effective_client_id:
            if campaign_id:
                query = query.eq("campaign_id", campaign_id)
            else:
                query = query.in_("campaign_id", campaign_ids)
        elif campaign_id:
            query = query.eq("campaign_id", campaign_id)

        if search and search.strip():
            query = _apply_search(query, search)

        start = (page - 1) * page_size
        response = query.range(start, start + page_size - 1).execute()

        total = response.count or 0
        return {
            "items": response.data or [],
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": (total + page_size - 1) // page_size,
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to retrieve leads. Please try again.",
        ) from exc


@router.get("/{lead_id}")
def get_lead(
    lead_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Return one lead, enforcing client ownership before returning details."""
    db = get_supabase_admin_client()

    try:
        response = (
            db.table("leads")
            .select(LEAD_DETAIL_FIELDS)
            .eq("id", lead_id)
            .limit(1)
            .execute()
        )
        leads = response.data or []

        if not leads:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lead was not found.",
            )

        lead = leads[0]

        if current_user["role"] == "client":
            campaign_response = (
                db.table("campaigns")
                .select("id")
                .eq("id", lead["campaign_id"])
                .eq("client_id", current_user["client_id"])
                .limit(1)
                .execute()
            )
            if not campaign_response.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Lead was not found.",
                )

        return lead

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to retrieve lead details. Please try again.",
        ) from exc