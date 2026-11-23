"""Service to generate professional, branded PDF payslips using ReportLab."""

import io
from datetime import date

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


def generate_payslip_pdf(payslip) -> bytes:
    """Generate a clean, high-resolution PDF payslip document.

    :param payslip: employees.models.Payslip instance
    :return: bytes representing the generated PDF document
    """
    buffer = io.BytesIO()

    # Setup document with 0.5-inch margins
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()

    # Custom typography styles
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=colors.black,
        alignment=0,
    )

    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#555555"),
        alignment=0,
    )

    badge_style = ParagraphStyle(
        "BadgeText",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=13,
        textColor=colors.black,
        alignment=2,
    )

    section_heading = ParagraphStyle(
        "SectionHeading",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=colors.black,
    )

    cell_bold = ParagraphStyle(
        "CellBold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        textColor=colors.black,
    )

    cell_normal = ParagraphStyle(
        "CellNormal",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#333333"),
    )

    cell_amount = ParagraphStyle(
        "CellAmount",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=colors.black,
        alignment=2,
    )

    cell_amount_bold = ParagraphStyle(
        "CellAmountBold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=13,
        textColor=colors.black,
        alignment=2,
    )

    story = []

    # 1. Header (Company Info + Document Badge)
    header_data = [
        [
            Paragraph("<b>EMPLOYEE MANAGEMENT SYSTEM</b>", title_style),
            Paragraph("<b>OFFICIAL PAYSLIP</b>", badge_style),
        ],
        [
            Paragraph(
                "Enterprise Human Resources & Payroll Division<br/>"
                "Confidential Earnings Statement",
                subtitle_style,
            ),
            Paragraph(
                f"<b>Period:</b> {date(payslip.period_year, payslip.period_month, 1).strftime('%B %Y')}<br/>"
                f"<b>Currency:</b> {payslip.currency}",
                ParagraphStyle("SubBadge", parent=subtitle_style, alignment=2),
            ),
        ],
    ]
    header_table = Table(header_data, colWidths=[3.8 * inch, 3.7 * inch])
    header_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(header_table)
    story.append(Spacer(1, 10))
    story.append(
        HRFlowable(
            width="100%",
            thickness=1.5,
            color=colors.black,
            spaceBefore=2,
            spaceAfter=14,
        )
    )

    # 2. Employee & Pay Details Matrix
    emp = payslip.employee
    dept_name = emp.department.name if emp.department else "General / Unassigned"
    emp_details = [
        [
            Paragraph("<b>Employee Name:</b>", cell_bold),
            Paragraph(f"{emp.first_name} {emp.last_name}", cell_normal),
            Paragraph("<b>Pay Period:</b>", cell_bold),
            Paragraph(f"{payslip.period_year}-{payslip.period_month:02d}", cell_normal),
        ],
        [
            Paragraph("<b>Employee ID:</b>", cell_bold),
            Paragraph(emp.employee_id, cell_normal),
            Paragraph("<b>Issued Date:</b>", cell_bold),
            Paragraph(payslip.generated_at.strftime("%Y-%m-%d"), cell_normal),
        ],
        [
            Paragraph("<b>Department:</b>", cell_bold),
            Paragraph(dept_name, cell_normal),
            Paragraph("<b>Job Title / Role:</b>", cell_bold),
            Paragraph(emp.position or "Staff", cell_normal),
        ],
        [
            Paragraph("<b>Email:</b>", cell_bold),
            Paragraph(emp.email, cell_normal),
            Paragraph("<b>Employment Status:</b>", cell_bold),
            Paragraph(emp.get_employment_status_display(), cell_normal),
        ],
    ]
    emp_table = Table(
        emp_details, colWidths=[1.4 * inch, 2.35 * inch, 1.4 * inch, 2.35 * inch]
    )
    emp_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F9F9F9")),
                ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#E5E5E5")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#EEEEEE")),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(emp_table)
    story.append(Spacer(1, 16))

    # 3. Itemized Earnings & Deductions Breakdown
    story.append(Paragraph("EARNINGS & DEDUCTIONS BREAKDOWN", section_heading))
    story.append(Spacer(1, 6))

    curr = payslip.currency or "USD"
    breakdown_data = [
        [
            Paragraph("<b>Earnings Category</b>", cell_bold),
            Paragraph("<b>Amount</b>", cell_amount_bold),
            Paragraph("<b>Deductions Category</b>", cell_bold),
            Paragraph("<b>Amount</b>", cell_amount_bold),
        ],
        [
            Paragraph("Basic Base Salary", cell_normal),
            Paragraph(f"{curr} {payslip.basic_salary:,.2f}", cell_amount),
            Paragraph("Tax Withholding (Income Tax)", cell_normal),
            Paragraph(f"{curr} {payslip.tax_deduction:,.2f}", cell_amount),
        ],
        [
            Paragraph("Allowances (Housing / Transport)", cell_normal),
            Paragraph(f"{curr} {payslip.allowances:,.2f}", cell_amount),
            Paragraph("Other Deductions (Benefits / Advances)", cell_normal),
            Paragraph(f"{curr} {payslip.other_deductions:,.2f}", cell_amount),
        ],
        [
            Paragraph("Performance Bonus / Incentives", cell_normal),
            Paragraph(f"{curr} {payslip.bonus:,.2f}", cell_amount),
            Paragraph("—", cell_normal),
            Paragraph(f"{curr} 0.00", cell_amount),
        ],
        [
            Paragraph("<b>Gross Earnings</b>", cell_bold),
            Paragraph(f"<b>{curr} {payslip.gross_pay:,.2f}</b>", cell_amount_bold),
            Paragraph("<b>Total Deductions</b>", cell_bold),
            Paragraph(
                f"<b>{curr} {payslip.total_deductions:,.2f}</b>", cell_amount_bold
            ),
        ],
    ]

    breakdown_table = Table(
        breakdown_data,
        colWidths=[2.35 * inch, 1.4 * inch, 2.35 * inch, 1.4 * inch],
    )
    breakdown_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EAEAEA")),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#F0F0F0")),
                ("LINEBELOW", (0, 0), (-1, 0), 1, colors.black),
                ("LINEABOVE", (0, -1), (-1, -1), 1, colors.black),
                ("BOX", (0, 0), (-1, -1), 0.75, colors.black),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#DDDDDD")),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(breakdown_table)
    story.append(Spacer(1, 16))

    # 4. Net Take-Home Pay Highlight Card
    net_pay_data = [
        [
            Paragraph("<b>NET TAKE-HOME PAY</b>", title_style),
            Paragraph(
                f"<b>{curr} {payslip.net_pay:,.2f}</b>",
                ParagraphStyle(
                    "NetPayNum",
                    parent=title_style,
                    fontSize=20,
                    leading=24,
                    alignment=2,
                ),
            ),
        ]
    ]
    net_pay_table = Table(net_pay_data, colWidths=[3.75 * inch, 3.75 * inch])
    net_pay_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#111111")),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.white),
                ("TOPPADDING", (0, 0), (-1, -1), 12),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
                ("LEFTPADDING", (0, 0), (-1, -1), 14),
                ("RIGHTPADDING", (0, 0), (-1, -1), 14),
            ]
        )
    )
    story.append(net_pay_table)
    story.append(Spacer(1, 14))

    # 5. Notes & Remarks (if provided)
    if payslip.notes:
        story.append(Paragraph("<b>Remarks & Notes:</b>", section_heading))
        story.append(Spacer(1, 4))
        story.append(Paragraph(payslip.notes, cell_normal))
        story.append(Spacer(1, 14))

    # 6. Signatures and Disclaimers
    story.append(Spacer(1, 20))
    sig_data = [
        [
            Paragraph(
                "____________________________<br/>Employee Signature", cell_normal
            ),
            Paragraph(
                "____________________________<br/>Authorized HR Officer", cell_amount
            ),
        ]
    ]
    sig_table = Table(sig_data, colWidths=[3.75 * inch, 3.75 * inch])
    sig_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(sig_table)
    story.append(Spacer(1, 20))

    disclaimer = Paragraph(
        "<i>This official payroll statement is generated by the Employee Management System. "
        "Any questions or discrepancies should be directed to the Human Resources & Payroll department "
        "within 5 business days of issue.</i>",
        subtitle_style,
    )
    story.append(disclaimer)

    doc.build(story)
    pdf_value = buffer.getvalue()
    buffer.close()
    return pdf_value
