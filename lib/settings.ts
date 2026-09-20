"use client";

import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import {
  db,
} from "@/lib/firebase";

export type SystemSettings = {
  schoolName: string;

  logoText: string;

  defaultYear: string;

  studentNumberDigits: 6;

  allowStudentAnswerViewBeforeGrading: boolean;

  requireSecondReview: boolean;

  hideStudentIdentityInCrossSection: boolean;

  enableDeviationScore: boolean;

  enableRanking: boolean;

  enableRetest: boolean;

  answerUploadImmediatelyVisible: boolean;

  updatedAt?: unknown;

  updatedBy?: string;
};

const SETTINGS_ID =
  "global";

/* =========================================================
   初期設定
   ========================================================= */

export const defaultSystemSettings: SystemSettings = {
  schoolName:
    "○○塾",

  logoText:
    "塾ロゴ",

  defaultYear:
    "2026",

  studentNumberDigits:
    6,

  allowStudentAnswerViewBeforeGrading:
    true,

  requireSecondReview:
    true,

  hideStudentIdentityInCrossSection:
    true,

  enableDeviationScore:
    true,

  enableRanking:
    true,

  enableRetest:
    true,

  answerUploadImmediatelyVisible:
    true,
};

/* =========================================================
   設定取得
   ========================================================= */

export async function getSystemSettings(): Promise<SystemSettings> {
  const reference =
    doc(
      db,
      "systemSettings",
      SETTINGS_ID
    );

  const snapshot =
    await getDoc(
      reference
    );

  if (!snapshot.exists()) {
    return {
      ...defaultSystemSettings,
    };
  }

  const data =
    snapshot.data();

  return normalizeSettings(
    data
  );
}

/* =========================================================
   設定保存
   ========================================================= */

export async function saveSystemSettings(
  settings: SystemSettings,
  updatedBy: string
) {
  validateSettings(
    settings
  );

  if (!updatedBy.trim()) {
    throw new Error(
      "更新者IDがありません。"
    );
  }

  const reference =
    doc(
      db,
      "systemSettings",
      SETTINGS_ID
    );

  await setDoc(
    reference,
    {
      ...settings,

      studentNumberDigits:
        6,

      updatedBy,

      updatedAt:
        serverTimestamp(),
    },
    {
      merge: true,
    }
  );
}

/* =========================================================
   設定の一部更新
   ========================================================= */

export async function updateSystemSettings(
  changes: Partial<SystemSettings>,
  updatedBy: string
) {
  const current =
    await getSystemSettings();

  const next: SystemSettings = {
    ...current,
    ...changes,

    /*
     * 生徒番号は仕様上6桁固定。
     */
    studentNumberDigits:
      6,
  };

  await saveSystemSettings(
    next,
    updatedBy
  );
}

/* =========================================================
   生徒番号設定
   ========================================================= */

export function getStudentNumberDigits(): 6 {
  return 6;
}

/* =========================================================
   採点設定
   ========================================================= */

export async function isSecondReviewRequired(): Promise<boolean> {
  const settings =
    await getSystemSettings();

  return (
    settings.requireSecondReview
  );
}

export async function shouldHideStudentIdentity(): Promise<boolean> {
  const settings =
    await getSystemSettings();

  return (
    settings.hideStudentIdentityInCrossSection
  );
}

/* =========================================================
   成績設定
   ========================================================= */

export async function isDeviationScoreEnabled(): Promise<boolean> {
  const settings =
    await getSystemSettings();

  return (
    settings.enableDeviationScore
  );
}

export async function isRankingEnabled(): Promise<boolean> {
  const settings =
    await getSystemSettings();

  return (
    settings.enableRanking
  );
}

/* =========================================================
   追試設定
   ========================================================= */

export async function isRetestEnabled(): Promise<boolean> {
  const settings =
    await getSystemSettings();

  return (
    settings.enableRetest
  );
}

/* =========================================================
   設定正規化
   ========================================================= */

function normalizeSettings(
  data: Record<
    string,
    unknown
  >
): SystemSettings {
  return {
    schoolName:
      typeof data.schoolName ===
      "string"
        ? data.schoolName
        : defaultSystemSettings.schoolName,

    logoText:
      typeof data.logoText ===
      "string"
        ? data.logoText
        : defaultSystemSettings.logoText,

    defaultYear:
      typeof data.defaultYear ===
      "string"
        ? data.defaultYear
        : defaultSystemSettings.defaultYear,

    studentNumberDigits:
      6,

    allowStudentAnswerViewBeforeGrading:
      typeof data.allowStudentAnswerViewBeforeGrading ===
      "boolean"
        ? data.allowStudentAnswerViewBeforeGrading
        : defaultSystemSettings.allowStudentAnswerViewBeforeGrading,

    requireSecondReview:
      typeof data.requireSecondReview ===
      "boolean"
        ? data.requireSecondReview
        : defaultSystemSettings.requireSecondReview,

    hideStudentIdentityInCrossSection:
      typeof data.hideStudentIdentityInCrossSection ===
      "boolean"
        ? data.hideStudentIdentityInCrossSection
        : defaultSystemSettings.hideStudentIdentityInCrossSection,

    enableDeviationScore:
      typeof data.enableDeviationScore ===
      "boolean"
        ? data.enableDeviationScore
        : defaultSystemSettings.enableDeviationScore,

    enableRanking:
      typeof data.enableRanking ===
      "boolean"
        ? data.enableRanking
        : defaultSystemSettings.enableRanking,

    enableRetest:
      typeof data.enableRetest ===
      "boolean"
        ? data.enableRetest
        : defaultSystemSettings.enableRetest,

    answerUploadImmediatelyVisible:
      typeof data.answerUploadImmediatelyVisible ===
      "boolean"
        ? data.answerUploadImmediatelyVisible
        : defaultSystemSettings.answerUploadImmediatelyVisible,

    updatedAt:
      data.updatedAt,

    updatedBy:
      typeof data.updatedBy ===
      "string"
        ? data.updatedBy
        : undefined,
  };
}

/* =========================================================
   バリデーション
   ========================================================= */

function validateSettings(
  settings: SystemSettings
) {
  if (
    !settings.schoolName.trim()
  ) {
    throw new Error(
      "塾名を入力してください。"
    );
  }

  if (
    !settings.logoText.trim()
  ) {
    throw new Error(
      "ロゴ表示名を入力してください。"
    );
  }

  if (
    !/^\d{4}$/.test(
      settings.defaultYear
    )
  ) {
    throw new Error(
      "年度は4桁で指定してください。"
    );
  }

  /*
   * 生徒番号は必ず6桁。
   */
  if (
    settings.studentNumberDigits !==
    6
  ) {
    throw new Error(
      "生徒番号は6桁固定です。"
    );
  }
}
