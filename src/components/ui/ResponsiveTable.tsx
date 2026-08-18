import React, { isValidElement, type ReactNode } from 'react';
import { ChevronsLeftRight } from 'lucide-react';

interface ResponsiveTableProps {
  children: ReactNode;
  caption?: string;
}

interface TableCellModel {
  content: ReactNode;
  header: boolean;
}

const elementName = (node: ReactNode) =>
  isValidElement(node) && typeof node.type === 'string' ? node.type : null;

const childNodes = (node: ReactNode): ReactNode[] => {
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  return React.Children.toArray(node.props.children);
};

const collectRows = (node: ReactNode): TableCellModel[][] => {
  if (!isValidElement(node)) {
    return Array.isArray(node)
      ? React.Children.toArray(node).flatMap((child) => collectRows(child))
      : [];
  }
  if (elementName(node) === 'tr') {
    return [childNodes(node)
      .filter((child) => ['th', 'td'].includes(elementName(child) || ''))
      .map((child) => ({
        content: isValidElement<{ children?: ReactNode }>(child) ? child.props.children : child,
        header: elementName(child) === 'th',
      }))];
  }

  return childNodes(node).flatMap((child) => collectRows(child));
};

export const ResponsiveTable: React.FC<ResponsiveTableProps> = ({
  children,
  caption = 'Tabela de estudo',
}) => {
  const rows = collectRows(children).filter((row) => row.length > 0);
  const explicitHeader = rows.find((row) => row.some((cell) => cell.header));
  const headers = explicitHeader || rows[0] || [];
  const dataRows = explicitHeader ? rows.filter((row) => row !== explicitHeader) : rows.slice(1);
  const columnCount = Math.max(1, ...rows.map((row) => row.length));
  const minimumWidth = Math.max(560, columnCount * 180);

  return (
    <figure className="responsive-table my-5 min-w-0 max-w-full">
      <figcaption className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold text-slate-600">
        <span>{caption}</span>
        <span className="flex items-center gap-1 text-teal-700 sm:hidden" aria-hidden="true">
          <ChevronsLeftRight className="h-4 w-4" /> Deslize para comparar
        </span>
      </figcaption>

      <div
        className={`${dataRows.length > 0 ? 'hidden sm:block' : 'block'} max-w-full overflow-x-auto rounded-xl border border-slate-200 shadow-sm`}
        role="region"
        aria-label={`${caption}. Use as setas ou role horizontalmente para consultar todas as colunas.`}
        tabIndex={0}
      >
        <table className="border-separate border-spacing-0 text-left text-sm" style={{ minWidth: minimumWidth }}>
          <caption className="sr-only">{caption}</caption>
          {children}
        </table>
      </div>

      {dataRows.length > 0 && <div className="space-y-3 sm:hidden">
        {dataRows.map((row, rowIndex) => (
          <article key={rowIndex} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <h4 className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900">
              {row[0]?.content || `Registro ${rowIndex + 1}`}
            </h4>
            <dl className="divide-y divide-slate-100">
              {row.map((cell, cellIndex) => (
                <div key={cellIndex} className="grid gap-1 px-4 py-3">
                  <dt className="text-xs font-bold uppercase tracking-wide text-teal-800">
                    {headers[cellIndex]?.content || `Coluna ${cellIndex + 1}`}
                  </dt>
                  <dd className="min-w-0 text-sm leading-relaxed text-slate-700">{cell.content}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>}
    </figure>
  );
};
