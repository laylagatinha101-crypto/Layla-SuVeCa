import React from 'react';
import type { ContentBlock } from '../../../types/pedagogicalView';
import { ContentBlockRenderer } from '../blocks/ContentBlockRenderer';

interface ExplanationSectionProps {
  blocks?: ContentBlock[];
}

export const ExplanationSection: React.FC<ExplanationSectionProps> = ({ blocks = [] }) => {
  if (!blocks || blocks.length === 0) return null;

  return (
    <div className="space-y-3">
      {blocks.map((block, idx) => (
        <ContentBlockRenderer key={idx} block={block} />
      ))}
    </div>
  );
};
