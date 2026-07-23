"""
Agent 1: Research Engine
Builds a client intelligence brief from the fuzzy brief + web search before the first meeting.
"""

from __future__ import annotations

import json
import os
import re

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from backend.state import AgentState, Phase
from backend.prompts.research_prompt import RESEARCH_SYSTEM, RESEARCH_USER
from backend.tools.web_search import (
    search_company,
    search_industry_trends,
    search_competitors,
    search_problem_context,
    search_regulatory_context,
    search_recent_news,
    search_case_studies,
    format_search_results_for_prompt,
)
from backend.logger import push_log


def _get_model() -> ChatAnthropic:
    return ChatAnthropic(
        model=os.environ.get("SONNET_MODEL", "claude-sonnet-4-6"),
        max_tokens=4096,
        api_key=os.environ.get("ANTHROPIC_API_KEY"),
        max_retries=6,
    )


def _extract_json_block(text: str) -> dict:
    """Extract JSON from model output, handling markdown code blocks."""
    # Try to find JSON block
    json_match = re.search(r"```json\s*([\s\S]*?)\s*```", text)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass
    # Try raw JSON object
    json_match = re.search(r"\{[\s\S]*\}", text)
    if json_match:
        try:
            return json.loads(json_match.group(0))
        except json.JSONDecodeError:
            pass
    return {}


def _extract_client_info_from_brief(raw_inputs: list[str]) -> tuple[str, str, str]:
    """
    Heuristic extraction of company name, industry, and problem from the brief.
    Results are only used for search query construction — the LLM refines everything.
    """
    combined = " ".join(raw_inputs)

    # Try to find a capitalized proper noun sequence as the company name.
    # Looks for 1-3 consecutive Title Case words not at sentence start.
    # e.g. "the CFO of Roche about" → "Roche", "spoke to PharmaClient AG about" → "PharmaClient AG"
    company_name = ""
    proper_noun_match = re.search(
        r"\b(?:of|at|for|with|to)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})\b",
        combined,
    )
    if proper_noun_match:
        candidate = proper_noun_match.group(1)
        # Exclude common false positives
        if candidate not in {"I", "The", "We", "Our", "This", "That", "It"}:
            company_name = candidate

    # Use the full brief text as problem description (truncated for query length)
    problem = combined[:250]

    return company_name, "", problem


