import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CumulativeReviewRenderer } from './CumulativeReviewRenderer';
import type { CumulativeReviewView } from '../../types/pedagogicalView';

const mockCumulativeReview: CumulativeReviewView = {
  viewSchemaVersion: '1.0.0',
  unitType: 'cumulative_review',
  source: {
    unitId: 'IP-A14-S01',
    lessonId: 'A14',
    generatedAt: '2026-08-18T21:30:00Z',
  },
  unit: {
    unitId: 'IP-A14-S01',
    lessonId: 'A14',
    sectionId: 'S01',
    title: 'Revisão Cumulativa: Ortografia',
    objective: 'Recuperar as decisões centrais de acentuação e hífen.',
  },
  sections: {
    suveca: {
      level: 'review',
      label: 'Revisão Cumulativa SuVeCA',
      summary: 'Aplicação transversal do protocolo SuVeCA para recuperação ativa de regras.',
      steps: ['Reconstrua Su–Ve–C–A–Pred', 'Aplique a regra específica'],
      limits: ['Regras fonéticas e morfológicas operam em camadas próprias.'],
      primaryLinguisticLayer: 'Morfologia e Ortografia',
    },
    conceptMap: {
      items: ['Hiato', 'Ditongo Aberto', 'Hífen', 'Porquês'],
    },
    prioritizedRules: {
      items: [
        'Regra do Hiato: Acentuam-se o "i" ou "u" tônico sozinho na sílaba.',
        'Hífen antes de H: Sempre há hífen.',
      ],
    },
    structuredSynthesis: {
      blocks: [
        { type: 'paragraph', text: 'Resumo das regras gerais de acentuação e emprego de hífen.' },
        { type: 'formula', text: '$F = L - D$' },
      ],
    },
    recoveryExamples: {
      blocks: [
        { type: 'paragraph', text: 'Exemplo: "auto-observação" com vogais iguais exige hífen.' },
      ],
    },
    activeReviewProtocol: {
      items: [
        'Identificar a regra central',
        'Justificar por que as demais alternativas foram eliminadas',
      ],
    },
  },
};

describe('CumulativeReviewRenderer', () => {
  it('renderiza o cabeçalho e objetivo da unidade de revisão', () => {
    render(<CumulativeReviewRenderer view={mockCumulativeReview} />);
    expect(screen.getByText(/Revisão Geral Cumulativa • Aula 14 \(S01\)/i)).toBeInTheDocument();
    expect(screen.getByText('Revisão Cumulativa: Ortografia')).toBeInTheDocument();
    expect(screen.getByText(/Recuperar as decisões centrais de acentuação e hífen/i)).toBeInTheDocument();
  });

  it('renderiza os chips do mapa de conceitos', () => {
    render(<CumulativeReviewRenderer view={mockCumulativeReview} />);
    expect(screen.getByText('Hiato')).toBeInTheDocument();
    expect(screen.getByText('Ditongo Aberto')).toBeInTheDocument();
    expect(screen.getByText('Hífen')).toBeInTheDocument();
  });

  it('renderiza as regras priorizadas e a síntese com fórmula KaTeX', () => {
    render(<CumulativeReviewRenderer view={mockCumulativeReview} />);
    expect(screen.getByText(/Regra do Hiato/i)).toBeInTheDocument();
    expect(screen.getByText(/Resumo das regras gerais de acentuação/i)).toBeInTheDocument();
  });

  it('interage com o checklist do protocolo de revisão ativa', () => {
    render(<CumulativeReviewRenderer view={mockCumulativeReview} />);
    const protocolButton = screen.getByText(/Identificar a regra central/i);
    expect(protocolButton).toBeInTheDocument();

    fireEvent.click(protocolButton);
    expect(protocolButton.closest('button')).toHaveClass('bg-emerald-50/50');
  });
});
