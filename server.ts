import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import {
  formatKnowledgeContext,
  KNOWLEDGE_BUILD,
  retrieveKnowledge,
} from "./src/lib/knowledgeRetrieval";
import {
  formatOfficialQuestionContext,
  getOfficialQuestion,
  getOfficialQuestionStoreHealth,
  queryOfficialQuestions,
  sampleOfficialQuestions,
} from "./src/lib/officialQuestions.server";
import { toLearnerFacingContent } from "./src/lib/learnerContent";
import { formatSuvecaMethodContext } from "./src/lib/suvecaMethod";
import { applicationDefault, getApps as getAdminApps, initializeApp as initializeAdminApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";

// Local development follows the README and keeps the Gemini key in .env.local.
// Load it first, then use .env only as a fallback for values not already set.
dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "32kb" }));

const APPROVED_GEMINI_MODELS = new Set(["gemini-3.1-flash-lite", "gemini-2.5-flash"]);
const resolveModel = (value: unknown) =>
  typeof value === "string" && APPROVED_GEMINI_MODELS.has(value)
    ? value
    : "gemini-3.1-flash-lite";

const adminApp = getAdminApps()[0] || initializeAdminApp({ credential: applicationDefault() });
const aiRateLimits = new Map<string, { windowStartedAt: number; count: number }>();
const requireFirebaseUser: express.RequestHandler = async (req, res, next) => {
  const authorization = req.header("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return res.status(401).json({ error: "Entre na sua conta para usar os recursos de IA." });
  try {
    const decoded = await getAdminAuth(adminApp).verifyIdToken(token, true);
    res.locals.userId = decoded.uid;
    return next();
  } catch {
    return res.status(401).json({ error: "Sua sessão expirou. Entre novamente para continuar." });
  }
};

const limitAiRequests: express.RequestHandler = (req, res, next) => {
  const key = String(res.locals.userId || req.ip || "anonymous");
  const now = Date.now();
  const previous = aiRateLimits.get(key);
  const bucket = !previous || now - previous.windowStartedAt >= 60_000
    ? { windowStartedAt: now, count: 0 }
    : previous;
  bucket.count += 1;
  aiRateLimits.set(key, bucket);
  if (bucket.count > 12) return res.status(429).json({ error: "Limite temporário de IA atingido. Aguarde um minuto." });
  return next();
};

app.use(
  ["/api/suveca/analyze", "/api/gemini/explain", "/api/gemini/generate-questions", "/api/gemini/generate-error-flashcards"],
  requireFirebaseUser,
  limitAiRequests,
);

const withAiTimeout = async <T,>(operation: Promise<T>, timeoutMs = 30_000): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("AI_TIMEOUT")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const knowledgeRefsFor = (record: ReturnType<typeof retrieveKnowledge>[number]) => {
  const editorialRefs = Array.isArray(record.sourceRefs)
    ? record.sourceRefs.filter((reference): reference is string => typeof reference === "string")
    : [];
  return editorialRefs;
};

const allowedRefsFor = (records: ReturnType<typeof retrieveKnowledge>, extraContext = "") => {
  const allowed = new Set(records.flatMap(knowledgeRefsFor));
  for (const match of extraContext.matchAll(/\[((?:QUESTION|EDITORIAL|CORPUS):[^\]]+)\]/gi)) {
    allowed.add(match[1]);
  }
  return allowed;
};

const keepAllowedRefs = (value: unknown, allowed: Set<string>) =>
  Array.isArray(value)
    ? [...new Set(value.filter((reference): reference is string => typeof reference === "string" && allowed.has(reference)))]
    : [];

// Lazy GoogleGenAI initialization helper
function getGenAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is missing.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// API Health Check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", app: "SuVeCA Concursos 2.0", knowledgeBase: KNOWLEDGE_BUILD });
});

app.get("/api/knowledge/health", async (_req, res) => {
  try {
    const officialQuestions = await getOfficialQuestionStoreHealth();
    return res.json({ status: "ok", ...KNOWLEDGE_BUILD, officialQuestions });
  } catch (error: any) {
    return res.status(503).json({
      status: "error",
      component: "official-question-store",
      message: error.message,
    });
  }
});

