from datetime import date, datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field

from app.api.dependencies.auth import get_current_user
from app.core.supabase_admin import get_supabase_admin_client


router = APIRouter(
    prefix="/api/client-portal",
    tags=["Client Portal"],
)


RESPONSE_VALUES = {
    "not_contacted",
    "interested",
    "not_interested",
    "call_back_required",
    "no_response",
    "invalid_contact",
    "converted",
}


class LeadUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    workflow_status: Literal["pending", "followed_up", "completed"] | None = None
    call_done_date: date | None = None
    response: str | None = Field(default=None, max_length=30)
    comments: str | None = Field(default=None, max_length=5000)


class ReminderCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reminder_at: datetime
    note: str | None = Field(default=None, max_length=1000)


def _require_client(user: dict) -> str:
    if user.get("role") != "client" or not user.get("client_id"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Client portal access is required.",
        )
    return user["client_id"]


def _get_client_campaign(db, client_id: str, campaign_id: str):
    result = (
        db.table("campaigns")
        .select("id,client_id,name,status,created_at,last_synced_at")
        .eq("id", campaign_id)
        .eq("client_id", client_id)
        .limit(1)
        .execute()
    )

    campaigns = result.data or []
    if not campaigns:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign was not found.",
        )

    return campaigns[0]


def _get_client_lead(db, client_id: str, lead_id: str):
    result = (
        db.table("leads")
        .select(
            "id,campaign_id,full_name,phone_number,email,area,"
            "created_time,platform,meta_campaign_name,ad_name,"
            "source_status,priority,workflow_status,call_done_date,"
            "response,comments,reviewed_at,created_at,updated_at"
        )
        .eq("id", lead_id)
        .limit(1)
        .execute()
    )

    leads = result.data or []
    if not leads:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead was not found.",
        )

    lead = leads[0]
    _get_client_campaign(db, client_id, lead["campaign_id"])
    return lead


def _client_campaigns(db, client_id: str):
    result = (
        db.table("campaigns")
        .select("id,name,status,created_at,last_synced_at")
        .eq("client_id", client_id)
        .in_("status", ["active", "completed"])
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


@router.get("/dashboard")
def get_client_dashboard(
    current_user: dict = Depends(get_current_user),
):
    client_id = _require_client(current_user)
    db = get_supabase_admin_client()

    try:
        campaigns = _client_campaigns(db, client_id)
        campaign_ids = [item["id"] for item in campaigns]

        stats = {
            "total_campaigns": len(campaigns),
            "active_campaigns": sum(
                1 for item in campaigns if item["status"] == "active"
            ),
            "completed_campaigns": sum(
                1 for item in campaigns if item["status"] == "completed"
            ),
            "total_leads": 0,
            "total_pending": 0,
            "total_followed_up": 0,
            "total_completed": 0,
            "new_leads": 0,
        }

        if campaign_ids:
            result = (
                db.table("leads")
                .select("id,workflow_status,reviewed_at")
                .in_("campaign_id", campaign_ids)
                .execute()
            )
            leads = result.data or []

            stats["total_leads"] = len(leads)
            stats["total_pending"] = sum(
                1 for lead in leads
                if lead.get("workflow_status") == "pending"
            )
            stats["total_followed_up"] = sum(
                1 for lead in leads
                if lead.get("workflow_status") == "followed_up"
            )
            stats["total_completed"] = sum(
                1 for lead in leads
                if lead.get("workflow_status") == "completed"
            )
            stats["new_leads"] = sum(
                1 for lead in leads if lead.get("reviewed_at") is None
            )

        return {
            "client_id": client_id,
            "client_name": current_user.get("email"),
            "stats": stats,
        }

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Unable to load the client dashboard.",
        )


@router.get("/campaigns")
def list_client_campaigns(
    current_user: dict = Depends(get_current_user),
):
    client_id = _require_client(current_user)
    db = get_supabase_admin_client()

    try:
        campaigns = _client_campaigns(db, client_id)
        campaign_ids = [item["id"] for item in campaigns]

        counts = {}
        if campaign_ids:
            result = (
                db.table("leads")
                .select("campaign_id,workflow_status,reviewed_at")
                .in_("campaign_id", campaign_ids)
                .execute()
            )

            for lead in result.data or []:
                campaign_id = lead["campaign_id"]
                item = counts.setdefault(
                    campaign_id,
                    {
                        "total_leads": 0,
                        "new_leads": 0,
                        "pending": 0,
                        "followed_up": 0,
                        "completed": 0,
                    },
                )
                item["total_leads"] += 1

                if lead.get("reviewed_at") is None:
                    item["new_leads"] += 1

                workflow = lead.get("workflow_status", "pending")
                if workflow in item:
                    item[workflow] += 1

        for campaign in campaigns:
            campaign["lead_stats"] = counts.get(
                campaign["id"],
                {
                    "total_leads": 0,
                    "new_leads": 0,
                    "pending": 0,
                    "followed_up": 0,
                    "completed": 0,
                },
            )

        return {"campaigns": campaigns}

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve campaigns.",
        )


