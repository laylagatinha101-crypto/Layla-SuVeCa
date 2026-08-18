import json
import re
from pathlib import Path

ROOT = Path(r"c:\Users\origi\OneDrive\Desktop\Códigos")
CANONICAL_V2 = ROOT / "Notebook LM" / "Português" / "Integracao_Pedagogica" / "v2" / "canonical"
OUTPUT_FILE = ROOT / "relatorio_incertezas_editoriais_normativas.md"

def read_jsonl(path):
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]

decisions = read_jsonl(CANONICAL_V2 / "editorial_decisions.jsonl")
units = {u["unitId"]: u for u in read_jsonl(CANONICAL_V2 / "units.jsonl")}

conflict_decisions = [d for d in decisions if d.get("decisionType") == "migrated_conflict"]

print(f"Total de Conflitos: {len(conflict_decisions)}")

parsed_items = []

for d in conflict_decisions:
    sp = d.get("sourcePayload", {})
    desc = sp.get("description_markdown", "")
    unit_id = d.get("unitId")
    unit_info = units.get(unit_id, {})
    res = d.get("resolution", {})
    
    # Parse individual sections inside description_markdown
    sections = re.split(r'\n(?=##\s+UNCERTAIN-)', desc)
    for sec in sections:
        sec = sec.strip()
        if not sec:
            continue
        
        # Title
        title_m = re.search(r'##\s+(UNCERTAIN-[^\n]+)', sec)
        title = title_m.group(1) if title_m else "Incerteza Editorial"
        
        # Tensão / Descrição
        desc_m = re.search(r'-\s+\*\*(?:Descrição da Tensão|Descrição|Problema):\*\*\s*(.*?)(?=\n-\s+\*\*|\Z)', sec, re.DOTALL)
        tension = desc_m.group(1).strip() if desc_m else ""
        
        # Resolução Proposta / Pedagógica
        sol_m = re.search(r'-\s+\*\*(?:Resolução Consolidada|Resolução pedagógica|Interpretação e Resolução Teórica|Encaminhamento):\*\*\s*(.*?)(?=\n-\s+\*\*|\Z)', sec, re.DOTALL)
        sol = sol_m.group(1).strip() if sol_m else ""
        
        parsed_items.append({
            "unitId": unit_id,
            "unitTitle": unit_info.get("title", unit_id),
            "lessonId": unit_info.get("lessonId", ""),
            "decisionId": d.get("decisionId"),
            "uncertaintyTitle": title,
            "tension": tension,
            "pedagogicalResolution": sol,
            "finalWording": res.get("finalWording", ""),
            "studentCaveat": res.get("studentCaveat", ""),
            "editorialRationale": res.get("editorialRationale", ""),
            "confidence": res.get("confidence", 1.0),
            "verdict": res.get("verdict", "approve_with_changes"),
        })

print(f"Total de casos individuais de incerteza extraídos: {len(parsed_items)}")

# Classificação temática
categories = {
    "normative_ambiguity": [],     # Ambiguidade / Divergência da Norma Culta
    "exam_board_discrepancy": [],  # Erratas, Falhas Materiais e Divergências entre Bancas (FGV, FCC, Cebraspe)
    "pedagogical_simplification": [], # Tensão Didática vs. Rigor Teórico Estrito
    "contextual_interpretation": [],  # Ambiguidade Semântica e Contextual
}

for item in parsed_items:
    text_lower = (item["uncertaintyTitle"] + " " + item["tension"]).lower()
    if any(k in text_lower for k in ["banca", "consulplan", "idecan", "cebraspe", "cespe", "fgv", "vunesp", "fcc", "erro material", "digitação", "diagramação", "gabarito"]):
        categories["exam_board_discrepancy"].append(item)
    elif any(k in text_lower for k in ["didática", "operacional", "mnemônico", "simplificação", "lousa", "ao vivo", "chat"]):
        categories["pedagogical_simplification"].append(item)
    elif any(k in text_lower for k in ["interpretação", "sentido", "contexto", "duplo sentido", "ambiguidade", "semântica"]):
        categories["contextual_interpretation"].append(item)
    else:
        categories["normative_ambiguity"].append(item)

print(f"- Divergências e Erratas de Bancas: {len(categories['exam_board_discrepancy'])}")
print(f"- Tensões Didática vs. Rigor Normativo: {len(categories['pedagogical_simplification'])}")
print(f"- Ambiguidades Normativas / Doutrinárias: {len(categories['normative_ambiguity'])}")
print(f"- Interpretação e Semântica Contextual: {len(categories['contextual_interpretation'])}")
