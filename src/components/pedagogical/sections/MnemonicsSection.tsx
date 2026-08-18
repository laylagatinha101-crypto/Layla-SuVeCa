import React from 'react';
import { Brain, Sparkles } from 'lucide-react';
import type { ContentBlock } from '../../../types/pedagogicalView';
import { ContentBlockRenderer } from '../blocks/ContentBlockRenderer';
import { MnemonicCard } from '../../ui/MnemonicCard';

interface MnemonicsSectionProps {
  blocks?: ContentBlock[];
}

export const MnemonicsSection: React.FC<MnemonicsSectionProps> = ({ blocks = [] }) => {
  if (!blocks || blocks.length === 0) return null;

  return (
    <div className="space-y-4">
      {blocks.map((block, idx) => (
        <ContentBlockRenderer key={idx} block={block} />
      ))}
    </div>
  );
};
