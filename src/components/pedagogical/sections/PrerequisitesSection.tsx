import React from 'react';
import type { ContentBlock, ConnectionMapView } from '../../../types/pedagogicalView';
import { ContentBlockRenderer } from '../blocks/ContentBlockRenderer';
import { ConnectionMap } from '../../ui/ConnectionMap';

interface PrerequisitesSectionProps {
  blocks?: ContentBlock[];
  maps?: ConnectionMapView[];
}

export const PrerequisitesSection: React.FC<PrerequisitesSectionProps> = ({ blocks = [], maps = [] }) => {
  if (blocks.length === 0 && maps.length === 0) return null;

  return (
    <div className="space-y-4">
      {blocks.length > 0 && (
        <div className="space-y-2">
          {blocks.map((block, idx) => (
            <ContentBlockRenderer key={idx} block={block} />
          ))}
        </div>
      )}

      {maps.map((map, idx) => (
        <div key={map.mapId || idx} className="my-3">
          {map.rawAscii ? (
            <ConnectionMap source={map.rawAscii} />
          ) : (
            <div className="rounded-2xl border border-teal-200 bg-white p-4">
              <h5 className="m-0 mb-2 text-xs font-bold text-teal-950">{map.title || 'Mapa de Conexões'}</h5>
              <div className="flex flex-wrap gap-2">
                {map.nodes.map((n) => (
                  <span key={n.nodeId} className="rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-900 border border-teal-200">
                    {n.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
