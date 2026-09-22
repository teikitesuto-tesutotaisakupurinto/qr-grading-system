"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import {
  db,
} from "@/lib/firebase";

import type {
  GradingDocument,
  GradingMark,
  GradingResult,
  ReviewStatus,
  FirstReview,
  SecondReview,
} from "@/lib/types";

/* =========================================================
   採点方式
   ========================================================= */

export type GradingMethod =
  | "automatic"
  | "manual";

/* =========================================================
   問題の採点設定
   ========================================================= */

export type QuestionGradingSetting = {
  questionId: string;

  questionNumber: string;

  gradingMethod: GradingMethod;

  maxScore: number;

  /*
   * 自動採点の場合
   */
  correctAnswer?: string;

  /*
   * 記述式など
   */
  rubric?: string;

  /*
   * 自動採点結果を
   * 人間が確認する必要があるか
   */
  requiresReview: boolean;
};

/* =========================================================
   採点対象
   ========================================================= */

export type GradingWorkItem = {
  questionId: string;

  questionNumber: string;

  gradingMethod: GradingMethod;

  answerText: string;

  score: number;

  maxScore: number;

  mark: GradingMark;

  confidence: number;

  reviewRequired: boolean;

  reason?: string;

  rubric?: string;
};

/* =========================================================
   一次確認保存
   ========================================================= */

export type SaveReviewInput = {
  answerId: string;

  testId: string;

  subjectId: string;

  studentNumber: string;

  reviewerId: string;

  results: GradingResult[];

  internalNote?: string;

  publicAnnotation?: string;
};

/* =========================================================
   採点方式判定
   ========================================================= */

export function isAutomaticGrading(
  setting: QuestionGradingSetting
) {
  return (
    setting.gradingMethod ===
    "automatic"
  );
}

export function isManualGrading(
  setting: QuestionGradingSetting
) {
  return (
    setting.gradingMethod ===
    "manual"
  );
}

/* =========================================================
   自動採点可能な問題だけ抽出
   ========================================================= */

export function getAutomaticQuestions(
  settings: QuestionGradingSetting[]
) {
  return settings.filter(
    (
      setting
    ) =>
      setting.gradingMethod ===
      "automatic"
  );
}

/* =========================================================
   手動採点問題だけ抽出
   ========================================================= */

export function getManualQuestions(
  settings: QuestionGradingSetting[]
) {
  return settings.filter(
    (
      setting
    ) =>
      setting.gradingMethod ===
      "manual"
  );
}

/* =========================================================
   自動採点結果を生成
   =========================================================
   注意：
   この関数は「自動採点方式として登録された問題」
   に対してのみ使用する。
   ========================================================= */

export function createAutomaticGradingResult(
  setting: QuestionGradingSetting,
  answerText: string
): GradingResult {
  if (
    setting.gradingMethod !==
    "automatic"
  ) {
    throw new Error(
      `問題${setting.questionNumber}は手動採点です。`
    );
  }

  const normalizedAnswer =
    normalizeAnswerText(
      answerText
    );

  const normalizedCorrect =
    normalizeAnswerText(
      setting.correctAnswer ??
        ""
    );

  const correct =
    normalizedAnswer !==
      "" &&
    normalizedAnswer ===
      normalizedCorrect;

  return {
    questionId:
      setting.questionId,

    questionNumber:
      setting.questionNumber,

    answerText,

    mark:
      correct
        ? "○"
        : "×",

    score:
      correct
        ? setting.maxScore
        : 0,

    maxScore:
      setting.maxScore,

    /*
     * 完全一致型の自動採点なので
     * 判定自体は高信頼として扱う。
     *
     * OCR結果の信頼度とは別。
     */
    confidence:
      1,

    reviewRequired:
      setting.requiresReview,

    reason:
      correct
        ? undefined
        : "自動採点で不正解と判定",

    rubric:
      setting.rubric,
  };
}

/* =========================================================
   手動採点用の初期結果
   ========================================================= */

export function createManualGradingResult(
  setting: QuestionGradingSetting,
  answerText: string
): GradingResult {
  if (
    setting.gradingMethod !==
    "manual"
  ) {
    throw new Error(
      `問題${setting.questionNumber}は自動採点です。`
    );
  }

  return {
    questionId:
      setting.questionId,

    questionNumber:
      setting.questionNumber,

    answerText,

    /*
     * 手動採点前なので0点として
     * 仮登録する。
     */
    score:
      0,

    maxScore:
      setting.maxScore,

    /*
     * 採点前。
     */
    mark:
      "×",

    confidence:
      0,

    /*
     * 必ず人間による確認が必要。
     */
    reviewRequired:
      true,

    reason:
      "手動採点待ち",

    rubric:
      setting.rubric,
  };
}

