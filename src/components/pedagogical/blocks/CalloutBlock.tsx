import React from 'react';
import type { CalloutBlock as CalloutBlockType } from '../../../types/pedagogicalView';
import { PedagogicalCallout } from '../../ui/PedagogicalCallout';
import { InlineRichText } from './InlineRichText';

interface CalloutBlockProps {
  block: CalloutBlockType;
}

export const CalloutBlock: React.FC<CalloutBlockProps> = ({ block }) => {
  const text = block.text || '';
  let type: 'objective' | 'method_limit' | 'insight' | 'default' = 'default';

  if (block.kind === 'objective' || text.toLowerCase().includes('objetivo de aprendizagem')) {
    type = 'objective';
  } else if (block.kind === 'method_limit' || text.toLowerCase().includes('limite do método')) {
    type = 'method_limit';
  } else if (block.kind === 'insight' || text.toLowerCase().includes('insight')) {
    type = 'insight';
  }

  const cleanText = text
    .replace(/^>\s*/, '')
    .replace(/^\*\*(?:Objetivo de aprendizagem|Limite do método|Insight)[^*]*\*\*:?\s*/i, '');

  return (
    <PedagogicalCallout type={type}>
      <InlineRichText>{cleanText}</InlineRichText>
    </PedagogicalCallout>
  );
};
