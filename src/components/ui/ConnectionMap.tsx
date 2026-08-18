import React from 'react';
import { PorquesVisualGuide } from './PorquesVisualGuide';
import { SyllablePhoneticsVisualGuide } from './SyllablePhoneticsVisualGuide';
import { PedagogicalFlowchart } from './PedagogicalFlowchart';
import { PedagogicalTreeDiagram } from './PedagogicalTreeDiagram';

interface ConnectionMapProps {
  source: string;
}

export const looksLikeConnectionMap = (source: string) => {
  if (!source || typeof source !== 'string') return false;
  if (source.includes('EMPREGO DOS PORQUÊS') || (source.includes('PORQUÊ') && source.includes('POR QUÊ'))) {
    return true;
  }
  if (source.includes('ESTUDO DA SÍLABA') || source.includes('ENCONTROS VOCÁLICOS')) {
    return true;
  }
  if (source.includes('[INÍCIO') || source.includes('[Início') || (source.includes('PASSO 1:') && source.includes('PASSO 2:'))) {
    return true;
  }
  const connectorMatches = source.match(/[─-╿←-⇿▼▲◆|]/gu)?.length || 0;
  const lines = source.split(/\r?\n/).length;
  return connectorMatches >= 4 && lines >= 3;
};

export const ConnectionMap: React.FC<ConnectionMapProps> = ({ source }) => {
  // 1. Specialized Guide: Os 4 Porquês
  if (source.includes('EMPREGO DOS PORQUÊS') || (source.includes('PORQUÊ') && source.includes('PORQUE') && source.includes('POR QUÊ'))) {
    return <PorquesVisualGuide />;
  }

  // 2. Specialized Guide: Estudo da Sílaba e Fonética
  if (source.includes('ESTUDO DA SÍLABA') || source.includes('ENCONTROS VOCÁLICOS') || source.includes('Mantra da Vogal')) {
    return <SyllablePhoneticsVisualGuide />;
  }

  // 3. Algoritmos e Fluxogramas Decisórios
  if (source.includes('[INÍCIO') || source.includes('[Início') || (source.includes('PASSO 1:') && (source.includes('PASSO 2:') || source.includes('SIM:')))) {
    return <PedagogicalFlowchart source={source} />;
  }

  // 4. Árvores Sintáticas e Taxonomias Estruturadas
  return <PedagogicalTreeDiagram source={source} />;
};