/* =========================================================
   自動＋手動混在の採点結果を作成
   ========================================================= */

export function createInitialGradingResults(
  settings: QuestionGradingSetting[],
  answers: Record<
    string,
    string
  >
): GradingResult[] {
  return settings.map(
    (
      setting
    ) => {
      const answerText =
        answers[
          setting.questionId
        ] ??
        "";

      if (
        setting.gradingMethod ===
        "automatic"
      ) {
        return createAutomaticGradingResult(
          setting,
          answerText
        );
      }

      return createManualGradingResult(
        setting,
        answerText
      );
    }
  );
}

/* =========================================================
   自動採点済みか
   ========================================================= */

export function isAutomaticallyCompleted(
  result: GradingResult
) {
  return (
    result.reviewRequired ===
      false &&
    result.confidence >
      0
  );
}

/* =========================================================
   手動採点待ちか
   ========================================================= */

export function isManualReviewRequired(
  result: GradingResult
) {
  return (
    result.reviewRequired ===
    true
  );
}

/* =========================================================
   一次確認が必要か
   ========================================================= */

export function requiresFirstReview(
  results: GradingResult[]
) {
  return results.some(
    (
      result
    ) =>
      result.reviewRequired
  );
}

/* =========================================================
   自動採点のみ完了しているか
   ========================================================= */

export function isAutomaticPhaseCompleted(
  results: GradingResult[]
) {
  return (
    results.length >
      0 &&
    results.every(
      (
        result
      ) =>
        result.reviewRequired ===
          false &&
        result.confidence >
          0
    )
  );
}

/* =========================================================
   手動採点完了判定
   ========================================================= */

export function isManualGradingCompleted(
  results: GradingResult[]
) {
  return (
    results.length >
      0 &&
    results.every(
      (
        result
      ) =>
        result.reviewRequired ===
        false
    )
  );
}

/* =========================================================
   採点結果取得
   ========================================================= */

