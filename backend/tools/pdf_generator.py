"""
PDF generation tool using WeasyPrint.
Converts structured proposal components into a professional consulting PDF.
"""

from __future__ import annotations

import os
from datetime import date
from pathlib import Path

import markdown


OUTPUTS_DIR = Path(__file__).parent.parent.parent / "outputs"
OUTPUTS_DIR.mkdir(exist_ok=True)


PROPOSAL_CSS = """
@page {
    size: A4;
    margin: 2.5cm 2.8cm;
    @bottom-center {
        content: "CONFIDENTIAL — " string(company) " — Page " counter(page) " of " counter(pages);
        font-size: 8pt;
        color: #888;
    }
}

body {
    font-family: "Georgia", "Times New Roman", serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #1a1a1a;
}

.header {
    border-bottom: 2px solid #1a1a1a;
    padding-bottom: 12px;
    margin-bottom: 24px;
}

.firm-name {
    font-size: 14pt;
    font-weight: bold;
    letter-spacing: 0.5px;
}

.confidential-notice {
    font-size: 8pt;
    color: #666;
    margin-top: 4px;
}

h1 {
    font-size: 16pt;
    font-weight: bold;
    margin-top: 0;
    margin-bottom: 6px;
}

h2 {
    font-size: 12pt;
    font-weight: bold;
    margin-top: 28px;
    margin-bottom: 8px;
    border-bottom: 1px solid #ccc;
    padding-bottom: 4px;
}

h3 {
    font-size: 11pt;
    font-weight: bold;
    margin-top: 16px;
    margin-bottom: 4px;
}

p {
    margin: 0 0 10px 0;
    text-align: justify;
}

ul, ol {
    margin: 8px 0 12px 0;
    padding-left: 24px;
}

li {
    margin-bottom: 4px;
}

.section {
    margin-bottom: 20px;
}

.meta-line {
    font-size: 9pt;
    color: #666;
    margin-bottom: 20px;
}

table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    font-size: 10pt;
    page-break-inside: auto;
}

tr {
    page-break-inside: avoid;
    page-break-after: auto;
}

thead {
    display: table-header-group;
}

tfoot {
    display: table-footer-group;
}

th {
    background-color: #f0f0f0;
    border: 1px solid #ccc;
    padding: 6px 8px;
    text-align: left;
    font-weight: bold;
}

td {
    border: 1px solid #ccc;
    padding: 5px 8px;
    vertical-align: top;
}

.footer-note {
    font-size: 8pt;
    color: #888;
    margin-top: 32px;
    border-top: 1px solid #ddd;
    padding-top: 8px;
}
"""


