import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfessorSuvecaModal } from './ProfessorSuvecaModal';

vi.mock('../lib/authenticatedFetch', () => ({
  authenticatedFetch: (input: string, init?: RequestInit) => fetch(input, init),
}));

describe('ProfessorSuvecaModal', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        answerMarkdown: '**Objeto direto** completa o verbo.\n\n| Teste | Resultado |\n|---|---|\n| o quê? | objeto |\n\n[PASSAGE:source:abc#1-20]',
        sourceRefs: ['PASSAGE:source:abc#1-20'],
      }),
    })));
  });

  it('renderiza Markdown e nunca mostra os identificadores internos', async () => {
    const user = userEvent.setup();
    render(<ProfessorSuvecaModal isOpen onClose={vi.fn()} initialContext="Sintaxe" />);

    await user.type(screen.getByRole('textbox', { name: /dúvida/i }), 'O que é objeto direto?');
    await user.click(screen.getByRole('button', { name: /enviar/i }));

    expect(await screen.findByText('Objeto direto')).toHaveProperty('tagName', 'STRONG');
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Esta resposta ajudou?')).toBeInTheDocument();
    expect(screen.queryByText(/PASSAGE:|QUESTION:|KB:/i)).not.toBeInTheDocument();
  });

  it('envia os últimos turnos na pergunta de continuação', async () => {
    const user = userEvent.setup();
    render(<ProfessorSuvecaModal isOpen onClose={vi.fn()} />);
    const input = screen.getByRole('textbox', { name: /dúvida/i });

    await user.type(input, 'Explique o objeto direto');
    await user.click(screen.getByRole('button', { name: /enviar/i }));
    await screen.findByText('Objeto direto');
    await user.type(input, 'E como diferencio do indireto?');
    await user.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2));
    const request = JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]?.body));
    expect(request.history).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'user', text: 'Explique o objeto direto' }),
      expect.objectContaining({ role: 'assistant', text: expect.stringContaining('Objeto direto') }),
    ]));
  });
});
