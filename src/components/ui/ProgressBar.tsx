import React from 'react';

interface ProgressBarProps {
  value: number; // 0 to 100
  label?: string;
  ariaLabel?: string;
  showPercent?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'teal' | 'amber' | 'emerald';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  label,
  ariaLabel,
  showPercent = true,
  size = 'md',
  color = 'teal',
}) => {
  const percentage = Math.min(100, Math.max(0, value));

  const heightClasses = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  }[size];

  const barColorClasses = {
    teal: 'bg-teal-700',
    amber: 'bg-amber-600',
    emerald: 'bg-emerald-600',
  }[color];

  return (
    <div className="w-full space-y-1.5">
      {(label || showPercent) && (
        <div className="flex justify-between items-center text-xs font-medium text-slate-700">
          {label && <span>{label}</span>}
          {showPercent && (
            <span className="font-semibold text-slate-900">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
      <div
        className={`w-full bg-slate-200 rounded-full overflow-hidden ${heightClasses}`}
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel || label || `Progresso: ${Math.round(percentage)}%`}
      >
        <div
          className={`h-full transition-all duration-300 ease-out ${barColorClasses}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
