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

/* =========================================================
   Types
   ========================================================= */

export type GradingMark =
  | "○"
  | "△"
  | "×";

export type ReviewType =
  | "first"
  | "second";

export type GradingResult = {
  questionId: string;

  /*
   * 問題番号は、元データでは
   * "1"
   * "1-1"
   * "問1"
   * などもあり得るためstring。
   */
  questionNumber: string;

  mark: GradingMark;

  score: number;

  maxScore: number;

  answerText: string;

  confidence: number;

  reviewRequired: boolean;

  reason?: string;

  rubric?: string;
};

export type GradingDocument = {
  id: string;

  results: GradingResult[];

  totalScore: number;

  totalMaxScore: number;

  status:
    | "pending"
    | "reviewing"
    | "completed"
    | "error"
    | string;

  reviewRequired: boolean;

  internalNote: string;

  publicAnnotation: string;

  createdAt?: unknown;

  updatedAt?: unknown;
};

export type FirstReview = {
  id: string;

  answerId: string;

  testId: string;

  subjectId: string;

  studentNumber: string;

  reviewerId: string;

  results: GradingResult[];

  totalScore: number;

  totalMaxScore: number;

  internalNote: string;

  publicAnnotation: string;

  status:
    | "reviewing"
    | "completed"
    | "returned";

  createdAt?: unknown;

  updatedAt?: unknown;
};

export type SecondReview = {
  id: string;

  answerId: string;

  testId: string;

  subjectId: string;

  studentNumber: string;

  reviewerId: string;

  results: GradingResult[];

  totalScore: number;

  totalMaxScore: number;

  disagreement: boolean;

  internalNote: string;

  publicAnnotation: string;

  status:
    | "reviewing"
    | "completed"
    | "returned";

  createdAt?: unknown;

  updatedAt?: unknown;
};

/* =========================================================
   採点結果取得
   ========================================================= */

