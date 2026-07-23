"""
Document extractor: converts uploaded PDF or DOCX files into plain text.

Supports:
  - PDF  → via pymupdf (fitz): fast, pure-Python, no external binaries
  - DOCX → via python-docx: reads paragraphs and table cells

Returns a plain str of the extracted text.
Raises ValueError with a user-friendly message on failure (empty doc,
password-protected PDF, unsupported format, etc.)
"""

from __future__ import annotations

import io
from pathlib import Path
from typing import BinaryIO

# ── PDF extraction ────────────────────────────────────────────────────────────

def _extract_pdf(data: bytes) -> tuple[str, int]:
    """
    Extract text from a PDF byte stream using pymupdf.

    Returns:
        (extracted_text, page_count)
    Raises:
        ImportError  if pymupdf is not installed
        ValueError   if the PDF is encrypted, empty, or has no extractable text
    """
    try:
        import fitz  # pymupdf
    except ImportError as exc:
        raise ImportError(
            "pymupdf is required for PDF extraction. Install it with: pip install pymupdf"
        ) from exc

    doc = fitz.open(stream=data, filetype="pdf")

    if doc.is_encrypted:
        raise ValueError(
            "This PDF is password-protected. Please remove the password before uploading."
        )

    page_count = doc.page_count
    pages_text: list[str] = []

    for page in doc:
        text = page.get_text("text").strip()
        if text:
            pages_text.append(text)

    doc.close()

    if not pages_text:
        raise ValueError(
            "No extractable text found in the PDF. "
            "It may be a scanned image PDF — try copy-pasting the text manually instead."
        )

    full_text = "\n\n".join(pages_text)
    return full_text, page_count


# ── DOCX extraction ───────────────────────────────────────────────────────────

def _extract_docx(data: bytes) -> tuple[str, None]:
    """
    Extract text from a DOCX byte stream using python-docx.
    Reads paragraphs and all table cells.

    Returns:
        (extracted_text, None)   — page_count is not available for DOCX
    Raises:
        ImportError  if python-docx is not installed
        ValueError   if the document has no readable content
    """
    try:
        from docx import Document  # python-docx
    except ImportError as exc:
        raise ImportError(
            "python-docx is required for DOCX extraction. Install it with: pip install python-docx"
        ) from exc

    doc = Document(io.BytesIO(data))
    chunks: list[str] = []

    # Paragraphs
    for para in doc.paragraphs:
        text = para.text.strip()
        if text:
            chunks.append(text)

    # Table cells
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                text = cell.text.strip()
                if text and text not in chunks:
                    chunks.append(text)

    if not chunks:
        raise ValueError("No readable text found in the DOCX file.")

    return "\n\n".join(chunks), None


# ── Public interface ──────────────────────────────────────────────────────────

def extract_text_from_upload(
    file_data: bytes,
    filename: str,
) -> tuple[str, int | None]:
    """
    Extract plain text from an uploaded PDF or DOCX file.

    Args:
        file_data: Raw bytes of the uploaded file.
        filename:  Original filename (used to determine file type).

    Returns:
        (extracted_text, page_count)
        page_count is an int for PDFs, None for DOCX.

    Raises:
        ValueError:   On unsupported format, empty document, or encrypted PDF.
        ImportError:  If a required extraction library is missing.
    """
    suffix = Path(filename).suffix.lower()

    if suffix == ".pdf":
        return _extract_pdf(file_data)
    elif suffix in (".docx", ".doc"):
        if suffix == ".doc":
            raise ValueError(
                "Legacy .doc files (Word 97–2003) are not supported. "
                "Please save as .docx and re-upload."
            )
        return _extract_docx(file_data)
    else:
        raise ValueError(
            f"Unsupported file type: '{suffix}'. Please upload a PDF (.pdf) or Word document (.docx)."
        )


def has_pdf_support() -> bool:
    """Return True if pymupdf is installed."""
    try:
        import fitz  # noqa: F401
        return True
    except ImportError:
        return False


def has_docx_support() -> bool:
    """Return True if python-docx is installed."""
    try:
        from docx import Document  # noqa: F401
        return True
    except ImportError:
        return False