const queryValue = (value: unknown) => typeof value === "string" ? value.trim() : undefined;
const questionFiltersFrom = (source: Record<string, unknown>) => ({
  moduleId: queryValue(source.moduleId),
  conceptId: queryValue(source.conceptId),
  topic: queryValue(source.topic),
  bank: queryValue(source.bank),
  year: queryValue(source.year) ? Number(source.year) : undefined,
  difficulty: queryValue(source.difficulty),
  query: queryValue(source.query),
});

// Editorial source payloads are immutable. Filters and app relations come from
// a separate derived index generated by the pedagogical compiler.
app.get("/api/knowledge/questions", async (req, res) => {
  try {
    const filters = questionFiltersFrom(req.query as Record<string, unknown>);
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    return res.json(await queryOfficialQuestions(filters, { offset, limit }));
  } catch (error: any) {
    return res.status(500).json({ error: "Não foi possível consultar o banco editorial.", details: error.message });
  }
});

app.post("/api/knowledge/questions/sample", async (req, res) => {
  try {
    const filters = questionFiltersFrom((req.body || {}) as Record<string, unknown>);
    const count = Math.min(50, Math.max(1, Number(req.body?.count) || 10));
    const questions = (await sampleOfficialQuestions(filters, count)).filter(Boolean);
    return res.json({
      count: questions.length,
      questionSetVersion: questions[0]?.provenance.questionSetVersion || "",
      questions,
    });
  } catch (error: any) {
    return res.status(500).json({ error: "Não foi possível montar a amostra editorial.", details: error.message });
  }
});

app.get("/api/knowledge/questions/:questionId", async (req, res) => {
  try {
    const question = await getOfficialQuestion(req.params.questionId);
    if (!question) return res.status(404).json({ error: "Questão editorial não encontrada." });
    return res.json(question);
  } catch (error: any) {
    return res.status(500).json({ error: "Não foi possível carregar a questão editorial.", details: error.message });
  }
});

