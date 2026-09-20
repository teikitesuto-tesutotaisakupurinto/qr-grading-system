import {
  initializeApp,
} from "firebase-admin/app";

import {
  getFirestore,
  FieldValue,
} from "firebase-admin/firestore";

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

import {
  createManagedUser,
  disableManagedUser,
  enableManagedUser,
  generateManagedPasswordResetLink,
  updateManagedUserRole,
} from "./userManagement";

import {
  createUploadUrl,
} from "./supabase";

/* =========================================================
   Firebase Admin
   ========================================================= */

initializeApp();

/* =========================================================
   共通設定
   ========================================================= */

setGlobalOptions({
  region:
    "asia-northeast1",

  maxInstances:
    50,

  memory:
    "1GiB",

  timeoutSeconds:
    540,
});

/* =========================================================
   答案アップロードURL
   ========================================================= */

export const createAnswerUploadUrl =
  onCall(
    {
      timeoutSeconds:
        60,

      memory:
        "256MiB",
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
        typeof data.testId ===
        "string"
          ? data.testId.trim()
          : "";

      const subjectId =
        typeof data.subjectId ===
        "string"
          ? data.subjectId.trim()
          : "";

      const fileName =
        typeof data.fileName ===
        "string"
          ? data.fileName.trim()
          : "";

      const contentType =
        typeof data.contentType ===
        "string"
          ? data.contentType
          : "";

      const size =
        Number(
          data.size
        );

      const studentNumber =
        typeof data.studentNumber ===
        "string"
          ? data.studentNumber.trim()
          : undefined;

      if (!testId) {
        throw new HttpsError(
          "invalid-argument",
          "testIdが必要です。"
        );
      }

      if (!subjectId) {
        throw new HttpsError(
          "invalid-argument",
          "subjectIdが必要です。"
        );
      }

      if (!fileName) {
        throw new HttpsError(
          "invalid-argument",
          "ファイル名が必要です。"
        );
      }

      const allowedTypes = [
        "application/pdf",
        "image/jpeg",
        "image/png",
      ];

      if (
        !allowedTypes.includes(
          contentType
        )
      ) {
        throw new HttpsError(
          "invalid-argument",
          "PDF・JPG・PNGのみ対応しています。"
        );
      }

      if (
        !Number.isFinite(
          size
        ) ||
        size <= 0 ||
        size >
          20 *
            1024 *
            1024
      ) {
        throw new HttpsError(
          "invalid-argument",
          "ファイルサイズが不正です。"
        );
      }

      if (
        studentNumber &&
        !/^\d{6}$/.test(
          studentNumber
        )
      ) {
        throw new HttpsError(
          "invalid-argument",
          "生徒番号は6桁数字で指定してください。"
        );
      }

      const db =
        getFirestore();

      const answerRef =
        db
          .collection(
            "answers"
          )
          .doc();

      const answerId =
        answerRef.id;

      const extension =
        getFileExtension(
          fileName,
          contentType
        );

      const fileKey = [
        "answers",
        testId,
        subjectId,
        `${answerId}.${extension}`,
      ].join("/");

      const uploadUrl =
        await createUploadUrl(
          fileKey,
          contentType
        );

      await answerRef.set({
        id:
          answerId,

        testId,

        subjectId,

        ...(studentNumber
          ? {
              studentNumber,
            }
          : {}),

        fileKey,

        fileName,

        contentType,

        size,

        status:
          "uploaded",

        createdBy:
          request.auth.uid,

        createdAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),
      });

      return {
        success:
          true,

        answerId,

        fileKey,

        uploadUrl,
      };
    }
  );

/* =========================================================
   答案処理開始
   ========================================================= */

