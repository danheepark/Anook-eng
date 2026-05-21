import sys
import os

from app.infrastructure.database.connection import get_db_connection
from app.domains.rag.service import upsert_knowledge_entry
from app.domains.front.knowledge_data import FRONT_KNOWLEDGE

def seed_front_knowledge(force: bool = False):
    print("🚀 프론트데스크(FRONT) RAG 지식 시딩을 시작합니다...")

    conn = get_db_connection()
    stats = {"inserted": 0, "updated": 0, "skipped": 0}
    try:
        with conn.cursor() as cur:
            for item in FRONT_KNOWLEDGE:
                question = item["question"]
                answer = item["answer"]

                result = upsert_knowledge_entry(cur, "FRONT", question, answer, force=force)
                stats[result] += 1

                if result == "inserted":
                    print(f"✅ 신규 등록: {question[:30]}...")
                elif result == "updated":
                    print(f"🔄 내용 수정: {question[:30]}...")
                else:
                    print(f"⏩ 변경 없음: {question[:30]}...")

        conn.commit()
        print(
            f"\n🎉 [FRONT] 시딩 완료 - "
            f"신규 {stats['inserted']}건, 수정 {stats['updated']}건, 건너뜀 {stats['skipped']}건"
        )
    except Exception as e:
        conn.rollback()
        print(f"\n❌ 시딩 중 오류 발생: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="answer 동일해도 강제 재임베딩")
    args = parser.parse_args()
    seed_front_knowledge(force=args.force)
