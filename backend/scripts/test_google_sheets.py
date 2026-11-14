from pprint import pprint

from app.services.google_sheets_service import (
    GoogleSheetsService,
    GoogleSheetsError,
)


def main():
    print("\n======================================")
    print(" INTELERA - GOOGLE SHEETS CONNECTION")
    print("======================================\n")

    sheet_url = input(
        "Paste your shared Google Sheets URL: "
    ).strip()

    if not sheet_url:
        print("ERROR: Spreadsheet URL is required.")
        return

    try:
        sheets = GoogleSheetsService()

        print("\nAuthenticating with Google...")
        print("Service account:", sheets.service_account_email)

        print("\nChecking spreadsheet access...")

        result = sheets.test_connection(sheet_url)

        print("\nSUCCESS: Google Sheets connection established!")

        print("\nSpreadsheet details:")
        pprint(result)

        print("\n======================================")
        print(" GOOGLE SHEETS TEST PASSED")
        print("======================================")

    except (GoogleSheetsError, ValueError) as exc:
        print("\nGOOGLE SHEETS ERROR:")
        print(exc)

    except Exception as exc:
        print("\nUNEXPECTED ERROR:")
        print(type(exc).__name__, str(exc))


if __name__ == "__main__":
    main()