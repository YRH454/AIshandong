"""
RAG 知识库服务 — ChromaDB + BGE 中文嵌入（参考 A3LearnMake + AptAdapt）

功能:
  - 文档加载（支持 .md / .txt / .pdf）
  - 分块（RecursiveCharacterTextSplitter, chunk=500, overlap=50）
  - 向量化（BAAI/bge-small-zh-v1.5, 中文优化, 384维）
  - 语义检索（返回 top-k 相关片段）
  - 索引重建

所有 Agent 均可通过 rag_service.retrieve() 获取相关知识库内容。
"""
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# 代理配置（国内环境访问 HuggingFace）
os.environ.setdefault("HTTP_PROXY", "http://127.0.0.1:7897")
os.environ.setdefault("HTTPS_PROXY", "http://127.0.0.1:7897")
os.environ.setdefault("NO_PROXY", "localhost,127.0.0.1")
# 使用官方 HuggingFace Hub（通过代理访问），镜像站可能不稳定
os.environ["HF_ENDPOINT"] = "https://huggingface.co"

# 延迟导入，避免启动时加载大模型
_rag_instance: Optional["RAGService"] = None


class RAGService:
    """ChromaDB 向量知识库 — 单例模式"""

    def __init__(self):
        self._embedding_model = None
        self._vectorstore = None
        self._chroma_client = None
        self.persist_dir = os.path.join(os.path.dirname(__file__), "..", "..", "data", "chroma")
        self.kb_dir = os.path.join(os.path.dirname(__file__), "..", "..", "data", "knowledge_base")
        self._ready = False

    # ── 懒加载 ──

    def _ensure_embedding(self):
        if self._embedding_model is not None:
            return
        try:
            from langchain_community.embeddings import HuggingFaceEmbeddings
            self._embedding_model = HuggingFaceEmbeddings(
                model_name="BAAI/bge-small-zh-v1.5",
                cache_folder="./data/embeddings",
                model_kwargs={"device": "cpu"},
            )
            logger.info("BGE 嵌入模型加载完成")
        except Exception as e:
            logger.warning(f"BGE 嵌入模型加载失败: {e}，回退到简单 TF-IDF 检索")
            self._embedding_model = None

    def _ensure_vectorstore(self):
        if self._vectorstore is not None and self._ready:
            return
        os.makedirs(self.persist_dir, exist_ok=True)
        self._ensure_embedding()

        if self._embedding_model is None:
            self._ready = False
            return

        try:
            from langchain_community.vectorstores import Chroma
            if os.path.exists(os.path.join(self.persist_dir, "chroma.sqlite3")):
                self._vectorstore = Chroma(
                    persist_directory=self.persist_dir,
                    embedding_function=self._embedding_model,
                )
                logger.info(f"ChromaDB 已加载，现有 {self._vectorstore._collection.count()} 条")
            else:
                self._build_index()
            self._ready = True
        except Exception as e:
            logger.warning(f"ChromaDB 初始化失败: {e}")
            self._ready = False

    # ── 索引构建 ──

    def _build_index(self):
        """从 knowledge_base 目录加载文档并构建向量索引"""
        from langchain_community.document_loaders import DirectoryLoader, TextLoader
        from langchain_text_splitters import RecursiveCharacterTextSplitter
        from langchain_community.vectorstores import Chroma

        if not os.path.exists(self.kb_dir):
            os.makedirs(self.kb_dir, exist_ok=True)
            logger.info(f"知识库目录已创建: {self.kb_dir}")
            return

        docs = []
        # 加载 Markdown 文件
        if os.path.isdir(self.kb_dir):
            try:
                loader = DirectoryLoader(
                    self.kb_dir,
                    glob="**/*.md",
                    loader_cls=TextLoader,
                    loader_kwargs={"encoding": "utf-8"},
                )
                docs.extend(loader.load())
            except Exception as e:
                logger.warning(f"加载 .md 文件失败: {e}")

        # 加载纯文本文件
        if os.path.isdir(self.kb_dir):
            try:
                loader = DirectoryLoader(
                    self.kb_dir,
                    glob="**/*.txt",
                    loader_cls=TextLoader,
                    loader_kwargs={"encoding": "utf-8"},
                )
                docs.extend(loader.load())
            except Exception as e:
                logger.warning(f"加载 .txt 文件失败: {e}")

        if not docs:
            logger.info("知识库目录为空，跳过索引构建")
            return

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,
            chunk_overlap=50,
            separators=["\n\n", "\n", "。", "！", "？", ".", "!", "?", " "],
        )
        chunks = splitter.split_documents(docs)
        logger.info(f"文档分块完成: {len(docs)} 文档 → {len(chunks)} 块")

        self._vectorstore = Chroma.from_documents(
            chunks,
            self._embedding_model,
            persist_directory=self.persist_dir,
        )
        self._ready = True
        logger.info(f"向量索引构建完成，{len(chunks)} 个片段已入库")

    # ── 检索 ──

    def retrieve(self, query: str, k: int = 5) -> list[dict]:
        """语义检索相关知识片段

        Returns:
            [{"content": "...", "score": 0.95, "metadata": {...}}, ...]
        """
        self._ensure_vectorstore()

        if not self._ready or self._vectorstore is None:
            return _fallback_keyword_search(query, self.kb_dir, k)

        try:
            results = self._vectorstore.similarity_search_with_score(query, k=k)
            chunks = []
            for doc, score in results:
                chunks.append({
                    "content": doc.page_content,
                    "score": round(float(score), 4),
                    "metadata": doc.metadata,
                })
            return chunks
        except Exception as e:
            logger.warning(f"向量检索失败: {e}，回退关键词检索")
            return _fallback_keyword_search(query, self.kb_dir, k)

    def retrieve_texts(self, query: str, k: int = 5) -> list[str]:
        """便捷方法：只返回文本内容列表"""
        return [c["content"] for c in self.retrieve(query, k)]

    # ── 管理 ──

    def rebuild(self):
        """重建索引（清空旧数据后重新入库）"""
        import shutil
        if os.path.exists(self.persist_dir):
            shutil.rmtree(self.persist_dir)
        self._vectorstore = None
        self._ready = False
        self._build_index()
        logger.info("知识库索引已重建")

    def add_text(self, text: str, metadata: dict = None):
        """直接添加文本片段到知识库"""
        from langchain_text_splitters import RecursiveCharacterTextSplitter
        from langchain_community.vectorstores import Chroma
        from langchain_core.documents import Document

        self._ensure_embedding()
        if self._embedding_model is None:
            return

        splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
        chunks = splitter.split_text(text)
        docs = [Document(page_content=c, metadata=metadata or {}) for c in chunks]

        if self._vectorstore and self._ready:
            self._vectorstore.add_documents(docs)
        else:
            self._vectorstore = Chroma.from_documents(
                docs, self._embedding_model, persist_directory=self.persist_dir
            )
            self._ready = True
        logger.info(f"已添加 {len(chunks)} 个片段到知识库")

    @property
    def is_ready(self) -> bool:
        self._ensure_vectorstore()
        return self._ready

    @property
    def chunk_count(self) -> int:
        if self._vectorstore and self._ready:
            try:
                return self._vectorstore._collection.count()
            except Exception:
                return 0
        return 0