export async function getGradingResult(
  answerId: string
): Promise<GradingDocument | null> {
  if (
    !answerId.trim()
  ) {
    return null;
  }

  const snapshot =
    await getDoc(
      doc(
        db,
        "gradingResults",
        answerId
      )
    );

  if (
    !snapshot.exists()
  ) {
    return null;
  }

  const data =
    snapshot.data();

  return {
    id:
      snapshot.id,

    answerId:
      stringValue(
        data.answerId
      ) ||
      answerId,

    results:
      normalizeResults(
        data.results
      ),

    totalScore:
      calculateTotalScore(
        normalizeResults(
          data.results
        )
      ),

    totalMaxScore:
      calculateTotalMaxScore(
        normalizeResults(
          data.results
        )
      ),

    status:
      stringValue(
        data.status
      ) ||
      "pending",

    reviewRequired:
      data.reviewRequired ===
      true,

    internalNote:
      stringValue(
        data.internalNote
      ),

    publicAnnotation:
      stringValue(
        data.publicAnnotation
      ),

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

/* =========================================================
   一次確認取得
   ========================================================= */

export async function getFirstReview(
  answerId: string
): Promise<FirstReview | null> {
  if (
    !answerId.trim()
  ) {
    return null;
  }

  const snapshot =
    await getDocs(
      query(
        collection(
          db,
          "firstReviews"
        ),

        where(
          "answerId",
          "==",
          answerId
        )
      )
    );

  if (
    snapshot.empty
  ) {
    return null;
  }

  const document =
    snapshot.docs[0];

  const data =
    document.data();

  return {
    id:
      document.id,

    answerId:
      stringValue(
        data.answerId
      ) ||
      answerId,

    testId:
      stringValue(
        data.testId
      ),

    subjectId:
      stringValue(
        data.subjectId
      ),

    studentNumber:
      stringValue(
        data.studentNumber
      ),

    reviewerId:
      stringValue(
        data.reviewerId
      ),

    results:
      normalizeResults(
        data.results
      ),

    totalScore:
      safeNumber(
        data.totalScore
      ),

    totalMaxScore:
      safeNumber(
        data.totalMaxScore
      ),

    internalNote:
      stringValue(
        data.internalNote
      ),

    publicAnnotation:
      stringValue(
        data.publicAnnotation
      ),

    status:
      normalizeReviewStatus(
        data.status
      ),

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

/* =========================================================
   二次確認取得
   ========================================================= */

export async function getSecondReview(
  answerId: string
): Promise<SecondReview | null> {
  if (
    !answerId.trim()
  ) {
    return null;
  }

  const snapshot =
    await getDocs(
      query(
        collection(
          db,
          "secondReviews"
        ),

        where(
          "answerId",
          "==",
          answerId
        )
      )
    );

  if (
    snapshot.empty
  ) {
    return null;
  }

  const document =
    snapshot.docs[0];

  const data =
    document.data();

  return {
    id:
      document.id,

    answerId:
      stringValue(
        data.answerId
      ) ||
      answerId,

    testId:
      stringValue(
        data.testId
      ),

    subjectId:
      stringValue(
        data.subjectId
      ),

    studentNumber:
      stringValue(
        data.studentNumber
      ),

    reviewerId:
      stringValue(
        data.reviewerId
      ),

    results:
      normalizeResults(
        data.results
      ),

    totalScore:
      safeNumber(
        data.totalScore
      ),

    totalMaxScore:
      safeNumber(
        data.totalMaxScore
      ),

    disagreement:
      data.disagreement ===
      true,

    internalNote:
      stringValue(
        data.internalNote
      ),

    publicAnnotation:
      stringValue(
        data.publicAnnotation
      ),

    status:
      normalizeReviewStatus(
        data.status
      ),

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

/* =========================================================
   一次確認保存
   ========================================================= */

export async function saveFirstReview(
  input: SaveReviewInput
) {
  validateReviewInput(
    input
  );

  const previous =
    await getFirstReview(
      input.answerId
    );

  const reference =
    previous
      ? doc(
          db,
          "firstReviews",
          previous.id
        )
      : doc(
          collection(
            db,
            "firstReviews"
          )
        );

  const totalScore =
    calculateTotalScore(
      input.results
    );

  const totalMaxScore =
    calculateTotalMaxScore(
      input.results
    );

  /*
   * 手動採点が残っている場合、
   * 二次確認には進めない。
   */
  const remainingManual =
    input.results.some(
      (
        result
      ) =>
        result.reviewRequired
    );

  const batch =
    writeBatch(
      db
    );

  batch.set(
    reference,
    {
      answerId:
        input.answerId,

      testId:
        input.testId,

      subjectId:
        input.subjectId,

      studentNumber:
        input.studentNumber,

      reviewerId:
        input.reviewerId,

      results:
        input.results,

      totalScore,

      totalMaxScore,

      internalNote:
        input.internalNote ??
        "",

      publicAnnotation:
        input.publicAnnotation ??
        "",

      status:
        remainingManual
          ? "reviewing"
          : "completed",

      updatedAt:
        serverTimestamp(),

      ...(previous
        ? {}
        : {
            createdAt:
              serverTimestamp(),
          }),
    },
    {
      merge:
        true,
    }
  );

  batch.update(
    doc(
      db,
      "answers",
      input.answerId
    ),
    {
      status:
        remainingManual
          ? "first_review"
          : "second_review",

      totalScore,

      totalMaxScore,

      reviewRequired:
        remainingManual,

      updatedAt:
        serverTimestamp(),
    }
  );

  await batch.commit();

  return reference.id;
}

/* =========================================================
   二次確認保存
   ========================================================= */

export async function saveSecondReview(
  input: SaveReviewInput
) {
  validateReviewInput(
    input
  );

  /*
   * 手動採点がまだ残っている場合、
   * 二次確認完了にはできない。
   */
  if (
    input.results.some(
      (
        result
      ) =>
        result.reviewRequired
    )
  ) {
    throw new Error(
      "まだ手動採点が完了していない問題があります。"
    );
  }

  const firstReview =
    await getFirstReview(
      input.answerId
    );

  const disagreement =
    firstReview
      ? hasDisagreement(
          firstReview.results,
          input.results
        )
      : false;

  const previous =
    await getSecondReview(
      input.answerId
    );

  const reference =
    previous
      ? doc(
          db,
          "secondReviews",
          previous.id
        )
      : doc(
          collection(
            db,
            "secondReviews"
          )
        );

  const totalScore =
    calculateTotalScore(
      input.results
    );

  const totalMaxScore =
    calculateTotalMaxScore(
      input.results
    );

  const batch =
    writeBatch(
      db
    );

  batch.set(
    reference,
    {
      answerId:
        input.answerId,

      testId:
        input.testId,

      subjectId:
        input.subjectId,

      studentNumber:
        input.studentNumber,

      reviewerId:
        input.reviewerId,

      results:
        input.results,

      totalScore,

      totalMaxScore,

      disagreement,

      internalNote:
        input.internalNote ??
        "",

      publicAnnotation:
        input.publicAnnotation ??
        "",

      status:
        disagreement
          ? "reviewing"
          : "completed",

      updatedAt:
        serverTimestamp(),

      ...(previous
        ? {}
        : {
            createdAt:
              serverTimestamp(),
          }),
    },
    {
      merge:
        true,
    }
  );

  batch.update(
    doc(
      db,
      "answers",
      input.answerId
    ),
    {
      status:
        disagreement
          ? "first_review"
          : "confirmed",

      totalScore,

      totalMaxScore,

      reviewRequired:
        disagreement,

      reviewDisagreement:
        disagreement,

      updatedAt:
        serverTimestamp(),
    }
  );

  await batch.commit();

  return reference.id;
}

/* =========================================================
   採点確定
   ========================================================= */

export async function confirmGrading(
  answerIds: string[],
  confirmedBy: string
) {
  if (
    answerIds.length ===
    0
  ) {
    throw new Error(
      "確定する答案がありません。"
    );
  }

  if (
    !confirmedBy.trim()
  ) {
    throw new Error(
      "確定者が指定されていません。"
    );
  }

  const uniqueIds =
    Array.from(
      new Set(
        answerIds
      )
    );

  for (
    const answerId of
      uniqueIds
  ) {
    await validateConfirmation(
      answerId
    );
  }

  const batchSize =
    400;

  for (
    let start = 0;
    start <
    uniqueIds.length;
    start +=
      batchSize
  ) {
    const batch =
      writeBatch(
        db
      );

    const current =
      uniqueIds.slice(
        start,
        start +
          batchSize
      );

    for (
      const answerId of
        current
    ) {
      batch.update(
        doc(
          db,
          "answers",
          answerId
        ),
        {
          status:
            "confirmed",

          confirmedBy,

          confirmedAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        }
      );
    }

    await batch.commit();
  }
}

/* =========================================================
   確定前チェック
   ========================================================= */

async function validateConfirmation(
  answerId: string
) {
  const grading =
    await getGradingResult(
      answerId
    );

  if (
    !grading
  ) {
    throw new Error(
      `採点結果がありません: ${answerId}`
    );
  }

  /*
   * 手動採点が残っていたら確定不可。
   */
  if (
    grading.results.some(
      (
        result
      ) =>
        result.reviewRequired
    )
  ) {
    throw new Error(
      `手動採点が未完了です: ${answerId}`
    );
  }

  const first =
    await getFirstReview(
      answerId
    );

  if (
    !first ||
    first.status !==
      "completed"
  ) {
    throw new Error(
      `一次確認が完了していません: ${answerId}`
    );
  }

  const second =
    await getSecondReview(
      answerId
    );

  if (
    !second ||
    second.status !==
      "completed"
  ) {
    throw new Error(
      `二次確認が完了していません: ${answerId}`
    );
  }

  if (
    second.disagreement
  ) {
    throw new Error(
      `一次確認と二次確認が一致していません: ${answerId}`
    );
  }
}

/* =========================================================
   Return to first review
   ========================================================= */

export async function returnToFirstReview(
  answerId: string
) {
  const second =
    await getSecondReview(
      answerId
    );

  const batch =
    writeBatch(
      db
    );

  if (
    second
  ) {
    batch.update(
      doc(
        db,
        "secondReviews",
        second.id
      ),
      {
        status:
          "returned",

        updatedAt:
          serverTimestamp(),
      }
    );
  }

  batch.update(
    doc(
      db,
      "answers",
      answerId
    ),
    {
      status:
        "first_review",

      reviewRequired:
        true,

      updatedAt:
        serverTimestamp(),
    }
  );

  await batch.commit();
}

/* =========================================================
   Calculate total
   ========================================================= */

export function calculateTotalScore(
  results: GradingResult[]
) {
  return results.reduce(
    (
      total,
      result
    ) =>
      total +
      normalizeScore(
        result.score,
        result.maxScore
      ),
    0
  );
}

export function calculateTotalMaxScore(
  results: GradingResult[]
) {
  return results.reduce(
    (
      total,
      result
    ) =>
      total +
      Math.max(
        0,
        safeNumber(
          result.maxScore
        )
      ),
    0
  );
}

/* =========================================================
   Compare
   ========================================================= */

export function hasDisagreement(
  first: GradingResult[],
  second: GradingResult[]
) {
  if (
    first.length !==
    second.length
  ) {
    return true;
  }

  for (
    const firstResult of
      first
  ) {
    const secondResult =
      second.find(
        (
          item
        ) =>
          item.questionId ===
          firstResult.questionId
      );

    if (
      !secondResult
    ) {
      return true;
    }

    if (
      firstResult.mark !==
      secondResult.mark
    ) {
      return true;
    }

    if (
      firstResult.score !==
      secondResult.score
    ) {
      return true;
    }
  }

  return false;
}

/* =========================================================
   Normalize
   ========================================================= */

function normalizeResults(
  value: unknown
): GradingResult[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  return value.map(
    (
      item,
      index
    ) => {
      const data =
        item &&
        typeof item ===
          "object"
          ? item as Record<
              string,
              unknown
            >
          : {};

      return {
        questionId:
          stringValue(
            data.questionId
          ) ||
          `question-${index + 1}`,

        questionNumber:
          stringValue(
            data.questionNumber
          ) ||
          String(
            index + 1
          ),

        answerText:
          stringValue(
            data.answerText
          ),

        mark:
          normalizeMark(
            data.mark
          ),

        score:
          safeNumber(
            data.score
          ),

        maxScore:
          safeNumber(
            data.maxScore
          ),

        confidence:
          safeNumber(
            data.confidence
          ),

        reviewRequired:
          data.reviewRequired ===
          true,

        reason:
          typeof data.reason ===
          "string"
            ? data.reason
            : undefined,

        rubric:
          typeof data.rubric ===
          "string"
            ? data.rubric
            : undefined,
      };
    }
  );
}

/* =========================================================
   Validation
   ========================================================= */

function validateReviewInput(
  input: SaveReviewInput
) {
  if (
    !input.answerId.trim()
  ) {
    throw new Error(
      "答案IDがありません。"
    );
  }

  if (
    !input.testId.trim()
  ) {
    throw new Error(
      "テストIDがありません。"
    );
  }

  if (
    !input.subjectId.trim()
  ) {
    throw new Error(
      "教科IDがありません。"
    );
  }

  if (
    !input.reviewerId.trim()
  ) {
    throw new Error(
      "確認者IDがありません。"
    );
  }

  if (
    !/^\d{6}$/.test(
      input.studentNumber
    )
  ) {
    throw new Error(
      "生徒番号は6桁で指定してください。"
    );
  }

  for (
    const result of
      input.results
  ) {
    if (
      result.score <
        0 ||
      result.score >
        result.maxScore
    ) {
      throw new Error(
        `問題${result.questionNumber}の得点が不正です。`
      );
    }
  }
}

/* =========================================================
   Text
   ========================================================= */

function normalizeAnswerText(
  value:
    | string
    | undefined
) {
  return (
    value ??
    ""
  )
    .trim()
    .replace(
      /\s+/g,
      ""
    )
    .toLowerCase();
}

/* =========================================================
   Primitive
   ========================================================= */

function stringValue(
  value: unknown
) {
  return typeof value ===
    "string"
    ? value
    : "";
}

function safeNumber(
  value: unknown
) {
  const number =
    Number(
      value ?? 0
    );

  return Number.isFinite(
    number
  )
    ? number
    : 0;
}

function normalizeScore(
  score: number,
  maxScore: number
) {
  const max =
    Math.max(
      0,
      safeNumber(
        maxScore
      )
    );

  return Math.min(
    max,
    Math.max(
      0,
      safeNumber(
        score
      )
    )
  );
}

function normalizeMark(
  value: unknown
): GradingMark {
  if (
    value === "○" ||
    value === "△" ||
    value === "×"
  ) {
    return value;
  }

  return "×";
}

function normalizeReviewStatus(
  value: unknown
): ReviewStatus {
  if (
    value ===
      "reviewing" ||
    value ===
      "completed" ||
    value ===
      "returned"
  ) {
    return value;
  }

  return "reviewing";
}
