from app.services.lead_sync_service import LeadSyncService


def main():
    print("\n======================================")
    print(" INTELERA - MANUAL LEAD SYNCHRONIZATION")
    print("======================================\n")

    campaign_id = input(
        "Enter the Supabase campaign UUID: "
    ).strip()

    if not campaign_id:
        print("ERROR: Campaign ID is required.")
        return

    confirm = input(
        "\nStart synchronization for this campaign? (yes/no): "
    ).strip().lower()

    if confirm != "yes":
        print("Synchronization cancelled.")
        return

    try:
        service = LeadSyncService()
        result = service.sync_campaign(campaign_id)

        print("\n======================================")
        print(" SYNCHRONIZATION COMPLETED")
        print("======================================")

        for key, value in result.items():
            print(f"{key}: {value}")

    except Exception as exc:
        print("\n======================================")
        print(" SYNCHRONIZATION FAILED")
        print("======================================")
        print(type(exc).__name__, str(exc))


if __name__ == "__main__":
    main()