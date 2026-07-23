"""
Agent 4: Framework Customizer & Methodology Architect
Selects and customizes consulting frameworks, designs concrete deliverables,
approach/timeline, and fees estimate.
"""

from __future__ import annotations

import json
import os
import re

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from backend.state import AgentState, Phase
from backend.prompts.framework_prompt import FRAMEWORK_SYSTEM, FRAMEWORK_USER, CRITIQUE_INJECTION
from backend.tools.rag_retrieval import retrieve_frameworks, format_retrieved_chunks_for_prompt
from backend.logger import push_log


def _get_model() -> ChatAnthropic:
    return ChatAnthropic(
        model=os.environ.get("OPUS_MODEL", "claude-opus-4-7"),
        max_tokens=8192,
        api_key=os.environ.get("ANTHROPIC_API_KEY"),
        max_retries=6,
    )


def _build_critique_section(state: AgentState) -> str:
    """Build critique injection for methodology/approach sections."""
    history = state.get("critique_history", [])
    if not history:
        return ""
    latest = history[-1]
    scores = latest.get("scores", {})
    per_section = latest.get("per_section_feedback", {})
    # Combine methodology and approach feedback
    methodology_critique = per_section.get("methodology", "")
    approach_critique = per_section.get("approach", "")
    critique_text = f"Methodology: {methodology_critique}\n\nApproach: {approach_critique}"
    return CRITIQUE_INJECTION.format(
        round=state.get("revision_count", 1),
        critique_text=critique_text,
        urgency_score=scores.get("urgency", "?"),
        empathy_score=scores.get("empathy", "?"),
        clarity_score=scores.get("clarity", "?"),
        differentiation_score=scores.get("differentiation", "?"),
    )


def _extract_sections(text: str) -> tuple[str, str, str, str, list[str]]:
    """Extract methodology, approach, fees sections and framework list from LLM output."""
    methodology = ""
    approach = ""
    fees = ""
    conclusion = ""
    selected_frameworks = []

    # Extract SELECTED_FRAMEWORKS line
    fw_match = re.search(r"SELECTED_FRAMEWORKS:\s*(.+)", text, re.IGNORECASE)
    if fw_match:
        selected_frameworks = [f.strip() for f in fw_match.group(1).split(",")]

    # Extract sections using header patterns
    section_patterns = [
        ("methodology", r"\[\[METHODOLOGY\]\][:\s]*([\s\S]*?)(?=(?:\[\[APPROACH\]\]|\[\[FEES\]\]|\[\[CONCLUSION\]\]|\[\[END_OF_PROPOSAL\]\]|SELECTED_FRAMEWORKS|\Z))"),
        ("approach", r"\[\[APPROACH\]\][:\s]*([\s\S]*?)(?=(?:\[\[FEES\]\]|\[\[CONCLUSION\]\]|\[\[END_OF_PROPOSAL\]\]|SELECTED_FRAMEWORKS|\Z))"),
        ("fees", r"\[\[FEES\]\][:\s]*([\s\S]*?)(?=(?:\[\[CONCLUSION\]\]|\[\[END_OF_PROPOSAL\]\]|SELECTED_FRAMEWORKS|\Z))"),
        ("conclusion", r"\[\[CONCLUSION\]\][:\s]*([\s\S]*?)(?=(?:\[\[END_OF_PROPOSAL\]\]|SELECTED_FRAMEWORKS|\Z))"),
    ]

    for key, pattern in section_patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if match:
            content = match.group(1).strip()
            # Remove SELECTED_FRAMEWORKS line if it leaked in
            content = re.sub(r"SELECTED_FRAMEWORKS:.*", "", content).strip()
            if key == "methodology":
                methodology = content
            elif key == "approach":
                approach = content
            elif key == "fees":
                fees = content
            elif key == "conclusion":
                conclusion = content

    # Fallback: split text into thirds
    if not methodology and not approach and not fees:
        third = len(text) // 3
        methodology = text[:third].strip()
        approach = text[third:2*third].strip()
        fees = text[2*third:].strip()

    return methodology, approach, fees, conclusion, selected_frameworks


def framework_node(state: AgentState) -> dict:
    """
    Agent 4: Framework Customizer node.
    Designs the Methodology, Approach, and Fees sections.
    """
    client_profile = state.get("client_profile", {})
    proposal_components = state.get("proposal_components", {})
    understanding = proposal_components.get("understanding", "")
    human_directives = state.get("human_directives", [])

    # RAG: retrieve relevant frameworks
    problem_description = (
        client_profile.get("problem_domain", "")
        + " "
        + client_profile.get("industry", "")
        + " "
        + (understanding[:300] if understanding else "")
    )
    try:
        push_log("Consulting knowledge base for methodology frameworks...")
        chunks = retrieve_frameworks(problem_description, n_results=6)
        rag_context = format_retrieved_chunks_for_prompt(chunks)
    except Exception as e:
        rag_context = f"[Knowledge base unavailable: {e}. Proceed without RAG context.]"

    critique_section = _build_critique_section(state)

    estimates_lines = []
    if state.get("timeline_estimate"):
        estimates_lines.append(f"Timeline Estimate: {state['timeline_estimate']}")
    if state.get("fee_estimate"):
        estimates_lines.append(f"Fee Estimate: {state['fee_estimate']}")
    estimates_section = "\n".join(estimates_lines) if estimates_lines else "None provided. Generate standard placeholders."

    meeting_transcript = state.get("meeting_transcript", "")

    model = _get_model()
    user_content = FRAMEWORK_USER.format(
        client_profile=json.dumps(client_profile, indent=2),
        meeting_transcript=meeting_transcript if meeting_transcript else "[No meeting transcript provided.]",
        understanding_section=understanding,
        rag_context=rag_context,
        human_directives="\n".join(human_directives) if human_directives else "None.",
        estimates_section=estimates_section,
        critique_section=critique_section,
    )
    push_log("Agent 4 architecting customized methodology and delivery model...")
    response = model.invoke([
        SystemMessage(content=FRAMEWORK_SYSTEM),
        HumanMessage(content=user_content),
    ])
    response_text = response.content

    # ── Usage Tracking ───────────────────────────────────────────────────────
    from backend.usage_utils import update_usage
    usage_updates = update_usage(state, response, search_count=1) # Counting RAG as 1 search

    methodology, approach, fees, conclusion, selected_frameworks = _extract_sections(response_text)

    # Merge into existing proposal_components
    existing = dict(proposal_components)
    existing["methodology"] = methodology
    existing["approach"] = approach
    existing["fees"] = fees
    existing["conclusion"] = conclusion

    return {
        "proposal_components": existing,
        "selected_frameworks": selected_frameworks,
        "current_phase": Phase.CRITIQUING,
        **usage_updates
    }
