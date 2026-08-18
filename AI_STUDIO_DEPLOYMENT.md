# Base editorial e implantação

O conteúdo curricular ativo da SuVeCA é compilado das aulas 00–14 do workspace editorial. Para as aulas 00–13, `corpus_apostila` é a autoridade normativa e `Integracao_Pedagogica` fornece a expansão didática, cognitiva e aplicada. A Aula 14 organiza a revisão cumulativa. O conteúdo curricular antigo não é mesclado.

O método que dá identidade ao aplicativo permanece como uma camada distinta: **SuVeCA = Sujeito + Verbo + Complemento + Adjunto + Predicativo**. Ele é um mapa para reconstruir relações sintáticas, não um molde de ordem linear. `knowledge/editorial/suveca-method.json` define o método e o panorama de cada aula; `knowledge/editorial/suveca-group-connections.json` classifica explicitamente os 102 grupos como aplicação central, conexão forte, apoio estrutural, apoio indireto ou camada fora do núcleo. Assim, fonologia e hífen não são artificialmente reduzidos à sintaxe, enquanto pronomes, verbos, termos da oração, período composto, pontuação, concordância e regência preservam a SuVeCA como eixo efetivo de aprendizagem. Essa camada organiza o uso do conteúdo, mas não cria regras nem substitui a autoridade do corpus.

## Compilação editorial

```bash
npm run kb:pedagogical:build
npm run kb:shard
npm run kb:pedagogical:audit
npm run kb:shard:audit
```

`scripts/build-pedagogical-curriculum.mjs` lê a fonte externa configurada, calcula um digest dos arquivos editoriais e produz artefatos determinísticos com um `buildId` comum. Entre as saídas estão:

- `knowledge/canonical/pedagogical-curriculum.json`: currículo completo usado pelo app;
- `public/knowledge/pedagogical/units/`: 115 unidades de estudo independentes de vídeo;
- `public/knowledge/pedagogical/suveca-method.json`: método, panoramas A00–A14, taxonomia e as 102 conexões temáticas;
- `public/knowledge/pedagogical/decision-procedures.json`: roteiros decisórios;
- `src/data/editorialFlashcards.generated.ts` e `editorialDailyTips.generated.ts`: revisão ativa;
- `public/knowledge/official-questions.*.json`: banco de questões editoriais das aulas 00–13;
- `functions/src/officialQuestions.ts` e `officialCorpus.generated.ts`: gabaritos confiáveis para verificação server-side.

No estado atual, a projeção contém 15 aulas, 115 unidades, 410 roteiros, 209 flashcards, 20 questões no simulado cumulativo, 12 no Duelo e 1.209 questões no banco editorial. A Aula 14 não fabrica questões: ela é uma camada de revisão sobre A00–A13.

## Particionamento e integridade

O banco editorial é dividido em `public/knowledge/official-question-parts/` para ambientes que não carregam bem os monólitos. `official-questions.manifest.json` registra total, ordem dos IDs, bytes e SHA-256 de cada parte. O servidor prefere as partes verificadas quando o manifesto está presente e usa os monólitos como fallback compatível.

Nenhum enunciado, alternativa, gabarito ou comentário é reescrito durante o particionamento. O total é lido do manifesto; não existe contagem fixa no runtime. `GET /api/knowledge/health` informa `buildId`, versão, total e modo de carregamento (`monolithic` ou `sharded`).

## Validação e deploy

```bash
npm run lint
npm test
npm --prefix functions run build
npm run build
```

O `prebuild` executa as auditorias pedagógica e de shards. Ele interrompe a implantação se houver divergência de conteúdo, hash, versão, cobertura, gabarito ou dependência audiovisual.

Aplicação, Firebase Functions e `firestore.rules` devem ser implantados juntos. As tentativas e os duelos usam versões derivadas do mesmo `buildId` (`editorial-simulado-*`, `editorial-corpus-*` e `editorial-duel-*`); um deploy parcial rejeita corretamente versões que não tenham o gabarito confiável correspondente.

Progresso curricular, notas, flashcards editoriais, agendas e rankings também são isolados pelo `buildId`. Cartões pessoais do Caderno de Erros são preservados numa coleção própria; conteúdo e métricas do currículo anterior não aparecem sob os identificadores reutilizados das novas aulas.
