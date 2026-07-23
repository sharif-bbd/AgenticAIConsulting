import os
from langchain_core.messages import BaseMessage

# Pricing per 1M tokens (USD) keyed by substring of model name.
# Checked against Anthropic's published prices — update here if rates change.
_MODEL_PRICING: list[tuple[str, float, float]] = [
    # (model name substring,  input $/1M,  output $/1M)
    ("haiku",   0.80,  4.00),
    ("sonnet",  3.00, 15.00),
    ("opus",   15.00, 75.00),
]
_DEFAULT_INPUT_PER_M  = 3.00   # fallback: Sonnet rates
_DEFAULT_OUTPUT_PER_M = 15.00

def _get_pricing(model_name: str) -> tuple[float, float]:
    """Return (input_rate, output_rate) per token for the given model name."""
    model = (model_name or "").lower()
    for substring, inp, out in _MODEL_PRICING:
        if substring in model:
            return inp / 1_000_000, out / 1_000_000
    return _DEFAULT_INPUT_PER_M / 1_000_000, _DEFAULT_OUTPUT_PER_M / 1_000_000


def _resolve_model_name(response: BaseMessage) -> str:
    """Best-effort extraction of the model name from a LangChain response.
    Falls back to env vars if metadata is absent (e.g. in tests)."""
    meta = getattr(response, "response_metadata", {}) or {}
    name = meta.get("model_name") or meta.get("model")
    if name:
        return name
    usage = getattr(response, "usage_metadata", {}) or {}
    if usage.get("model_name"):
        return usage["model_name"]
    return os.environ.get("OPUS_MODEL") or os.environ.get("SONNET_MODEL") or ""

# Search cost estimate (Tavily free tier / pay-as-you-go is negligible;
# kept as a rough marker only — set to 0 to ignore it entirely).
_SEARCH_COST_PER_CALL = 0.01


def update_usage(state: dict, response: BaseMessage, search_count: int = 0) -> dict:
    """
    Extracts usage metadata from a LangChain response and increments
    cumulative tokens and USD cost in the state.
    """
    total_tokens = state.get("total_tokens", 0)
    total_cost   = state.get("total_cost", 0.0)

    # 1. Try standard usage_metadata property (most LangChain models now support this)
    usage = getattr(response, "usage_metadata", {}) or {}
    
    # 2. Fallback: Check response_metadata['usage'] (older or specific providers)
    if not usage:
        resp_meta = getattr(response, "response_metadata", {}) or {}
        usage = resp_meta.get("usage", {}) or {}

    # Extract tokens with variety of possible keys
    input_tokens  = usage.get("input_tokens") or usage.get("prompt_tokens", 0)
    output_tokens = usage.get("output_tokens") or usage.get("completion_tokens", 0)

    input_rate, output_rate = _get_pricing(_resolve_model_name(response))

    llm_cost    = (input_tokens * input_rate) + (output_tokens * output_rate)
    search_cost = search_count * _SEARCH_COST_PER_CALL

    return {
        "total_tokens": total_tokens + input_tokens + output_tokens,
        "total_cost":   round(total_cost + llm_cost + search_cost, 6),
    }

