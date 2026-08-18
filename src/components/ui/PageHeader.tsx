import React from 'react';

interface PageHeaderProps {
  badge?: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  badge,
  title,
  description,
  actions,
}) => {
  return (
    <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="space-y-1">
          {badge && <div className="inline-block">{badge}</div>}
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {title}
          </h1>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {description && (
        <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
          {description}
        </p>
      )}
    </div>
  );
};
