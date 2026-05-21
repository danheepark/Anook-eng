import os
import re

def resolve_engine(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Pattern for run_*_agent
    pattern = r'<<<<<<< HEAD\n(async def run_[a-z_]+_agent\(.*?, system_language: str = "ko"\) -> dict:)\n=======\n(async def run_[a-z_]+_agent\(.*?, active_requests: list = None\) -> dict:)\n>>>>>>> origin/dev'
    
    def repl(match):
        return match.group(1).replace(') -> dict:', ', active_requests: list = None) -> dict:')

    new_content = re.sub(pattern, repl, content)
    
    # Pattern for route function in router_engine
    if "router_engine.py" in file_path:
        router_pattern = r'<<<<<<< HEAD\n(def route\(.*?, system_language: str = "ko"\) -> List\[RouterOutputSchema\]:)\n=======\n(def route\(.*?, active_requests: List\[str\] = None\) -> List\[RouterOutputSchema\]:)\n>>>>>>> origin/dev'
        def repl_router(match):
            return match.group(1).replace(') -> List[RouterOutputSchema]:', ', active_requests: List[str] = None) -> List[RouterOutputSchema]:')
        new_content = re.sub(router_pattern, repl_router, new_content)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)

engine_dir = "ai/app/core"
for filename in os.listdir(engine_dir):
    if filename.endswith("_engine.py"):
        resolve_engine(os.path.join(engine_dir, filename))

# For analyze.py
def resolve_analyze():
    with open("ai/app/api/analyze.py", 'r', encoding='utf-8') as f:
        content = f.read()

    # Route call
    route_pattern = r'<<<<<<< HEAD\n(\s*router_results = route\(.*?, request\.system_language\))\n=======\n(\s*router_results = route\(.*?, getattr\(request, \'active_requests\', \[\]\)\))\n>>>>>>> origin/dev'
    def repl_route(match):
        return match.group(1).replace('request.system_language)', 'getattr(request, \'active_requests\', []), request.system_language)')
    content = re.sub(route_pattern, repl_route, content)

    # run_*_agent calls
    agent_pattern = r'<<<<<<< HEAD\n(\s*system_language=request\.system_language)\n=======\n(\s*active_requests=getattr\(request, \'active_requests\', \[\]\))\n>>>>>>> origin/dev'
    def repl_agent(match):
        return match.group(1) + ",\n" + match.group(2)
    content = re.sub(agent_pattern, repl_agent, content)

    with open("ai/app/api/analyze.py", 'w', encoding='utf-8') as f:
        f.write(content)

resolve_analyze()
print("Engines and analyze.py resolved")
