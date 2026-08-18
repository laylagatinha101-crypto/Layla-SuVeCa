import { EDITORIAL_DAILY_TIPS } from './editorialDailyTips.generated';

export interface DailyTip {
  id: string;
  category: string;
  rule: string;
  explanation: string;
  example: string;
  moduleId?: string;
}

/**
 * Recorte diário da fonte editorial das aulas 00–14. A seleção é estável por
 * dia para que a pessoa possa voltar à dica sem receber uma resposta diferente.
 */
export const DAILY_TIPS: DailyTip[] = EDITORIAL_DAILY_TIPS;

export const getDailyTip = (date = new Date()): DailyTip => {
  // A data local vira uma semente simples: uma dica por dia, sem depender de rede.
  const daySeed = Math.floor(
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() /
      86_400_000
  );
  return DAILY_TIPS[Math.abs(daySeed) % DAILY_TIPS.length];
};
