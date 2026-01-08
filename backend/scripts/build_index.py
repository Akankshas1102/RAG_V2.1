import os
import pickle
import faiss
import numpy as np
from pathlib import Path
import fitz
from bs4 import BeautifulSoup
from sentence_transformers import SentenceTransformer

# Base paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
VECTOR_STORE_DIR = BASE_DIR / "vector_store"
EMBEDDING_MODEL_NAME = "sentence-transformers/all-mpnet-base-v2"

def clean_text(text):
    return " ".join(text.split())

def load_pdf(file_path):
    doc = fitz.open(file_path)
    text = "".join(page.get_text() for page in doc)
    text = clean_text(text)
    words = text.split()
    chunk_size = 100
    overlap = 20
    chunks = []
    for i in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[i:i + chunk_size])
        if chunk.strip():
            chunks.append(chunk)
    return chunks

def load_html(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f, "html.parser")
    chunks = []
    current_chunk = []
    total_text = [] 
    for el in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "td", "div", "span"]):
        text = clean_text(el.get_text(strip=True))
        if text:
            total_text.append(f"Tag: {el.name}, Text: {text}")  # 
            prefix = "Heading: " if el.name in ["h1", "h2", "h3", "h4", "h5", "h6"] else "Content: " if el.name in ["p", "div"] else "List item: " if el.name == "li" else ""
            text = f"{prefix}{text}"
            if el.name in ["h1", "h2", "h3", "h4", "h5", "h6"] and current_chunk:
                if current_chunk:
                    chunks.append(" ".join(current_chunk))
                current_chunk = [text]
            else:
                current_chunk.append(text)
            if len(" ".join(current_chunk).split()) > 10:  
                chunks.append(" ".join(current_chunk))
                current_chunk = []
    if current_chunk:
        chunks.append(" ".join(current_chunk))
    filtered_chunks = [chunk for chunk in chunks if len(chunk.split()) > 5]  
    print(f"[*] Extracted text: {total_text}") 
    print(f"[*] Processed {len(chunks)} raw chunks, {len(filtered_chunks)} after filtering for {file_path.name}")
    return filtered_chunks

def load_documents():
    documents = []
    print(f"[*] Resolving data directory: {DATA_DIR}")
    if not DATA_DIR.exists():
        print(f"[!] Data directory '{DATA_DIR}' does not exist. Please create it and add .html or .pdf files.")
        return documents
    file_paths = list(DATA_DIR.rglob("*.[pP][dD][fF]")) + list(DATA_DIR.rglob("*.[hH][tT][mM][lL]")) + list(DATA_DIR.rglob("*.[hH][tT][mM]"))
    if not file_paths:
        print(f"[!] No .pdf, .html, or .htm files found in '{DATA_DIR}'. Contents: {[f.name for f in DATA_DIR.iterdir() if f.is_file()]}")
        return documents
    print(f"[*] Found {len(file_paths)} files: {[p.name for p in file_paths]}")
    for file_path in file_paths:
        if file_path.suffix.lower() in [".pdf"]:
            try:
                documents.extend(load_pdf(str(file_path)))
            except Exception as e:
                print(f"[!] Error reading {file_path.name}: {e}")
        elif file_path.suffix.lower() in [".html", ".htm"]:
            try:
                html_chunks = load_html(file_path)
                documents.extend(html_chunks)
            except Exception as e:
                print(f"[!] Error reading {file_path.name}: {e}")
    return documents

def embed_documents(docs, model):
    print("[+] Generating embeddings...")
    embeddings = model.encode(docs, show_progress_bar=True)
    return np.array(embeddings).astype("float32")

def save_index(embeddings, documents):
    print("[+] Creating FAISS index...")
    index = faiss.IndexFlatL2(embeddings.shape[1])
    index.add(embeddings)
    VECTOR_STORE_DIR.mkdir(parents=True, exist_ok=True)
    faiss.write_index(index, str(VECTOR_STORE_DIR / "index.faiss"))
    with open(VECTOR_STORE_DIR / "doc_embeddings.pkl", "wb") as f:
        pickle.dump(documents, f)
    print("[✅] Saved FAISS index and document store.")

def main():
    print("[*] Loading embedding model...")
    model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    documents = load_documents()
    if not documents:
        print("[!] Exiting: No documents to process.")
        return
    print(f"[*] Processed {len(documents)} document chunks.")
    embeddings = embed_documents(documents, model)
    save_index(embeddings, documents)

if __name__ == "__main__":
    main()