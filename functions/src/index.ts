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
        typeof testId !==
          "string" ||
        typeof subjectId !==
          "string" ||
        !Array.isArray(
          answerIds
        )
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
          "答案が選択されていません。"
        );
      }

      if (
        answerIds.length >
        10000
      ) {
        throw new HttpsError(
          "invalid-argument",
          "一度に処理できる答案数を超えています。"
        );
      }

      const invalidId =
        answerIds.some(
          (id) =>
            typeof id !==
            "string"
        );

      if (invalidId) {
        throw new HttpsError(
          "invalid-argument",
          "answerIdsに不正な値があります。"
        );
      }

      const jobId =
        await createAnswerProcessingJob(
          {
            testId,
            subjectId,
            answerIds,
            requestedBy:
              request.auth.uid,
          }
        );

      return {
        success: true,
        jobId,
        total:
          answerIds.length,
        status: "queued",
      };
    }
  );

/* =========================================================
   ジョブ作成後の実処理
   ========================================================= */

export const answerJobCreated =
  onDocumentCreated(
    {
      document:
        "gradingJobs/{jobId}",
      memory: "1GiB",
      timeoutSeconds: 540,
    },
    async (event) => {
      const snapshot =
        event.data;

      if (!snapshot) {
        return;
      }

      await processAnswerJob(
        snapshot.id,
        snapshot.data()
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

      const {
        testId,
      } =
        request.data ?? {};

      if (
        typeof testId !==
        "string"
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

      const {
        testId,
      } =
        request.data ?? {};

      if (
        typeof testId !==
        "string"
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

      const {
        testId,
      } =
        request.data ?? {};

      if (
        typeof testId !==
        "string"
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
   CSV処理
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

      const {
        importId,
        type,
      } =
        request.data ?? {};

      if (
        typeof importId !==
          "string" ||
        typeof type !==
          "string"
      ) {
        throw new HttpsError(
          "invalid-argument",
          "importIdとtypeが必要です。"
        );
      }

      const allowedTypes = [
        "students",
        "scores",
        "retests",
      ];

      if (
        !allowedTypes.includes(
          type
        )
      ) {
        throw new HttpsError(
          "invalid-argument",
          "対応していないCSV種別です。"
        );
      }

      return processCsvImport(
        {
          importId,
          type:
            type as
              | "students"
              | "scores"
              | "retests",
          requestedBy:
            request.auth.uid,
        }
      );
    }
  );

/* =========================================================
   現在のユーザー情報
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
        uid:
          request.auth.uid,
        role,
      };
    }
  );
