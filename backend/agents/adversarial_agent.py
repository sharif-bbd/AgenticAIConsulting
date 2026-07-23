"""
Agent 5: Adversarial Reviewer (The Sparring Partner)
Evaluates the draft proposal from the perspective of a skeptical client executive.
Scores 4 dimensions and generates actionable critique for revision loops.
This is Marc's core requirement — AI as sparring partner, not just text generator.
"""

from __future__ import annotations

import json
import os
import re

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from backend.state import AgentState, Phase
from backend.prompts.adversarial_prompt import ADVERSARIAL_SYSTEM, ADVERSARIAL_USER
from backend.logger import push_log


def _get_model() -> ChatAnthropic:
    return ChatAnthropic(
        # Opus for sharper adversarial reasoning on dense evaluations
        model=os.environ.get("OPUS_MODEL", "claude-opus-4-7"),
        max_tokens=4000,
        api_key=os.environ.get("ANTHROPIC_API_KEY"),
        max_retries=6,
    )


def _determine_executive_role(client_profile: dict) -> str:
    """Infer the likely decision-maker role from client profile context."""
    industry = client_profile.get("industry", "").lower()
    problem_domain = client_profile.get("problem_domain", "").lower()

    if any(kw in problem_domain for kw in ["it", "digital", "technology", "ai", "data"]):
        return "CTO / Head of IT"
    if any(kw in problem_domain for kw in ["cost", "efficiency", "finance", "budget"]):
        return "CFO"
    if any(kw in problem_domain for kw in ["strategy", "market", "growth", "competitive"]):
        return "CEO / CSO"
    if any(kw in problem_domain for kw in ["operations", "process", "supply", "logistics"]):
        return "COO"
    return "CEO"


def _parse_evaluation(text: str) -> dict:
    """
    Parse the JSON evaluation from the adversarial agent's response.
    Includes robust fallbacks for truncated or malformed JSON.
    """
    # 1. Standard attempt: JSON block in backticks
    json_match = re.search(r"```json\s*([\s\S]*?)\s*```", text)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass

    # 2. Raw JSON object attempt
    json_match = re.search(r"\{[\s\S]*\}", text)
    if json_match:
        try:
            return json.loads(json_match.group(0))
        except json.JSONDecodeError:
            pass

    # 3. Resilient Fallback: Regex extraction for individual fields
    push_log("⚠ Adversarial response malformed. Initializing resilient recovery...")
    
    scores = {}
    for dim in ["urgency", "empathy", "clarity", "differentiation", "total"]:
        match = re.search(rf'"{dim}":\s*(\d+)', text, re.IGNORECASE)
        if match:
            scores[dim] = int(match.group(1))
    
    if not scores:
        scores = {"urgency": 15, "empathy": 15, "clarity": 15, "differentiation": 15, "total": 60}

    # Extract feedback sections via regex (handles truncated quotes)
    section_patterns = {
        "understanding": r'"understanding":\s*"([^"]*)',
        "methodology": r'"methodology":\s*"([^"]*)',
        "approach": r'"approach":\s*"([^"]*)',
        "fees": r'"fees":\s*"([^"]*)',
    }
    
    per_section = {}
    for key, pattern in section_patterns.items():
        match = re.search(pattern, text)
        per_section[key] = match.group(1).strip() if match else "Review raw response for details."

    # Top 3 Issues
    issues = []
    issues_match = re.search(r'"top_3_issues":\s*\[([\s\S]*?)\]', text)
    if issues_match:
        issues_raw = issues_match.group(1)
        # Regex to find full quoted strings, ignoring commas inside them
        issues = re.findall(r'"([^"]*)"', issues_raw)
        if not issues:
            issues = re.findall(r"'([^']*)'", issues_raw)
        
        # Clean up
        issues = [i.strip() for i in issues if len(i.strip()) > 5]
    
    if not issues:
        # Fallback: Extract longest quoted strings that look like feedback
        all_quotes = re.findall(r'"([^"]{25,})"', text)
        issues = [q for q in all_quotes if "{" not in q and ":" not in q][:3]

    if not issues:
        issues = ["Critique provided in raw response."]

    # Winning Conditions (Roadmap)
    winning_conditions = []
    wc_match = re.search(r'"winning_conditions":\s*\[([\s\S]*?)\]', text)
    if wc_match:
        wc_raw = wc_match.group(1)
        winning_conditions = re.findall(r'"([^"]*)"', wc_raw)
        if not winning_conditions:
            winning_conditions = re.findall(r"'([^']*)'", wc_raw)
    
    if not winning_conditions:
        # Fallback 1: Extract from overall text if it looks like a numbered list
        # Filter out anything that looks like an introductory sentence ending in a colon
        numbered_list = [it.strip() for it in re.findall(r'(?:\*\*|\d+\.|\(\d+\))\s*(.*?)(?=\*\*|\d+\.|\(\d+\)|\Z)', text, re.DOTALL) if it.strip()]
        winning_conditions = [item for item in numbered_list if len(item) > 10 and not item.endswith(':')]
        
    if not winning_conditions:
        # Fallback 2: Look for what_would_make_me_sign legacy field
        legacy_text = per_section.get('what_would_make_me_sign', '')
        if legacy_text and len(legacy_text) > 10:
            parts = re.split(r'(?:\d+\.|\(\d+\))', legacy_text)
            # Filter out the intro part if it's the first element and ends with a colon
            if len(parts) > 1:
                winning_conditions = [p.strip() for p in parts[1:] if len(p.strip()) > 5]
            else:
                winning_conditions = [legacy_text.strip()]
        legacy_match = re.search(r'"what_would_make_me_sign":\s*"([^"]*)', text)
        if legacy_match:
            winning_conditions = [legacy_match.group(1).strip()]

    if not winning_conditions:
        winning_conditions = ["Review verdict for required changes."]

    return {
        "scores": scores,
        "per_section_feedback": per_section,
        "top_3_issues": issues,
        "winning_conditions": winning_conditions,
        "overall_verdict": text[:1000],
    }