// API: Analyze sentence with SuVeCA method
app.post("/api/suveca/analyze", async (req, res) => {
  try {
    const { sentence, model } = req.body;
    if (!sentence || typeof sentence !== "string") {
      return res.status(400).json({ error: "Frase inválida para análise." });
    }

    const safeSentence = sentence.trim().slice(0, 800);
    const ai = getGenAIClient();
    const knowledgeRecords = retrieveKnowledge(`${safeSentence} sujeito verbo complemento sintaxe oração`, 3);
    const knowledgeContext = formatKnowledgeContext(knowledgeRecords);
    const methodContext = formatSuvecaMethodContext();
    const prompt = `Analise a seguinte oração em português do Brasil aplicando rigorosamente o Método SuVeCA:

Frase: "${safeSentence}"

${methodContext}

${knowledgeContext}

REGRAS DE SAÍDA:
- Mantenha os blocos na ordem superficial em que aparecem na frase; não reordene a frase para fazê-la caber em Su–Ve–C–A–Pred.
- Em surfacePattern, registre a sequência realmente encontrada, como "A + Ve + Su".
- Em relationalMap, explique os vínculos reconstruídos entre verbo, sujeito, complementos, adjuntos e predicativos.
- Registre em implicitElements os sujeitos ocultos, termos elípticos, sujeitos indeterminados e a inexistência de sujeito. Não invente um bloco textual que não aparece na frase.
- Em período composto, delimite cada oração e deixe clara a relação entre elas.

Forneça um JSON estruturado com os blocos sintáticos, classe gramatical de cada termo, ordem (direta ou inversa), voz verbal, explicação pedagógica para concursos públicos e os identificadores das fontes efetivamente usadas. Trate o corpus_apostila como autoridade normativa e a Integracao_Pedagogica como sua expansão didática; a SuVeCA é a camada metodológica do aplicativo. Não atribua à fonte normativa uma interpretação editorial própria do método.`;

    const selectedModel = resolveModel(model);

    const response = await withAiTimeout(ai.models.generateContent({
      model: selectedModel,
      contents: prompt,
      config: {
        systemInstruction:
          "Você é um especialista em Sintaxe da Língua Portuguesa para concursos públicos e tutor do método SuVeCA. SuVeCA é um mapa para reconstruir relações sintáticas, nunca um molde de ordem linear: preserve inversões, elipses, sujeitos pospostos, ocultos, indeterminados e orações sem sujeito. Use prioritariamente a Base Editorial SuVeCA: o corpus_apostila fornece a autoridade normativa, a Integracao_Pedagogica fornece a organização e a expansão didática, e a SuVeCA fornece somente a camada metodológica de aplicação. Aplique limites, exceções, contrastes e testes decisórios, preserve essa hierarquia entre as camadas e não invente proveniência.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sentence: { type: Type.STRING },
            order: { type: Type.STRING, description: "Direta ou Inversa" },
            verbalVoice: { type: Type.STRING, description: "Ativa, Passiva Analítica, Passiva Sintética, Reflexiva" },
            surfacePattern: { type: Type.STRING, description: "Sequência dos blocos na ordem real, por exemplo A + Ve + Su" },
            relationalMap: { type: Type.STRING, description: "Relações reconstruídas sem impor ordem direta" },
            implicitElements: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Elementos ocultos, elípticos, indeterminados ou inexistentes; lista vazia quando não houver",
            },
            blocks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  category: {
                    type: Type.STRING,
                    description: "SUJEITO, VERBO, COMPLEMENTO, ADJUNTO_ADVERBIAL, ADJUNTO_ADNOMINAL, PREDICATIVO, CONECTOR, VOCATIVO, APOSTO",
                  },
                  shortLabel: { type: Type.STRING, description: "Su, Ve, C(OD), C(OI), Aadv, Aadn, Pred, etc." },
                  colorTag: { type: Type.STRING, description: "blue, emerald, amber, purple, rose, cyan, gray" },
                  morphology: { type: Type.STRING, description: "Classes morfológicas envolvidas" },
                  explanation: { type: Type.STRING, description: "Motivo sintático e regras para concursos" },
                },
                required: ["text", "category", "shortLabel", "explanation"],
              },
            },
            summaryExplanation: { type: Type.STRING, description: "Resumo pedagógico e atenção para concursos" },
            contestTips: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Pegadinhas ou detalhes cobrados pelas bancas (Cebraspe, FGV, FCC)",
            },
            knowledgeSources: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Referências EDITORIAL e CORPUS efetivamente usadas.",
            },
          },
          required: ["sentence", "order", "verbalVoice", "surfacePattern", "relationalMap", "implicitElements", "blocks", "summaryExplanation"],
        },
      },
    }));

    const jsonStr = response.text || "{}";
    const data = JSON.parse(jsonStr);
    const allowedKnowledgeSources = allowedRefsFor(knowledgeRecords);
    data.knowledgeSources = Array.isArray(data.knowledgeSources)
      ? data.knowledgeSources.filter((reference: unknown): reference is string => typeof reference === "string" && allowedKnowledgeSources.has(reference))
      : [];
    if (!data.knowledgeSources.length) {
      return res.status(422).json({ error: "A análise não retornou proveniência válida da Base Editorial. Tente reformular a oração." });
    }
    return res.json(data);
  } catch (error: any) {
    console.error("Erro na análise SuVeCA:", error);
    return res.status(500).json({
      error: "Não foi possível analisar a oração via IA no momento.",
      details: error.message,
    });
  }
});

