from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app.core.supabase_admin import get_supabase_admin_client
from app.services.google_sheets_service import GoogleSheetsService


BATCH_SIZE = 100
SYNC_LOCK_LEASE_SECONDS = 900

SOURCE_FIELDS = [
    "full_name",
    "phone_number",
    "email",
    "area",
    "created_time",
    "platform",
    "meta_campaign_id",
    "meta_campaign_name",
    "ad_id",
    "ad_name",
    "adset_id",
    "adset_name",
    "form_id",
    "form_name",
    "source_status",
    "priority",
    "raw_data",
]


def clean_value(value: Any) -> str | None:
    if value is None:
        return None

    cleaned = str(value).strip()
    return cleaned if cleaned else None


def is_dummy_test_lead(row: dict) -> bool:
    for value in row.values():
        if value is not None and "<test lead:" in str(value).lower():
            return True

    email = clean_value(row.get("email"))

    return bool(
        email and email.strip().lower() == "test@meta.com"
    )


def parse_created_time(value: str | None) -> str | None:
    if not value:
        return None

    try:
        parsed = datetime.fromisoformat(
            value.replace("Z", "+00:00")
        )

        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)

        return parsed.isoformat()

    except ValueError:
        return None


def map_sheet_row(
    headers: list,
    values: list,
    campaign_id: str,
) -> dict | None:

    source = {
        str(header).strip(): (
            values[index] if index < len(values) else ""
        )
        for index, header in enumerate(headers)
    }

    if is_dummy_test_lead(source):
        return None

    source_lead_id = clean_value(source.get("id"))

    if not source_lead_id:
        return None

    phone = clean_value(source.get("phone_number"))

    if phone and phone.lower().startswith("p:"):
        phone = phone[2:].strip() or None

    email = clean_value(source.get("email"))

    return {
        "campaign_id": campaign_id,
        "source_lead_id": source_lead_id,
        "full_name": clean_value(source.get("full_name")),
        "phone_number": phone,
        "email": email,
        "area": clean_value(
            source.get(
                "which_area_do_you_need_the_cleaning_service_in?"
            )
        ),
        "created_time": parse_created_time(
            clean_value(source.get("created_time"))
        ),
        "platform": clean_value(source.get("platform")),
        "meta_campaign_id": clean_value(source.get("campaign_id")),
        "meta_campaign_name": clean_value(source.get("campaign_name")),
        "ad_id": clean_value(source.get("ad_id")),
        "ad_name": clean_value(source.get("ad_name")),
        "adset_id": clean_value(source.get("adset_id")),
        "adset_name": clean_value(source.get("adset_name")),
        "form_id": clean_value(source.get("form_id")),
        "form_name": clean_value(source.get("form_name")),
        "source_status": clean_value(source.get("lead_status")),
        "priority": clean_value(source.get("Priority")),
        "raw_data": source,
    }


