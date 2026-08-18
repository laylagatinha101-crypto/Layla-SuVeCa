import json
import re
from pathlib import Path
from collections import defaultdict

ROOT = Path(r"c:\Users\origi\OneDrive\Desktop\Códigos")
CANONICAL_V2 = ROOT / "Notebook LM" / "Português" / "Integracao_Pedagogica" / "v2" / "canonical"

def read_jsonl(path):
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]

traps = read_jsonl(CANONICAL_V2 / "exam_traps.jsonl")

# Analisar os tópicos canônicos e títulos dos traps
topic_traps = defaultdict(list)
for t in traps:
    top = t.get("canonicalTopicId", "outros")
    topic_traps[top].append(t)

print(f"Total de tópicos com traps: {len(topic_traps)}")
for top, tr_list in sorted(topic_traps.items()):
    print(f"- {top:45}: {len(tr_list)} traps")
