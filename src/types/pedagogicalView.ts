/**
 * Contrato Canônico de Apresentação (View Model V1 / V2.1)
 * Boundary estrito entre a base canônica v2.1 e o frontend React do SuVeCa.
 */

export type ContentBlockType =
  | 'paragraph'
  | 'heading'
  | 'list'
  | 'formula'
  | 'table_ref'
  | 'callout'
  | 'code'
  | 'diagram';

export interface ParagraphBlock {
  type: 'paragraph';
  text: string;
}

export interface HeadingBlock {
  type: 'heading';
  level: number;
  text: string;
}

export interface ListBlock {
  type: 'list';
  ordered: boolean;
  items: string[];
}

export interface FormulaBlock {
  type: 'formula';
  text: string;
}

export interface TableRefBlock {
  type: 'table_ref';
  tableId: string;
  /** Tabela resolvida diretamente em tempo de build para evitar buscas adicionais */
  table?: CanonicalTableView;
}

export interface CalloutBlock {
  type: 'callout';
  text: string;
  kind?: 'objective' | 'method_limit' | 'insight' | 'warning' | 'default';
}

export interface CodeBlock {
  type: 'code';
  language?: string;
  text: string;
}

export interface DiagramBlock {
  type: 'diagram';
  diagramType: 'tree' | 'flow' | 'classification' | 'relationship' | 'connection_map';
  text?: string;
  nodes?: ConnectionMapNode[];
  edges?: ConnectionMapEdge[];
}

export type ContentBlock =
  | ParagraphBlock
  | HeadingBlock
  | ListBlock
  | FormulaBlock
  | TableRefBlock
  | CalloutBlock
  | CodeBlock
  | DiagramBlock;

export interface CanonicalTableView {
  tableId: string;
  caption?: string;
  headers: string[];
  rows: string[][];
}

export interface ConnectionMapNode {
  nodeId: string;
  label: string;
  nodeType: 'topic' | 'concept' | 'rule' | 'method' | 'trap' | 'example' | 'contrast';
  metadata?: Record<string, unknown>;
}

export interface ConnectionMapEdge {
  from: string;
  to: string;
  relation: string;
  label?: string;
}

export interface ConnectionMapView {
  mapId: string;
  title?: string;
  mapType: string;
  nodes: ConnectionMapNode[];
  edges: ConnectionMapEdge[];
  rawAscii?: string;
}

export interface SuvecaConnectionView {
  level: 'central' | 'strong' | 'support' | 'indirect' | 'outside_core' | 'review';
  label: string;
  summary: string;
  steps: string[];
  limits: string[];
  primaryLinguisticLayer?: string;
  entryPoint?: string;
  decisiveTests?: string[];
  contrasts?: string[];
  examTraps?: string[];
  syntacticMapExtensions?: string[];
}

export interface CanonicalEntityView {
  entityId: string;
  title: string;
  statement?: string;
  scope?: string;
  modality?: string;
  conditions?: string[];
  exceptions?: string[];
  blocks: ContentBlock[];
}

export interface ProcedureView {
  procedureId: string;
  title: string;
  objective?: string;
  inputs?: { name: string; description: string }[];
  steps?: { order: number; action: string; explanation?: string; test?: string }[];
  outputs?: { name: string; description: string }[];
  formulas?: string[];
  blocks: ContentBlock[];
}

export interface ContrastView {
  contrastId: string;
  title: string;
  contrastType?: string;
  conceptA?: string;
  conceptB?: string;
  sideA?: { label: string; criteria: string[] };
  sideB?: { label: string; criteria: string[] };
  decisionCriterion?: string;
  blocks: ContentBlock[];
}

export interface WorkedExampleView {
  exampleId: string;
  title: string;
  prompt?: string;
  analysisSteps?: { order: number; action: string; rationale?: string }[];
  result?: string;
  decisivePoint?: string;
  commonMistake?: string;
  examTip?: string;
  blocks: ContentBlock[];
}