def adversarial_node(state: AgentState) -> dict:
    """
    Agent 5: Adversarial Reviewer node.
    Evaluates the current proposal draft and either:
    - Returns critique for revision (if quality_score < 0.80 and revision_count < 3)
    - Advances to HITL #2 (graph routing handles this via route_after_adversarial)
    """
    client_profile = state.get("client_profile", {})
    proposal_components = state.get("proposal_components", {})
    critique_history = list(state.get("critique_history", []))

    company_name = client_profile.get("company_name", "the client company")
    executive_role = _determine_executive_role(client_profile)

    meeting_transcript = state.get("meeting_transcript", "")

    model = _get_model()
    user_content = ADVERSARIAL_USER.format(
        executive_role=executive_role,
        company_name=company_name,
        meeting_transcript=meeting_transcript if meeting_transcript else "[No meeting transcript provided.]",
        intro=proposal_components.get("intro", "[Not yet drafted]"),
        understanding=proposal_components.get("understanding", "[Not yet drafted]"),
        methodology=proposal_components.get("methodology", "[Not yet drafted]"),
        approach=proposal_components.get("approach", "[Not yet drafted]"),
        fees=proposal_components.get("fees", "[Not yet drafted]"),
    )
    human_directives = state.get("human_directives", [])
    evaluator_persona = ""
    if human_directives:
        evaluator_persona = "\n=== SPECIFIC PERSONA & DIRECTIVES ===\n" + "\n".join(human_directives) + "\nAdopt this specific persona and follow these directives during your evaluation.\n"

    system_content = ADVERSARIAL_SYSTEM.format(
        executive_role=executive_role,
        company_name=company_name,
        industry=client_profile.get("industry", "the client's industry"),
        evaluator_persona=evaluator_persona,
    )

    push_log(f"Agent 5 performing adversarial review as {executive_role}...")
    response = model.invoke([
        SystemMessage(content=system_content),
        HumanMessage(content=user_content),
    ])
    response_text = response.content

    # ── Usage Tracking ───────────────────────────────────────────────────────
    from backend.usage_utils import update_usage
    usage_updates = update_usage(state, response)

    evaluation = _parse_evaluation(response_text)
    # ... (rest of logic) ...
    scores = evaluation.get("scores", {})

    # Normalize total score to 0.0–1.0
    raw_total = scores.get("total", 0)
    if not raw_total:
        raw_total = sum([
            scores.get("urgency", 0),
            scores.get("empathy", 0),
            scores.get("clarity", 0),
            scores.get("differentiation", 0),
        ])
    quality_score = round(raw_total / 100.0, 3)

    # Record critique
    critique_entry = {
        "round": state.get("revision_count", 0),
        "scores": scores,
        "per_section_feedback": evaluation.get("per_section_feedback", {}),
        "top_3_issues": evaluation.get("top_3_issues", []),
        "winning_conditions": evaluation.get("winning_conditions", []),
        "overall_verdict": evaluation.get("overall_verdict", ""),
        "executive_persona": f"{executive_role} of {company_name}",
    }
    critique_history.append(critique_entry)

    next_phase = Phase.HITL_2 if quality_score >= 0.80 or state.get("revision_count", 0) >= 3 else Phase.DRAFTING

    return {
        "critique_history": critique_history,
        "quality_score": quality_score,
        "current_phase": next_phase,
        **usage_updates
    }
