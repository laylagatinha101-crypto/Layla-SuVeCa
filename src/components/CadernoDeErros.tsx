import React, { useRef, useState } from 'react';
import { CadernoErroItem } from '../types/suveca';
import { FlashcardPractice } from './FlashcardPractice';
import { useModalFocus } from '../hooks/useModalFocus';
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  BookOpen,
  Filter,
  Sparkles,
  AlertCircle,
  X,
  Printer,
} from 'lucide-react';

interface CadernoDeErrosProps {
  errors: CadernoErroItem[];
  onAddError: (item: CadernoErroItem) => void;
  onUpdateErrorStatus: (
    id: string,
    status: CadernoErroItem['status'],
    review?: Pick<CadernoErroItem, 'lastReviewedAt' | 'nextReviewAt'>
  ) => void;
  onDeleteError: (id: string) => void;
  userId?: string;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#039;',
      '"': '&quot;',
    };
    return entities[character];
  });

export const CadernoDeErros: React.FC<CadernoDeErrosProps> = ({
  errors,
  onAddError,
  onUpdateErrorStatus,
  onDeleteError,
  userId,
}) => {
  const [activeFilter, setActiveFilter] = useState<string>('todos');
  const [activeView, setActiveView] = useState<'errors' | 'flashcards'>('errors');

  // Form modal state for adding custom error
  const [showAddModal, setShowAddModal] = useState(false);
  const [conteudo, setConteudo] = useState('');
  const [erroCometido, setErroCometido] = useState('');
  const [regraDecisiva, setRegraDecisiva] = useState('');
  const [novoExemplo, setNovoExemplo] = useState('');
  const addDialogCloseRef = useRef<HTMLButtonElement>(null);
  const addDialogRef = useModalFocus(
    showAddModal,
    () => setShowAddModal(false),
    addDialogCloseRef
  );

  const handleSubmitNewError = (e: React.FormEvent) => {
    e.preventDefault();
    if (!conteudo || !erroCometido || !regraDecisiva) return;

    const newItem: CadernoErroItem = {
      id: `err_${Date.now()}`,
      date: new Date().toLocaleDateString('pt-BR'),
      conteudo,
      erroCometido,
      regraDecisiva,
      novoExemplo: novoExemplo || 'Criar exemplo prático de aplicação.',
      status: 'dia0',
      origin: 'manual',
    };

    onAddError(newItem);
    setConteudo('');
    setErroCometido('');
    setRegraDecisiva('');
    setNovoExemplo('');
    setShowAddModal(false);
  };

  const filteredErrors = errors.filter((item) => {
    if (activeFilter === 'todos') return true;
    return item.status === activeFilter;
  });

  const getStatusBadge = (status: CadernoErroItem['status']) => {
    switch (status) {
      case 'dia0':
        return { label: 'Dia 0 (Recém-Adicionado)', color: 'bg-rose-50 text-rose-800 border-rose-200' };
      case 'dia1':
        return { label: 'Dia 1 (Revisão 24h)', color: 'bg-amber-50 text-amber-800 border-amber-200' };
      case 'dia7':
        return { label: 'Dia 7 (Revisão Semanal)', color: 'bg-purple-50 text-purple-800 border-purple-200' };
      case 'dia30':
        return { label: 'Dia 30 (Revisão Mensal)', color: 'bg-blue-50 text-blue-800 border-blue-200' };
      case 'dominado':
        return { label: 'Dominado! (Aprendido)', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
    }
  };

  const handleExportPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.opener = null;
    const rows = errors
      .map(
        (item) => `
          <article>
            <div class="meta"><strong>${escapeHtml(item.conteudo)}</strong><span>${escapeHtml(item.date)}</span></div>
            <h2>Erro cometido</h2><p>${escapeHtml(item.erroCometido)}</p>
            <h2>Regra decisiva</h2><p>${escapeHtml(item.regraDecisiva)}</p>
            <h2>Exemplo de fixação</h2><p>${escapeHtml(item.novoExemplo)}</p>
            ${item.questionId ? `<h2>Proveniência</h2><p>${escapeHtml(`${item.bank || 'Questão'} · ID ${item.questionId}${item.year ? ` · ${item.year}` : ''}`)}</p>` : ''}
          </article>`
      )
      .join('');

    printWindow.document.write(`<!doctype html>
      <html lang="pt-BR"><head><meta charset="utf-8" /><title>Caderno de Erros — SuVeCA</title>
      <style>
        @page { margin: 18mm; }
        body { font-family: Arial, sans-serif; color: #172033; line-height: 1.5; }
        h1 { color: #0f766e; margin-bottom: 4px; }
        .subtitle { color: #64748b; margin-top: 0; font-size: 13px; }
        article { border: 1px solid #cbd5e1; border-radius: 10px; padding: 16px; margin: 16px 0; break-inside: avoid; }
        .meta { display: flex; justify-content: space-between; gap: 12px; color: #0f766e; font-size: 13px; }
        h2 { font-size: 13px; margin: 14px 0 3px; color: #334155; text-transform: uppercase; letter-spacing: .03em; }
        p { margin: 0; font-size: 14px; white-space: pre-wrap; }
      </style></head><body>
        <h1>Caderno de Erros — Método SuVeCA</h1>
        <p class="subtitle">Exportado em ${new Date().toLocaleDateString('pt-BR')} · ${errors.length} registro(s)</p>
        ${rows || '<p>Nenhum registro no Caderno de Erros.</p>'}
      </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 200);
  };

  return (
    <div className="space-y-8 pb-16 max-w-5xl mx-auto">
      {/* Header */}
      <header className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-2 bg-teal-50 text-teal-800 border border-teal-200 text-xs px-3 py-1 rounded-full font-semibold">
            <FileSpreadsheet className="w-3.5 h-3.5 text-teal-700" />
            <span>Método das 4 Colunas & Repetição Espaçada</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Caderno de Erros do Concurseiro
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl">
            Registrar a causa exata do erro com a Regra Decisiva transforma cada questão errada em aprovação. Acompanhe suas revisões programadas nos ciclos de Dia 0, 1, 7 e 30.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportPdf}
            className="button-secondary px-4 py-3 text-xs sm:text-sm"
            title="Abrir versão para impressão ou salvar como PDF"
          >
            <Printer className="w-4 h-4 text-teal-700" />
            <span>Exportar PDF</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveView('errors');
              setShowAddModal(true);
            }}
            className="button-primary px-5 py-3 text-xs sm:text-sm"
            aria-haspopup="dialog"
            aria-controls="add-error-dialog"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Registro de Erro</span>
          </button>
        </div>
      </header>

      <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 text-xs font-semibold">
        <button
          onClick={() => setActiveView('errors')}
          className={`flex-1 px-4 py-2.5 rounded-xl transition ${
            activeView === 'errors'
              ? 'bg-white text-slate-900 shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Registros e ciclos
        </button>
        <button
          onClick={() => setActiveView('flashcards')}
          className={`flex-1 px-4 py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 ${
            activeView === 'flashcards'
              ? 'bg-white text-slate-900 shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-violet-700" />
          Flashcards e revisão ativa
        </button>
      </div>

      {activeView === 'flashcards' ? (
        <FlashcardPractice
          errors={errors}
          onUpdateErrorStatus={onUpdateErrorStatus}
          userId={userId}
        />
      ) : (
        <>

      {/* Status Filter Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto bg-slate-100 p-1.5 rounded-2xl border border-slate-200 text-xs font-medium">
        {[
          { id: 'todos', label: 'Todos os Erros', count: errors.length },
          { id: 'dia0', label: 'Dia 0', count: errors.filter((e) => e.status === 'dia0').length },
          { id: 'dia1', label: 'Dia 1 (24h)', count: errors.filter((e) => e.status === 'dia1').length },
          { id: 'dia7', label: 'Dia 7 (Semanal)', count: errors.filter((e) => e.status === 'dia7').length },
          { id: 'dia30', label: 'Dia 30 (Mensal)', count: errors.filter((e) => e.status === 'dia30').length },
          { id: 'dominado', label: 'Dominados', count: errors.filter((e) => e.status === 'dominado').length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id)}
            className={`px-3 py-2 rounded-xl font-semibold transition whitespace-nowrap flex items-center space-x-1.5 cursor-pointer ${
              activeFilter === tab.id
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <span>{tab.label}</span>
            <span className="bg-slate-200 px-1.5 py-0.5 rounded-md text-[10px] font-bold text-slate-800">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Errors Cards List */}
      {filteredErrors.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center space-y-3 shadow-xs">
          <FileSpreadsheet className="w-12 h-12 text-slate-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">Nenhum erro neste filtro</h3>
          <p className="text-xs text-slate-500">
            Adicione um novo erro ou resolva questões no simulado para preencher seu caderno.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredErrors.map((item) => {
            const badge = getStatusBadge(item.status);

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4 relative"
              >
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
                      {item.conteudo}
                    </span>
                    <span className="text-xs text-slate-600">{item.date}</span>
                    {item.origin && item.origin !== 'manual' && (
                      <span className="rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-bold text-violet-800">
                        {item.origin === 'official_question' ? 'Questão editorial' : item.origin === 'module_question' ? 'Questão da aula' : item.origin === 'ai_generated' ? 'Questão gerada por IA' : 'Simulado'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full border ${badge.color}`}
                    >
                      {badge.label}
                    </span>
                    <button
                      onClick={() => onDeleteError(item.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition cursor-pointer"
                      title="Excluir do Caderno"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {item.questionId && (
                  <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3 text-xs leading-relaxed text-violet-950">
                    <strong>Origem:</strong> {item.bank || 'Banco de questões'} · ID {item.questionId}
                    {item.year ? ` · ${item.year}` : ''}
                    {item.questionText && <p className="mt-1 line-clamp-3">{item.questionText}</p>}
                    {item.conceptIds?.length ? <p className="mt-1 font-mono text-[11px]">Conceitos: {item.conceptIds.join(', ')}</p> : null}
                  </div>
                )}

                {/* 3 Columns Grid for Detail */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-xs font-bold text-rose-800 block">
                      Erro Cometido
                    </span>
                    <p className="text-xs sm:text-sm text-slate-700 font-medium">
                      {item.erroCometido}
                    </p>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-xs font-bold text-emerald-800 block">
                      Regra Decisiva Gramatical
                    </span>
                    <p className="text-xs sm:text-sm text-slate-700 font-medium leading-relaxed">
                      {item.regraDecisiva}
                    </p>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-xs font-bold text-teal-800 block">
                      Exemplo de Fixação
                    </span>
                    <p className="text-xs sm:text-sm text-slate-700 italic font-medium">
                      "{item.novoExemplo}"
                    </p>
                  </div>
                </div>

                <p className="border-t border-slate-100 pt-3 text-xs text-slate-600">
                  O ciclo é atualizado pelas revisões dos flashcards; cada cartão mantém seu próprio intervalo.
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Add New Error Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
          onClick={() => setShowAddModal(false)}
        >
          <div
            ref={addDialogRef}
            id="add-error-dialog"
            className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-xl space-y-4 my-auto max-h-[90dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-error-dialog-title"
            tabIndex={-1}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 id="add-error-dialog-title" className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-teal-700" />
                <span>Registrar Novo Erro no Caderno</span>
              </h3>
              <button
                ref={addDialogCloseRef}
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg"
                aria-label="Fechar formulário"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitNewError} className="space-y-4 text-xs sm:text-sm">
              <div className="space-y-1">
                <label htmlFor="error-content" className="block text-xs font-bold text-slate-900">
                  1. Conteúdo / Tópico Gramatical:
                </label>
                <input
                  id="error-content"
                  type="text"
                  required
                  placeholder="Ex: Concordância com o verbo haver"
                  value={conteudo}
                  onChange={(e) => setConteudo(e.target.value)}
                  className="input-field w-full p-3 text-sm sm:text-base font-medium"
                  style={{ fontSize: '16px' }}
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="error-mistake" className="block text-xs font-bold text-slate-900">
                  2. Erro Cometido na Questão:
                </label>
                <textarea
                  id="error-mistake"
                  required
                  rows={2}
                  placeholder="Ex: Fiz o verbo concordar no plural com o termo posterior ('Houveram dúvidas')."
                  value={erroCometido}
                  onChange={(e) => setErroCometido(e.target.value)}
                  className="input-field w-full p-3 text-sm sm:text-base font-medium"
                  style={{ fontSize: '16px' }}
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="error-rule" className="block text-xs font-bold text-slate-900">
                  3. Regra Decisiva da Gramática:
                </label>
                <textarea
                  id="error-rule"
                  required
                  rows={2}
                  placeholder="Ex: Haver no sentido de existir é verbo impessoal e fica estritamente no singular ('Houve dúvidas')."
                  value={regraDecisiva}
                  onChange={(e) => setRegraDecisiva(e.target.value)}
                  className="input-field w-full p-3 text-sm sm:text-base font-medium"
                  style={{ fontSize: '16px' }}
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="error-example" className="block text-xs font-bold text-slate-900">
                  4. Novo Exemplo de Aplicação Direta:
                </label>
                <input
                  id="error-example"
                  type="text"
                  placeholder="Ex: Deve haver mudanças no edital."
                  value={novoExemplo}
                  onChange={(e) => setNovoExemplo(e.target.value)}
                  className="input-field w-full p-3 text-sm sm:text-base font-medium"
                  style={{ fontSize: '16px' }}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="button-secondary text-xs px-4 py-2.5 min-h-[44px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="button-primary text-xs px-5 py-2.5 min-h-[44px] font-bold"
                >
                  Salvar Erro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};