def research_node(state: AgentState) -> dict:
    """
    Agent 1: Research Engine node.
    Runs web searches and synthesizes a client intelligence brief.
    """
    raw_inputs = state.get("raw_client_inputs", [])
    combined_brief = "\n\n".join(raw_inputs) if raw_inputs else ""

    # Quick extraction for search queries
    company_name, industry, problem_desc = _extract_client_info_from_brief(raw_inputs)

    if state.get("is_cancelled"):
        push_log("🛑 Research aborted by user signal.")
        return {"current_phase": Phase.CANCELLED}

    # Run web searches in parallel by collecting all results
    all_search_text = []

    if company_name:
        try:
            push_log(f"[1/6] Searching web for company profile: {company_name}")
            push_log(f"[QUERY] Latest profile and leadership for {company_name}")
            company_results = search_company(company_name, industry)
            all_search_text.append(format_search_results_for_prompt(company_results))
            if company_results:
                push_log(f"[INTEL] Found profile data for {company_name}")
            push_log("✓ Company profile retrieved.")
        except Exception as e:
            push_log(f"⚠ Company search failed: {e}")
            all_search_text.append(f"[Company search failed: {e}]")
    else:
        push_log("i Company name not identified - skipping profile search.")
        all_search_text.append("[Company name not identified from brief — skipping company search]")
    
    if state.get("is_cancelled"): return {"current_phase": Phase.CANCELLED}

    try:
        push_log(f"[2/6] Researching industry trends: {industry or 'General'}")
        push_log(f"[QUERY] 2024 trends and market shifts in {industry or 'the client sector'}")
        industry_results = search_industry_trends(industry, problem_desc[:100])
        all_search_text.append(format_search_results_for_prompt(industry_results))
        if industry_results:
            push_log(f"[INTEL] Identified key trends in {industry or 'sector'}")
        push_log("✓ Industry trends analyzed.")
    except Exception as e:
        push_log(f"⚠ Industry search failed: {e}")
        all_search_text.append(f"[Industry search failed: {e}]")

    try:
        push_log(f"[3/6] Investigating problem context: {problem_desc[:50]}...")
        push_log(f"[QUERY] Strategic challenges in {problem_desc[:50]}")
        problem_results = search_problem_context(problem_desc[:150])
        all_search_text.append(format_search_results_for_prompt(problem_results))
        if problem_results:
            push_log(f"[INTEL] Enriched problem context with market data")
        push_log("✓ Problem context enriched.")
    except Exception as e:
        push_log(f"⚠ Context search failed: {e}")
        all_search_text.append(f"[Problem context search failed: {e}]")

    if state.get("is_cancelled"): return {"current_phase": Phase.CANCELLED}

    # ── 3 additional targeted searches ────────────────────────────────────────
    problem_domain = problem_desc[:120]

    try:
        push_log("[4/6] Checking regulatory constraints and shifts...")
        push_log(f"[QUERY] Regulatory updates and compliance requirements for {industry or problem_domain}")
        reg_results = search_regulatory_context(industry or problem_domain, problem_domain)
        all_search_text.append(format_search_results_for_prompt(reg_results))
        if reg_results:
            push_log(f"[INTEL] Captured legal and regulatory landscape")
        push_log("✓ Regulatory context captured.")
    except Exception as e:
        push_log(f"⚠ Regulatory search failed: {e}")
        all_search_text.append(f"[Regulatory context search failed: {e}]")

    if company_name:
        try:
            push_log(f"[5/6] Fetching recent news & PR for {company_name}...")
            push_log(f"[QUERY] News headlines and press releases for {company_name} last 6 months")
            news_results = search_recent_news(company_name)
            all_search_text.append(format_search_results_for_prompt(news_results))
            if news_results:
                push_log(f"[INTEL] Retrieved latest news cycle data for {company_name}")
            push_log("✓ Recent news retrieved.")
        except Exception as e:
            push_log(f"⚠ News search failed: {e}")
            all_search_text.append(f"[Recent news search failed: {e}]")
    else:
        all_search_text.append("[Company name not identified — skipping recent news search]")

    try:
        push_log("[6/6] Sourcing relevant case studies and benchmarks...")
        push_log(f"[QUERY] ROI benchmarks and success stories for {problem_domain}")
        case_results = search_case_studies(problem_domain, industry or "")
        all_search_text.append(format_search_results_for_prompt(case_results))
        if case_results:
            push_log(f"[INTEL] Sourced industry-leading benchmarks")
        push_log("✓ Benchmarks retrieved.")
    except Exception as e:
        push_log(f"⚠ Case studies failed: {e}")
        all_search_text.append(f"[Case studies search failed: {e}]")

    if state.get("is_cancelled"): return {"current_phase": Phase.CANCELLED}

    combined_search = "\n\n" + "="*60 + "\n\n".join(all_search_text)

    # Call LLM
    push_log("Research complete. Synthesizing client dossier via LLM...")
    model = _get_model()
    user_content = RESEARCH_USER.format(
        raw_client_inputs=combined_brief,
        search_results=combined_search,
    )
    response = model.invoke([
        SystemMessage(content=RESEARCH_SYSTEM),
        HumanMessage(content=user_content),
    ])
    response_text = response.content

    # ── Usage Tracking ───────────────────────────────────────────────────────
    from backend.usage_utils import update_usage
    search_count = len([x for x in [company_name, industry, problem_desc, "reg", company_name, "case"] if x])
    usage_updates = update_usage(state, response, search_count=search_count)

    # Parse client profile JSON
    client_profile = _extract_json_block(response_text)
    # ... (rest of parsing logic) ...
    briefing_dossier = response_text
    dossier_match = re.search(
        r"(?:BRIEFING DOSSIER|briefing dossier)[:\s]*([\s\S]+)",
        response_text,
        re.IGNORECASE,
    )
    if dossier_match:
        briefing_dossier = dossier_match.group(1).strip()
    elif client_profile:
        briefing_dossier = re.sub(r"```json[\s\S]*?```", "", response_text).strip()
        briefing_dossier = re.sub(r"\{[\s\S]*?\}", "", briefing_dossier, count=1).strip()

    if not client_profile:
        client_profile = {
            "company_name": company_name or "Client (to be confirmed)",
            "industry": "Unknown",
            "problem_domain": "Strategic problem solving",
            "engagement_title": "Strategic Advisory Engagement",
        }
    else:
        # Sanitize: replace placeholder values that the LLM may have emitted literally
        _BAD_PLACEHOLDERS = {"UNKNOWN", "NOT PROVIDED", "N/A", "None", "", "Unknown"}
        if client_profile.get("company_name", "").upper() in {p.upper() for p in _BAD_PLACEHOLDERS}:
            client_profile["company_name"] = company_name or "Client (to be confirmed)"
    if not briefing_dossier:
        briefing_dossier = response_text

    return {
        "client_profile": client_profile,
        "briefing_dossier": briefing_dossier,
        "current_phase": Phase.QUESTION_GEN,
        **usage_updates
    }
