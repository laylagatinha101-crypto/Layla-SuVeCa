import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PedagogicalDeepDive } from './ModuleViewer';

describe('aprofundamento pedagógico', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('não aborta uma resposta lenta ao entrar no estado de carregamento', async () => {
    let resolveFetch!: (response: Response) => void;
    let requestSignal: AbortSignal | undefined;
    const pendingResponse = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      requestSignal = init?.signal || undefined;
      return pendingResponse;
    }));

    render(
      <PedagogicalDeepDive
        section={{
          title: 'Estudo da Sílaba - Teoria',
          contentMarkdown: 'Resumo',
          contentUrl: '/knowledge/pedagogical/units/teste-resposta-lenta.md',
          estimatedMinutes: 22,
        }}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /abrir unidade pedagógica completa/i }));
    expect(screen.getByRole('status')).toHaveTextContent('Carregando aprofundamento');
    expect(requestSignal?.aborted).toBe(false);

    await act(async () => {
      resolveFetch({
        ok: true,
        text: async () => '# Conteúdo aprofundado carregado',
      } as Response);
      await pendingResponse;
    });

    expect(await screen.findByRole('heading', { name: 'Conteúdo aprofundado carregado' })).toBeVisible();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
