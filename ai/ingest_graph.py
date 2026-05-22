import os
import sys
import json
import time
import hashlib
import importlib
from neo4j import GraphDatabase
from google import genai

# ai 디렉토리를 파이썬 경로에 추가
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# 환경변수 로드 (기본값 설정)
# 도커 내부에서 실행하기 위해 anook-neo4j-local 지정
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://anook-neo4j-local:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "anook2026")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") # .env에 설정된 키를 불러옵니다.

if not GEMINI_API_KEY:
    print("⚠️ GEMINI_API_KEY 환경변수가 설정되지 않았습니다.")
    exit(1)

client = genai.Client(api_key=GEMINI_API_KEY)


def compute_text_hash(text: str) -> str:
    """텍스트의 SHA-256 해시를 16진수 문자열로 반환합니다."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def connect_neo4j_with_retry(max_attempts: int = 5, base_delay: float = 1.0):
    """
    Neo4j 드라이버를 생성하고 연결을 검증합니다.
    컨테이너가 켜지는 중일 수 있으므로 지수 백오프(1s → 2s → 4s → 8s → 16s)로 재시도합니다.
    """
    auth = (NEO4J_USER, NEO4J_PASSWORD) if NEO4J_PASSWORD else None
    last_error = None
    for attempt in range(1, max_attempts + 1):
        try:
            driver = GraphDatabase.driver(NEO4J_URI, auth=auth)
            driver.verify_connectivity()
            if attempt > 1:
                print(f"✅ Neo4j 연결 성공 (시도 {attempt}/{max_attempts})")
            return driver
        except Exception as e:
            last_error = e
            if attempt < max_attempts:
                delay = base_delay * (2 ** (attempt - 1))
                print(f"⏳ Neo4j 연결 실패 (시도 {attempt}/{max_attempts}): {e}. {delay:.0f}초 후 재시도...")
                time.sleep(delay)
    raise RuntimeError(f"Neo4j 연결 최종 실패: {last_error}")


def should_skip_ingestion(session, domain: str, new_hash: str) -> bool:
    """
    이중 검증으로 스킵 여부를 판단합니다.
    - 저장된 해시와 새 해시가 일치하고
    - 실제 데이터 노드(SystemMeta 제외)가 존재하면 스킵
    Neo4j가 초기화되어 데이터가 날아간 경우에도 안전하게 다시 적재됩니다.
    """
    record = session.run(
        "MATCH (m:SystemMeta {domain: $domain}) RETURN m.hash AS hash",
        domain=domain,
    ).single()
    stored_hash = record["hash"] if record else None

    if stored_hash != new_hash:
        return False

    record = session.run(
        "MATCH (n) WHERE NOT n:SystemMeta RETURN count(n) AS cnt"
    ).single()
    data_count = record["cnt"] if record else 0
    return data_count > 0


def update_system_meta_tx(tx, domain: str, new_hash: str):
    """SystemMeta 노드의 해시를 갱신합니다. (트랜잭션 내부 실행)"""
    tx.run(
        """
        MERGE (m:SystemMeta {domain: $domain})
        SET m.hash = $hash, m.updated_at = datetime()
        """,
        domain=domain,
        hash=new_hash,
    )


def execute_domain_ingestion_transaction(tx, domain: str, graph_data: dict, new_hash: str):
    """
    적재 + 해시 갱신을 단일 트랜잭션으로 처리 (ALL-OR-NOTHING).
    적재 실패 시 SystemMeta가 갱신되지 않아 다음 실행 시 자동 재시도됨.
    """
    ingest_to_neo4j_tx(tx, graph_data)
    update_system_meta_tx(tx, domain, new_hash)


def extract_entities_and_relations(text):
    prompt = f"""
    당신은 호텔 데이터베이스 데이터 마이닝 전문가입니다.
    다음 제공된 호텔 규정 매뉴얼 텍스트를 분석하여, Knowledge Graph 구성을 위한 엔티티(Entity)와 관계(Relation)를 추출하세요.
    결과는 반드시 유효한 JSON 포맷의 문자열로만 반환하세요. (마크다운 백틱 제외)

    [엔티티 타입 제한]
    - Department: 부서 이름 (예: 하우스키핑, 시설관리팀, 프론트데스크 등)
    - Item: 물품 또는 서비스 이름 (예: 수건, 에어컨, 생수 등)
    - Rule: 요금, 규정, 정책 (예: 수건 1장당 1000원, 무상 수리 등)

    [관계 타입 제한]
    - HANDLED_BY: Item -> Department (예: 수건은 하우스키핑이 처리한다)
    - GOVERNED_BY: Item -> Rule (예: 수건은 '1장당 1000원'이라는 규정을 따른다)

    [분석할 텍스트]
    {text}

    [출력 JSON 포맷 예시]
    {{
        "entities": [
            {{"id": "수건", "label": "Item"}},
            {{"id": "하우스키핑", "label": "Department"}},
            {{"id": "추가 1장당 1000원 부과", "label": "Rule"}}
        ],
        "relations": [
            {{"source": "수건", "target": "하우스키핑", "type": "HANDLED_BY"}},
            {{"source": "수건", "target": "추가 1장당 1000원 부과", "type": "GOVERNED_BY"}}
        ]
    }}
    """

    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt
    )
    try:
        # JSON 포맷만 남기도록 파싱
        clean_json = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(clean_json)
    except Exception as e:
        print("JSON 파싱 에러:", e)
        print("원본 응답:", response.text)
        return None

def ingest_to_neo4j_tx(tx, graph_data):
    """트랜잭션을 통해 엔티티/관계를 MERGE 합니다."""
    for entity in graph_data.get("entities", []):
        label = entity["label"]
        name = entity["id"]
        query = f"MERGE (n:{label} {{name: $name}})"
        tx.run(query, name=name)

    for rel in graph_data.get("relations", []):
        source_name = rel["source"]
        target_name = rel["target"]
        rel_type = rel["type"]
        query = f"""
        MATCH (source {{name: $source_name}})
        MATCH (target {{name: $target_name}})
        MERGE (source)-[r:{rel_type}]->(target)
        """
        tx.run(query, source_name=source_name, target_name=target_name)

def get_all_knowledge_texts():
    """모든 도메인의 knowledge_data.py에서 질문과 답변을 추출하여 텍스트로 결합"""
    domains_dir = os.path.join(os.path.dirname(__file__), "app", "domains")
    domain_folders = [f for f in os.listdir(domains_dir) if os.path.isdir(os.path.join(domains_dir, f))]

    domain_texts = {}
    for domain in domain_folders:
        knowledge_file = os.path.join(domains_dir, domain, "knowledge_data.py")
        if os.path.exists(knowledge_file):
            try:
                module_name = f"app.domains.{domain}.knowledge_data"
                module = importlib.import_module(module_name)

                # 모듈에서 리스트 형태의 KNOWLEDGE 변수 찾기 (예: FB_KNOWLEDGE, HK_KNOWLEDGE)
                for attr_name in dir(module):
                    if attr_name.endswith("_KNOWLEDGE") and isinstance(getattr(module, attr_name), list):
                        knowledge_list = getattr(module, attr_name)
                        texts = []
                        for item in knowledge_list:
                            texts.append(f"Q: {item['question']}\nA: {item['answer']}")
                        texts.sort()  # 항목 순서 변경에 의한 해시 만료 방지
                        domain_texts[domain] = "\n\n".join(texts)
                        break
            except Exception as e:
                print(f"⚠️ [{domain.upper()}] 지식 로드 중 오류 발생: {e}")

    return domain_texts

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="해시 일치해도 Gemini 재호출 및 재적재 강제 실행")
    args = parser.parse_args()

    print("====================================")
    print("1. 모든 도메인의 RAG 지식 데이터 수집")
    print("====================================")

    domain_texts = get_all_knowledge_texts()
    if not domain_texts:
        print("❌ 수집된 지식 데이터가 없습니다.")
        exit(1)

    print(f"✅ 총 {len(domain_texts)}개 도메인의 지식 데이터를 찾았습니다: {list(domain_texts.keys())}")

    print("\n====================================")
    print("2. Neo4j 연결 (필요 시 재시도)")
    print("====================================")
    driver = connect_neo4j_with_retry()

    print("\n====================================")
    print("3. 도메인별 해시 검증 후 적재 (Incremental)")
    print("====================================")

    stats = {"skipped": 0, "processed": 0, "failed": 0}
    total_entities = 0
    total_relations = 0

    try:
        for domain, text in domain_texts.items():
            print(f"\n--- 🚀 [{domain.upper()}] ---")
            new_hash = compute_text_hash(text)

            # 도메인별로 세션을 새로 열어 한 도메인의 에러가 다음 도메인에 전파되지 않게 격리
            try:
                with driver.session() as session:
                    if not args.force and should_skip_ingestion(session, domain, new_hash):
                        print(
                            f"⏩ [{domain.upper()}] 변경 없음 - Gemini 호출 스킵 "
                            f"(hash: {new_hash[:8]}...)"
                        )
                        stats["skipped"] += 1
                        continue

                    print(f"🔄 [{domain.upper()}] 변경 감지 - Gemini로 분석 요청 중...")
                    graph_data = extract_entities_and_relations(text)

                    if not graph_data:
                        print(f"❌ [{domain.upper()}] 데이터 추출 실패 - 다음 도메인으로 진행")
                        stats["failed"] += 1
                        continue

                    entities_count = len(graph_data.get("entities", []))
                    relations_count = len(graph_data.get("relations", []))
                    total_entities += entities_count
                    total_relations += relations_count

                    print(
                        f"[{domain.upper()}] 추출 완료: "
                        f"엔티티 {entities_count}개, 관계 {relations_count}개"
                    )
                    session.execute_write(
                        execute_domain_ingestion_transaction,
                        domain,
                        graph_data,
                        new_hash,
                    )
                    stats["processed"] += 1
                    print(f"✅ [{domain.upper()}] 적재 완료 (hash: {new_hash[:8]}...)")
            except Exception as e:
                print(f"❌ [{domain.upper()}] 처리 중 오류 발생: {e}")
                stats["failed"] += 1
    finally:
        driver.close()

    print("\n====================================")
    print(
        f"🎉 파이프라인 완료! "
        f"처리 {stats['processed']}, 스킵 {stats['skipped']}, 실패 {stats['failed']} | "
        f"누적 엔티티 {total_entities}, 관계 {total_relations}"
    )
    print("http://localhost:7474 에서 확인하세요.")
