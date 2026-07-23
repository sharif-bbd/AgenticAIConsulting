"""
Agent 2: Discovery Prep Agent
Generates targeted probing questions for the first client meeting,
then attempts to pre-answer web-searchable ones via Tavily.
"""

from __future__ import annotations

import json
import os
import re

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from backend.state import AgentState, Phase
from backend.prompts.discovery_prompt import DISCOVERY_SYSTEM, DISCOVERY_USER
from backend.tools.web_search import search_question_answer, format_search_results_for_prompt
from backend.logger import push_log

# Sentinel value stored when a question cannot be answered via web search
NEEDS_MEETING = "Requires meeting"

# Maximum number of questions to attempt web-answering
_MAX_QA_SEARCHES = 12


def _get_model() -> ChatAnthropic:
    return ChatAnthropic(
        model=os.environ.get("SONNET_MODEL", "claude-sonnet-4-6"),
        max_tokens=2048,
        api_key=os.environ.get("ANTHROPIC_API_KEY"),
        max_retries=6,
    )


def _parse_questions(text: str) -> list[str]:
    """Extract individual questions from the LLM response."""
    questions = []
    # Match lines starting with "- [Category]" or numbered list items containing "?"
    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue
        # Match bullet points with question marks
        if (line.startswith("- ") or re.match(r"^\d+\.", line)) and "?" in line:
            # Remove leading bullet/number
            cleaned = re.sub(r"^[-\d.]+\s*", "", line).strip()
            if cleaned:
                questions.append(cleaned)
    # Fallback: just return all lines with question marks
    if not questions:
        for line in text.split("\n"):
            line = line.strip()
            if "?" in line and len(line) > 20:
                questions.append(line)
    return questions


def generate_questions(
    client_profile: dict,
    briefing_dossier: str,
    refinement_directives: list[str] | None = None,
) -> tuple[list[str], Any]: # Returns (questions, response_metadata)
    """
    Pure function: generate probing questions given client intelligence.
    Returns:
        tuple of (List of question strings, response_object).
    """
    model = _get_model()

    refinement_section = ""
    if refinement_directives:
        refinement_section = (
            "\n\n=== REFINEMENT DIRECTIVES FROM CONSULTANT ===\n"
            + "\n".join(f"- {d}" for d in refinement_directives)
            + "\n\nRevise and regenerate the full question set taking these directives into account."
        )

    user_content = DISCOVERY_USER.format(
        client_profile=json.dumps(client_profile, indent=2),
        briefing_dossier=briefing_dossier,
    ) + refinement_section

    push_log("Drafting initial probing questions for the client meeting...")
    response = model.invoke([
        SystemMessage(content=DISCOVERY_SYSTEM),
        HumanMessage(content=user_content),
    ])
    questions = _parse_questions(response.content)

    if not questions:
        questions = [response.content]

    return questions, response


def _enrich_questions_with_search(
    questions: list[str],
    client_profile: dict,
    state: AgentState
) -> tuple[dict, dict]: # Returns (answers, usage_updates)
    """
    Attempt to web-answer up to MAX_QA_SEARCHES questions using Tavily.
    Returns:
        tuple of (Dict mapping question text → answer, usage_sum_dict).
    """
    from backend.tools.web_search import search_question_answer, format_search_results_for_prompt
    from backend.usage_utils import update_usage
    push_log("Enriching questions with automated web research...")

    company_name = client_profile.get("company_name", "")
    industry = client_profile.get("industry", "")

    SKIP_KEYWORDS = [
        "internally", "stakeholder", "champion", "resist", "politics",
        "board", "approve", "budget owner", "who owns", "who decide",
        "who is responsible", "internally",
    ]

    def _is_web_answerable(q: str) -> bool:
        ql = q.lower()
        return not any(kw in ql for kw in SKIP_KEYWORDS)

    candidates = [q for q in questions if _is_web_answerable(q)][:_MAX_QA_SEARCHES]

    if not candidates:
        return {q: NEEDS_MEETING for q in questions}, {"total_tokens": 0, "total_cost": 0.0}

    model = _get_model()
    answers: dict[str, str] = {}
    
    # Track usage within this loop
    accumulated_usage = {"total_tokens": 0, "total_cost": 0.0}
    current_temp_state = {"total_tokens": 0, "total_cost": 0.0}

    for i, question in enumerate(questions, 1):
        if question not in candidates:
            answers[question] = NEEDS_MEETING
            continue

        if state.get("is_cancelled"): return {"current_phase": Phase.CANCELLED}

        try:
            push_log(f"[{i}/{len(questions)}] Attempting to auto-answer: '{question[:50]}...'")
            results = search_question_answer(question, company_name, industry)
            # ... skipping existing summary logic ...
            summary = results.get("summary", "")
            sources = results.get("results", [])

            if not summary and not sources:
                push_log(f"i No public data found for question {i}. Moving on.")
                answers[question] = NEEDS_MEETING
                continue

            context = format_search_results_for_prompt(results)
            synthesis_prompt = (
                f"Based only on the web search results below, provide a concise 1–3 sentence factual answer "
                f"to this question about {company_name}: \"{question}\"\n\n"
                f"If the search results do not contain enough information to answer this question, "
                f"respond with exactly: INSUFFICIENT_DATA\n\n"
                f"Search results:\n{context}"
            )
            response = model.invoke([HumanMessage(content=synthesis_prompt)])
            
            # Update usage for this step
            updates = update_usage(current_temp_state, response, search_count=1)
            accumulated_usage["total_tokens"] += (updates["total_tokens"] - current_temp_state["total_tokens"])
            accumulated_usage["total_cost"] += (updates["total_cost"] - current_temp_state["total_cost"])
            current_temp_state = updates
            
            answer_text = response.content.strip()

            if "INSUFFICIENT_DATA" in answer_text or len(answer_text) < 10:
                answers[question] = NEEDS_MEETING
            else:
                answers[question] = answer_text

        except Exception:
            answers[question] = NEEDS_MEETING

    return answers, accumulated_usage


def discovery_node(state: AgentState) -> dict:
    """
    Agent 2: Discovery Prep node.
    """
    from backend.usage_utils import update_usage
    client_profile = state.get("client_profile", {})
    briefing_dossier = state.get("briefing_dossier", "")
    
    if state.get("is_cancelled"):
        push_log("🛑 Discovery prep aborted by user signal.")
        return {"current_phase": Phase.CANCELLED}

    # 1. Initial generation usage
    questions, initial_resp = generate_questions(client_profile, briefing_dossier)
    usage_gen = update_usage(state, initial_resp)

    # 2. Enrichment usage (multiple calls)
    try:
        question_answers, usage_enrich = _enrich_questions_with_search(questions, client_profile, state)
    except Exception:
        question_answers = {q: NEEDS_MEETING for q in questions}
        usage_enrich = {"total_tokens": 0, "total_cost": 0.0}

    # Final totals (usage_gen already includes state + initial_resp)
    total_tokens = usage_gen["total_tokens"] + usage_enrich["total_tokens"]
    total_cost   = usage_gen["total_cost"] + usage_enrich["total_cost"]

    return {
        "probing_questions": questions,
        "question_answers": question_answers,
        "current_phase": Phase.HITL_1,
        "total_tokens": total_tokens,
        "total_cost": round(total_cost, 6)
    }
