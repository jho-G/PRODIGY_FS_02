"""Service for generating styled Excel (.xlsx) and CSV exports."""

import csv
import io

from django.http import HttpResponse
from django.utils import timezone
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter


def export_dataset_response(
    headers: list,
    rows: list,
    filename_prefix: str = "export",
    export_format: str = "csv",
    sheet_title: str = "Data",
) -> HttpResponse:
    """Generate a streamed HTTP response for CSV or Excel (.xlsx) file download.

    :param headers: List of string column header titles
    :param rows: List of row sequences (lists or tuples)
    :param filename_prefix: Base filename without extension or timestamp
    :param export_format: 'xlsx' or 'csv' (defaults to 'csv')
    :param sheet_title: Sheet name inside the Excel workbook
    :return: Django HttpResponse with proper content-type and disposition
    """
    timestamp = timezone.now().strftime("%Y%m%d_%H%M%S")
    clean_format = export_format.lower().strip()

    if clean_format in ["xlsx", "excel"]:
        wb = Workbook()
        ws = wb.active
        ws.title = sheet_title[:31]  # Excel sheet title limit is 31 chars
        ws.views.sheetView[0].showGridLines = True

        # Styles matching modern professional look
        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        header_fill = PatternFill(
            start_color="1A1A1A", end_color="1A1A1A", fill_type="solid"
        )
        header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)

        row_font = Font(name="Calibri", size=10, color="111111")
        zebra_fill = PatternFill(
            start_color="F9F9F9", end_color="F9F9F9", fill_type="solid"
        )
        white_fill = PatternFill(
            start_color="FFFFFF", end_color="FFFFFF", fill_type="solid"
        )

        thin_border = Border(
            left=Side(style="thin", color="E0E0E0"),
            right=Side(style="thin", color="E0E0E0"),
            top=Side(style="thin", color="E0E0E0"),
            bottom=Side(style="thin", color="E0E0E0"),
        )

        # Write header
        ws.append(headers)
        ws.row_dimensions[1].height = 26

        for col_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=1, column=col_idx)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_align
            cell.border = thin_border

        # Write rows
        for row_idx, row_data in enumerate(rows, start=2):
            ws.append(row_data)
            ws.row_dimensions[row_idx].height = 20
            is_even = row_idx % 2 == 0

            for col_idx in range(1, len(headers) + 1):
                cell = ws.cell(row=row_idx, column=col_idx)
                cell.font = row_font
                cell.fill = zebra_fill if is_even else white_fill
                cell.border = thin_border
                cell.alignment = Alignment(vertical="center")

        # Auto-adjust column widths
        for col_idx, col in enumerate(ws.columns, start=1):
            max_len = 0
            for cell in col:
                val_str = str(cell.value or "")
                if len(val_str) > max_len:
                    max_len = len(val_str)
            col_letter = get_column_letter(col_idx)
            ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)

        filename = f"{filename_prefix}_{timestamp}.xlsx"
        response = HttpResponse(
            buffer.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response

    # Default: CSV format
    filename = f"{filename_prefix}_{timestamp}.csv"
    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'

    # Add UTF-8 BOM so Excel opens CSV without encoding issues
    response.write("\ufeff")

    writer = csv.writer(response)
    writer.writerow(headers)
    for row in rows:
        writer.writerow(row)

    return response
