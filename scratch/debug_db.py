import sqlite3
import json
import os
from pathlib import Path

DB_PATH = Path("proposal_sessions.db")

def check_session():
    if not DB_PATH.exists():
        print("Database not found")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Check all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    print(f"Tables: {tables}")

    # Check checkpoints
    try:
        cursor.execute("SELECT thread_id, checkpoint FROM checkpoints ORDER BY thread_id LIMIT 5")
        rows = cursor.fetchall()
        for thread_id, checkpoint in rows:
            print(f"Thread: {thread_id}")
            # Checkpoint is usually binary (msgpack or similar)
            # data = msgpack.unpackb(checkpoint)
    except Exception as e:
        print(f"Error reading checkpoints: {e}")

    conn.close()

if __name__ == "__main__":
    check_session()
