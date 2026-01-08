import os
import pickle
import faiss
import numpy as np
import requests
from pathlib import Path
from sentence_transformers import SentenceTransformer
from transformers import AutoTokenizer

BASE_DIR = Path(__file__).resolve().parent.parent
VECTOR_STORE_DIR = BASE_DIR / "vector_store"
INDEX_PATH = VECTOR_STORE_DIR / "index.faiss"
DOCS_PATH = VECTOR_STORE_DIR / "doc_embeddings.pkl"

print("[*] Loading FAISS index and document store...")
index = faiss.read_index(str(INDEX_PATH))
with open(DOCS_PATH, "rb") as f:
    documents = pickle.load(f)

embedding_model = SentenceTransformer("sentence-transformers/multi-qa-mpnet-base-dot-v1")
tokenizer = AutoTokenizer.from_pretrained("sentence-transformers/multi-qa-mpnet-base-dot-v1", model_max_length=2048)

def get_query_embedding(query: str) -> np.ndarray:
    return embedding_model.encode([query]).astype("float32")

def search_documents(query: str, top_k: int = 5) -> list:
    query_vector = get_query_embedding(query)
    distances, indices = index.search(query_vector, top_k)
    results = [(distances[0][i], documents[idx]) for i, idx in enumerate(indices[0]) if idx < len(documents)]
    print(f"[*] Query: {query}")
    print("[*] Retrieved chunks and distances:", results)
    return [doc for _, doc in sorted(results, key=lambda x: x[0])]

def truncate_context(chunks, max_tokens=2048):
    context = ""
    for chunk in chunks:
        if len(tokenizer.encode(context + "\n\n" + chunk)) <= max_tokens:
            context += "\n\n" + chunk
        else:
            break
    return context.strip()

def query_ollama(prompt: str) -> str:
    try:
        response = requests.post(
            "http://localhost:11500/api/generate",
            json={"model": "llama3.1:8b", "prompt": prompt, "stream": False} 
        )
        res_json = response.json()
        print("[*] Ollama raw response:", res_json)
        return res_json.get("response", "Error: Unexpected response format.")
    except Exception as e:
        print(f"[!] Error connecting to Ollama: {e}")
        return "Error: Unable to connect to the local LLM."

def answer_query(user_query: str) -> str:
    print("[*] Starting RAG pipeline...")
    try:
        context_chunks = search_documents(user_query, top_k=3)
        context = truncate_context(context_chunks)
        context = "\n\n".join(f"Chunk {i+1}: {chunk}" for i, chunk in enumerate(context_chunks))
        print("[*] Retrieved context:", context)
        prompt = (
            "You are a helpful assistant. Answer the question based STRICTLY on the most relevant information in the provided context below. "
            "Focus on the chunk that directly addresses the question and ignore irrelevant details. "
            "Do not use any external knowledge, assumptions, or prior training data. "
            'You are a helpful assistant answering questions based on the given documentation context. Answer the following question using only the information provided in the context below. If the answer is not explicitly stated, respond with "The information is not available in the provided documents.'
            "If the context does not contain enough information to answer the question accurately, respond with 'I don’t have enough information to answer this question.' "
            "Provide an answer directly addressing the question.\n\n"
            f"Context:\n{context}\n\n"
            f"Question: {user_query}\nAnswer:"
        )
        print("[*] Sending prompt to Ollama...")
        response = query_ollama(prompt)
        print("[*] Ollama responded with:", response)
        return response
    except Exception as e:
        print(f"[!] RAG processing error: {e}")
        return "Error occurred while processing the query."