export const startAnswerProcessing =
  onCall(
    {
      timeoutSeconds:
        60,

      memory:
        "512MiB",
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
        typeof data.testId ===
        "string"
          ? data.testId.trim()
          : "";

      const subjectId =
        typeof data.subjectId ===
        "string"
          ? data.subjectId.trim()
          : "";

      const answerIds =
        Array.isArray(
          data.answerIds
        )
          ? data.answerIds.filter(
              (
                id
              ): id is string =>
                typeof id ===
                  "string" &&
                id.trim() !== ""
            )
          : [];

      if (!testId) {
        throw new HttpsError(
          "invalid-argument",
          "testIdが必要です。"
        );
      }

      if (!subjectId) {
        throw new HttpsError(
          "invalid-argument",
          "subjectIdが必要です。"
        );
      }

      if (
        answerIds.length ===
        0
      ) {
        throw new HttpsError(
          "invalid-argument",
          "処理対象の答案がありません。"
        );
      }

      if (
        answerIds.length >
        10000
      ) {
        throw new HttpsError(
          "invalid-argument",
          "一度に処理できる答案は10000件までです。"
        );
      }

      const uniqueIds =
        Array.from(
          new Set(
            answerIds
          )
        );

      const jobId =
        await createAnswerProcessingJob({
          testId,

          subjectId,

          answerIds:
            uniqueIds,

          requestedBy:
            request.auth.uid,
        });

      return {
        success:
          true,

        jobId,

        total:
          uniqueIds.length,

        status:
          "queued",
      };
    }
  );

/* =========================================================
   ジョブ自動実行
   ========================================================= */

export const answerJobCreated =
  onDocumentCreated(
    {
      document:
        "gradingJobs/{jobId}",

      memory:
        "1GiB",

      timeoutSeconds:
        540,

      retry:
        true,
    },

    async (event) => {
      const snapshot =
        event.data;

      if (!snapshot) {
        return;
      }

      const data =
        snapshot.data();

      if (
        data.status !==
        "queued"
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
   成績
   ========================================================= */

export const calculateScores =
  onCall(
    {
      timeoutSeconds:
        540,

      memory:
        "1GiB",
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

      const testId =
        request.data?.testId;

      if (
        typeof testId !==
          "string" ||
        !testId.trim()
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
   偏差値
   ========================================================= */

export const calculateDeviationScores =
  onCall(
    {
      timeoutSeconds:
        540,

      memory:
        "1GiB",
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

      const testId =
        request.data?.testId;

      if (
        typeof testId !==
          "string" ||
        !testId.trim()
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
   順位
   ========================================================= */

export const calculateRank =
  onCall(
    {
      timeoutSeconds:
        540,

      memory:
        "1GiB",
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

      const testId =
        request.data?.testId;

      if (
        typeof testId !==
          "string" ||
        !testId.trim()
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
   CSV
   ========================================================= */

export const executeCsvImport =
  onCall(
    {
      timeoutSeconds:
        540,

      memory:
        "1GiB",
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

      const importId =
        request.data?.importId;

      const type =
        request.data?.type;

      if (
        typeof importId !==
          "string" ||
        !importId.trim()
      ) {
        throw new HttpsError(
          "invalid-argument",
          "importIdが必要です。"
        );
      }

      if (
        type !==
          "students" &&
        type !==
          "scores" &&
        type !==
          "retests"
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
   現在ユーザー権限
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
        success:
          true,

        uid:
          request.auth.uid,

        role,
      };
    }
  );

/* =========================================================
   ユーザー管理
   ========================================================= */

export {
  createManagedUser,
  disableManagedUser,
  enableManagedUser,
  generateManagedPasswordResetLink,
  updateManagedUserRole,
};

/* =========================================================
   拡張子
   ========================================================= */

function getFileExtension(
  fileName: string,
  contentType: string
): string {
  const extension =
    fileName
      .split(".")
      .pop()
      ?.toLowerCase();

  if (
    extension === "jpg" ||
    extension === "jpeg" ||
    extension === "png" ||
    extension === "pdf"
  ) {
    return extension;
  }

  if (
    contentType ===
    "image/jpeg"
  ) {
    return "jpg";
  }

  if (
    contentType ===
    "image/png"
  ) {
    return "png";
  }

  return "pdf";
}