export async function getGradingResult(
  answerId: string
): Promise<GradingDocument | null> {
  if (
    !answerId.trim()
  ) {
    throw new Error(
      "answerIdが指定されていません。"
    );
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

    results:
      normalizeGradingResults(
        data.results
      ),

    totalScore:
      toSafeNumber(
        data.totalScore
      ),

    totalMaxScore:
      toSafeNumber(
        data.totalMaxScore
      ),

    status:
      typeof data.status ===
      "string"
        ? data.status
        : "pending",

    reviewRequired:
      data.reviewRequired ===
      true,

    internalNote:
      typeof data.internalNote ===
      "string"
        ? data.internalNote
        : "",

    publicAnnotation:
      typeof data.publicAnnotation ===
      "string"
        ? data.publicAnnotation
        : "",

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
    throw new Error(
      "answerIdが指定されていません。"
    );
  }

  const reviewQuery =
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
    );

  const snapshot =
    await getDocs(
      reviewQuery
    );

  if (
    snapshot.empty
  ) {
    return null;
  }

  const item =
    snapshot.docs[0];

  const data =
    item.data();

  return {
    id:
      item.id,

    answerId:
      stringValue(
        data.answerId
      ),

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
      normalizeGradingResults(
        data.results
      ),

    totalScore:
      toSafeNumber(
        data.totalScore
      ),

    totalMaxScore:
      toSafeNumber(
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
    throw new Error(
      "answerIdが指定されていません。"
    );
  }

  const reviewQuery =
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
    );

  const snapshot =
    await getDocs(
      reviewQuery
    );

  if (
    snapshot.empty
  ) {
    return null;
  }

  const item =
    snapshot.docs[0];

  const data =
    item.data();

  return {
    id:
      item.id,

    answerId:
      stringValue(
        data.answerId
      ),

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
      normalizeGradingResults(
        data.results
      ),

    totalScore:
      toSafeNumber(
        data.totalScore
      ),

    totalMaxScore:
      toSafeNumber(
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
  input: {
    answerId: string;

    testId: string;

    subjectId: string;

    studentNumber: string;

    reviewerId: string;

    results: GradingResult[];

    internalNote?: string;

    publicAnnotation?: string;
  }
): Promise<string> {
  validateReviewInput(
    input
  );

  const totalScore =
    calculateTotalScore(
      input.results
    );

  const totalMaxScore =
    calculateTotalMaxScore(
      input.results
    );

  const existing =
    await getFirstReview(
      input.answerId
    );

  const reference =
    existing
      ? doc(
          db,
          "firstReviews",
          existing.id
        )
      : doc(
          collection(
            db,
            "firstReviews"
          )
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

      ...(existing
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

  await batch.commit();

  await updateAnswerAfterFirstReview(
    input.answerId,
    totalScore,
    totalMaxScore
  );

  return reference.id;
}

/* =========================================================
   二次確認保存
   ========================================================= */

export async function saveSecondReview(
  input: {
    answerId: string;

    testId: string;

    subjectId: string;

    studentNumber: string;

    reviewerId: string;

    results: GradingResult[];

    internalNote?: string;

    publicAnnotation?: string;
  }
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
      : true;

  const totalScore =
    calculateTotalScore(
      input.results
    );

  const totalMaxScore =
    calculateTotalMaxScore(
      input.results
    );

  const existing =
    await getSecondReview(
      input.answerId
    );

  const reference =
    existing
      ? doc(
          db,
          "secondReviews",
          existing.id
        )
      : doc(
          collection(
            db,
            "secondReviews"
          )
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

      ...(existing
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

  await batch.commit();

  await updateAnswerAfterSecondReview(
    input.answerId,
    totalScore,
    totalMaxScore,
    disagreement
  );

  return reference.id;
}

/* =========================================================
   一次確認差し戻し
   ========================================================= */

export async function returnToFirstReview(
  answerId: string
) {
  const secondReview =
    await getSecondReview(
      answerId
    );

  if (
    secondReview
  ) {
    await updateDoc(
      doc(
        db,
        "secondReviews",
        secondReview.id
      ),
      {
        status:
          "returned",

        updatedAt:
          serverTimestamp(),
      }
    );
  }

  await updateDoc(
    doc(
      db,
      "answers",
      answerId
    ),
    {
      status:
        "first_review",

      updatedAt:
        serverTimestamp(),
    }
  );
}

/* =========================================================
   採点確定
   ========================================================= */

export async function confirmGrading(
  answerIds: string[]
) {
  if (
    answerIds.length ===
    0
  ) {
    throw new Error(
      "確定する答案がありません。"
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
    await validateAnswerForConfirmation(
      answerId
    );
  }

  const BATCH_SIZE =
    400;

  for (
    let start = 0;
    start <
    uniqueIds.length;
    start +=
      BATCH_SIZE
  ) {
    const batch =
      writeBatch(
        db
      );

    const chunk =
      uniqueIds.slice(
        start,
        start +
          BATCH_SIZE
      );

    for (
      const answerId of
        chunk
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

          updatedAt:
            serverTimestamp(),
        }
      );
    }

    await batch.commit();
  }
}

/* =========================================================
   採点確定前チェック
   ========================================================= */

async function validateAnswerForConfirmation(
  answerId: string
) {
  const answer =
    await getGradingResult(
      answerId
    );

  if (
    !answer
  ) {
    throw new Error(
      `採点結果がありません: ${answerId}`
    );
  }

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
    second.disagreement
  ) {
    throw new Error(
      `一次・二次確認の判定が一致していません: ${answerId}`
    );
  }

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
        `問題 ${result.questionNumber} の得点が不正です: ${answerId}`
      );
    }
  }
}

/* =========================================================
   採点公開
   ========================================================= */

