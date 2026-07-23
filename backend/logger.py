import contextvars
from collections import defaultdict
from typing import List

# Thread-safe global context variable to track the active session ID.
current_session_id = contextvars.ContextVar("current_session_id", default="")

# In-memory structured log dictionary mapping session_id -> list of log strings.
ACTIVE_LOGS: dict[str, List[str]] = defaultdict(list)

def push_log(message: str):
    """
    Push a log message to the active session's log queue.
    Automatically retrieves the session_id from the contextvars.
    """
    sid = current_session_id.get()
    if sid:
        ACTIVE_LOGS[sid].append(message)
    else:
        # Fallback if executing outside context (e.g. tests)
        print(f"[No Session] {message}")

def get_logs(session_id: str, cursor: int = 0) -> List[str]:
    """Retrieve logs for a given session starting from an index cursor."""
    if session_id not in ACTIVE_LOGS:
        return []
    return ACTIVE_LOGS[session_id][cursor:]