// API: Ask Professor SuVeCA (AI Grammar Tutor)
app.post("/api/gemini/explain", async (req, res) => {
  try {
    const { question, context, history, model } = req.body || {};
    if (typeof question !== "string" || !question.trim()) {
      return res.status(400).json({ error: "Pergunta não informada." });
    }

    const safeQuestion = question.trim().slice(0, 4000);
    const safeContext = typeof context === "string"
      ? context.trim().slice(0, 800)
      : "Geral de Português para Concursos";
    const safeHistory = Array.isArray(history)
      ? history
          .slice(-6)
          .filter((message) => message && (message.role === "user" || message.role === "assistant") && typeof message.text === "string")
          .map((message) => ({ role: message.role as "user" | "assistant", text: message.text.trim().slice(0, 4000) }))
          .filter((message) => message.text)
      : [];
    const conversationContext = safeHistory.length
      ? safeHistory.map((message) => `${message.role === "user" ? "Aluno" : "Professor"}: ${message.text}`).join("\n\n")
      : "Sem mensagens anteriores relevantes.";

    const ai = getGenAIClient();
    const knowledgeRecords = retrieveKnowledge(`${safeContext} ${safeQuestion}`, 3);
    const knowledgeContext = formatKnowledgeContext(knowledgeRecords);
    const officialQuestionContext = await formatOfficialQuestionContext(`${safeContext} ${safeQuestion}`, 2);
    const prompt = `Contexto da aula: ${safeContext}

HISTÓRICO RECENTE:
${conversationContext}

DÚVIDA ATUAL DO ALUNO:
${safeQuestion}

${knowledgeContext}

${officialQuestionContext}

Produza answerMarkdown e sourceRefs separadamente.

REGRAS PARA answerMarkdown:
- Responda diretamente à dúvida atual levando em conta o histórico; não se apresente novamente.
- Explique o porquê, o teste mental repetível na prova e a regra decisiva.
- Quando útil, dê um exemplo positivo e um contrastivo e destaque a pegadinha típica.
- Diferencie eixos classificatórios distintos (por exemplo, impessoalidade e transitividade).
- Faça uma verificação de coerência: não apresente a mesma construção como certa e errada sob as mesmas condições.
- Use Markdown com títulos curtos, negrito, listas ou tabelas somente quando melhorarem a compreensão.
- Não inclua EDITORIAL, CORPUS, QUESTION, PASSAGE, KB, IDs, hashes ou referências técnicas no texto pedagógico.
- Se a base não sustentar uma afirmação específica, diga isso claramente em linguagem natural.

REGRAS PARA sourceRefs:
- Liste apenas os identificadores EDITORIAL, CORPUS e QUESTION efetivamente usados.
- As referências são metadados internos e nunca devem ser explicadas dentro de answerMarkdown.
 - Trate o corpus_apostila como autoridade normativa e a Integracao_Pedagogica como expansão didática. Preserve também o conteúdo das questões editoriais citado; não o corrija, reescreva nem atribua à SuVeCA.
- Quando relações sintáticas forem decisivas, aplique a SuVeCA como mapa relacional, preservando ordem inversa, omissões e orações sem sujeito. Não force a metodologia em questões puramente gráficas, lexicais ou discursivas.`;

    const selectedModel = resolveModel(model);

    const response = await withAiTimeout(ai.models.generateContent({
      model: selectedModel,
      contents: prompt,
      config: {
        systemInstruction:
          "Você é o Professor SuVeCA, tutor ancorado na Base Editorial SuVeCA. O corpus_apostila é a autoridade normativa; a Integracao_Pedagogica organiza e expande o conteúdo para o ensino; a SuVeCA é o mapa metodológico que reconstrói relações sintáticas sem impor ordem linear. Use o mapa quando ele ajudar a decisão e explicite seus limites quando a questão pertencer à forma, ao léxico, ao texto ou ao discurso. Preserve a separação e a hierarquia entre essas camadas, aplique limites, exceções, contrastes e testes decisórios, responda com rigor pedagógico e mantenha toda proveniência exclusivamente em sourceRefs.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answerMarkdown: {
              type: Type.STRING,
              description: "Resposta pedagógica em Markdown sem identificadores técnicos de fontes.",
            },
            sourceRefs: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Referências internas EDITORIAL, CORPUS e QUESTION efetivamente utilizadas.",
            },
          },
          required: ["answerMarkdown", "sourceRefs"],
        },
      },
    }));

    const data = JSON.parse(response.text || "{}");
    const answerMarkdown = toLearnerFacingContent(data.answerMarkdown);
    if (!answerMarkdown) throw new Error("O Professor não retornou conteúdo pedagógico válido.");
    const sourceRefs = keepAllowedRefs(data.sourceRefs, allowedRefsFor(knowledgeRecords, officialQuestionContext));
    if (!sourceRefs.length) {
      return res.status(422).json({ error: "A base recuperada não sustentou uma resposta com proveniência verificável. Reformule a dúvida." });
    }
    return res.json({ answerMarkdown, sourceRefs });
  } catch (error: any) {
    console.error("Erro no Professor SuVeCA:", error);
    return res.status(500).json({
      error: "Erro ao consultar o Professor SuVeCA.",
      details: error.message,
    });
  }
});

