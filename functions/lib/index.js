"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendInactivityReviewEmails = exports.verifyDuelRound = exports.syncLeaderboardAlias = exports.verifyOfficialSimulado = exports.sendDailyReviewPushes = void 0;
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const firebase_functions_1 = require("firebase-functions");
const params_1 = require("firebase-functions/params");
const firestore_2 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const officialQuestions_js_1 = require("./officialQuestions.js");
const officialCorpus_generated_js_1 = require("./officialCorpus.generated.js");
const duelQuestions_js_1 = require("./duelQuestions.js");
var pushNotifications_js_1 = require("./pushNotifications.js");
Object.defineProperty(exports, "sendDailyReviewPushes", { enumerable: true, get: function () { return pushNotifications_js_1.sendDailyReviewPushes; } });
(0, app_1.initializeApp)();
const firestore = (0, firestore_1.getFirestore)();
const resendApiKey = (0, params_1.defineSecret)('RESEND_API_KEY');
const OFFICIAL_SIMULADO_IDS = Object.keys(officialQuestions_js_1.OFFICIAL_SIMULADO_ANSWER_KEY);
const ANSWER_VALUES = new Set(['A', 'B', 'C', 'D', 'E']);
const CURRENT_EDITORIAL_BUILD_ID = officialQuestions_js_1.OFFICIAL_SIMULADO_VERSION.slice(-16);
const CURRENT_DUEL_BUILD_ID = duelQuestions_js_1.DUEL_QUESTION_SET_VERSION.slice(-16);
if (officialCorpus_generated_js_1.OFFICIAL_CORPUS_VERSION.slice(-16) !== CURRENT_EDITORIAL_BUILD_ID
    || CURRENT_DUEL_BUILD_ID !== CURRENT_EDITORIAL_BUILD_ID) {
    throw new Error('Os gabaritos confiáveis pertencem a builds editoriais diferentes.');
}
const monthKeyFor = (date) => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
    }).formatToParts(date);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    return `${year ?? date.getUTCFullYear()}-${month ?? String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};
const getFirstName = (displayName) => {
    if (typeof displayName !== 'string')
        return '';
    return displayName
        .trim()
        .split(/\s+/)[0]
        ?.replace(/[\u0000-\u001F\u007F]/g, '')
        .slice(0, 32) || '';
};
const getPublicAlias = (displayName, shareFirstName) => shareFirstName === true && getFirstName(displayName)
    ? getFirstName(displayName)
    : 'Estudante SuVeCA';
const isValidAnswerMap = (value, answerKey, requiredSize) => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return false;
    const entries = Object.entries(value);
    return entries.length === requiredSize && entries.every(([questionId, answer]) => Object.prototype.hasOwnProperty.call(answerKey, questionId) &&
        typeof answer === 'string' &&
        ANSWER_VALUES.has(answer));
};
const isValidDuelAnswerLog = (value) => Array.isArray(value) &&
    value.length > 0 &&
    value.length <= Object.keys(duelQuestions_js_1.DUEL_ANSWER_KEY).length &&
    new Set(value.map((answer) => answer?.questionId)).size === value.length &&
    value.every((answer) => {
        if (!answer || typeof answer !== 'object' || Array.isArray(answer))
            return false;
        const candidate = answer;
        return (typeof candidate.questionId === 'string' &&
            Object.prototype.hasOwnProperty.call(duelQuestions_js_1.DUEL_ANSWER_KEY, candidate.questionId) &&
            typeof candidate.optionId === 'string' &&
            ANSWER_VALUES.has(candidate.optionId) &&
            typeof candidate.responseMs === 'number' &&
            Number.isFinite(candidate.responseMs) &&
            candidate.responseMs >= 0 &&
            candidate.responseMs <= 60_000);
    });
/**
 * Recalculates the score of an official mock exam and is the only writer of
 * public monthly leaderboard documents. A forged `correctCount` is ignored.
 */
exports.verifyOfficialSimulado = (0, firestore_2.onDocumentCreated)('users/{userId}/attempt_submissions/{attemptId}', async (event) => {
    const submission = event.data?.data();
    const { userId, attemptId } = event.params;
    const isCanonicalSimulado = submission?.questionSetVersion === officialQuestions_js_1.OFFICIAL_SIMULADO_VERSION;
    const isOfficialCorpusSample = submission?.questionSetVersion === officialCorpus_generated_js_1.OFFICIAL_CORPUS_VERSION;
    const answerKey = isCanonicalSimulado
        ? officialQuestions_js_1.OFFICIAL_SIMULADO_ANSWER_KEY
        : isOfficialCorpusSample
            ? officialCorpus_generated_js_1.OFFICIAL_CORPUS_ANSWER_KEY
            : null;
    const requiredSize = isCanonicalSimulado ? OFFICIAL_SIMULADO_IDS.length : officialCorpus_generated_js_1.OFFICIAL_CORPUS_SAMPLE_SIZE;
    if (!submission || submission.schemaVersion !== 1 || !answerKey || !isValidAnswerMap(submission.answerMap, answerKey, requiredSize)) {
        firebase_functions_1.logger.warn('Tentativa oficial rejeitada por formato inválido.', {
            userId,
            attemptId,
        });
        return;
    }
    const answerMap = submission.answerMap;
    const submittedQuestionIds = Object.keys(answerMap);
    const correctCount = submittedQuestionIds.reduce((total, questionId) => total +
        (answerMap[questionId] === answerKey[questionId]
            ? 1
            : 0), 0);
    const totalQuestions = submittedQuestionIds.length;
    const now = new Date();
    const monthKey = monthKeyFor(now);
    const attemptBuildId = submission.questionSetVersion.slice(-16);
    const leaderboardKey = `${monthKey}_${attemptBuildId}`;
    const verifiedAttemptRef = firestore.doc(`users/${userId}/verified_attempts/${attemptId}`);
    const userRef = firestore.doc(`users/${userId}`);
    const preferencesRef = firestore.doc(`users/${userId}/data/leaderboard_preferences`);
    const leaderboardRef = firestore.doc(`leaderboards/${leaderboardKey}/entries/${userId}`);
    await firestore.runTransaction(async (transaction) => {
        const [verifiedAttempt, userSnapshot, preferenceSnapshot] = await Promise.all([
            transaction.get(verifiedAttemptRef),
            transaction.get(userRef),
            transaction.get(preferencesRef),
        ]);
        // Firestore functions may retry delivery. The immutable verification
        // record makes score aggregation idempotent.
        if (verifiedAttempt.exists)
            return;
        const alias = getPublicAlias(userSnapshot.data()?.displayName, preferenceSnapshot.data()?.shareFirstName);
        transaction.create(verifiedAttemptRef, {
            schemaVersion: 1,
            sourceAttemptId: attemptId,
            questionSetVersion: submission.questionSetVersion,
            correctCount,
            totalQuestions,
            percentage: Math.round((correctCount / totalQuestions) * 100),
            verifiedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        transaction.set(leaderboardRef, {
            schemaVersion: 2,
            month: monthKey,
            curriculumBuildId: attemptBuildId,
            alias,
            correctAnswers: firestore_1.FieldValue.increment(correctCount),
            verifiedAttemptCount: firestore_1.FieldValue.increment(1),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
    });
});
/** Keeps the visible alias in the current month up to date without client writes. */
exports.syncLeaderboardAlias = (0, firestore_2.onDocumentWritten)('users/{userId}/data/leaderboard_preferences', async (event) => {
    if (!event.data?.after.exists)
        return;
    const { userId } = event.params;
    const monthKey = monthKeyFor(new Date());
    const leaderboardKey = `${monthKey}_${CURRENT_EDITORIAL_BUILD_ID}`;
    const leaderboardRef = firestore.doc(`leaderboards/${leaderboardKey}/entries/${userId}`);
    const [leaderboardSnapshot, userSnapshot] = await Promise.all([
        leaderboardRef.get(),
        firestore.doc(`users/${userId}`).get(),
    ]);
    if (!leaderboardSnapshot.exists)
        return;
    await leaderboardRef.set({
        alias: getPublicAlias(userSnapshot.data()?.displayName, event.data.after.data()?.shareFirstName),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
});
/**
 * Calculates Duel scores from an answer transcript. Client-provided totals,
 * points and best times are discarded; response durations are clamped to keep
 * the public board within the limits of the 60-second mode.
 */
exports.verifyDuelRound = (0, firestore_2.onDocumentCreated)('users/{userId}/duel_submissions/{roundId}', async (event) => {
    const submission = event.data?.data();
    const { userId, roundId } = event.params;
    if (!submission ||
        submission.schemaVersion !== 1 ||
        submission.questionSetVersion !== duelQuestions_js_1.DUEL_QUESTION_SET_VERSION ||
        !isValidDuelAnswerLog(submission.answerLog)) {
        firebase_functions_1.logger.warn('Duelo rejeitado por formato inválido.', { userId, roundId });
        return;
    }
    const answerLog = submission.answerLog;
    const normalizedAnswers = answerLog.map((answer) => ({
        ...answer,
        // Durations come from a browser, so prevent an impossible zero-ms
        // answer from becoming a larger bonus than a realistic fast answer.
        responseMs: Math.min(60_000, Math.max(250, Math.floor(answer.responseMs))),
    }));
    const correctAnswers = normalizedAnswers.filter((answer) => answer.optionId ===
        duelQuestions_js_1.DUEL_ANSWER_KEY[answer.questionId]);
    const score = correctAnswers.reduce((total, answer) => total + 100 + Math.max(0, 100 - Math.floor(answer.responseMs / 100)), 0);
    const totalResponseMs = normalizedAnswers.reduce((total, answer) => total + answer.responseMs, 0);
    const fastestResponseMs = normalizedAnswers.length
        ? Math.min(...normalizedAnswers.map((answer) => answer.responseMs))
        : 0;
    const monthKey = monthKeyFor(new Date());
    const leaderboardKey = `${monthKey}_${CURRENT_DUEL_BUILD_ID}`;
    const verifiedRoundRef = firestore.doc(`users/${userId}/verified_duel_rounds/${roundId}`);
    const userRef = firestore.doc(`users/${userId}`);
    const preferencesRef = firestore.doc(`users/${userId}/data/leaderboard_preferences`);
    const leaderboardRef = firestore.doc(`duel_leaderboards/${leaderboardKey}/entries/${userId}`);
    await firestore.runTransaction(async (transaction) => {
        const [verifiedRound, currentEntry, userSnapshot, preferenceSnapshot] = await Promise.all([
            transaction.get(verifiedRoundRef),
            transaction.get(leaderboardRef),
            transaction.get(userRef),
            transaction.get(preferencesRef),
        ]);
        if (verifiedRound.exists)
            return;
        const current = currentEntry.data() || {};
        const currentBestScore = Number.isFinite(current.bestScore)
            ? Math.max(0, Math.floor(current.bestScore))
            : 0;
        const currentBestResponseMs = Number.isFinite(current.bestResponseMs)
            ? Math.max(0, Math.floor(current.bestResponseMs))
            : 0;
        const isNewBest = score > currentBestScore ||
            (score === currentBestScore &&
                fastestResponseMs > 0 &&
                (currentBestResponseMs === 0 || fastestResponseMs < currentBestResponseMs));
        const alias = getPublicAlias(userSnapshot.data()?.displayName, preferenceSnapshot.data()?.shareFirstName);
        transaction.create(verifiedRoundRef, {
            schemaVersion: 1,
            sourceRoundId: roundId,
            correctAnswers: correctAnswers.length,
            answeredCount: normalizedAnswers.length,
            score,
            totalResponseMs,
            fastestResponseMs,
            verifiedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        transaction.set(leaderboardRef, {
            schemaVersion: 2,
            month: monthKey,
            curriculumBuildId: CURRENT_DUEL_BUILD_ID,
            alias,
            bestScore: isNewBest ? score : currentBestScore,
            bestCorrectAnswers: isNewBest
                ? correctAnswers.length
                : Number.isFinite(current.bestCorrectAnswers)
                    ? Math.max(0, Math.floor(current.bestCorrectAnswers))
                    : 0,
            bestResponseMs: currentBestResponseMs
                ? Math.min(currentBestResponseMs, fastestResponseMs || currentBestResponseMs)
                : fastestResponseMs,
            roundsPlayed: (Number.isFinite(current.roundsPlayed)
                ? Math.max(0, Math.floor(current.roundsPlayed))
                : 0) + 1,
            totalCorrectAnswers: (Number.isFinite(current.totalCorrectAnswers)
                ? Math.max(0, Math.floor(current.totalCorrectAnswers))
                : 0) + correctAnswers.length,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
    });
});
/**
 * Optional Resend delivery for accounts that explicitly enabled e-mail
 * reminders. It is intentionally opt-in and only sends after 48 hours of
 * inactivity measured by a server timestamp.
 */
exports.sendInactivityReviewEmails = (0, scheduler_1.onSchedule)({
    schedule: 'every 24 hours',
    timeZone: 'America/Sao_Paulo',
    secrets: [resendApiKey],
}, async () => {
    const apiKey = resendApiKey.value();
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) {
        firebase_functions_1.logger.warn('Lembretes por e-mail ignorados: configure RESEND_API_KEY e RESEND_FROM_EMAIL.');
        return;
    }
    const cutoff = firestore_1.Timestamp.fromDate(new Date(Date.now() - 48 * 60 * 60 * 1000));
    const staleUsers = await firestore
        .collection('users')
        .where('lastActivityAt', '<=', cutoff)
        .limit(500)
        .get();
    await Promise.all(staleUsers.docs.map(async (userSnapshot) => {
        const user = userSnapshot.data();
        // The profile document is user-writable. Resolve the destination from
        // Firebase Auth instead of trusting a client-provided e-mail field.
        let recipient;
        try {
            recipient = await (0, auth_1.getAuth)().getUser(userSnapshot.id);
        }
        catch (error) {
            firebase_functions_1.logger.warn('Conta ausente ao preparar lembrete por e-mail.', {
                userId: userSnapshot.id,
                error,
            });
            return;
        }
        const email = recipient.email || '';
        if (!email || recipient.emailVerified === false)
            return;
        const preferenceRef = firestore.doc(`users/${userSnapshot.id}/data/notification_preferences`);
        const preference = await preferenceRef.get();
        const preferenceData = preference.data();
        if (preferenceData?.emailReviewEnabled !== true)
            return;
        const lastSentAt = preferenceData?.lastInactivityEmailAt;
        if (lastSentAt instanceof firestore_1.Timestamp && lastSentAt.toMillis() > cutoff.toMillis()) {
            return;
        }
        const appUrl = process.env.APP_URL || 'https://suveca.app';
        const firstName = getFirstName(user.displayName) || 'concurseiro(a)';
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from,
                to: [email],
                subject: 'Sua revisão diária SuVeCA está esperando',
                html: `<p>Olá, ${firstName}.</p><p>Faz mais de 48 horas desde seu último estudo. Retome suas regras decisivas e mantenha o ritmo.</p><p><a href="${appUrl}">Abrir meu Review Diário</a></p>`,
            }),
        });
        if (!response.ok) {
            throw new Error(`Resend respondeu ${response.status} para ${userSnapshot.id}`);
        }
        await preferenceRef.set({
            lastInactivityEmailAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
    }));
});
