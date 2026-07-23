"""
Agent 6: Formatting & Output Engine
Polishes approved proposal components and renders the final PDF + Markdown.
"""

from __future__ import annotations

import json
import os
import re

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from backend.state import AgentState, Phase
from backend.prompts.output_prompt import OUTPUT_SYSTEM, OUTPUT_USER
from backend.tools.pdf_generator import generate_pdf, generate_markdown


def _get_model() -> ChatAnthropic:
    return ChatAnthropic(
        model=os.environ.get("SONNET_MODEL", "claude-sonnet-4-6"),
        max_tokens=8192,
        api_key=os.environ.get("ANTHROPIC_API_KEY"),
        max_retries=6,
    )


def _extract_final_sections(text: str) -> dict:
    """Extract the final polished sections from the output agent's response."""
    result = {}
    section_keys = {
        "FINAL_INTRO": "intro",
        "FINAL_UNDERSTANDING": "understanding",
        "FINAL_METHODOLOGY": "methodology",
        "FINAL_APPROACH": "approach",
        "FINAL_FEES": "fees",
        "FINAL_CONCLUSION": "conclusion",
    }

    for label, key in section_keys.items():
        pattern = rf"{label}:\s*([\s\S]*?)(?={'|'.join(section_keys.keys())}|\Z)"
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            result[key] = match.group(1).strip()

    return result


def output_node(state: AgentState) -> dict:
    """
    Agent 6: Output Engine node.
    1. Polishes the approved proposal draft (light editing, no strategy changes)
    2. Generates Markdown file
    3. Generates PDF file
    """
    client_profile = state.get("client_profile", {})
    proposal_components = dict(state.get("proposal_components", {}))
    human_directives = state.get("human_directives", [])

    # Generate a session ID from the state (use a hash of company + timestamp)
    company = client_profile.get("company_name", "client")
    import hashlib
    import time
    session_id = hashlib.md5(f"{company}{time.time()}".encode()).hexdigest()

    # Polish with LLM
    model = _get_model()
    user_content = OUTPUT_USER.format(
        intro=proposal_components.get("intro", "[Missing]"),
        understanding=proposal_components.get("understanding", "[Missing]"),
        methodology=proposal_components.get("methodology", "[Missing]"),
        approach=proposal_components.get("approach", "[Missing]"),
        fees=proposal_components.get("fees", "[Missing]"),
        conclusion=proposal_components.get("conclusion", ""),
        client_profile=json.dumps(client_profile, indent=2),
        human_directives="\n".join(human_directives) if human_directives else "None.",
    )

    response = model.invoke([
        SystemMessage(content=OUTPUT_SYSTEM),
        HumanMessage(content=user_content),
    ])
    response_text = response.content

    # ── Usage Tracking ───────────────────────────────────────────────────────
    from backend.usage_utils import update_usage
    usage_updates = update_usage(state, response)

    polished_sections = _extract_final_sections(response_text)

    # Merge polished sections back (only override if we got content)
    for key, content in polished_sections.items():
        if content:
            proposal_components[key] = content

    # Generate output files
    md_path = None
    pdf_path = None

    try:
        md_path = generate_markdown(proposal_components, client_profile, session_id)
    except Exception as e:
        print(f"Markdown generation failed: {e}")

    try:
        pdf_path = generate_pdf(proposal_components, client_profile, session_id)
    except Exception as e:
        print(f"PDF generation failed (WeasyPrint): {e}")
        print("Markdown version is available.")

    # Store output paths in client_profile for retrieval
    output_info = {
        "session_id": session_id,
        "markdown_path": str(md_path) if md_path else None,
        "pdf_path": str(pdf_path) if pdf_path else None,
    }
    updated_profile = {**client_profile, "_output": output_info}

    return {
        "proposal_components": proposal_components,
        "client_profile": updated_profile,
        "current_phase": Phase.COMPLETE,
        **usage_updates
    }