// API: Generate Custom Questões
app.post("/api/gemini/generate-questions", async (req, res) => {
  try {
    const { topic, bank, count, model } = req.body;
    const safeTopic = typeof topic === "string" ? topic.trim().slice(0, 240) : "Concordância";
    const safeBank = typeof bank === "string" ? bank.trim().slice(0, 80) : "CEBRASPE / FGV";
    const safeCount = Math.min(5, Math.max(1, Number(count) || 3));
    const ai = getGenAIClient();
    const knowledgeRecords = retrieveKnowledge(`${safeTopic} ${safeBank}`, 3);
    const knowledgeContext = formatKnowledgeContext(knowledgeRecords);
    const officialQuestionContext = await formatOfficialQuestionContext(`${safeTopic} ${safeBank}`, 2);

    const prompt = `Gere ${safeCount} questões inéditas no estilo da banca ${safeBank} sobre o tema: "${safeTopic}".

${knowledgeContext}

${officialQuestionContext}

Use a Base Editorial como sustentação conceitual: o corpus_apostila é a autoridade normativa e a Integracao_Pedagogica fornece a expansão didática. Quando a resolução depender de relações sintáticas, use a SuVeCA como mapa — não como ordem obrigatória — e respeite termos omitidos e orações sem sujeito; não a force em fenômenos de outra camada. As questões editoriais acima servem apenas como referência de incidência e formato. Não copie, corrija nem reescreva seus enunciados ou soluções. Forneça questões novas com enunciado, alternativas/opções ou julgamento Certo/Errado, resposta correta, comentário gramatical detalhado e sourceRefs separados. O comentário é conteúdo do aluno e não pode conter EDITORIAL, CORPUS, QUESTION, PASSAGE, KB ou IDs técnicos; as referências internas ficam exclusivamente em sourceRefs.`;

    const selectedModel = resolveModel(model);

    const response = await withAiTimeout(ai.models.generateContent({
      model: selectedModel,
      contents: prompt,
      config: {
        systemInstruction: "Você é um elaborador de questões de Língua Portuguesa para concursos públicos ancorado na Base Editorial SuVeCA. Preserve a autoridade normativa do corpus_apostila, use a Integracao_Pedagogica para clareza, gradação e qualidade didática e aplique a SuVeCA apenas como mapa de relações sintáticas quando ela for pertinente, nunca como molde linear, sem inventar proveniência.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  type: { type: Type.STRING, description: "CERTO_ERRADO ou MULTIPLA_ESCOLHA" },
                  bank: { type: Type.STRING },
                  topic: { type: Type.STRING },
                  supportText: { type: Type.STRING, description: "Texto de apoio opcional" },
                  questionText: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        letter: { type: Type.STRING },
                        text: { type: Type.STRING },
                      },
                    },
                  },
                  correctAnswer: { type: Type.STRING, description: "C ou E se for Certo/Errado, ou A, B, C, D, E" },
                  commentary: { type: Type.STRING, description: "Comentário pedagógico completo com a regra decisiva" },
                  sourceRefs: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Referências internas EDITORIAL, CORPUS e, quando usada como referência de incidência, QUESTION.",
                  },
                },
                required: ["id", "type", "questionText", "correctAnswer", "commentary", "sourceRefs"],
              },
            },
          },
          required: ["questions"],
        },
      },
    }));

    const jsonStr = response.text || "{}";
    const data = JSON.parse(jsonStr);
    const questions = Array.isArray(data.questions)
      ? data.questions.map((question: any) => ({
          ...question,
          supportText: toLearnerFacingContent(question.supportText) || undefined,
          questionText: toLearnerFacingContent(question.questionText),
          commentary: toLearnerFacingContent(question.commentary),
          options: Array.isArray(question.options)
            ? question.options.map((option: any) => ({ ...option, text: toLearnerFacingContent(option.text) }))
            : question.options,
          origin: "ai_generated",
          sourceRefs: keepAllowedRefs(question.sourceRefs, allowedRefsFor(knowledgeRecords, officialQuestionContext)),
        })).filter((question: any) => question.questionText && question.commentary && question.sourceRefs.length)
      : [];
    if (!questions.length) {
      return res.status(422).json({ error: "A base não sustentou questões inéditas com proveniência verificável para este pedido." });
    }
    return res.json({ questions });
  } catch (error: any) {
    console.error("Erro ao gerar questões:", error);
    return res.status(500).json({
      error: "Não foi possível gerar as questões no momento.",
      details: error.message,
    });
  }
});

