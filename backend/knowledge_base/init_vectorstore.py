"""
Initialize the ChromaDB vector store with consulting frameworks and example proposals.
Run this once before starting the system: python -m backend.knowledge_base.init_vectorstore
"""

import os
import sys
from pathlib import Path

import chromadb
from chromadb.utils import embedding_functions

KNOWLEDGE_BASE_DIR = Path(__file__).parent
VECTORSTORE_DIR = KNOWLEDGE_BASE_DIR / "vectorstore"
FRAMEWORKS_DIR = KNOWLEDGE_BASE_DIR / "frameworks"
EXAMPLES_DIR = KNOWLEDGE_BASE_DIR / "proposal_examples"

COLLECTION_NAME = "consulting_knowledge"


def load_markdown_files(directory: Path) -> list[dict]:
    """Load all markdown files from a directory, returning list of {content, metadata}."""
    docs = []
    for md_file in directory.glob("*.md"):
        content = md_file.read_text(encoding="utf-8")
        docs.append({
            "content": content,
            "metadata": {
                "source": md_file.name,
                "type": "framework" if directory == FRAMEWORKS_DIR else "proposal_example",
                "name": md_file.stem.replace("_", " ").title(),
            },
            "id": f"{directory.name}/{md_file.stem}",
        })
    return docs


def chunk_document(doc: dict, chunk_size: int = 800, overlap: int = 100) -> list[dict]:
    """Split a document into overlapping chunks for better retrieval granularity."""
    content = doc["content"]
    chunks = []
    start = 0
    chunk_idx = 0

    while start < len(content):
        end = min(start + chunk_size, len(content))
        # Try to break at a newline boundary
        if end < len(content):
            newline_pos = content.rfind("\n", start, end)
            if newline_pos > start:
                end = newline_pos

        chunk_content = content[start:end].strip()
        if chunk_content:
            chunks.append({
                "content": chunk_content,
                "metadata": {**doc["metadata"], "chunk_index": chunk_idx},
                "id": f"{doc['id']}_chunk{chunk_idx}",
            })
            chunk_idx += 1

        start = end - overlap if end < len(content) else len(content)

    return chunks


def init_vectorstore(reset: bool = False) -> chromadb.Collection:
    """
    Initialize or reset the ChromaDB collection with all knowledge base content.

    Args:
        reset: If True, deletes and recreates the collection.

    Returns:
        The ChromaDB collection.
    """
    client = chromadb.PersistentClient(path=str(VECTORSTORE_DIR))

    # Use a local sentence-transformers model for embeddings (no API key needed)
    embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name="all-MiniLM-L6-v2"
    )

    if reset:
        try:
            client.delete_collection(COLLECTION_NAME)
            print(f"Deleted existing collection: {COLLECTION_NAME}")
        except Exception:
            pass

    collection = client.get_or_create_collection(
        name=COLLECTION_NAME,
        embedding_function=embedding_fn,
        metadata={"hnsw:space": "cosine"},
    )

    # Check if already populated
    existing_count = collection.count()
    if existing_count > 0 and not reset:
        print(f"Collection already has {existing_count} chunks. Skipping initialization.")
        print("Run with reset=True to reinitialize.")
        return collection

    # Load all documents
    all_docs = []
    all_docs.extend(load_markdown_files(FRAMEWORKS_DIR))
    all_docs.extend(load_markdown_files(EXAMPLES_DIR))

    print(f"Loaded {len(all_docs)} documents from knowledge base.")

    # Chunk documents
    all_chunks = []
    for doc in all_docs:
        chunks = chunk_document(doc)
        all_chunks.extend(chunks)
        print(f"  {doc['metadata']['name']}: {len(chunks)} chunks")

    print(f"\nTotal chunks to embed: {len(all_chunks)}")

    # Add to ChromaDB in batches
    batch_size = 50
    for i in range(0, len(all_chunks), batch_size):
        batch = all_chunks[i : i + batch_size]
        collection.add(
            documents=[c["content"] for c in batch],
            metadatas=[c["metadata"] for c in batch],
            ids=[c["id"] for c in batch],
        )
        print(f"  Embedded batch {i // batch_size + 1}/{(len(all_chunks) - 1) // batch_size + 1}")

    print(f"\nVector store initialized: {collection.count()} chunks in '{COLLECTION_NAME}'")
    return collection


def get_collection() -> chromadb.Collection:
    """Return the existing collection (must be initialized first)."""
    client = chromadb.PersistentClient(path=str(VECTORSTORE_DIR))
    embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name="all-MiniLM-L6-v2"
    )
    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        embedding_function=embedding_fn,
        metadata={"hnsw:space": "cosine"},
    )


if __name__ == "__main__":
    reset = "--reset" in sys.argv
    init_vectorstore(reset=reset)
