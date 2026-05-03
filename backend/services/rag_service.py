"""RAG service for position-aware retrieval."""

import logging
import os
from pathlib import Path
from typing import List, Optional

logger = logging.getLogger(__name__)

_faiss_index = None
_embeddings_model = None
_chunks: List[dict] = []


class RAGService:
    def __init__(self, knowledge_base_path: str = "../knowledge_base"):
        self.knowledge_base_path = knowledge_base_path
        self._initialized = False

    async def init_knowledge_base(self):
        global _faiss_index, _embeddings_model, _chunks

        kb_path = Path(self.knowledge_base_path)
        if not kb_path.exists():
            logger.warning("Knowledge base path does not exist: %s", kb_path.absolute())
            self._initialized = True
            return

        try:
            import faiss
            import numpy as np
            from sentence_transformers import SentenceTransformer
        except ImportError as exc:
            logger.warning("RAG dependencies unavailable, skip init: %s", exc)
            self._initialized = True
            return

        os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")
        try:
            _embeddings_model = SentenceTransformer("all-MiniLM-L6-v2", local_files_only=True)
        except Exception as exc:
            logger.warning("Failed to load embeddings model, skip RAG init: %s", exc)
            self._initialized = True
            return

        md_files = list(kb_path.glob("**/*.md"))
        if not md_files:
            logger.warning("No markdown files found in knowledge base")
            self._initialized = True
            return

        _chunks = []
        for md_file in md_files:
            text = md_file.read_text(encoding="utf-8")
            position_type = self._infer_position_type(str(md_file))
            for chunk_text in self._split_text(text, chunk_size=500, overlap=50):
                _chunks.append(
                    {
                        "text": chunk_text,
                        "source": str(md_file.name),
                        "position_type": position_type,
                    }
                )

        if not _chunks:
            logger.warning("Knowledge base is empty after chunking")
            self._initialized = True
            return

        texts = [str(item["text"]) for item in _chunks if str(item["text"]).strip()]
        if not texts:
            logger.warning("Knowledge base text list is empty after normalization")
            self._initialized = True
            return

        try:
            embeddings = _embeddings_model.encode(
                texts,
                batch_size=16,
                show_progress_bar=False,
                convert_to_numpy=True,
            )
            embeddings = np.array(embeddings, dtype="float32")
            faiss.normalize_L2(embeddings)
            _faiss_index = faiss.IndexFlatIP(embeddings.shape[1])
            _faiss_index.add(embeddings)
        except Exception as exc:
            logger.warning("Failed to build RAG embeddings, skip RAG init: %s", exc)
            _faiss_index = None
            _chunks = []
            self._initialized = True
            return

        logger.info("RAG initialized with %s chunks", len(_chunks))
        self._initialized = True

    def _infer_position_type(self, file_path: str) -> str:
        path_lower = file_path.lower().replace("\\", "/")
        if "backend_java" in path_lower or "/backend/" in path_lower or "java" in path_lower:
            return "java_backend"
        if "frontend_web" in path_lower or "/frontend/" in path_lower or "web" in path_lower:
            return "web_frontend"
        if "embedded" in path_lower:
            return "embedded"
        if "python_algorithm" in path_lower:
            return "python_algorithm"
        if "software_testing" in path_lower:
            return "software_testing"
        if "devops" in path_lower:
            return "devops"
        return "general"

    def _split_text(self, text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
        sections = text.split("\n## ")
        chunks = []
        for section in sections:
            section = section.strip()
            if not section:
                continue
            if len(section) <= chunk_size:
                chunks.append(section)
                continue
            for index in range(0, len(section), chunk_size - overlap):
                chunk = section[index : index + chunk_size]
                if chunk.strip():
                    chunks.append(chunk.strip())
        return chunks

    async def search(self, query: str, position_type: Optional[str] = None, top_k: int = 3) -> List[str]:
        global _faiss_index, _embeddings_model, _chunks

        if not self._initialized or _faiss_index is None or _embeddings_model is None:
            logger.warning("RAG not initialized, return empty retrieval result")
            return []

        try:
            import faiss
            import numpy as np

            query_embedding = _embeddings_model.encode(
                [str(query)],
                batch_size=1,
                show_progress_bar=False,
                convert_to_numpy=True,
            )
            query_embedding = np.array(query_embedding, dtype="float32")
            faiss.normalize_L2(query_embedding)

            search_k = min(max(top_k * 5, top_k), len(_chunks))
            _, indices = _faiss_index.search(query_embedding, search_k)

            results: List[str] = []
            general_results: List[str] = []
            for idx in indices[0]:
                if idx == -1:
                    continue
                chunk = _chunks[idx]
                if position_type and chunk["position_type"] == position_type:
                    results.append(chunk["text"])
                elif chunk["position_type"] == "general":
                    general_results.append(chunk["text"])
                elif not position_type:
                    results.append(chunk["text"])

                if len(results) >= top_k:
                    break

            if len(results) < top_k:
                for item in general_results:
                    if item not in results:
                        results.append(item)
                    if len(results) >= top_k:
                        break
            return results[:top_k]
        except Exception as exc:
            logger.error("RAG search failed: %s", exc)
            return []

    async def get_reference_answer(self, question: str) -> str:
        relevant_docs = await self.search(question, top_k=3)
        return "\n\n---\n\n".join(relevant_docs) if relevant_docs else ""


RAGServiceInstance = RAGService()