class LeadSyncService:

    def __init__(self):
        self.db = get_supabase_admin_client()
        self.google = GoogleSheetsService()

    def _acquire_lock(
        self,
        campaign_id: str,
        lock_token: str,
    ) -> bool:

        response = self.db.rpc(
            "acquire_campaign_sync_lock",
            {
                "p_campaign_id": campaign_id,
                "p_lock_token": lock_token,
                "p_lease_seconds": SYNC_LOCK_LEASE_SECONDS,
            },
        ).execute()

        result = response.data

        if isinstance(result, list):
            return bool(result[0]) if result else False

        return bool(result)

    def _release_lock(
        self,
        campaign_id: str,
        lock_token: str,
    ) -> None:

        self.db.rpc(
            "release_campaign_sync_lock",
            {
                "p_campaign_id": campaign_id,
                "p_lock_token": lock_token,
            },
        ).execute()

    def _get_existing_ids(
        self,
        campaign_id: str,
        source_ids: list[str],
    ) -> set[str]:

        existing = set()

        for start in range(0, len(source_ids), BATCH_SIZE):
            batch = source_ids[start:start + BATCH_SIZE]

            response = (
                self.db.table("leads")
                .select("source_lead_id")
                .eq("campaign_id", campaign_id)
                .in_("source_lead_id", batch)
                .execute()
            )

            existing.update(
                row["source_lead_id"]
                for row in (response.data or [])
            )

        return existing

    def sync_campaign(
        self,
        campaign_id: str,
        trigger_type: str = "manual",
    ) -> dict:
        """Synchronize one campaign and record what triggered the run."""

        if trigger_type not in {"manual", "scheduled"}:
            raise ValueError(
                "trigger_type must be either 'manual' or 'scheduled'."
            )

        log_id = None
        created_count = 0
        updated_count = 0

        skipped_test_count = 0
        skipped_invalid_count = 0

        lock_token = str(uuid4())
        lock_acquired = False

        try:
            # 1. Retrieve and validate campaign.
            campaign_response = (
                self.db.table("campaigns")
                .select(
                    "id,name,status,sheet_url,spreadsheet_id,worksheet_gid"
                )
                .eq("id", campaign_id)
                .single()
                .execute()
            )

            campaign = campaign_response.data

            if not campaign:
                raise ValueError("Campaign was not found.")

            if campaign["status"] != "active":
                raise ValueError(
                    "Only active campaigns can be synchronized."
                )

            # 2. Acquire database-level campaign lock.
            lock_acquired = self._acquire_lock(
                campaign_id,
                lock_token,
            )

            if not lock_acquired:
                raise RuntimeError(
                    "A synchronization is already running for this campaign. "
                    "Please wait until it finishes before trying again."
                )

            # 3. Create sync log after acquiring the lock.
            log_response = (
                self.db.table("sync_logs")
                .insert({
                    "campaign_id": campaign_id,
                    "status": "running",
                    "trigger_type": trigger_type,
                    "created_count": 0,
                    "updated_count": 0,
                })
                .execute()
            )

            log_id = log_response.data[0]["id"]

            # 4. Validate Google Sheets URL.
            details = self.google.extract_spreadsheet_details(
                campaign["sheet_url"]
            )

            if details["spreadsheet_id"] != campaign["spreadsheet_id"]:
                raise ValueError(
                    "Campaign spreadsheet URL and stored spreadsheet ID do not match."
                )

            # 5. Retrieve spreadsheet metadata.
            metadata = self.google.get_spreadsheet_metadata(
                campaign["spreadsheet_id"]
            )

            worksheets = metadata.get("sheets", [])
            selected_gid = campaign.get("worksheet_gid")

            if selected_gid:
                worksheet = next(
                    (
                        item for item in worksheets
                        if str(item["properties"]["sheetId"])
                        == str(selected_gid)
                    ),
                    None,
                )
            else:
                worksheet = worksheets[0] if worksheets else None

            if worksheet is None:
                raise ValueError(
                    "The configured worksheet could not be found."
                )

            worksheet_name = worksheet["properties"]["title"]

            # 6. Fetch worksheet data.
            sheet_rows = self.google.get_worksheet_data(
                campaign["spreadsheet_id"],
                worksheet_name,
            )

            if not sheet_rows:
                raise ValueError("The selected worksheet is empty.")

            headers = [
                str(header).strip()
                for header in sheet_rows[0]
            ]

            required_headers = {
                "id",
                "full_name",
                "phone_number",
                "email",
                "created_time",
            }

            missing_headers = required_headers - set(headers)

            if missing_headers:
                raise ValueError(
                    "Missing required spreadsheet headers: "
                    + ", ".join(sorted(missing_headers))
                )

            # 7. Map and validate lead rows.
            mapped_leads = []

            for values in sheet_rows[1:]:
                source = {
                    headers[index]: (
                        values[index] if index < len(values) else ""
                    )
                    for index in range(len(headers))
                }

                if is_dummy_test_lead(source):
                    skipped_test_count += 1
                    continue

                mapped = map_sheet_row(
                    headers,
                    values,
                    campaign_id,
                )

                if mapped is None:
                    skipped_invalid_count += 1
                    continue

                mapped_leads.append(mapped)

            # Avoid duplicate source IDs within one worksheet.
            unique_leads = {}

            for lead in mapped_leads:
                unique_leads[lead["source_lead_id"]] = lead

            mapped_leads = list(unique_leads.values())

            source_ids = [
                lead["source_lead_id"]
                for lead in mapped_leads
            ]

            # 8. Identify existing leads.
            existing_ids = (
                self._get_existing_ids(campaign_id, source_ids)
                if source_ids
                else set()
            )

            created_count = sum(
                1 for source_id in source_ids
                if source_id not in existing_ids
            )

            updated_count = sum(
                1 for source_id in source_ids
                if source_id in existing_ids
            )

            # 9. Upsert source-owned fields only.
            for start in range(0, len(mapped_leads), BATCH_SIZE):
                batch = mapped_leads[start:start + BATCH_SIZE]

                self.db.table("leads").upsert(
                    batch,
                    on_conflict="campaign_id,source_lead_id",
                ).execute()

            # 10. Update campaign sync timestamp.
            completed_at = datetime.now(timezone.utc).isoformat()

            self.db.table("campaigns").update({
                "last_synced_at": completed_at,
                "updated_at": completed_at,
            }).eq("id", campaign_id).execute()

            # 11. Mark sync log successful.
            self.db.table("sync_logs").update({
                "status": "success",
                "created_count": created_count,
                "updated_count": updated_count,
                "error_message": None,
            }).eq("id", log_id).execute()

            return {
                "success": True,
                "campaign_id": campaign_id,
                "campaign_name": campaign["name"],
                "worksheet": worksheet_name,
                "total_sheet_data_rows": len(sheet_rows) - 1,
                "created_count": created_count,
                "updated_count": updated_count,
                "skipped_test_leads": skipped_test_count,
                "skipped_invalid_rows": skipped_invalid_count,
                "sync_log_id": log_id,
                "trigger_type": trigger_type,
            }

        except Exception as exc:

            if log_id:
                try:
                    self.db.table("sync_logs").update({
                        "status": "failed",
                        "created_count": created_count,
                        "updated_count": updated_count,
                        "error_message": str(exc)[:4000],
                    }).eq("id", log_id).execute()

                except Exception:
                    pass

            raise

        finally:

            # 12. Always release the lock after the sync attempt.
            if lock_acquired:
                try:
                    self._release_lock(
                        campaign_id,
                        lock_token,
                    )
                except Exception:
                    # The 15-minute lease provides a recovery fallback.
                    pass
