import sys
import os
import argparse
import importlib

# ai 디렉토리를 파이썬 경로에 추가
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def run_all_seeds(force: bool = False):
    print("========================================")
    print("🌟 아늑(Aneuk) AI RAG 지식 통합 시딩 🌟")
    print("========================================")

    domains_dir = os.path.join(os.path.dirname(__file__), "app", "domains")
    
    # app/domains/ 아래의 모든 폴더 탐색
    domain_folders = [f for f in os.listdir(domains_dir) if os.path.isdir(os.path.join(domains_dir, f))]
    
    seed_functions = []
    
    for domain in domain_folders:
        seed_file_path = os.path.join(domains_dir, domain, "seed_knowledge.py")
        if os.path.exists(seed_file_path):
            try:
                # 동적으로 모듈 임포트 (예: app.domains.fb.seed_knowledge)
                module_name = f"app.domains.{domain}.seed_knowledge"
                module = importlib.import_module(module_name)
                
                # 모듈 안에서 'seed_' 로 시작하는 함수 찾기
                for attr_name in dir(module):
                    if attr_name.startswith("seed_") and callable(getattr(module, attr_name)):
                        seed_functions.append((domain, getattr(module, attr_name)))
                        break
            except Exception as e:
                print(f"⚠️ [{domain.upper()}] 모듈 로드 중 오류 발생: {e}")

    if not seed_functions:
        print("❌ 실행할 시딩 스크립트(seed_knowledge.py)를 찾지 못했습니다.")
        return

    print(f"총 {len(seed_functions)}개의 도메인 시딩을 시작합니다: {[d[0].upper() for d in seed_functions]}\n")

    success_count = 0
    for domain, func in seed_functions:
        print(f"\n--- 🚀 [{domain.upper()}] 시딩 시작 ---")
        try:
            func(force=force)
            success_count += 1
        except Exception as e:
            print(f"❌ [{domain.upper()}] 시딩 실패: {e}")

    print("\n========================================")
    if success_count == len(seed_functions):
        print(f"✅ 모든 시딩({success_count}/{len(seed_functions)})이 성공적으로 완료되었습니다!")
    else:
        print(f"⚠️ 일부 시딩이 실패했습니다. (성공: {success_count}, 실패: {len(seed_functions) - success_count})")
    print("========================================")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="answer 동일해도 강제 재임베딩")
    args = parser.parse_args()
    run_all_seeds(force=args.force)
