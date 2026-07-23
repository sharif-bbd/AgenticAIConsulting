"""
Agent 3: Empathy & Synthesis Drafter
Writes the Introduction and "Our Understanding of the Situation" sections.
This is the most critical section — if the client doesn't feel understood, the deal is dead.
"""

from __future__ import annotations

import json
import os
import re

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from backend.state import AgentState, Phase
from backend.prompts.drafting_prompt import DRAFTING_SYSTEM, DRAFTING_USER, CRITIQUE_INJECTION
from backend.logger import push_log


def _get_model() -> ChatAnthropic:
    return ChatAnthropic(
        model=os.environ.get("OPUS_MODEL", "claude-opus-4-7"),
        max_tokens=8192,
        api_key=os.environ.get("ANTHROPIC_API_KEY"),
        max_retries=6,
    )


def _build_critique_section(state: AgentState) -> str:
    """Build the critique injection block if we're in a revision round."""
    history = state.get("critique_history", [])
    if not history:
        return ""
    latest = history[-1]
    scores = latest.get("scores", {})
    # Only include feedback relevant to drafting (understanding section)
    per_section = latest.get("per_section_feedback", {})
    critique_text = per_section.get("understanding", latest.get("overall_feedback", ""))
    return CRITIQUE_INJECTION.format(
        round=state.get("revision_count", 1),
        critique_text=critique_text,
        urgency_score=scores.get("urgency", "?"),
        empathy_score=scores.get("empathy", "?"),
        clarity_score=scores.get("clarity", "?"),
        differentiation_score=scores.get("differentiation", "?"),
        total_score=scores.get("total", "?"),
    )


def _extract_sections(text: str) -> tuple[str, str]:
    """Extract Introduction and Understanding sections from LLM output."""
    intro = ""
    understanding = ""

    # Try labeled sections
    intro_match = re.search(
        r"(?:INTRODUCTION|Introduction)[:\s]*([\s\S]*?)(?=(?:OUR UNDERSTANDING|Our Understanding|##|\Z))",
        text,
        re.IGNORECASE,
    )
    if intro_match:
        intro = intro_match.group(1).strip()

    understanding_match = re.search(
        r"(?:OUR UNDERSTANDING.*?SITUATION|Our Understanding.*?Situation)[:\s]*([\s\S]*?)(?=\Z|---|\*\*\*)",
        text,
        re.IGNORECASE,
    )
    if understanding_match:
        understanding = understanding_match.group(1).strip()

    # Fallback: split at the section boundary
    if not intro and not understanding:
        parts = re.split(r"(?:OUR UNDERSTANDING|Our Understanding)", text, maxsplit=1)
        if len(parts) == 2:
            intro = parts[0].strip()
            understanding = parts[1].strip()
        else:
            intro = text[:len(text)//3].strip()
            understanding = text[len(text)//3:].strip()

    return intro, understanding


def drafting_node(state: AgentState) -> dict:
    """
    Agent 3: Empathy Drafter node.
    Produces the Introduction and Understanding sections.
    On revision rounds, incorporates adversarial critique.
    """
    client_profile = state.get("client_profile", {})
    meeting_transcript = state.get("meeting_transcript", "")
    human_directives = state.get("human_directives", [])
    revision_count = state.get("revision_count", 0)

    critique_section = _build_critique_section(state)

    model = _get_model()
    user_content = DRAFTING_USER.format(
        client_profile=json.dumps(client_profile, indent=2),
        meeting_transcript=meeting_transcript,
        human_directives="\n".join(human_directives) if human_directives else "None.",
        critique_section=critique_section,
    )
    push_log("Agent 3 drafting introduction and situation understanding...")
    response = model.invoke([
        SystemMessage(content=DRAFTING_SYSTEM),
        HumanMessage(content=user_content),
    ])
    response_text = response.content

    # ── Usage Tracking ───────────────────────────────────────────────────────
    from backend.usage_utils import update_usage
    usage_updates = update_usage(state, response)

    intro, understanding = _extract_sections(response_text)

    # Merge into existing proposal_components
    existing = dict(state.get("proposal_components", {}))
    existing["intro"] = intro
    existing["understanding"] = understanding

    return {
        "proposal_components": existing,
        "revision_count": revision_count + 1 if critique_section else revision_count,
        "current_phase": Phase.DRAFTING,
        **usage_updates
    }
