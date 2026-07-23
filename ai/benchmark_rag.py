import time
import json
import os
import sys

# 프로젝트 루트 디렉토리를 경로에 추가하여 app 모듈 임포트가 가능하게 함
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.domains.rag.service import search_similar, search_hybrid
from google import genai

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("⚠️ GEMINI_API_KEY 환경변수가 필요합니다.")
    exit(1)
    
client = genai.Client(api_key=GEMINI_API_KEY)

# 테스트 질문 세트
TEST_QUERIES = [
    "수건 추가로 요청하면 비용이 얼마인가요?", # 단순 정보 검색 (Vector가 잘함)
    "방이 너무 더워서 에어컨 고장난 것 같은데, 누가 고치러 오고 수리비 나오나요?" # 다중 부서 및 규정 복합 추론 (Graph가 잘함)
]

def generate_answer(query: str, context: str) -> str:
    prompt = f"""
    당신은 호텔 AI 컨시어지입니다. 다음 제공된 컨텍스트를 바탕으로 고객의 질문에 답하세요.
    
    [컨텍스트]
    {context}
    
    [질문]
    {query}
    """
    response = client.models.generate_content(
        model='gemini-3.1-flash-lite',
        contents=prompt
    )
    return response.text

def run_benchmark():
    print("\n=== RAG 파이프라인 성능 평가 (벤치마크) ===\n")
    
    for query in TEST_QUERIES:
        print(f"▶ 테스트 질문: {query}")
        
        # 1. Vector RAG 단독 테스트
        start_time = time.time()
        # 데이터가 비어있을 수 있으므로 threshold를 0.0으로 설정하여 무조건 가져오게 테스트
        v_results = search_similar(query, domain_code=None, top_k=2, threshold=0.0)
        v_context = json.dumps(v_results, ensure_ascii=False)
        v_answer = generate_answer(query, v_context)
        v_latency = time.time() - start_time
        
        print(f"\n[기존 방식: Vector RAG]")
        print(f"- 응답 시간(Latency): {v_latency:.2f}초")
        print(f"- 검색된 DB 컨텍스트 조각 수: {len(v_results)}개")
        print(f"- 생성된 답변: {v_answer.strip()}\n")
        
        # 2. Hybrid (Vector + Graph) RAG 테스트
        start_time = time.time()
        h_results = search_hybrid(query, domain_code=None, top_k=2, threshold=0.0)
        h_context = json.dumps(h_results, ensure_ascii=False)
        h_answer = generate_answer(query, h_context)
        h_latency = time.time() - start_time
        
        print(f"[신규 방식: Hybrid RAG (Vector + Graph)]")
        print(f"- 응답 시간(Latency): {h_latency:.2f}초")
        print(f"- 검색된 Vector 조각: {len(h_results['vector_context'])}개, Graph 관계: {len(h_results['graph_context'])}개")
        print(f"- 생성된 답변: {h_answer.strip()}\n")
        print("-" * 60 + "\n")

if __name__ == "__main__":
    run_benchmark()
