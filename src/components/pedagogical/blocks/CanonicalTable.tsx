import React from 'react';
import type { CanonicalTableView } from '../../../types/pedagogicalView';
import { ResponsiveTable } from '../../ui/ResponsiveTable';
import { InlineRichText } from './InlineRichText';

interface CanonicalTableProps {
  table: CanonicalTableView;
}

export const CanonicalTable: React.FC<CanonicalTableProps> = ({ table }) => {
  if (!table || !table.headers || table.headers.length === 0) return null;

  return (
    <ResponsiveTable caption={table.caption || 'Tabela canônica pedagógica'}>
      <table>
        <thead>
          <tr>
            {table.headers.map((header, idx) => (
              <th key={idx}>
                <InlineRichText>{header}</InlineRichText>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(table.rows || []).map((row, rIdx) => (
            <tr key={rIdx}>
              {row.map((cell, cIdx) => (
                <td key={cIdx}>
                  <InlineRichText>{cell}</InlineRichText>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ResponsiveTable>
  );
};
