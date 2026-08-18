# Suíte visual e de acessibilidade

Esta suíte usa Playwright com Chromium para verificar a interface real do SuVeCA em quatro larguras: 1440, 768, 390 e 320 pixels.

## Comandos

- `npm run test:e2e`: executa regressão visual, overflow, teclado, alvos de toque e axe.
- `npm run test:e2e:update`: recria as imagens de referência após uma mudança visual intencional.
- `npm run test:e2e:ui`: abre a interface interativa do Playwright.
- `npm run test:e2e:report`: abre o último relatório HTML.

O servidor de desenvolvimento é iniciado automaticamente em `127.0.0.1:3000`. A data é congelada em 12/08/2026 e o armazenamento do navegador é limpo em cada teste para manter os resultados determinísticos.

## O que é validado

- capturas da Apostila, Analisador, Simulado, Roteiros e menu `Mais`;
- ausência de overflow horizontal no documento;
- alvos de navegação com pelo menos 44 px;
- abertura e fechamento da pesquisa por teclado, com retorno de foco;
- operação do menu `Mais` por teclado e foco preso no painel móvel;
- violações WCAG A/AA de impacto sério ou crítico via axe-core.

As imagens de referência ficam em `tests/e2e/__snapshots__`. Só atualize essas imagens depois de revisar visualmente o relatório e confirmar que a mudança é desejada.
