# Relatório de Auditoria de Linha de Base — SuVeCa v2.0 (Pré v2.1)

Este documento estabelece o estado auditável exato da Base Canônica e dos componentes antes da execução do Semantic Hardening & Enrichment.

## 1. Contagens Canônicas Globais

| Coleção Canônica | Registros | Chave Primária | Status Relacional |
|---|:---:|---|---|
| `concepts.jsonl` | **1082** | `entityId` | 100% íntegro (0 broken refs) |
| `connection_maps.jsonl` | **102** | `mapId` | 100% íntegro (0 broken refs) |
| `contrasts.jsonl` | **211** | `entityId` | 100% íntegro (0 broken refs) |
| `editorial_decisions.jsonl` | **181** | `decisionId` | 100% íntegro (0 broken refs) |
| `evidence.jsonl` | **5223** | `evidenceId` | 100% íntegro (0 broken refs) |
| `exam_traps.jsonl` | **600** | `entityId` | 100% íntegro (0 broken refs) |
| `examples.jsonl` | **1602** | `entityId` | 100% íntegro (0 broken refs) |
| `explanation_blocks.jsonl` | **11098** | `entityId` | 100% íntegro (0 broken refs) |
| `learning_objectives.jsonl` | **190** | `entityId` | 100% íntegro (0 broken refs) |
| `limits_exceptions.jsonl` | **125** | `entityId` | 100% íntegro (0 broken refs) |
| `official_questions.jsonl` | **2588** | `officialQuestionId` | 100% íntegro (0 broken refs) |
| `prerequisites.jsonl` | **196** | `entityId` | 100% íntegro (0 broken refs) |
| `procedures.jsonl` | **413** | `entityId` | 100% íntegro (0 broken refs) |
| `question_blocks.jsonl` | **466** | `questionBlockId` | 100% íntegro (0 broken refs) |
| `retrieval_summaries.jsonl` | **102** | `entityId` | 100% íntegro (0 broken refs) |
| `rules.jsonl` | **103** | `entityId` | 100% íntegro (0 broken refs) |
| `tables.jsonl` | **364** | `entityId` | 100% íntegro (0 broken refs) |
| `units.jsonl` | **102** | `unitId` | 100% íntegro (0 broken refs) |

## 2. Diagnóstico de Metadados Genéricos (Oportunidades de Enriquecimento v2.1)

| Entidade Canônica | Total de Entidades | Entidades com Metadado Genérico | Fonte do Conteúdo Rico | Ação na v2.1 |
|---|:---:|:---:|---|---|
| **Rules (`rules.jsonl`)** | 103 | **103** (100%) | `contentBlockRef` | Extrair condições concretas, escopo e modalidade. |
| **Procedures (`procedures.jsonl`)** | 413 | **0** (100%) | `contentBlockRef` | Estruturar inputs, outputs, passos e testes computáveis. |
| **Exam Traps (`exam_traps.jsonl`)** | 600 | **600** (100%) | `contentBlockRef` | Estruturar gatilho, raciocínio enganoso e teste decisivo. |
| **Examples (`examples.jsonl`)** | 1602 | **1602** (100%) | `contentBlockRef` | Extrair prompt real, passos de análise e resultado específico. |

## 3. Governança Editorial e Projeções

- **Decisões Editoriais:** 181/181 aprovadas (`reviewerType: human_editor`).
- **Casos Finais de Tensão:** 98 casos adjudicados e homologados como finais para publicação.
- **Erratas / Falhas Materiais de Bancas:** 19 casos catalogados com imutabilidade de payload e ressalva.

## 4. Estado da Aula 14 (Revisões Cumulativas)

- **Arquivos de Revisão:** 13 arquivos Markdown (`A14-S01` a `A14-S13`) com 6 seções cada.
- **Status:** Pendente de canonicalização em `cumulative_review_units.jsonl` e geração de `CumulativeReviewView`.