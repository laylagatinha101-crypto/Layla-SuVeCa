import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  Target,
  TrendingUp,
} from 'lucide-react';
import type { CadernoErroItem } from '../types/suveca';
import { ProgressBar } from './ui/ProgressBar';

export interface LearningAttempt {
  id: string;
  completedAt?: string;
  createdAt?: string;
  correct?: number;
  total?: number;
  /** Campos usados pelo SimuladoEngine atual. */
  correctCount?: number;
  totalQuestions?: number;
  percentage?: number;
  byTopic?: unknown;
  answerMap?: Record<string, string>;
  questionSetVersion?: string;
}

interface StatisticsDashboardProps {
  attempts: LearningAttempt[];
  errors: CadernoErroItem[];
  visitedModules: number;
  totalModules: number;
  readSections?: number;
  totalSections?: number;
  practiceAnswered?: number;
  practiceCorrect?: number;
  userName?: string | null;
  onOpenSimulado?: () => void;
}

type TopicSummary = {
  topic: string;
  correct: number;
  total: number;
  accuracy: number;
};

const TOPIC_COLORS = ['#0f766e', '#0e7490', '#7c3aed', '#b45309', '#be185d', '#15803d', '#2563eb', '#64748b'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toNumber = (value: unknown): number => {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const normalizeTopics = (byTopic: unknown): Array<{ topic: string; correct: number; total: number }> => {
  if (Array.isArray(byTopic)) {
    return byTopic.flatMap((item) => {
      if (!isRecord(item)) return [];
      const topic = typeof item.topic === 'string' ? item.topic : 'Sem tópico';
      const total = toNumber(item.total);
      const correct = toNumber(item.correct);
      return total > 0 ? [{ topic, total, correct }] : [];
    });
  }

  if (!isRecord(byTopic)) return [];

  return Object.entries(byTopic).flatMap(([topic, value]) => {
    if (isRecord(value)) {
      const total = toNumber(value.total);
      const correct = toNumber(value.correct);
      return total > 0 ? [{ topic, total, correct }] : [];
    }

    // Aceita também um mapa simples tópico -> percentual, para dados legados.
    const accuracy = toNumber(value);
    return accuracy > 0 ? [{ topic, total: 1, correct: accuracy / 100 }] : [];
  });
};

const percent = (numerator: number, denominator: number) =>
  denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;

const getAttemptTotal = (attempt: LearningAttempt) =>
  toNumber(attempt.total ?? attempt.totalQuestions);

const getAttemptCorrect = (attempt: LearningAttempt) =>
  toNumber(attempt.correct ?? attempt.correctCount);

const displayDate = (date?: string) => {
  if (!date) return 'Simulado';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? 'Simulado'
    : parsed.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

export const StatisticsDashboard: React.FC<StatisticsDashboardProps> = ({
  attempts,
  errors,
  visitedModules,
  totalModules,
  readSections = 0,
  totalSections = 0,
  practiceAnswered = 0,
  practiceCorrect = 0,
  userName,
  onOpenSimulado,
}) => {
  const topicData = useMemo<TopicSummary[]>(() => {
    const totals = new Map<string, { correct: number; total: number }>();

    attempts.forEach((attempt) => {
      normalizeTopics(attempt.byTopic).forEach((result) => {
        const current = totals.get(result.topic) ?? { correct: 0, total: 0 };
        totals.set(result.topic, {
          correct: current.correct + result.correct,
          total: current.total + result.total,
        });
      });
    });

    return [...totals.entries()]
      .map(([topic, result]) => ({
        topic,
        correct: result.correct,
        total: result.total,
        accuracy: percent(result.correct, result.total),
      }))
      .sort((a, b) => b.accuracy - a.accuracy || b.total - a.total);
  }, [attempts]);

  const attemptHistory = useMemo(
    () =>
      [...attempts]
        .sort(
          (first, second) =>
            new Date(first.completedAt || first.createdAt || 0).getTime() -
            new Date(second.completedAt || second.createdAt || 0).getTime()
        )
        .slice(-8)
        .map((attempt, index) => {
        const total = getAttemptTotal(attempt);
        const accuracy = attempt.percentage ?? percent(getAttemptCorrect(attempt), total);
        return {
          label: displayDate(attempt.completedAt || attempt.createdAt) || `#${index + 1}`,
          accuracy,
        };
        }),
    [attempts]
  );

  const allAnswered = attempts.reduce((sum, attempt) => sum + getAttemptTotal(attempt), 0);
  const allCorrect = attempts.reduce((sum, attempt) => sum + getAttemptCorrect(attempt), 0);
  const overallAccuracy = percent(allCorrect, allAnswered);
  const masteredErrors = errors.filter((error) => error.status === 'dominado').length;
  const reviewedErrors = errors.filter((error) => Boolean(error.lastReviewedAt)).length;

  const methodData = useMemo(
    () => [
      {
        stage: 'Compreender',
        progress: percent(readSections, Math.max(totalSections, 1)),
        detail: `${readSections}/${totalSections} seções estudadas · ${visitedModules}/${totalModules} aulas abertas`,
      },
      {
        stage: 'Aplicar',
        progress: Math.min(100, percent(allAnswered + practiceAnswered, 40)),
        detail: `${allAnswered + practiceAnswered} questões · ${practiceCorrect} acertos nas aulas`,
      },
      {
        stage: 'Registrar',
        progress: Math.min(100, errors.length * 20),
        detail: errors.length ? `${errors.length}/5 regras registradas para formar um ciclo` : 'Registre seu primeiro erro real',
      },
      {
        stage: 'Revisar',
        progress: percent(reviewedErrors, Math.max(errors.length, 1)),
        detail: errors.length ? `${reviewedErrors}/${errors.length} regras revisadas` : 'Sem revisões ainda',
      },
      {
        stage: 'Dominar',
        progress: percent(masteredErrors, Math.max(errors.length, 1)),
        detail: errors.length ? `${masteredErrors}/${errors.length} regras dominadas` : 'Sem regras dominadas',
      },
    ],
    [allAnswered, errors.length, masteredErrors, practiceAnswered, practiceCorrect, readSections, reviewedErrors, totalModules, totalSections, visitedModules]
  );

  const needsPractice = attempts.length === 0;
  const greetingName = userName?.split(' ')[0] || 'você';

  return (
    <div className="space-y-6 pb-16 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 duration-300">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
              <BarChart3 className="h-3.5 w-3.5" /> Painel de evolução
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Estatísticas de {greetingName}
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
              Acompanhe o ciclo SuVeCA e identifique os tópicos que merecem a próxima revisão ativa.
            </p>
          </div>
          {onOpenSimulado && (
            <button type="button" onClick={onOpenSimulado} className="button-primary shrink-0 text-sm">
              <ClipboardCheck className="h-4 w-4" /> Resolver simulado
            </button>
          )}
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Taxa geral de acertos"
          value={allAnswered ? `${overallAccuracy}%` : '—'}
          hint={allAnswered ? `${allCorrect} de ${allAnswered} questões` : 'Faça um simulado para medir'}
          icon={Target}
          color="teal"
        />
        <MetricCard
          label="Simulados concluídos"
          value={String(attempts.length)}
          hint={attempts.length ? 'Histórico salvo automaticamente' : 'Seu primeiro resultado aparecerá aqui'}
          icon={TrendingUp}
          color="blue"
        />
        <MetricCard
          label="Regras revisadas"
          value={`${reviewedErrors}/${errors.length}`}
          hint={errors.length ? 'Ciclo Dia 1, 7, 30 ou dominado' : 'Adicione regras ao Caderno'}
          icon={BookOpenCheck}
          color="amber"
        />
        <MetricCard
          label="Regras dominadas"
          value={String(masteredErrors)}
          hint={errors.length ? `${percent(masteredErrors, errors.length)}% do Caderno` : 'Seu domínio aparece aqui'}
          icon={CheckCircle2}
          color="emerald"
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs xl:col-span-2 sm:p-6">
          <div className="mb-5">
            <h2 className="font-bold text-slate-900">Ciclo de aprendizagem SuVeCA</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Indicadores calculados a partir das aulas exploradas, simulados e revisões do Caderno.
            </p>
          </div>
          <div className="space-y-4">
            {methodData.map((item) => (
              <div key={item.stage}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                  <span className="font-bold text-slate-800">{item.stage}</span>
                  <span className="font-semibold text-teal-800">{item.progress}%</span>
                </div>
                <ProgressBar value={item.progress} showPercent={false} size="sm" ariaLabel={`${item.stage}: ${item.progress}%`} />
                <p className="mt-1 text-xs text-slate-600">{item.detail}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs xl:col-span-3 sm:p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-bold text-slate-900">Evolução nos simulados</h2>
              <p className="mt-1 text-xs text-slate-500">Taxa de acertos por tentativa concluída.</p>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600">
              Meta: 80%
            </span>
          </div>
          {needsPractice ? (
            <EmptyChart onAction={onOpenSimulado} />
          ) : (
            <div className="h-[250px]" role="img" aria-label="Gráfico de evolução dos simulados; os valores também estão disponíveis na tabela logo após o gráfico">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={attemptHistory} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip
                    formatter={(value) => [`${toNumber(value)}%`, 'Acertos']}
                    contentStyle={{ borderRadius: 12, borderColor: '#cbd5e1', fontSize: 12 }}
                  />
                  <ReferenceLine y={80} stroke="#b7791f" strokeDasharray="5 5" />
                  <Line type="monotone" dataKey="accuracy" stroke="#0f766e" strokeWidth={3} dot={{ r: 4, fill: '#0f766e' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {!needsPractice && <table className="sr-only"><caption>Evolução dos simulados</caption><thead><tr><th>Tentativa</th><th>Taxa de acertos</th></tr></thead><tbody>{attemptHistory.map((attempt) => <tr key={`${attempt.label}-${attempt.accuracy}`}><td>{attempt.label}</td><td>{attempt.accuracy}%</td></tr>)}</tbody></table>}
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <h2 className="font-bold text-slate-900">Acertos por tópico</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              A taxa consolida as respostas dos seus simulados e destaca onde revisar primeiro.
            </p>
          </div>
          {!needsPractice && (
            <span className="text-xs font-semibold text-slate-500">{allAnswered} questões registradas</span>
          )}
        </div>
        <div className="h-[330px]" role="img" aria-label="Gráfico de taxa de acertos por tópico; os valores também estão disponíveis na tabela logo após o gráfico">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topicData} layout="vertical" margin={{ top: 4, right: 28, left: 26, bottom: 4 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="topic" width={135} tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: '#f8fafc' }}
                formatter={(value, _name, item) => {
                  const details = item.payload as TopicSummary;
                  return [`${toNumber(value)}% (${details.correct}/${details.total || 0})`, 'Taxa de acertos'];
                }}
                contentStyle={{ borderRadius: 12, borderColor: '#cbd5e1', fontSize: 12 }}
              />
              <Bar dataKey="accuracy" radius={[0, 6, 6, 0]} maxBarSize={24}>
                {topicData.map((topic, index) => (
                  <Cell key={topic.topic} fill={topic.total ? TOPIC_COLORS[index % TOPIC_COLORS.length] : '#cbd5e1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <table className="sr-only"><caption>Taxa de acertos por tópico</caption><thead><tr><th>Tópico</th><th>Acertos</th><th>Total</th><th>Taxa</th></tr></thead><tbody>{topicData.map((topic) => <tr key={topic.topic}><td>{topic.topic}</td><td>{topic.correct}</td><td>{topic.total}</td><td>{topic.accuracy}%</td></tr>)}</tbody></table>
        {needsPractice && (
          <p className="mt-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs text-slate-500">
            Ainda não há respostas registradas. As barras serão preenchidas após o primeiro simulado concluído.
          </p>
        )}
      </section>
    </div>
  );
};

const MetricCard: React.FC<{
  label: string;
  value: string;
  hint: string;
  icon: React.ElementType;
  color: 'teal' | 'blue' | 'amber' | 'emerald';
}> = ({ label, value, hint, icon: Icon, color }) => {
  const colors = {
    teal: 'border-teal-100 bg-teal-50 text-teal-700',
    blue: 'border-blue-100 bg-blue-50 text-blue-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  };

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">{value}</p>
        </div>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl border ${colors[color]}`}>
          <Icon className="h-4.5 w-4.5" />
        </span>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{hint}</p>
    </article>
  );
};

const EmptyChart: React.FC<{ onAction?: () => void }> = ({ onAction }) => (
  <div className="flex h-[250px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 text-center">
    <TrendingUp className="h-8 w-8 text-slate-400" />
    <p className="mt-3 text-sm font-bold text-slate-700">Seu primeiro resultado começa aqui</p>
    <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
      Conclua um simulado para acompanhar a sua evolução em cada tentativa.
    </p>
    {onAction && (
      <button type="button" onClick={onAction} className="button-secondary mt-4 text-xs">
        Ir para o simulado
      </button>
    )}
  </div>
);
