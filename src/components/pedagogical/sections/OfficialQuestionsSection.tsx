import React from 'react';
import { HelpCircle } from 'lucide-react';
import type { OfficialQuestionView } from '../../../types/pedagogicalView';
import { QuestionBlock } from '../../ui/QuestionBlock';
import { InlineRichText } from '../blocks/InlineRichText';

interface OfficialQuestionsSectionProps {
  questions?: OfficialQuestionView[];
}

export const OfficialQuestionsSection: React.FC<OfficialQuestionsSectionProps> = ({ questions = [] }) => {
  if (!questions || questions.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-teal-100/80 pb-3">
        <HelpCircle className="h-5 w-5 text-teal-700" />
        <h3 className="m-0 text-base font-black text-slate-900">
          Questões Oficiais de Prova ({questions.length})
        </h3>
      </div>

      <div className="space-y-6">
        {questions.map((q, idx) => (
          <QuestionBlock
            key={q.questionId || idx}
            title={`Questão ${idx + 1}: ${q.organization || q.examBoard || 'Concurso Público'}`}
            board={q.examBoard}
            year={q.year ? String(q.year) : undefined}
            prompt={q.prompt}
            options={q.options.map((opt) => ({ letter: opt.label.toUpperCase(), text: opt.text }))}
            solution={q.explanation}
            answer={q.officialAnswer}
            renderMarkdown={(text) => <InlineRichText>{text}</InlineRichText>}
          />
        ))}
      </div>
    </div>
  );
};