# ── 回退方案：简单关键词检索 ──

def _fallback_keyword_search(query: str, kb_dir: str, k: int = 5) -> list[dict]:
    """当 ChromaDB/BGE 不可用时，使用 jieba 关键词匹配回退"""
    import glob
    try:
        import jieba
        query_words = set(jieba.lcut(query))
    except ImportError:
        query_words = set(query)

    results = []
    for fpath in glob.glob(os.path.join(kb_dir, "**", "*.*"), recursive=True):
        if not fpath.endswith(('.md', '.txt')):
            continue
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                content = f.read()
        except Exception:
            continue

        # 计算关键词命中率
        try:
            import jieba
            content_words = set(jieba.lcut(content))
        except ImportError:
            content_words = set(content)

        hits = len(query_words & content_words)
        score = hits / max(len(query_words), 1)

        # 如果命中 ≥1 个关键词，按句子拆分返回
        if hits > 0:
            sentences = content.replace("\n", " ").split("。")
            for sent in sentences:
                try:
                    import jieba
                    sent_words = set(jieba.lcut(sent))
                except ImportError:
                    sent_words = set(sent)
                sent_hits = len(query_words & sent_words)
                if sent_hits > 0:
                    results.append({
                        "content": sent.strip()[:500],
                        "score": round(sent_hits / max(len(query_words), 1), 4),
                        "metadata": {"source": os.path.basename(fpath)},
                    })

        if len(results) >= k * 3:
            break

    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:k]


# ── 模块级单例 ──

def get_rag_service() -> RAGService:
    global _rag_instance
    if _rag_instance is None:
        _rag_instance = RAGService()
    return _rag_instance


def ensure_indexed() -> bool:
    """启动时确保知识库已建立向量索引(幂等,失败静默,回退关键词检索)"""
    try:
        svc = get_rag_service()
        svc._ensure_vectorstore()
        return svc._ready
    except Exception:
        return False