// API: Generate active-recall flashcards from a Caderno de Erros entry
app.post("/api/gemini/generate-error-flashcards", async (req, res) => {
  try {
    const { error, count, model } = req.body || {};
    if (
      !error ||
      typeof error.conteudo !== "string" ||
      typeof error.erroCometido !== "string" ||
      typeof error.regraDecisiva !== "string"
    ) {
      return res.status(400).json({
        error: "Envie um registro válido do Caderno de Erros para criar os flashcards.",
      });
    }

    const cardCount = Math.min(Math.max(Number(count) || 2, 1), 4);
    const truncate = (value: string) => value.trim().slice(0, 2400);
    const ai = getGenAIClient();
    const knowledgeRecords = retrieveKnowledge(`${error.conteudo} ${error.regraDecisiva}`, 2);
    const knowledgeContext = formatKnowledgeContext(knowledgeRecords);
    const prompt = `Transforme o seguinte registro do Caderno de Erros em ${cardCount} flashcards curtos de revisão ativa.

Tópico: ${truncate(error.conteudo)}
Erro cometido: ${truncate(error.erroCometido)}
Regra decisiva: ${truncate(error.regraDecisiva)}
Exemplo de fixação: ${typeof error.novoExemplo === "string" ? truncate(error.novoExemplo) : "não informado"}

${knowledgeContext}

Para cada flashcard produza:
- front: pergunta curta de recuperação ativa;
- back: resposta objetiva para conferência rápida;
- hint: dica opcional que conduz ao raciocínio sem entregar a resposta;
- explanation: explicação detalhada com o porquê, teste mental, ao menos um exemplo, contraste quando útil e pegadinha de concurso;
- sourceRefs: referências EDITORIAL e CORPUS efetivamente usadas, como metadados internos.

A explicação não deve apenas repetir o verso. Não invente regras sem apoio na Base Editorial: o corpus_apostila é a autoridade normativa e a Integracao_Pedagogica é a expansão didática. Nenhum texto de front, back, hint ou explanation pode conter EDITORIAL, CORPUS, QUESTION, PASSAGE, KB, IDs ou referências técnicas; mantenha-os exclusivamente em sourceRefs.`;

    const response = await withAiTimeout(ai.models.generateContent({
      model: resolveModel(model),
      contents: prompt,
      config: {
        systemInstruction:
          "Você é um professor de Língua Portuguesa para concursos ancorado na Base Editorial SuVeCA. Crie flashcards claros, autocontidos e focados em revisar a regra decisiva; preserve a autoridade normativa do corpus_apostila, use a Integracao_Pedagogica para aprofundamento didático e aplique a SuVeCA, quando pertinente, como mapa de relações sintáticas que admite inversões, omissões e ausência de sujeito.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            flashcards: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  front: {
                    type: Type.STRING,
                    description: "Pergunta de recuperação ativa, em português do Brasil.",
                  },
                  back: {
                    type: Type.STRING,
                    description: "Resposta explicada, breve e correta.",
                  },
                  hint: {
                    type: Type.STRING,
                    description: "Dica curta opcional, sem entregar a resposta inteira.",
                  },
                  explanation: {
                    type: Type.STRING,
                    description: "Aprofundamento pedagógico com raciocínio, exemplo, contraste e pegadinha, sem IDs técnicos.",
                  },
                  sourceRefs: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Referências internas EDITORIAL e CORPUS efetivamente utilizadas.",
                  },
                },
                required: ["front", "back", "explanation", "sourceRefs"],
              },
            },
          },
          required: ["flashcards"],
        },
      },
    }));

    const data = JSON.parse(response.text || "{}");
    const flashcards = Array.isArray(data.flashcards)
      ? data.flashcards.map((card: any) => ({
          front: toLearnerFacingContent(card.front),
          back: toLearnerFacingContent(card.back),
          hint: toLearnerFacingContent(card.hint) || undefined,
          explanation: toLearnerFacingContent(card.explanation),
          sourceRefs: keepAllowedRefs(card.sourceRefs, allowedRefsFor(knowledgeRecords)),
        })).filter((card: any) => card.front && card.back && card.explanation && card.sourceRefs.length)
      : [];
    if (!flashcards.length) {
      return res.status(422).json({ error: "A base não sustentou flashcards com proveniência verificável para esta regra." });
    }
    return res.json({ flashcards });
  } catch (error: any) {
    console.error("Erro ao gerar flashcards:", error);
    return res.status(500).json({
      error: "Não foi possível gerar flashcards via IA no momento.",
      details: error.message,
    });
  }
});

// Vite & Static file handling
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SuVeCA Server running on http://localhost:${PORT}`);
  });
}

startServer();
