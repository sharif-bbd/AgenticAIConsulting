"""
Central state schema for the Agentic Business Proposal system.
All agents read from and write to this shared state object.
"""

from enum import Enum
from typing import Annotated, Any
from typing_extensions import TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class Phase(str, Enum):
    INTAKE = "INTAKE"
    RESEARCH = "RESEARCH"
    QUESTION_GEN = "QUESTION_GEN"
    HITL_1 = "HITL_1"          # Waiting for meeting transcript
    DRAFTING = "DRAFTING"
    CRITIQUING = "CRITIQUING"
    HITL_2 = "HITL_2"          # Waiting for human approval of draft
    OUTPUT = "OUTPUT"
    COMPLETE = "COMPLETE"
    CANCELLED = "CANCELLED"
    FAILED = "FAILED"          # Unrecoverable error during graph execution


class ProposalComponents(TypedDict, total=False):
    intro: str                  # Letter introduction / context paragraph
    understanding: str          # "Our Understanding of the Situation" — most critical
    methodology: str            # Methodology & deliverables section
    approach: str               # Approach, timeline & team section
    fees: str                   # Estimated efforts and professional fees
    conclusion: str             # Final closing Statement & Next Steps


class AgentState(TypedDict):
    # ── Raw inputs ──────────────────────────────────────────────────────────
    raw_client_inputs: list[str]        # Emails, briefs, fuzzy requests (list for multi-doc support)
    meeting_transcript: str             # Uploaded by consultant after first client meeting

    # ── Built by Agent 1: Research Engine ───────────────────────────────────
    client_profile: dict[str, Any]      # company, industry, key_people, competitors, financials
    briefing_dossier: str               # Synthesized research narrative (3–5 paragraphs)

    # ── Built by Agent 2: Discovery Prep ────────────────────────────────────
    probing_questions: list[str]        # Ordered list of 8–12 questions for first meeting
    question_answers: dict              # Maps question → web-sourced answer (or "Requires meeting")

    # ── Built by Agents 3 & 4: Drafting + Framework ─────────────────────────
    proposal_components: ProposalComponents
    selected_frameworks: list[str]      # e.g. ["SWOT (customized)", "Issue Tree"]
    timeline_estimate: str | None       # Optional provided timeline estimate
    fee_estimate: str | None            # Optional provided fee estimate

    # ── Adversarial loop — Agent 5 ──────────────────────────────────────────
    critique_history: list[dict]        # Each: {round, scores, per_section_feedback, overall_feedback}
    quality_score: float                # 0.0–1.0 composite; threshold 0.80 to exit loop
    revision_count: int                 # Incremented each time Agents 3+4 revise; capped at 3

    # ── Human interaction ────────────────────────────────────────────────────
    human_directives: list[str]         # Explicit overrides injected at any HITL checkpoint

    # ── Workflow tracking ────────────────────────────────────────────────────
    # Stored as str (not Phase enum) to avoid msgpack serialization warnings in SQLite checkpointer.
    # Use Phase.VALUE or "VALUE" string — Phase is a str enum so both work interchangeably.
    current_phase: str

    # ── Usage & Cost ─────────────────────────────────────────────────────────
    total_tokens: int                   # Cumulative count
    total_cost: float                   # Cumulative USD cost
    is_cancelled: bool                  # User-requested cancellation flip

    # ── Error tracking ───────────────────────────────────────────────────────
    last_error: str | None              # Populated when current_phase=FAILED

    # ── Conversation messages (LangGraph managed) ────────────────────────────
    messages: Annotated[list[BaseMessage], add_messages]