export async function publishGrading(
  answerIds: string[]
) {
  if (
    answerIds.length ===
    0
  ) {
    throw new Error(
      "公開する答案がありません。"
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
    const answer =
      await getGradingResult(
        answerId
      );

    if (
      !answer
    ) {
      throw new Error(
        `採点結果がありません: ${answerId}`
      );
    }
  }

  const BATCH_SIZE =
    400;

  for (
    let start = 0;
    start <
    uniqueIds.length;
    start +=
      BATCH_SIZE
  ) {
    const batch =
      writeBatch(
        db
      );

    const chunk =
      uniqueIds.slice(
        start,
        start +
          BATCH_SIZE
      );

    for (
      const answerId of
        chunk
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
   Score
   ========================================================= */

function calculateTotalScore(
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

function calculateTotalMaxScore(
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
        toSafeNumber(
          result.maxScore
        )
      ),
    0
  );
}

function normalizeScore(
  score: number,
  maxScore: number
) {
  const safeScore =
    toSafeNumber(
      score
    );

  const safeMax =
    Math.max(
      0,
      toSafeNumber(
        maxScore
      )
    );

  return Math.min(
    safeMax,
    Math.max(
      0,
      safeScore
    )
  );
}

/* =========================================================
   一次・二次の差異
   ========================================================= */

function hasDisagreement(
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
   答案ステータス
   ========================================================= */

async function updateAnswerAfterFirstReview(
  answerId: string,
  score: number,
  maxScore: number
) {
  await updateDoc(
    doc(
      db,
      "answers",
      answerId
    ),
    {
      status:
        "first_review",

      firstReviewScore:
        score,

      firstReviewMaxScore:
        maxScore,

      updatedAt:
        serverTimestamp(),
    }
  );
}

async function updateAnswerAfterSecondReview(
  answerId: string,
  score: number,
  maxScore: number,
  disagreement: boolean
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

      secondReviewScore:
        score,

      secondReviewMaxScore:
        maxScore,

      reviewDisagreement:
        disagreement,

      updatedAt:
        serverTimestamp(),
    }
  );
}

/* =========================================================
   Validation
   ========================================================= */

function validateReviewInput(
  input: {
    answerId: string;

    testId: string;

    subjectId: string;

    studentNumber: string;

    reviewerId: string;

    results: GradingResult[];
  }
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
    !/^\d{6}$/.test(
      input.studentNumber
    )
  ) {
    throw new Error(
      "生徒番号が不正です。"
    );
  }

  if (
    !input.reviewerId.trim()
  ) {
    throw new Error(
      "採点者IDがありません。"
    );
  }

  if (
    !Array.isArray(
      input.results
    )
  ) {
    throw new Error(
      "採点結果が不正です。"
    );
  }

  for (
    const result of
      input.results
  ) {
    const score =
      toSafeNumber(
        result.score
      );

    const maxScore =
      toSafeNumber(
        result.maxScore
      );

    if (
      score <
        0 ||
      score >
        maxScore
    ) {
      throw new Error(
        `問題 ${result.questionNumber} の得点が不正です。`
      );
    }
  }
}

/* =========================================================
   Result normalization
   ========================================================= */

function normalizeGradingResults(
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
          ? (
              item as Record<
                string,
                unknown
              >
            )
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

        mark:
          normalizeMark(
            data.mark
          ),

        score:
          toSafeNumber(
            data.score
          ),

        maxScore:
          toSafeNumber(
            data.maxScore
          ),

        answerText:
          stringValue(
            data.answerText
          ),

        confidence:
          toSafeNumber(
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

function normalizeMark(
  value: unknown
): GradingMark {
  if (
    value ===
      "○" ||
    value ===
      "△" ||
    value ===
      "×"
  ) {
    return value;
  }

  return "×";
}

function normalizeReviewStatus(
  value: unknown
):
  | "reviewing"
  | "completed"
  | "returned" {
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

/* =========================================================
   Primitive helpers
   ========================================================= */

function stringValue(
  value: unknown
) {
  return typeof value ===
    "string"
    ? value
    : "";
}

function toSafeNumber(
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
