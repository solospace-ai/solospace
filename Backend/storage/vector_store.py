import os
import uuid
import datetime
from typing import List, Dict, Any, Optional

import chromadb
from chromadb.config import Settings

# Persistent directory for ChromaDB within Backend workspace
DB_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "solospace_chroma")

_chroma_client = None


def get_chroma_client():
    global _chroma_client
    if _chroma_client is None:
        _chroma_client = chromadb.PersistentClient(
            path=DB_DIR,
            settings=Settings(anonymized_telemetry=False)
        )
    return _chroma_client


def get_collection(name: str = "memories"):
    client = get_chroma_client()
    return client.get_or_create_collection(name=name)


async def store_vector_memory(
    agent_id: str,
    text: str,
    api_key: str,
    session_id: Optional[str] = None,
    provider: str = "gemini",
):
    """
    Store memory in ChromaDB with pre-computed embedding from provider.
    Runs asynchronously and is safe to call in background tasks.
    """
    try:
        from providers import get_embedding
        embedding = await get_embedding(provider, api_key, text)
        if not embedding:
            print("[VECTOR STORE] Failed to compute embedding. Skipping store.")
            return

        collection = get_collection()
        doc_id = str(uuid.uuid4())
        
        metadata = {
            "agent_id": agent_id or "global",
            "timestamp": datetime.datetime.now().isoformat(),
        }
        if session_id:
            metadata["session_id"] = session_id
            
        collection.add(
            ids=[doc_id],
            embeddings=[embedding],
            documents=[text],
            metadatas=[metadata]
        )
    except Exception as e:
        print(f"[VECTOR STORE ERROR] Failed to store memory: {e}")


async def query_vector_memory(
    query: str,
    api_key: str,
    top_k: int = 2,
    agent_id: Optional[str] = None,
    session_id: Optional[str] = None,
    provider: str = "gemini",
) -> List[str]:
    """
    Query memories using ChromaDB vector similarity.
    Supports filtering by agent_id and session_id.
    """
    try:
        from providers import get_embedding
        embedding = await get_embedding(provider, api_key, query)
        if not embedding:
            return []

        collection = get_collection()
        
        # Build filter query
        where_clause = None
        if agent_id and session_id:
            where_clause = {
                "$and": [
                    {"agent_id": agent_id},
                    {"session_id": session_id}
                ]
            }
        elif agent_id:
            where_clause = {"agent_id": agent_id}
        elif session_id:
            where_clause = {"session_id": session_id}

        results = collection.query(
            query_embeddings=[embedding],
            n_results=top_k,
            where=where_clause
        )
        
        documents = results.get("documents", [])
        if documents and len(documents) > 0:
            return documents[0]
        return []
    except Exception as e:
        print(f"[VECTOR STORE ERROR] Failed to query memories: {e}")
        return []
