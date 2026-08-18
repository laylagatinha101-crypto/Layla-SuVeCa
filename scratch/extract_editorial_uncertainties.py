import json
from pathlib import Path
from collections import defaultdict

ROOT = Path(r"c:\Users\origi\OneDrive\Desktop\Códigos")
CANONICAL_V2 = ROOT / "Notebook LM" / "Português" / "Integracao_Pedagogica" / "v2" / "canonical"
OUTPUT_FILE = ROOT / "relatorio_incertezas_editoriais_normativas.md"

def read_jsonl(path):
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]

decisions = read_jsonl(CANONICAL_V2 / "editorial_decisions.jsonl")
units = read_jsonl(CANONICAL_V2 / "units.jsonl")
evidence = read_jsonl(CANONICAL_V2 / "evidence.jsonl")

# Categorização dos conflitos e incertezas
conflict_decisions = [d for d in decisions if d.get("decisionType") == "migrated_conflict"]

print(f"Total de Decisões Editoriais: {len(decisions)}")
print(f"Total de Conflitos e Incertezas Mapeados: {len(conflict_decisions)}")

# Extrair tipos de incerteza
uncertainty_types = defaultdict(list)

for d in conflict_decisions:
    sp = d.get("sourcePayload", {})
    t = sp.get("type", "generic_uncertainty")
    desc = sp.get("description_markdown", "")
    res = d.get("resolution", {})
    
    uncertainty_types[t].append({
        "decisionId": d.get("decisionId"),
        "unitId": d.get("unitId"),
        "topicId": sp.get("canonical_topic_id"),
        "type": t,
        "description": desc,
        "verdict": res.get("verdict"),
        "finalWording": res.get("finalWording"),
        "prevailingSource": res.get("prevailingSource"),
        "studentCaveat": res.get("studentCaveat"),
        "editorialRationale": res.get("editorialRationale"),
        "requiredChanges": res.get("requiredChanges", []),
        "confidence": res.get("confidence"),
        "status": d.get("status")
    })

print("\nDistribuição de Tipos:")
for k, v in uncertainty_types.items():
    print(f"- {k}: {len(v)} casos")
