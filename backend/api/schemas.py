"""
Pydantic request/response schemas for the FastAPI backend.
"""

from typing import Optional
from pydantic import BaseModel, Field


class UploadBriefResponse(BaseModel):
    """Response from POST /session/upload-brief — extracted text ready for review."""
    filename: str
    extracted_text: str = Field(description="Plain text extracted from the uploaded file.")
    char_count: int = Field(description="Character count of the extracted text.")
    page_count: Optional[int] = Field(
        default=None,
        description="Number of pages (PDF only; None for DOCX).",
    )
    warning: Optional[str] = Field(
        default=None,
        description="Optional warning, e.g. 'Scanned PDF — text quality may be limited'.",
    )


class StartSessionRequest(BaseModel):
    """Start a new proposal generation session with a fuzzy client brief."""
    client_inputs: list[str] = Field(
        ...,
        description="One or more text inputs: emails, briefs, meeting notes from the client.",
        min_length=1,
    )


class StartSessionResponse(BaseModel):
    session_id: str
    message: str
    current_phase: str


class SessionStateResponse(BaseModel):
    session_id: str
    current_phase: str
    client_profile: Optional[dict] = None
    probing_questions: Optional[list[str]] = None
    question_answers: Optional[dict] = None
    proposal_components: Optional[dict] = None
    quality_score: Optional[float] = None
    revision_count: Optional[int] = None
    critique_history: Optional[list[dict]] = None
    selected_frameworks: Optional[list[str]] = None
    hitl_interrupt_data: Optional[dict] = None  # Data from the current HITL interrupt
    output_ready: bool = False
    pdf_path: Optional[str] = None
    markdown_path: Optional[str] = None
    total_tokens: int = 0
    total_cost: float = 0.0
    last_error: Optional[str] = None


class SubmitTranscriptRequest(BaseModel):
    """Resume after HITL #1: provide the meeting transcript and optional directives."""
    meeting_transcript: str = Field(
        ...,
        description="Full text of the client meeting transcript or consultant notes.",
        min_length=5,
    )
    human_directives: list[str] = Field(
        default_factory=list,
        description="Optional strategic overrides (e.g., 'Client is mainly worried about board optics').",
    )
    updated_questions: Optional[list[str]] = Field(
        default=None,
        description="Optional: revised probing questions (if consultant edited them).",
    )
    timeline_estimate: Optional[str] = Field(
        default=None,
        description="Optional timeline estimate for the proposal (e.g. '3 months', '8 weeks').",
    )
    fee_estimate: Optional[str] = Field(
        default=None,
        description="Optional fee estimate for the proposal (e.g. 'CHF 150,000', '100k-120k').",
    )


class ApproveDraftRequest(BaseModel):
    """Resume after HITL #2: approve the draft with optional edits."""
    proposal_overrides: Optional[dict] = Field(
        default=None,
        description="Optional section overrides: {intro, understanding, methodology, approach, fees}",
    )
    human_directives: list[str] = Field(
        default_factory=list,
        description="Final strategic overrides (tone adjustments, actual fee numbers, team names).",
    )


class InjectDirectiveRequest(BaseModel):
    """Inject a human directive into the current state at any point."""
    directive: str = Field(
        ...,
        description="A strategic instruction for the agents (e.g., 'Emphasise the AI regulatory deadline').",
    )


class InjectDirectiveResponse(BaseModel):
    session_id: str
    message: str
    directives_count: int


class RefineQuestionsRequest(BaseModel):
    """Request to regenerate probing questions with a consultant refinement directive."""
    refinement_directive: str = Field(
        ...,
        description="What the consultant wants to change, e.g. 'Add more questions on budget ownership and internal champions'.",
        min_length=5,
    )


class RefineQuestionsResponse(BaseModel):
    session_id: str
    probing_questions: list[str]
    question_answers: dict
    refinement_count: int
    message: str


class JumpPhaseRequest(BaseModel):
    """Request to force the workflow state to jump to a specific phase."""
    target_phase: str = Field(..., description="The Phase enum string to jump to.")

class JumpPhaseResponse(BaseModel):
    session_id: str
    current_phase: str
    message: str