export interface ExamTrapView {
  trapId: string;
  title: string;
  trigger?: string;
  misleadingReasoning?: string;
  expectedWrongConclusion?: string;
  correctReasoning?: string;
  decisiveTest?: string;
  studentCaveat?: string;
  errorPattern?: string;
  correctiveRule?: string;
  blocks: ContentBlock[];
}

export interface OfficialQuestionOptionView {
  label: string;
  text: string;
}

export interface QuestionPedagogicalEvaluation {
  officialAnswer: string;
  acceptedPedagogicalAnswers?: string[];
  anomalyType?: 'material_error' | 'exam_board_divergence' | 'ambiguous_item';
  editorialCaseRef?: string;
  explanation?: string;
}

export interface DistractorAnalysisView {
  optionLabel: string;
  status: 'correct' | 'incorrect' | 'officially_correct_but_contested' | 'theoretically_defensible';
  explanation: string;
  decisiveCriterion?: string;
}

export interface OfficialQuestionView {
  questionId: string;
  questionType: 'multiple_choice' | 'true_false' | 'certo_errado';
  examBoard?: string;
  organization?: string;
  year?: number;
  role?: string;
  prompt: string;
  options: OfficialQuestionOptionView[];
  officialAnswer?: string;
  explanation?: string;
  questionSha256?: string;
  answerSha256?: string;
  // Question Intelligence v2.1
  cognitiveDemand?: string;
  solutionStrategy?: string;
  pedagogicalEvaluation?: QuestionPedagogicalEvaluation;
  distractorAnalysis?: DistractorAnalysisView[];
}

export interface PedagogicalUnitSections {
  suveca: SuvecaConnectionView;
  prerequisites?: {
    blocks: ContentBlock[];
    maps?: ConnectionMapView[];
  };
  explanation?: {
    blocks: ContentBlock[];
  };
  rules?: {
    items: CanonicalEntityView[];
  };
  resolution?: {
    procedures: ProcedureView[];
  };
  contrasts?: {
    items: ContrastView[];
  };
  examples?: {
    items: WorkedExampleView[];
  };
  mnemonics?: {
    blocks: ContentBlock[];
  };
  traps?: {
    items: ExamTrapView[];
    supplementaryBlocks?: ContentBlock[];
  };
  glossary?: {
    blocks: ContentBlock[];
  };
  recall?: {
    blocks: ContentBlock[];
  };
}

export interface PedagogicalUnitView {
  viewSchemaVersion: '1.0.0';
  source: {
    unitId: string;
    canonicalSchemaVersion: string;
    buildId: string;
    generatedAt: string;
  };
  unit: {
    unitId: string;
    lessonId: string;
    groupId: string;
    title: string;
    variant: string;
    canonicalTopicId: string;
    learningObjectives: string[];
  };
  sections: PedagogicalUnitSections;
  officialQuestions?: OfficialQuestionView[];
}

export interface CumulativeReviewView {
  viewSchemaVersion: '1.0.0';
  unitType: 'cumulative_review';
  source: {
    unitId: string;
    lessonId: 'A14';
    generatedAt: string;
  };
  unit: {
    unitId: string;
    lessonId: 'A14';
    sectionId: string;
    title: string;
    objective: string;
  };
  sections: {
    suveca: SuvecaConnectionView;
    conceptMap: { items: string[] };
    prioritizedRules: { items: string[] };
    structuredSynthesis: { blocks: ContentBlock[] };
    recoveryExamples: { blocks: ContentBlock[] };
    activeReviewProtocol: { items: string[] };
  };
}

export interface PedagogicalViewsManifest {
  viewSchemaVersion: '1.0.0';
  sourceBuildId: string;
  unitsCount: number;
  standardUnitsCount?: number;
  cumulativeUnitsCount?: number;
  tablesCorpusCount: number;
  tablesEmbeddedCount: number;
  questionBlocksCount: number;
  linkedOfficialQuestionOccurrences: number;
  linkedOfficialQuestionsUnique: number;
  officialQuestionsCorpusCount: number;
  unresolvedRefs: 0;
  unknownBlockTypes: 0;
  generatedAt: string;
  generatedUnits: string[];
}
