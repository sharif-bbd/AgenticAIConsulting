
import sys
import os
from unittest.mock import MagicMock

# Add project root to path
sys.path.append(os.getcwd())

from backend.usage_utils import update_usage
from langchain_core.messages import AIMessage

def test_usage_extraction():
    state = {"total_tokens": 100, "total_cost": 0.5}
    
    # 1. Test standard usage_metadata
    msg1 = AIMessage(content="hello")
    msg1.usage_metadata = {"input_tokens": 50, "output_tokens": 20}
    
    res1 = update_usage(state, msg1)
    print(f"Test 1 (Standard): {res1}")
    assert res1["total_tokens"] == 170
    assert res1["total_cost"] > 0.5
    
    # 2. Test response_metadata fallback
    msg2 = AIMessage(content="hello")
    msg2.response_metadata = {"usage": {"prompt_tokens": 30, "completion_tokens": 10}}
    # Ensure usage_metadata is missing or None
    if hasattr(msg2, "usage_metadata"):
        msg2.usage_metadata = None
        
    res2 = update_usage(state, msg2)
    print(f"Test 2 (Fallback): {res2}")
    assert res2["total_tokens"] == 140
    assert res2["total_cost"] > 0.5

    # 3. Test Search Cost
    res3 = update_usage(state, msg1, search_count=5)
    print(f"Test 3 (Search): {res3}")
    # 0.5 + search(5 * 0.01) + llm_cost
    expected_search_increment = 0.05
    assert res3["total_cost"] >= 0.55

    print("\nALL USAGE TESTS PASSED!")

if __name__ == "__main__":
    test_usage_extraction()
