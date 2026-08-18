import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Cpu,
  GraduationCap,
  FileSpreadsheet,
  GitMerge,
  CalendarCheck,
  Bot,
  Search,
  Sparkles,
  LogOut,
  LogIn,
  RefreshCw,
  MoreHorizontal,
  X,
  User as UserIcon,
  BarChart3,
  CalendarDays,
  Swords,
  BookMarked,
  Brain,
  Timer,
} from 'lucide-react';
import type { User } from '../lib/firebase';
import { useModalFocus } from '../hooks/useModalFocus';

export type TabType =
  | 'modules'
  | 'analyzer'
  | 'simulado'
  | 'errors'
  | 'flashcards'
  | 'pomodoro'
  | 'agenda'
  | 'decision'
  | 'planner'
  | 'stats'
  | 'profile'
  | 'duel'
  | 'questions'
  | 'tutor';

interface NavbarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  onOpenSearch: () => void;
  errorCount: number;
  user?: User | null;
  onSignIn?: () => void;
  onSignOut?: () => void;
  isSyncing?: boolean;
}

interface NavItem {
  id: TabType;
  label: string;
  icon: React.ElementType;
  isIa?: boolean;
  countBadge?: number;
  group?: 'Estudar' | 'Praticar' | 'Revisar' | 'Acompanhar';
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenSearch,
  errorCount,
  user,
  onSignIn,
  onSignOut,
  isSyncing,
}) => {
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const [isDesktopMoreOpen, setIsDesktopMoreOpen] = useState(false);
  const mobileDrawerCloseRef = useRef<HTMLButtonElement>(null);
  const desktopMoreButtonRef = useRef<HTMLButtonElement>(null);
  const desktopMoreMenuRef = useRef<HTMLDivElement>(null);
  const mobileDrawerRef = useModalFocus(
    isMobileMoreOpen,
    () => setIsMobileMoreOpen(false),
    mobileDrawerCloseRef
  );

  const primaryTabs: NavItem[] = [
    { id: 'modules', label: 'Apostila', icon: BookOpen },
    { id: 'analyzer', label: 'Analisador', icon: Cpu, isIa: true },
    { id: 'simulado', label: 'Simulado', icon: GraduationCap },
  ];

  const secondaryTabs: NavItem[] = [
    {
      id: 'errors',
      label: 'Caderno de erros',
      icon: FileSpreadsheet,
      countBadge: errorCount > 0 ? errorCount : undefined,
      group: 'Revisar',
    },
    { id: 'flashcards', label: 'Flashcards', icon: Brain, isIa: true, group: 'Revisar' },
    { id: 'pomodoro', label: 'Cronômetro Foco', icon: Timer, group: 'Estudar' },
    { id: 'agenda', label: 'Review diário', icon: CalendarDays, group: 'Revisar' },
    { id: 'decision', label: 'Roteiros', icon: GitMerge, group: 'Estudar' },
    { id: 'planner', label: 'Planejamento', icon: CalendarCheck, group: 'Acompanhar' },
    { id: 'duel', label: 'Duelo', icon: Swords, group: 'Praticar' },
    { id: 'questions', label: 'Questões editoriais', icon: BookMarked, group: 'Praticar' },
    { id: 'stats', label: 'Estatísticas', icon: BarChart3, group: 'Acompanhar' },
    { id: 'profile', label: 'Perfil', icon: UserIcon, group: 'Acompanhar' },
    { id: 'tutor', label: 'Professor IA', icon: Bot, isIa: true, group: 'Estudar' },
  ];

  const allTabs: NavItem[] = [...primaryTabs, ...secondaryTabs];
  const desktopPrimaryIds = new Set<TabType>(['modules', 'analyzer', 'simulado', 'errors', 'flashcards', 'agenda']);
  const desktopPrimaryTabs = allTabs.filter((item) => desktopPrimaryIds.has(item.id));
  const desktopMoreTabs = allTabs.filter((item) => !desktopPrimaryIds.has(item.id));
  const isDesktopMoreActive = desktopMoreTabs.some((item) => item.id === activeTab);
  const navigationGroups = ['Estudar', 'Praticar', 'Revisar', 'Acompanhar'] as const;

  useEffect(() => {
    if (!isDesktopMoreOpen) return undefined;
    desktopMoreMenuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const closeOnPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!desktopMoreMenuRef.current?.contains(target) && !desktopMoreButtonRef.current?.contains(target)) {
        setIsDesktopMoreOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsDesktopMoreOpen(false);
      desktopMoreButtonRef.current?.focus();
    };
    document.addEventListener('pointerdown', closeOnPointerDown);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isDesktopMoreOpen]);

  const handleDesktopMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const buttons = [...(desktopMoreMenuRef.current?.querySelectorAll<HTMLButtonElement>('button') || [])];
    if (!buttons.length) return;
    event.preventDefault();
    const currentIndex = Math.max(0, buttons.indexOf(document.activeElement as HTMLButtonElement));
    const targetIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? buttons.length - 1
        : event.key === 'ArrowDown'
          ? (currentIndex + 1) % buttons.length
          : (currentIndex - 1 + buttons.length) % buttons.length;
    buttons[targetIndex]?.focus();
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-[var(--surface)] border-b border-[var(--border)] text-[var(--text)] shadow-xs">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          {/* Row 1: Logo, Search & Account */}
          <div className="flex items-center justify-between h-16 border-b border-slate-100/80">
            {/* Logo */}
            <button
              type="button"
              className="flex items-center space-x-3 cursor-pointer group min-h-[44px] rounded-xl -ml-2 px-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
              onClick={() => setActiveTab('modules')}
              aria-label="Ir para a Apostila"
            >
              <div className="w-10 h-10 rounded-xl bg-teal-700 text-white font-bold text-lg flex items-center justify-center shadow-xs">
                S
              </div>
              <div className="hidden min-[360px]:block">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-lg text-[var(--text-strong)] tracking-tight">
                    SuVeCA
                  </span>
                  <span className="text-[11px] font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                    Concursos
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] font-medium">
                  Português para concursos
                </p>
              </div>
            </button>

            {/* Right side: Search & User Profile */}
            <div className="flex items-center space-x-3">
              {/* Search Button */}
              <button
                type="button"
                onClick={onOpenSearch}
                className="input-field min-h-[44px] py-1.5 px-3 flex items-center space-x-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:border-slate-300 transition cursor-pointer"
                title="Pesquisar em todo o app (Ctrl+K)"
                aria-label="Abrir pesquisa"
              >
                <Search className="w-4 h-4 text-slate-400" />
                <span className="hidden sm:inline">Buscar no app...</span>
                <kbd className="hidden xl:inline text-[10px] bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded">
                  Ctrl+K
                </kbd>
              </button>

              {/* Account / User profile */}
              {user ? (
                <div className="flex items-center space-x-2 pl-2">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Usuário'}
                      className="w-8 h-8 rounded-full border border-slate-200 object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-800 font-bold text-xs flex items-center justify-center border border-teal-200">
                      {user.email?.[0].toUpperCase() || 'U'}
                    </div>
                  )}

                  <div className="hidden sm:block text-left">
                    <div className="text-xs font-semibold text-[var(--text-strong)] truncate max-w-[120px]">
                      {user.displayName || user.email?.split('@')[0]}
                    </div>
                    {isSyncing && (
                      <div className="text-[10px] text-teal-700 flex items-center gap-1 font-medium">
                        <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                        <span>Sincronizando...</span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={onSignOut}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="Sair da conta"
                    aria-label="Sair da conta"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={onSignIn} className="button-primary min-h-[44px] text-xs">
                  <LogIn className="w-4 h-4" />
                  <span>Entrar</span>
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Desktop Tabs */}
          <nav className="relative hidden min-w-0 items-center gap-1 py-2 lg:flex" aria-label="Navegação principal">
            {desktopPrimaryTabs.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex min-h-[44px] shrink-0 items-center space-x-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition cursor-pointer ${
                    isActive
                      ? 'bg-teal-50 text-teal-800 border border-teal-200/80 shadow-2xs font-bold'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-slate-100/70'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-teal-700' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>

                  {item.isIa && (
                    <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded font-bold uppercase tracking-wider flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                      IA
                    </span>
                  )}

                  {item.countBadge !== undefined && (
                    <span className="bg-rose-600 text-white text-[11px] px-2 py-0.2 rounded-full font-bold">
                      {item.countBadge}
                    </span>
                  )}
                </button>
              );
            })}
            <div className="relative ml-auto shrink-0">
              <button
                ref={desktopMoreButtonRef}
                type="button"
                onClick={() => setIsDesktopMoreOpen((open) => !open)}
                aria-expanded={isDesktopMoreOpen}
                aria-haspopup="menu"
                aria-controls="desktop-more-menu"
                className={`flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 ${
                  isDesktopMoreActive
                    ? 'border border-teal-200/80 bg-teal-50 font-bold text-teal-800 shadow-2xs'
                    : 'text-[var(--text-muted)] hover:bg-slate-100/70 hover:text-[var(--text-strong)]'
                }`}
              >
                <MoreHorizontal className="h-4 w-4" />
                <span>Mais</span>
              </button>
              {isDesktopMoreOpen && (
                <div
                  ref={desktopMoreMenuRef}
                  id="desktop-more-menu"
                  role="menu"
                  aria-label="Outras ferramentas"
                  onKeyDown={handleDesktopMenuKeyDown}
                  className="absolute right-0 top-[calc(100%+0.5rem)] z-50 grid w-[min(34rem,calc(100vw-2rem))] grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl xl:grid-cols-3"
                >
                  {navigationGroups.flatMap((group) => [
                    <h3 key={`${group}-heading`} className="col-span-2 px-1 pt-1 text-[11px] font-extrabold uppercase tracking-wide text-slate-500 xl:col-span-3">{group}</h3>,
                    ...desktopMoreTabs.filter((item) => item.group === group).map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="menuitem"
                        aria-current={isActive ? 'page' : undefined}
                        onClick={() => {
                          setActiveTab(item.id);
                          setIsDesktopMoreOpen(false);
                          desktopMoreButtonRef.current?.focus();
                        }}
                        className={`flex min-h-[48px] items-center gap-3 rounded-xl border p-3 text-left text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 ${
                          isActive
                            ? 'border-teal-200 bg-teal-50 font-bold text-teal-800'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <Icon className="h-5 w-5 shrink-0 text-teal-700" />
                        <span className="min-w-0 flex-1">
                          <span className="block leading-4">{item.label}</span>
                          {item.countBadge !== undefined && <span className="mt-0.5 block text-[10px] font-bold text-rose-600">{item.countBadge} pendentes</span>}
                        </span>
                        {item.isIa && <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-label="Recurso de inteligência artificial" />}
                      </button>
                    );
                  })])}
                </div>
              )}
            </div>
          </nav>
        </div>
      </header>

      {/* Mobile Bottom Fixed Bar (390px / small screens) */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg flex items-center justify-around min-h-[64px] pb-[env(safe-area-inset-bottom,0px)] px-1"
        aria-label="Navegação móvel"
      >
        {primaryTabs.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveTab(item.id);
                setIsMobileMoreOpen(false);
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1.5 px-2 rounded-lg transition ${
                isActive ? 'text-teal-800 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-teal-700' : 'text-slate-400'}`} />
              <span className="text-[11px] mt-1 font-medium">{item.label}</span>
            </button>
          );
        })}

        {/* More Button */}
        <button
          type="button"
          onClick={() => setIsMobileMoreOpen(!isMobileMoreOpen)}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1.5 px-2 rounded-lg transition ${
            secondaryTabs.some((t) => t.id === activeTab)
              ? 'text-teal-800 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          aria-expanded={isMobileMoreOpen}
          aria-controls="mobile-more-dialog"
          aria-haspopup="dialog"
          aria-label="Ver mais abas de navegação"
        >
          <div className="relative">
            <MoreHorizontal className="w-5 h-5 text-slate-500" />
            {errorCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-rose-600 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {errorCount}
              </span>
            )}
          </div>
          <span className="text-[11px] mt-1 font-medium">Mais</span>
        </button>
      </nav>

      {/* Mobile "Mais" Panel Drawer */}
      {isMobileMoreOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex flex-col justify-end"
          onClick={() => setIsMobileMoreOpen(false)}
        >
          <div
            ref={mobileDrawerRef}
            id="mobile-more-dialog"
            className="bg-white rounded-t-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] border-t border-slate-200 shadow-2xl space-y-3 animate-in slide-in-from-bottom duration-200 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-more-title"
            tabIndex={-1}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 id="mobile-more-title" className="font-bold text-slate-900 text-base">Outras Ferramentas</h3>
              <button
                ref={mobileDrawerCloseRef}
                type="button"
                onClick={() => setIsMobileMoreOpen(false)}
                className="text-slate-400 hover:text-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg"
                aria-label="Fechar painel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 pt-1">
              {navigationGroups.map((group) => <section key={group} aria-labelledby={`mobile-nav-${group}`}>
                <h4 id={`mobile-nav-${group}`} className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">{group}</h4>
                <div className="grid grid-cols-2 gap-2">
              {secondaryTabs.filter((item) => item.group === group).map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileMoreOpen(false);
                    }}
                    className={`flex items-center gap-3 p-3 rounded-xl min-h-[48px] text-xs font-semibold border transition text-left ${
                      isActive
                        ? 'bg-teal-50 text-teal-800 border-teal-200 font-bold'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-5 h-5 text-teal-700 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{item.label}</div>
                      {item.countBadge !== undefined && (
                        <div className="text-[10px] text-rose-600 font-bold mt-0.5">
                          {item.countBadge} pendentes
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
                </div>
              </section>)}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
