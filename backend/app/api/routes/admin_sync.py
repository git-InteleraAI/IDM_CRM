from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies.auth import get_current_admin
from app.core.supabase_admin import get_supabase_admin_client
from app.services.lead_sync_service import LeadSyncService


router = APIRouter(
    prefix="/api/admin/campaigns",
    tags=["Admin - Campaign Synchronization"],
)


@router.post("/{campaign_id}/sync")
def manually_sync_campaign(
    campaign_id: str,
    admin: dict = Depends(get_current_admin),
):
    """
    Trigger Google Sheets synchronization for an active campaign.
    Admin access is required.
    """

    try:
        service = LeadSyncService()
        result = service.sync_campaign(campaign_id, trigger_type="manual")

        return result

    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Campaign synchronization failed. Check the sync logs.",
        )


@router.get("/{campaign_id}/sync-logs")
def get_campaign_sync_logs(
    campaign_id: str,
    admin: dict = Depends(get_current_admin),
):
    """
    Retrieve the latest 20 synchronization records for a campaign.
    Admin access is required.
    """

    db = get_supabase_admin_client()

    try:
        campaign_response = (
            db.table("campaigns")
            .select("id,name")
            .eq("id", campaign_id)
            .limit(1)
            .execute()
        )

        campaigns = campaign_response.data or []

        if not campaigns:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Campaign was not found.",
            )

        logs_response = (
            db.table("sync_logs")
            .select(
                "id,campaign_id,status,created_count,updated_count,"
                "error_message,started_at,completed_at,trigger_type"
            )
            .eq("campaign_id", campaign_id)
            .order("started_at", desc=True)
            .limit(20)
            .execute()
        )

        return {
            "campaign_id": campaign_id,
            "campaign_name": campaigns[0]["name"],
            "logs": logs_response.data or [],
        }

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to retrieve campaign synchronization history.",
        )