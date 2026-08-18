import { SUVECA_METHOD } from '../data/suvecaMethod.generated';

export const formatSuvecaMethodContext = () => [
  `MÉTODO DO APLICATIVO — ${SUVECA_METHOD.name}`,
  `Equação funcional: ${SUVECA_METHOD.equation}.`,
  SUVECA_METHOD.definition,
  SUVECA_METHOD.authorityNote,
  'PRINCÍPIOS INEGOCIÁVEIS:',
  ...SUVECA_METHOD.principles.map((principle, index) => `${index + 1}. ${principle}`),
  'FLUXO DE ANÁLISE:',
  ...SUVECA_METHOD.workflow.map((step, index) => `${index + 1}. ${step.title}: ${step.instruction}`),
  'PADRÕES QUE PROVAM QUE O MAPA NÃO É UM MOLDE LINEAR:',
  ...SUVECA_METHOD.patterns.map((pattern) => `- ${pattern.surface}: ${pattern.example}`),
].join('\n');

export { SUVECA_METHOD };
