import os
import httpx
import logging
import time
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

TAVILY_API_URL = "https://api.tavily.com/search"

def _tavily_request(query: str, search_depth: str = "advanced", max_results: int = 5, include_answer: bool = True) -> Dict[str, Any]:
    """Helper to perform a robust, timed-out request to Tavily API."""
    api_key = os.environ.get("TAVILY_API_KEY")
    if not api_key:
        raise EnvironmentError("TAVILY_API_KEY environment variable not set.")

    payload = {
        "api_key": api_key,
        "query": query,
        "search_depth": search_depth,
        "max_results": max_results,
        "include_answer": include_answer,
    }

    try:
        start_time = time.time()
        # Use a 20-second timeout to prevent indefinite hangs
        with httpx.Client(timeout=20.0) as client:
            response = client.post(TAVILY_API_URL, json=payload)
            response.raise_for_status()
            
            duration = time.time() - start_time
            return response.json()
            
    except httpx.TimeoutException:
        logger.error(f"Tavily search timed out for query: {query}")
        return {"results": [], "answer": f"[Search timed out after 20s for: {query}]"}
    except Exception as e:
        logger.error(f"Tavily search failed for query: {query}. Error: {str(e)}")
        return {"results": [], "answer": f"[Search failed: {str(e)}]"}

def search_company(company_name: str, industry: str = "") -> dict:
    """Search for company information."""
    query = f"{company_name} {industry} company overview recent news strategy 2024 2025"
    response = _tavily_request(query)
    return {
        "query": query,
        "results": response.get("results", []),
        "summary": response.get("answer", ""),
    }

def search_industry_trends(industry: str, problem_domain: str = "") -> dict:
    """Search for industry trends."""
    query = f"{industry} industry trends challenges 2024 2025 {problem_domain}"
    response = _tavily_request(query)
    return {
        "query": query,
        "results": response.get("results", []),
        "summary": response.get("answer", ""),
    }

def search_competitors(company_name: str, industry: str) -> dict:
    """Search for main competitors."""
    query = f"{company_name} main competitors {industry} competitive landscape market share"
    response = _tavily_request(query)
    return {
        "query": query,
        "results": response.get("results", []),
        "summary": response.get("answer", ""),
    }

def search_problem_context(problem_description: str) -> dict:
    """Search for problem context."""
    query = f"enterprise {problem_description} best practices case studies management consulting"
    response = _tavily_request(query)
    return {
        "query": query,
        "results": response.get("results", []),
        "summary": response.get("answer", ""),
    }

def search_regulatory_context(industry: str, problem_domain: str = "") -> dict:
    """Search for regulatory context."""
    query = f"{industry} regulation compliance requirements 2024 2025 {problem_domain} legal risk"
    response = _tavily_request(query, max_results=4)
    return {
        "query": query,
        "results": response.get("results", []),
        "summary": response.get("answer", ""),
    }

def search_recent_news(company_name: str) -> dict:
    """Search for recent news."""
    query = f"{company_name} news announcement 2025 strategy results leadership"
    response = _tavily_request(query)
    return {
        "query": query,
        "results": response.get("results", []),
        "summary": response.get("answer", ""),
    }

def search_case_studies(problem_domain: str, industry: str = "") -> dict:
    """Search for consulting case studies."""
    query = f"{industry} {problem_domain} case study transformation success lessons learned peer example"
    response = _tavily_request(query, max_results=4)
    return {
        "query": query,
        "results": response.get("results", []),
        "summary": response.get("answer", ""),
    }

def search_question_answer(question: str, company_name: str = "", industry: str = "") -> dict:
    """Attempt to find a web-available answer to a specific probing question."""
    context = " ".join(filter(None, [company_name, industry]))
    query = f"{context} {question}"
    response = _tavily_request(query, search_depth="advanced", max_results=6)
    return {
        "query": query,
        "results": response.get("results", []),
        "summary": response.get("answer", ""),
    }

def format_search_results_for_prompt(search_results: dict) -> str:
    """Format search results into a clean string for LLM prompts."""
    lines = [f"Query: {search_results['query']}"]
    if search_results.get("summary"):
        lines.append(f"\nSynthesized Answer:\n{search_results['summary']}")
    lines.append("\nSource Details:")
    for i, result in enumerate(search_results.get("results", []), 1):
        lines.append(f"\n[{i}] {result.get('title', 'No title')}")
        lines.append(f"    URL: {result.get('url', '')}")
        content = result.get("content", "")
        if content:
            lines.append(f"    Excerpt: {content[:300]}...")
    return "\n".join(lines)
