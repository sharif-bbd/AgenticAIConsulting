
import os
import time
import sys
from dotenv import load_dotenv

# Add project root to path
sys.path.append(os.getcwd())

load_dotenv()

try:
    from tavily import TavilyClient
    print("✅ Tavily SDK imported successfully.")
except ImportError:
    print("❌ Tavily SDK not found. Please run 'pip install tavily-python'")
    sys.exit(1)

def diagnose():
    api_key = os.environ.get("TAVILY_API_KEY")
    if not api_key:
        print("❌ TAVILY_API_KEY not found in .env")
        return

    print(f"🔑 Using API Key: {api_key[:10]}...{api_key[-5:]}")
    
    client = TavilyClient(api_key=api_key)
    
    test_query = "Apple Inc financial results 2024"
    print(f"📡 Testing Tavily 'basic' search with query: '{test_query}'...")
    
    start_time = time.time()
    try:
        # Basic search is usually fast
        response = client.search(query=test_query, search_depth="basic")
        duration = time.time() - start_time
        print(f"✅ Basic search succeeded in {duration:.2f} seconds.")
        print(f"📈 Found {len(response.get('results', []))} results.")
    except Exception as e:
        print(f"❌ Basic search failed: {str(e)}")

    test_query_adv = "Cloud Strategy company overview recent news"
    print(f"\n📡 Testing Tavily 'advanced' search (what the agent uses) with query: '{test_query_adv}'...")
    
    start_time = time.time()
    try:
        # Advanced search can take longer
        response = client.search(query=test_query_adv, search_depth="advanced", max_results=3)
        duration = time.time() - start_time
        print(f"✅ Advanced search succeeded in {duration:.2f} seconds.")
        print(f"📈 Found {len(response.get('results', []))} results.")
    except Exception as e:
        print(f"❌ Advanced search failed: {str(e)}")

if __name__ == "__main__":
    diagnose()
