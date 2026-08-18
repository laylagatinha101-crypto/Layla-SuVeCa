#!/usr/bin/env python3
"""
scratch/adversarial_audit_v2_1.py

Auditoria Independente e Adversarial Read-Only sobre a Base Canônica SuVeCa v2.1.
Mede a densidade semântica real vs. preenchimento por fallback/templates.
"""

import json
import re
from pathlib import Path
from collections import Counter, defaultdict

ROOT = Path(r"c:\Users\origi\OneDrive\Desktop\Códigos")
CANONICAL_V2 = ROOT / "Notebook LM" / "Português" / "Integracao_Pedagogica" / "v2" / "canonical"
APP_SRC = ROOT / "SuVeCaSuVeCa" / "src"

def read_jsonl(path):
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]

print("=== EXECUTANDO AUDITORIA ADVERSARIAL READ-ONLY v2.1 ===")

# 1. Auditoria de Misconceptions (600 vs 600)
traps = read_jsonl(CANONICAL_V2 / "exam_traps.jsonl")
misconceptions = read_jsonl(CANONICAL_V2 / "misconceptions.jsonl")
print(f"\n1. MISCONCEPTIONS & TRAPS:")
print(f"- Total de exam_traps: {len(traps)}")
print(f"- Total de misconceptions gerados: {len(misconceptions)}")
single_trap_misconceptions = sum(1 for m in misconceptions if len(m.get("examTrapRefs", [])) == 1)
print(f"- Misconceptions com apenas 1 trap vinculada (1:1): {single_trap_misconceptions} ({single_trap_misconceptions/len(misconceptions)*100:.1f}%)")

# 2. Auditoria de Exemplos (1.602) - Fallback vs Conteúdo Específico
examples = read_jsonl(CANONICAL_V2 / "examples.jsonl")
examples_with_fallback_steps = 0
examples_with_extracted_steps = 0
examples_with_fallback_result = 0
examples_with_specific_prompt = 0

for ex in examples:
    steps = ex.get("analysisSteps", [])
    if any("Localizar a ocorrência do fenômeno linguístico" in s.get("action", "") for s in steps):
        examples_with_fallback_steps += 1
    else:
        examples_with_extracted_steps += 1
        
    res = ex.get("result", "")
    if "Emprego gramatical correto e justificado" in str(res):
        examples_with_fallback_result += 1
        
    prompt = ex.get("prompt", "")
    if prompt and prompt != ex.get("title") and len(prompt) > 10:
        examples_with_specific_prompt += 1

print(f"\n2. EXEMPLOS COMENTADOS (1.602 total):")
print(f"- Prompts específicos e distintos do título: {examples_with_specific_prompt} ({examples_with_specific_prompt/len(examples)*100:.1f}%)")
print(f"- Passos de análise com extração rica de lista: {examples_with_extracted_steps} ({examples_with_extracted_steps/len(examples)*100:.1f}%)")
print(f"- Passos com template estruturado de fallback: {examples_with_fallback_steps} ({examples_with_fallback_steps/len(examples)*100:.1f}%)")
print(f"- Resultados com fallback padronizado: {examples_with_fallback_result} ({examples_with_fallback_result/len(examples)*100:.1f}%)")

# 3. Auditoria de Procedimentos (413) - Fallback vs Conteúdo Específico
procedures = read_jsonl(CANONICAL_V2 / "procedures.jsonl")
proc_with_fallback_steps = 0
proc_with_extracted_steps = 0

for p in procedures:
    steps = p.get("steps", [])
    if any("Identificar a estrutura sintático-morfológica alvo" in s.get("action", "") for s in steps):
        proc_with_fallback_steps += 1
    else:
        proc_with_extracted_steps += 1

print(f"\n3. PROCEDIMENTOS (413 total):")
print(f"- Procedimentos com passos extraídos diretamente da lista: {proc_with_extracted_steps} ({proc_with_extracted_steps/len(procedures)*100:.1f}%)")
print(f"- Procedimentos com template de passos computáveis: {proc_with_fallback_steps} ({proc_with_fallback_steps/len(procedures)*100:.1f}%)")

# 4. Auditoria de Evidence Grounding (1.020)
evidence_links = read_jsonl(CANONICAL_V2 / "evidence_links.jsonl")
print(f"\n4. EVIDENCE GROUNDING (1.020 total):")
print(f"- Total de links gerados: {len(evidence_links)}")
entities_grounded = len(set(el["entityId"] for el in evidence_links))
print(f"- Unidades cobertas por evidências: {entities_grounded}/102")
print(f"- Média de links por unidade: {len(evidence_links)/entities_grounded:.1f}")
print(f"- Granularidade: Associação de nível de UNIDADE (não de claim individual).")

# 5. Auditoria de Frontend: looksLikeConnectionMap e regex em renderizadores
print(f"\n5. FRONTEND: VERIFICAÇÃO DE REGEX E HEURÍSTICAS NO CLIENTE:")
frontend_files = list(APP_SRC.glob("**/*.tsx")) + list(APP_SRC.glob("**/*.ts"))
connection_map_occurrences = []
regex_occurrences = []

for f in frontend_files:
    code = f.read_text(encoding="utf-8")
    if "looksLikeConnectionMap" in code:
        connection_map_occurrences.append(f.name)
    if "PedagogicalUnitRenderer" in f.name or "sections/" in str(f) or "blocks/" in str(f):
        if "RegExp" in code or ".match(" in code or ".test(" in code:
            regex_occurrences.append(f.name)

print(f"- Arquivos ainda contendo looksLikeConnectionMap: {connection_map_occurrences}")
print(f"- Componentes de exibição pedagógica usando regex: {regex_occurrences}")
