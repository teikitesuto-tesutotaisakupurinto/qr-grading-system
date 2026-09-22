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
  FirstReview,
  GradingDocument,
  GradingMark,
  GradingResult,
  ReviewStatus,
  SecondReview,
} from "@/lib/types";

/* =========================================================
   Types
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

export type GradingChange = {
  questionId: string;

  questionNumber: string;

  before: number;

  after: number;

  reason: string;
};

/* =========================================================
   Get automatic grading result
   ========================================================= */

export async function getGradingResult(
  answerId: string
): Promise<GradingDocument | null> {
  if (!answerId.trim()) {
    return null;
  }

  const snapshot = await getDoc(
    doc(
      db,
      "gradingResults",
      answerId
    )
  );

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();

  return {
    id: snapshot.id,

    answerId:
      stringValue(
        data.answerId
      ) || answerId,

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

    status:
      stringValue(
        data.status
      ) || "pending",

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
   Get first review
   ========================================================= */

export async function getFirstReview(
  answerId: string
): Promise<FirstReview | null> {
  if (!answerId.trim()) {
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

  if (snapshot.empty) {
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
      ) || answerId,

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
   Get second review
   ========================================================= */

export async function getSecondReview(
  answerId: string
): Promise<SecondReview | null> {
  if (!answerId.trim()) {
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

  if (snapshot.empty) {
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
      ) || answerId,

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
   Save first review
   ========================================================= */

export async function saveFirstReview(
  input: SaveReviewInput
): Promise<string> {
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
        "completed",

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
        "second_review",

      totalScore,

      totalMaxScore,

      reviewRequired:
        false,

      updatedAt:
        serverTimestamp(),
    }
  );

  await batch.commit();

  return reference.id;
}

/* =========================================================
   Save second review
   ========================================================= */

export async function saveSecondReview(
  input: SaveReviewInput
): Promise<string> {
  validateReviewInput(
    input
  );

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
        "completed",

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

  /*
   * 一次・二次で相違がある場合は
   * 採点確定には進めない。
   */
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
          : "second_review",

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
   Calculate changes
   ========================================================= */

export function calculateGradingChanges(
  before: GradingResult[],
  after: GradingResult[]
): GradingChange[] {
  const changes: GradingChange[] =
    [];

  for (
    const afterResult of
      after
  ) {
    const beforeResult =
      before.find(
        (
          item
        ) =>
          item.questionId ===
          afterResult.questionId
      );

    if (
      !beforeResult
    ) {
      continue;
    }

    const scoreChanged =
      beforeResult.score !==
      afterResult.score;

    const markChanged =
      beforeResult.mark !==
      afterResult.mark;

    if (
      !scoreChanged &&
      !markChanged
    ) {
      continue;
    }

    changes.push({
      questionId:
        afterResult.questionId,

      questionNumber:
        afterResult.questionNumber,

      before:
        beforeResult.score,

      after:
        afterResult.score,

      reason:
        afterResult.reason ??
        "",
    });
  }

  return changes;
}

/* =========================================================
   Confirm grading
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

  /*
   * 全答案を事前確認。
   */
  for (
    const answerId of
      uniqueIds
  ) {
    await validateConfirmation(
      answerId
    );
  }

  /*
   * Firestore Batchの上限を
   * 超えないよう400件単位。
   */
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

          confirmedAt:
            serverTimestamp(),

          confirmedBy,

          updatedAt:
            serverTimestamp(),
        }
      );
    }

    await batch.commit();
  }
}

/* =========================================================
   Validate confirmation
   ========================================================= */

async function validateConfirmation(
  answerId: string
) {
  const first =
    await getFirstReview(
      answerId
    );

  if (
    !first
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
    !second
  ) {
    throw new Error(
      `二次確認が完了していません: ${answerId}`
    );
  }

  if (
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
      `一次確認と二次確認の内容が一致していません: ${answerId}`
    );
  }

  /*
   * 得点の範囲チェック。
   */
  for (
    const result of
      second.results
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
   Publish
   ========================================================= */

export async function publishGrading(
  answerIds: string[]
) {
  if (
    answerIds.length ===
    0
  ) {
    return;
  }

  const uniqueIds =
    Array.from(
      new Set(
        answerIds
      )
    );

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
            "published",

          publishedAt:
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
   Return to second review
   ========================================================= */

export async function returnToSecondReview(
  answerId: string
) {
  await updateDoc(
    doc(
      db,
      "answers",
      answerId
    ),
    {
      status:
        "second_review",

      reviewRequired:
        true,

      updatedAt:
        serverTimestamp(),
    }
  );
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
   Disagreement
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
   Normalize results
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
      value,
      index
    ) => {
      const data =
        value &&
        typeof value ===
          "object"
          ? value as Record<
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
      "生徒番号が不正です。"
    );
  }

  if (
    !Array.isArray(
      input.results
    )
  ) {
    throw new Error(
      "採点結果がありません。"
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
   Helpers
   ========================================================= */

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

function normalizeScore(
  score: number,
  maxScore: number
) {
  const safeMax =
    Math.max(
      0,
      safeNumber(
        maxScore
      )
    );

  return Math.min(
    safeMax,
    Math.max(
      0,
      safeNumber(
        score
      )
    )
  );
}

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