@router.get("/campaigns/{campaign_id}/leads")
def list_campaign_leads(
    campaign_id: str,
    search: str | None = Query(default=None, max_length=100),
    workflow_status: Literal["pending", "followed_up", "completed"] | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    client_id = _require_client(current_user)
    db = get_supabase_admin_client()

    try:
        campaign = _get_client_campaign(db, client_id, campaign_id)

        query = (
            db.table("leads")
            .select(
                "id,campaign_id,full_name,phone_number,email,area,"
                "created_time,workflow_status,call_done_date,response,"
                "comments,reviewed_at,created_at,updated_at",
                count="exact",
            )
            .eq("campaign_id", campaign_id)
        )

        if workflow_status:
            query = query.eq("workflow_status", workflow_status)

        if search and search.strip():
            term = (
                search.strip()[:100]
                .replace("%", "")
                .replace("_", "")
                .replace(",", " ")
                .replace("(", " ")
                .replace(")", " ")
            )
            if term:
                pattern = f"%{term}%"
                query = query.or_(
                    f"full_name.ilike.{pattern},"
                    f"phone_number.ilike.{pattern},"
                    f"email.ilike.{pattern}"
                )

        start = (page - 1) * page_size
        result = (
            query.order("created_at", desc=True)
            .range(start, start + page_size - 1)
            .execute()
        )

        return {
            "campaign": campaign,
            "leads": result.data or [],
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": result.count or 0,
                "total_pages": (
                    (result.count + page_size - 1) // page_size
                    if result.count else 0
                ),
            },
        }

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve campaign leads.",
        )


@router.get("/leads/{lead_id}")
def get_client_lead(
    lead_id: str,
    current_user: dict = Depends(get_current_user),
):
    client_id = _require_client(current_user)
    db = get_supabase_admin_client()

    try:
        lead = _get_client_lead(db, client_id, lead_id)

        activities_result = (
            db.table("lead_activities")
            .select("id,activity_type,description,created_by,created_at")
            .eq("lead_id", lead_id)
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )

        reminders_result = (
            db.table("reminders")
            .select(
                "id,assigned_user,reminder_at,note,status,created_at,updated_at"
            )
            .eq("lead_id", lead_id)
            .order("reminder_at", desc=False)
            .execute()
        )

        return {
            "lead": lead,
            "activities": activities_result.data or [],
            "reminders": reminders_result.data or [],
        }

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve lead details.",
        )


@router.patch("/leads/{lead_id}")
def update_client_lead(
    lead_id: str,
    payload: LeadUpdate,
    current_user: dict = Depends(get_current_user),
):
    client_id = _require_client(current_user)
    db = get_supabase_admin_client()

    try:
        lead = _get_client_lead(db, client_id, lead_id)
        changes = payload.model_dump(mode="json", exclude_unset=True)

        if not changes:
            raise HTTPException(
                status_code=400,
                detail="No lead changes were provided.",
            )

        if "response" in changes:
            response_value = changes["response"]
            if response_value is not None and response_value not in RESPONSE_VALUES:
                raise HTTPException(
                    status_code=422,
                    detail="Invalid lead response value.",
                )

        changes["reviewed_at"] = datetime.now(timezone.utc).isoformat()

        (
            db.table("leads")
            .update(changes)
            .eq("id", lead_id)
            .execute()
        )

        activity_parts = [
            f"{key}: {value if value is not None else 'cleared'}"
            for key, value in changes.items()
            if key != "reviewed_at"
        ]

        if activity_parts:
            (
                db.table("lead_activities")
                .insert({
                    "lead_id": lead_id,
                    "activity_type": "client_update",
                    "description": "; ".join(activity_parts),
                    "created_by": current_user["id"],
                })
                .execute()
            )

        updated_lead = _get_client_lead(db, client_id, lead_id)
        return {"message": "Lead updated successfully.", "lead": updated_lead}

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Unable to update this lead.",
        )


@router.post("/leads/{lead_id}/reminders", status_code=201)
def create_lead_reminder(
    lead_id: str,
    payload: ReminderCreate,
    current_user: dict = Depends(get_current_user),
):
    client_id = _require_client(current_user)
    db = get_supabase_admin_client()

    try:
        _get_client_lead(db, client_id, lead_id)

        reminder_time = payload.reminder_at
        if reminder_time.tzinfo is None:
            raise HTTPException(
                status_code=422,
                detail="Reminder time must include a timezone.",
            )

        result = (
            db.table("reminders")
            .insert({
                "lead_id": lead_id,
                "assigned_user": current_user["id"],
                "reminder_at": reminder_time.isoformat(),
                "note": payload.note,
                "status": "pending",
            })
            .execute()
        )

        return {
            "message": "Reminder created successfully.",
            "reminder": (result.data or [None])[0],
        }

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Unable to create this reminder.",
        )