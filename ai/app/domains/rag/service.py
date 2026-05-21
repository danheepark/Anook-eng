from typing import List, Dict, Any, Optional
import os
from neo4j import GraphDatabase
from app.infrastructure.embedding.client import generate_embedding
from app.infrastructure.database.connection import get_db_connection
from app.core.config import settings

NEO4J_URI = settings.NEO4J_URI
NEO4J_USER = settings.NEO4J_USER
NEO4J_PASSWORD = settings.NEO4J_PASSWORD

# Neo4j Driver (Connection Pool) - Singleton
_neo4j_driver = None

def get_neo4j_driver():
    global _neo4j_driver
    if _neo4j_driver is None:
        auth = (NEO4J_USER, NEO4J_PASSWORD) if NEO4J_PASSWORD else None
        _neo4j_driver = GraphDatabase.driver(NEO4J_URI, auth=auth)
    return _neo4j_driver

def init_neo4j_driver():
    """서버 구동 시점에 미리 호출하여 연결을 맺고 검증(Fail-Fast)합니다."""
    driver = get_neo4j_driver()
    driver.verify_connectivity()
    return driver

def search_graph(query: str) -> List[Dict[str, Any]]:
    """
    사용자 질문에서 키워드를 바탕으로 Neo4j 그래프 데이터베이스를 탐색합니다.
    """
    driver = get_neo4j_driver()
    results = []
    try:
        with driver.session() as session:
            # 질문 문자열 내에 노드의 이름이 포함되어 있으면 연관된 관계를 전부 추출
            cypher_query = """
            MATCH (n)
            WHERE $search_keyword CONTAINS n.name
            MATCH (n)-[r]->(m)
            RETURN n.name AS source, type(r) AS relation, m.name AS target
            """
            rows = session.run(cypher_query, search_keyword=query)
            
            for row in rows:
                results.append({
                    "source": row["source"],
                    "relation": row["relation"],
                    "target": row["target"]
                })
    except Exception as e:
        print(f"Graph Search Error: {e}")
    
    return results

def search_hybrid(query: str, domain_code: str, top_k: int = 3, threshold: float = 0.7) -> List[Dict[str, Any]]:
    """
    Vector RAG와 Graph RAG를 결합한 하이브리드 검색을 수행합니다.
    (기존 시스템과의 완벽한 호환성을 위해 동일한 List[Dict] 형태로 반환합니다)
    """
    vector_results = search_similar(query, domain_code, top_k, threshold)
    graph_results = search_graph(query)
    
    # Graph 결과를 Vector 형태처럼 포장하여 기존 로직(필터링/프롬프트 주입)이 깨지지 않도록 방지
    for g in graph_results:
        vector_results.append({
            "id": None,
            "question": f"[Graph Fact] {g['source']}",
            "answer": f"{g['source']} --({g['relation']})--> {g['target']}",
            "domain_code": domain_code,
            "status": "APPROVED",
            "similarity": 0.99  # 그래프 지식은 확정적 지식이므로 높은 신뢰도 부여
        })
    
    return vector_results

def embed_text(text: str) -> List[float]:
    """
    텍스트를 임베딩 벡터로 변환합니다.
    """
    return generate_embedding(text)


