import React from 'react';
import { Target, Compass, Sparkles, Info } from 'lucide-react';

interface PedagogicalCalloutProps {
  type?: 'objective' | 'method_limit' | 'insight' | 'default';
  title?: string;
  children: React.ReactNode;
}

export const PedagogicalCallout: React.FC<PedagogicalCalloutProps> = ({
  type = 'default',
  title,
  children,
}) => {
  if (type === 'objective') {
    return (
      <div className="my-5 overflow-hidden rounded-2xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/60 p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-2 text-emerald-800">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 ring-1 ring-emerald-300">
            <Target className="h-4 w-4 text-emerald-700" />
          </span>
          <h4 className="m-0 text-xs font-black uppercase tracking-wider text-emerald-900">
            {title || 'Objetivo de Aprendizagem'}
          </h4>
        </div>
        <div className="mt-2.5 text-xs sm:text-sm font-medium text-emerald-950 leading-relaxed">
          {children}
        </div>
      </div>
    );
  }

  if (type === 'method_limit') {
    return (
      <div className="my-5 overflow-hidden rounded-2xl border border-blue-200/90 bg-gradient-to-br from-blue-50/90 via-white to-indigo-50/60 p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-2 text-blue-800">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 ring-1 ring-blue-300">
            <Compass className="h-4 w-4 text-blue-700" />
          </span>
          <h4 className="m-0 text-xs font-black uppercase tracking-wider text-blue-900">
            {title || 'Limite do Método SuVeCA'}
          </h4>
        </div>
        <div className="mt-2.5 text-xs sm:text-sm font-medium text-blue-950 leading-relaxed">
          {children}
        </div>
      </div>
    );
  }

  if (type === 'insight') {
    return (
      <div className="my-5 overflow-hidden rounded-2xl border border-purple-200/90 bg-gradient-to-br from-purple-50/90 via-white to-fuchsia-50/60 p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-2 text-purple-800">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 ring-1 ring-purple-300">
            <Sparkles className="h-4 w-4 text-purple-700" />
          </span>
          <h4 className="m-0 text-xs font-black uppercase tracking-wider text-purple-900">
            {title || 'Insight Metodológico'}
          </h4>
        </div>
        <div className="mt-2.5 text-xs sm:text-sm font-medium text-purple-950 leading-relaxed">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="my-4 rounded-xl border-l-4 border-teal-600 bg-teal-50/60 p-4 text-xs sm:text-sm text-teal-950">
      <div className="flex items-center gap-2 font-bold text-teal-900">
        <Info className="h-4 w-4 text-teal-700" />
        <span>{title || 'Nota Pedagógica'}</span>
      </div>
      <div className="mt-1 leading-relaxed font-medium">{children}</div>
    </div>
  );
};
