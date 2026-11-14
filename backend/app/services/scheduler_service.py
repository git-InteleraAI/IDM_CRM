import logging
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler

from app.core.supabase_admin import get_supabase_admin_client
from app.services.lead_sync_service import LeadSyncService


logger = logging.getLogger("uvicorn.error")

SCHEDULER_POLL_SECONDS = 60


def parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None

    try:
        parsed = datetime.fromisoformat(
            value.replace("Z", "+00:00")
        )

        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)

        return parsed

    except (ValueError, TypeError):
        logger.exception("Invalid campaign timestamp: %s", value)
        return None


def run_due_campaign_syncs():
    """
    Find active campaigns whose configured sync interval has elapsed
    and synchronize them independently of browser sessions.
    """

    logger.info("Checking campaigns due for synchronization.")

    try:
        db = get_supabase_admin_client()

        response = (
            db.table("campaigns")
            .select(
                "id,name,status,last_synced_at,created_at,"
                "sync_interval_minutes"
            )
            .eq("status", "active")
            .execute()
        )

        campaigns = response.data or []

    except Exception:
        logger.exception("Unable to retrieve active campaigns.")
        return

    now = datetime.now(timezone.utc)

    for campaign in campaigns:

        campaign_id = campaign["id"]
        campaign_name = campaign["name"]

        try:
            interval_minutes = int(
                campaign["sync_interval_minutes"]
            )

            if interval_minutes < 1:
                logger.warning(
                    "Invalid sync interval for campaign %s",
                    campaign_name,
                )
                continue

            # Use the last successful sync timestamp.
            # For a campaign never synchronized, use its creation time.
            reference_timestamp = (
                campaign.get("last_synced_at")
                or campaign.get("created_at")
            )

            last_sync_time = parse_timestamp(reference_timestamp)

            if last_sync_time is None:
                logger.warning(
                    "No valid sync reference time for campaign %s",
                    campaign_name,
                )
                continue

            elapsed_seconds = (
                now - last_sync_time
            ).total_seconds()

            required_seconds = interval_minutes * 60

            if elapsed_seconds < required_seconds:
                continue

            logger.info(
                "Campaign %s is due for synchronization.",
                campaign_name,
            )

            service = LeadSyncService()

            result = service.sync_campaign(campaign_id, trigger_type="scheduled")

            logger.info(
                "Campaign %s synchronized successfully. "
                "Created: %s, Updated: %s",
                campaign_name,
                result["created_count"],
                result["updated_count"],
            )

        except RuntimeError as exc:
            # Another sync may already hold the campaign lock.
            logger.warning(
                "Sync skipped for campaign %s: %s",
                campaign_name,
                exc,
            )

        except Exception:
            logger.exception(
                "Automatic synchronization failed for campaign %s.",
                campaign_name,
            )


scheduler = BackgroundScheduler(timezone="UTC")


def start_scheduler():
    if scheduler.running:
        logger.info("Automatic synchronization scheduler is already running.")
        return

    scheduler.add_job(
        run_due_campaign_syncs,
        trigger="interval",
        seconds=SCHEDULER_POLL_SECONDS,
        id="campaign_auto_sync",
        name="Automatic Campaign Synchronization",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=30,
    )

    scheduler.start()

    logger.info(
        "Automatic synchronization scheduler started. "
        "Polling interval: %s seconds.",
        SCHEDULER_POLL_SECONDS,
    )


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Automatic synchronization scheduler stopped.")