def upsert_knowledge_entry(cur, domain_code: str, question: str, answer: str, force: bool = False) -> str:
    """
    질문 단위로 knowledge_entry를 INSERT/UPDATE/SKIP 분기 처리합니다.

    - 신규 질문: 임베딩 생성 후 INSERT
    - 기존 질문 & answer 변경됨: 임베딩 재생성 후 UPDATE
    - 기존 질문 & answer 동일: 재임베딩 없이 SKIP
    - force=True: answer 동일해도 강제 재임베딩 후 UPDATE (모델 교체 시 사용)

    반환값: "inserted" | "updated" | "skipped"
    """
    cur.execute(
        "SELECT answer FROM knowledge_entry WHERE domain_code = %s AND question = %s",
        (domain_code, question),
    )
    row = cur.fetchone()

    if row is not None and row[0] == answer and not force:
        return "skipped"

    embedding_vector = embed_text(f"질문: {question}\n답변: {answer}")

    # ON CONFLICT DO UPDATE로 race condition 원천 차단 (AN-351 UNIQUE 제약과 연동)
    cur.execute(
        """
        INSERT INTO knowledge_entry (question, answer, domain_code, status, embedding)
        VALUES (%s, %s, %s, 'APPROVED', %s::vector)
        ON CONFLICT (domain_code, question) DO UPDATE SET
            answer = EXCLUDED.answer,
            embedding = EXCLUDED.embedding,
            updated_at = NOW()
        """,
        (question, answer, domain_code, embedding_vector),
    )
    return "inserted" if row is None else "updated"

def search_similar(query: str, domain_code: str, top_k: int = 3, threshold: float = 0.7) -> List[Dict[str, Any]]:
    """
    쿼리와 유사한 지식 엔트리를 데이터베이스에서 검색합니다.
    - 코사인 유사도를 사용합니다. (1 - (embedding <=> query_embedding))
    - threshold 미만인 결과는 제외합니다.
    """
    query_embedding = generate_embedding(query)
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # pgvector의 코사인 거리 연산자 <=> 를 사용 (거리가 작을수록 유사함)
            # 유사도 = 1 - (embedding <=> %s)
            if domain_code:
                sql = """
                    SELECT id, question, answer, domain_code, status,
                           1 - (embedding <=> %s::vector) AS similarity
                    FROM knowledge_entry
                    WHERE domain_code IN (%s, 'COMMON') AND status = 'APPROVED'
                    AND 1 - (embedding <=> %s::vector) >= %s
                    ORDER BY similarity DESC
                    LIMIT %s
                """
                cur.execute(sql, (query_embedding, domain_code, query_embedding, threshold, top_k))
            else:
                # domain_code가 없으면 전체 도메인에서 검색
                sql = """
                    SELECT id, question, answer, domain_code, status,
                           1 - (embedding <=> %s::vector) AS similarity
                    FROM knowledge_entry
                    WHERE status = 'APPROVED'
                    AND 1 - (embedding <=> %s::vector) >= %s
                    ORDER BY similarity DESC
                    LIMIT %s
                """
                cur.execute(sql, (query_embedding, query_embedding, threshold, top_k))
            rows = cur.fetchall()
            
            results = []
            for row in rows:
                results.append({
                    "id": row[0],
                    "question": row[1],
                    "answer": row[2],
                    "domain_code": row[3],
                    "status": row[4],
                    "similarity": row[5]
                })
            return results
    finally:
        conn.close()

def search_exact(query: str) -> List[Dict[str, Any]]:
    """
    질문(question)이 쿼리와 정확히 일치하는 지식 엔트리를 검색합니다.
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            sql = """
                SELECT id, question, answer, domain_code, status
                FROM knowledge_entry
                WHERE question = %s AND status = 'APPROVED'
            """
            cur.execute(sql, (query,))
            rows = cur.fetchall()
            
            results = []
            for row in rows:
                results.append({
                    "id": row[0],
                    "question": row[1],
                    "answer": row[2],
                    "domain_code": row[3],
                    "status": row[4],
                    "similarity": 1.0
                })
            return results
    finally:
        conn.close()

def get_all_answers_by_domain(domain_code: str) -> List[str]:
    """
    특정 도메인의 모든 승인된 답변(answer) 리스트를 가져옵니다.
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            sql = "SELECT answer FROM knowledge_entry WHERE domain_code = %s AND status = 'APPROVED'"
            cur.execute(sql, (domain_code,))
            rows = cur.fetchall()
            return [row[0] for row in rows]
    finally:
        conn.close()