def _build_html(
    proposal_components: dict,
    client_profile: dict,
    session_id: str,
) -> str:
    """Build the full HTML document from proposal components."""
    company = client_profile.get("company_name", "Client")
    today = date.today().strftime("%B %d, %Y")
    city = client_profile.get("city", "Zurich")

    sections_html = []

    def md_to_html(text: str) -> str:
        if not text:
            return ""
        return markdown.markdown(text, extensions=["tables", "nl2br"])

    # ── Header ────────────────────────────────────────────────────────────────
    sections_html.append(f"""
    <div class="header">
        <div class="firm-name">Marc Brandis Strategic Consulting</div>
        <div class="confidential-notice">
            CONFIDENTIAL — This document is solely for the use of {company} personnel.
            No part may be circulated or reproduced without prior written consent.
        </div>
    </div>
    """)

    # ── Title ─────────────────────────────────────────────────────────────────
    engagement_title = client_profile.get("engagement_title", "Strategic Consulting Proposal")
    sections_html.append(f"""
    <h1>{engagement_title}</h1>
    <div class="meta-line">
        Letter of Proposal &nbsp;·&nbsp; {city}, {today}
    </div>
    """)

    # ── Intro ─────────────────────────────────────────────────────────────────
    if proposal_components.get("intro"):
        sections_html.append(f"""
        <div class="section">
            <h2>Introduction</h2>
            {md_to_html(proposal_components["intro"])}
        </div>
        """)

    # ── Understanding ─────────────────────────────────────────────────────────
    if proposal_components.get("understanding"):
        sections_html.append(f"""
        <div class="section">
            <h2>Our Understanding of the Situation</h2>
            {md_to_html(proposal_components["understanding"])}
        </div>
        """)

    # ── Methodology ───────────────────────────────────────────────────────────
    if proposal_components.get("methodology"):
        sections_html.append(f"""
        <div class="section">
            <h2>Methodology and Deliverables</h2>
            {md_to_html(proposal_components["methodology"])}
        </div>
        """)

    # ── Approach ─────────────────────────────────────────────────────────────
    if proposal_components.get("approach"):
        sections_html.append(f"""
        <div class="section">
            <h2>Potential Approach, Timeline, and Team</h2>
            {md_to_html(proposal_components["approach"])}
        </div>
        """)

    # ── Fees ─────────────────────────────────────────────────────────────────
    if proposal_components.get("fees"):
        sections_html.append(f"""
        <div class="section">
            <h2>Estimated Efforts and Professional Fees</h2>
            {md_to_html(proposal_components["fees"])}
        </div>
        """)

    # ── Footer ────────────────────────────────────────────────────────────────
    sections_html.append(f"""
    <div class="footer-note">
        *&nbsp;&nbsp;&nbsp;&nbsp;*&nbsp;&nbsp;&nbsp;&nbsp;*<br><br>
        We would be pleased to support you on this engagement.
        Please do not hesitate to contact Dr. Marc Brandis with any questions.
    </div>
    """)

    body = "\n".join(sections_html)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>
        {PROPOSAL_CSS}
    </style>
</head>
<body>
    {body}
</body>
</html>"""


def generate_pdf(
    proposal_components: dict,
    client_profile: dict,
    session_id: str,
) -> Path:
    """
    Generate a PDF from the proposal components.

    Returns:
        Path to the generated PDF file.
    """
    try:
        import weasyprint
    except ImportError:
        raise ImportError("WeasyPrint is required for PDF generation. Run: pip install weasyprint")

    html_content = _build_html(proposal_components, client_profile, session_id)

    company = client_profile.get("company_name", "client").replace(" ", "_").lower()
    pdf_filename = f"proposal_{company}_{session_id[:8]}.pdf"
    pdf_path = OUTPUTS_DIR / pdf_filename

    html_doc = weasyprint.HTML(string=html_content, base_url=str(OUTPUTS_DIR))
    html_doc.write_pdf(str(pdf_path))

    return pdf_path


def generate_markdown(
    proposal_components: dict,
    client_profile: dict,
    session_id: str,
) -> Path:
    """
    Generate a Markdown version of the proposal (faster preview, no WeasyPrint needed).

    Returns:
        Path to the generated markdown file.
    """
    company = client_profile.get("company_name", "Client")
    today = date.today().strftime("%B %d, %Y")
    engagement_title = client_profile.get("engagement_title", "Strategic Consulting Proposal")

    lines = [
        f"# {engagement_title}",
        f"**CONFIDENTIAL** — {company} — {today}",
        "",
        "---",
        "",
    ]

    section_map = [
        ("intro", "Introduction"),
        ("understanding", "Our Understanding of the Situation"),
        ("methodology", "Methodology and Deliverables"),
        ("approach", "Potential Approach, Timeline, and Team"),
        ("fees", "Estimated Efforts and Professional Fees"),
    ]

    for key, title in section_map:
        content = proposal_components.get(key, "")
        if content:
            lines.append(f"## {title}")
            lines.append("")
            lines.append(content)
            lines.append("")
            lines.append("---")
            lines.append("")

    lines += [
        "*     *     *",
        "",
        "We would be pleased to support you on this engagement.",
        "Please do not hesitate to contact Dr. Marc Brandis with any questions.",
    ]

    company_slug = company.replace(" ", "_").lower()
    md_filename = f"proposal_{company_slug}_{session_id[:8]}.md"
    md_path = OUTPUTS_DIR / md_filename
    md_path.write_text("\n".join(lines), encoding="utf-8")

    return md_path
