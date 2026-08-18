import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Navbar, type TabType } from './Navbar';

const renderNavbar = (activeTab: TabType = 'modules') => {
  const setActiveTab = vi.fn();
  render(
    <Navbar
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onOpenSearch={vi.fn()}
      errorCount={2}
    />,
  );
  return setActiveTab;
};

describe('Navbar', () => {
  it('mantém as experiências principais visíveis e reúne as secundárias em Mais no desktop', async () => {
    const user = userEvent.setup();
    renderNavbar();
    const desktopNav = screen.getByRole('navigation', { name: /principal/i });

    for (const label of ['Apostila', 'Analisador', 'Simulado', 'Caderno de erros', 'Flashcards']) {
      expect(within(desktopNav).getByRole('button', { name: new RegExp(label, 'i') })).toBeInTheDocument();
    }

    const more = within(desktopNav).getByRole('button', { name: /mais/i });
    await user.click(more);
    const menu = screen.getByRole('menu', { name: /outras ferramentas/i });
    expect(within(menu).getByRole('menuitem', { name: /roteiros/i })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /questões editoriais/i })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /perfil/i })).toBeInTheDocument();
  });

  it('permite navegar pelo menu Mais por teclado e devolve o foco ao fechar', async () => {
    const user = userEvent.setup();
    renderNavbar();
    const desktopNav = screen.getByRole('navigation', { name: /principal/i });
    const more = within(desktopNav).getByRole('button', { name: /mais/i });

    more.focus();
    await user.keyboard('{Enter}');
    const firstItem = within(screen.getByRole('menu')).getAllByRole('menuitem')[0];
    firstItem.focus();
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).not.toBe(firstItem);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(more).toHaveFocus();
  });

  it('expõe todas as ferramentas secundárias no painel móvel com alvos de toque', async () => {
    const user = userEvent.setup();
    renderNavbar('profile');
    const mobileNav = screen.getByRole('navigation', { name: /móvel/i });
    const more = within(mobileNav).getByRole('button', { name: /mais abas/i });
    expect(more).toHaveClass('min-h-[48px]');

    await user.click(more);
    const dialog = screen.getByRole('dialog', { name: /outras ferramentas/i });
    expect(within(dialog).getByRole('button', { name: /perfil/i })).toHaveClass('min-h-[48px]');
    expect(within(dialog).getByRole('button', { name: /cronômetro foco/i })).toBeInTheDocument();
  });
});
