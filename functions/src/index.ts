import { initializeApp } from "firebase-admin/app";

import {
  onCall,
  HttpsError,
} from "firebase-functions/v2/https";

import {
  onDocumentCreated,
} from "firebase-functions/v2/firestore";

import {
  setGlobalOptions,
} from "firebase-functions/v2";

import {
  createAnswerProcessingJob,
  processAnswerJob,
} from "./answerProcessing";

import {
  calculateTestScores,
} from "./scoreCalculation";

import {
  calculateTestDeviationScores,
} from "./deviationScore";

import {
  calculateTestRankings,
} from "./ranking";

import {
  processCsvImport,
} from "./csvProcessing";

import {
  getUserRole,
  requireRole,
} from "./auth";

/* =========================================================
   Firebase Admin SDK
   ========================================================= */

initializeApp();

/* =========================================================
   Cloud Functions 共通設定
   ========================================================= */

setGlobalOptions({
  region: "asia-northeast1",
  maxInstances: 50,
  memory: "1GiB",
  timeoutSeconds: 540,
});

/* =========================================================
   答案処理ジョブ作成
   ========================================================= */

export const startAnswerProcessing =
  onCall(
    {
      timeoutSeconds: 60,
      memory: "512MiB",
    },
    async (request) => {
      if (!request.auth) {
        throw new HttpsError(
          "unauthenticated",
          "ログインが必要です。"
        );
      }

      await requireRole(
        request.auth.uid,
        [
          "本部管理者",
          "校舎管理者",
          "講師",
        ]
      );

      const data =
        request.data ?? {};

      const testId =
        data.testId;

      const subjectId =
        data.subjectId;

      const answerIds =
        data.answerIds;

      if (
        typeof testId !== "string" ||
        typeof subjectId !== "string" ||
        !Array.isArray(answerIds)
      ) {
        throw new HttpsError(
          "invalid-argument",
          "testId、subjectId、answerIdsが必要です。"
        );
      }

      if (
        answerIds.length === 0
      ) {
        throw new HttpsError(
          "invalid-argument",
          "処理対象の答案がありません。"
        );
      }

      if (
        answerIds.length > 10000
      ) {
        throw new HttpsError(
          "invalid-argument",
          "一度に処理できる答案数は10000件までです。"
        );
      }

      const invalidAnswerId =
        answerIds.some(
          (id) =>
            typeof id !== "string" ||
            id.trim() === ""
        );

      if (invalidAnswerId) {
        throw new HttpsError(
          "invalid-argument",
          "answerIdsに不正な値があります。"
        );
      }

      const uniqueAnswerIds =
        Array.from(
          new Set(answerIds)
        );

      const jobId =
        await createAnswerProcessingJob({
          testId,
          subjectId,
          answerIds:
            uniqueAnswerIds,
          requestedBy:
            request.auth.uid,
        });

      return {
        success: true,
        jobId,
        total:
          uniqueAnswerIds.length,
        status: "queued",
      };
    }
  );

/* =========================================================
   答案処理ジョブ開始
   ========================================================= */

export const answerJobCreated =
  onDocumentCreated(
    {
      document:
        "gradingJobs/{jobId}",

      memory: "1GiB",

      timeoutSeconds: 540,

      retry: true,
    },
    async (event) => {
      const snapshot =
        event.data;

      if (!snapshot) {
        return;
      }

      const data =
        snapshot.data();

      if (!data) {
        return;
      }

      if (
        data.status !== "queued"
      ) {
        return;
      }

      await processAnswerJob(
        snapshot.id,
        data
      );
    }
  );

/* =========================================================
   成績集計
   ========================================================= */

export const calculateScores =
  onCall(
    {
      timeoutSeconds: 540,
      memory: "1GiB",
    },
    async (request) => {
      if (!request.auth) {
        throw new HttpsError(
          "unauthenticated",
          "ログインが必要です。"
        );
      }

      await requireRole(
        request.auth.uid,
        [
          "本部管理者",
          "校舎管理者",
          "講師",
        ]
      );

      const data =
        request.data ?? {};

      const testId =
        data.testId;

      if (
        typeof testId !== "string" ||
        testId.trim() === ""
      ) {
        throw new HttpsError(
          "invalid-argument",
          "testIdが必要です。"
        );
      }

      return calculateTestScores(
        testId
      );
    }
  );

/* =========================================================
   偏差値計算
   ========================================================= */

export const calculateDeviationScores =
  onCall(
    {
      timeoutSeconds: 540,
      memory: "1GiB",
    },
    async (request) => {
      if (!request.auth) {
        throw new HttpsError(
          "unauthenticated",
          "ログインが必要です。"
        );
      }

      await requireRole(
        request.auth.uid,
        [
          "本部管理者",
          "校舎管理者",
          "講師",
        ]
      );

      const data =
        request.data ?? {};

      const testId =
        data.testId;

      if (
        typeof testId !== "string" ||
        testId.trim() === ""
      ) {
        throw new HttpsError(
          "invalid-argument",
          "testIdが必要です。"
        );
      }

      return calculateTestDeviationScores(
        testId
      );
    }
  );

/* =========================================================
   順位計算
   ========================================================= */

export const calculateRank =
  onCall(
    {
      timeoutSeconds: 540,
      memory: "1GiB",
    },
    async (request) => {
      if (!request.auth) {
        throw new HttpsError(
          "unauthenticated",
          "ログインが必要です。"
        );
      }

      await requireRole(
        request.auth.uid,
        [
          "本部管理者",
          "校舎管理者",
          "講師",
        ]
      );

      const data =
        request.data ?? {};

      const testId =
        data.testId;

      if (
        typeof testId !== "string" ||
        testId.trim() === ""
      ) {
        throw new HttpsError(
          "invalid-argument",
          "testIdが必要です。"
        );
      }

      return calculateTestRankings(
        testId
      );
    }
  );

/* =========================================================
   CSVインポート
   ========================================================= */

export const executeCsvImport =
  onCall(
    {
      timeoutSeconds: 540,
      memory: "1GiB",
    },
    async (request) => {
      if (!request.auth) {
        throw new HttpsError(
          "unauthenticated",
          "ログインが必要です。"
        );
      }

      await requireRole(
        request.auth.uid,
        [
          "本部管理者",
          "校舎管理者",
        ]
      );

      const data =
        request.data ?? {};

      const importId =
        data.importId;

      const type =
        data.type;

      if (
        typeof importId !== "string" ||
        importId.trim() === ""
      ) {
        throw new HttpsError(
          "invalid-argument",
          "importIdが必要です。"
        );
      }

      if (
        type !== "students" &&
        type !== "scores" &&
        type !== "retests"
      ) {
        throw new HttpsError(
          "invalid-argument",
          "CSV種別が不正です。"
        );
      }

      return processCsvImport({
        importId,
        type,
        requestedBy:
          request.auth.uid,
      });
    }
  );

/* =========================================================
   現在のユーザー権限取得
   ========================================================= */

export const getCurrentUserRole =
  onCall(
    async (request) => {
      if (!request.auth) {
        throw new HttpsError(
          "unauthenticated",
          "ログインが必要です。"
        );
      }

      const role =
        await getUserRole(
          request.auth.uid
        );

      return {
        success: true,
        uid:
          request.auth.uid,
        role,
      };
    }
  );
