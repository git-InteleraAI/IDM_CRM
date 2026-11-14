import re
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app.core.config import settings


GOOGLE_SHEETS_SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets.readonly"
]


class GoogleSheetsError(Exception):
    """Raised when Google Sheets access or retrieval fails."""


class GoogleSheetsService:

    def __init__(self):
        credentials_path = Path(settings.GOOGLE_SERVICE_ACCOUNT_FILE)

        if not credentials_path.is_file():
            raise GoogleSheetsError(
                "Google service-account JSON file was not found."
            )

        try:
            credentials = service_account.Credentials.from_service_account_file(
                str(credentials_path),
                scopes=GOOGLE_SHEETS_SCOPES,
            )

            self.service_account_email = credentials.service_account_email

            self.client = build(
                "sheets",
                "v4",
                credentials=credentials,
                cache_discovery=False,
            )

        except Exception as exc:
            raise GoogleSheetsError(
                f"Google authentication failed: {exc}"
            ) from exc

    @staticmethod
    def extract_spreadsheet_details(sheet_url: str) -> dict:
        try:
            parsed_url = urlparse(sheet_url.strip())

            if parsed_url.scheme != "https":
                raise ValueError("Only HTTPS Google Sheets URLs are allowed.")

            if parsed_url.hostname not in {
                "docs.google.com",
                "www.docs.google.com",
            }:
                raise ValueError("This is not a valid Google Sheets URL.")

            match = re.search(
                r"/spreadsheets/d/([a-zA-Z0-9_-]+)",
                parsed_url.path,
            )

            if not match:
                raise ValueError("Spreadsheet ID could not be extracted.")

            query = parse_qs(parsed_url.query)

            return {
                "spreadsheet_id": match.group(1),
                "worksheet_gid": query.get("gid", [None])[0],
            }

        except ValueError:
            raise
        except Exception as exc:
            raise ValueError("Invalid Google Sheets URL.") from exc

    def get_spreadsheet_metadata(self, spreadsheet_id: str) -> dict:
        try:
            response = (
                self.client.spreadsheets()
                .get(
                    spreadsheetId=spreadsheet_id,
                    fields="spreadsheetId,properties(title),sheets(properties(sheetId,title,index,gridProperties(rowCount,columnCount)))",
                )
                .execute()
            )

            return response

        except HttpError as exc:
            status = exc.resp.status

            if status == 403:
                raise GoogleSheetsError(
                    "Access denied. Share this spreadsheet with the "
                    "Google service-account email as Viewer."
                ) from exc

            if status == 404:
                raise GoogleSheetsError(
                    "Spreadsheet not found. Check the spreadsheet URL."
                ) from exc

            raise GoogleSheetsError(
                f"Google Sheets API returned HTTP {status}."
            ) from exc

    def get_worksheet_data(
        self,
        spreadsheet_id: str,
        worksheet_name: str,
    ) -> list:
        try:
            response = (
                self.client.spreadsheets()
                .values()
                .get(
                    spreadsheetId=spreadsheet_id,
                    range=f"'{worksheet_name.replace(chr(39), chr(39) + chr(39))}'!A:ZZ",
                )
                .execute()
            )

            return response.get("values", [])

        except HttpError as exc:
            raise GoogleSheetsError(
                f"Could not read worksheet: {exc}"
            ) from exc

    def test_connection(self, sheet_url: str) -> dict:
        details = self.extract_spreadsheet_details(sheet_url)

        metadata = self.get_spreadsheet_metadata(
            details["spreadsheet_id"]
        )

        worksheets = [
            {
                "title": sheet["properties"]["title"],
                "gid": str(sheet["properties"]["sheetId"]),
                "index": sheet["properties"]["index"],
            }
            for sheet in metadata.get("sheets", [])
        ]

        selected_gid = details["worksheet_gid"]

        selected_worksheet = None

        if selected_gid is not None:
            selected_worksheet = next(
                (
                    sheet
                    for sheet in worksheets
                    if sheet["gid"] == selected_gid
                ),
                None,
            )

            if selected_worksheet is None:
                raise GoogleSheetsError(
                    f"Worksheet gid {selected_gid} was not found."
                )

        elif worksheets:
            selected_worksheet = worksheets[0]

        if selected_worksheet is None:
            raise GoogleSheetsError(
                "No worksheets were found in this spreadsheet."
            )

        rows = self.get_worksheet_data(
            details["spreadsheet_id"],
            selected_worksheet["title"],
        )

        headers = rows[0] if rows else []

        return {
            "success": True,
            "spreadsheet_title": metadata["properties"]["title"],
            "spreadsheet_id": details["spreadsheet_id"],
            "service_account_email": self.service_account_email,
            "worksheets": worksheets,
            "selected_worksheet": selected_worksheet["title"],
            "selected_gid": selected_worksheet["gid"],
            "total_rows_including_header": len(rows),
            "headers": headers,
            "sample_rows": rows[1:4],
        }