"use client";

import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "@/lib/firebase";

import {
  getAppUser,
} from "@/lib/auth";

import type {
  Answer,
  FirstReview,
  GradingMark,
  GradingResult,
  SecondReview,
  TestQuestion,
  UserRole,
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

  internalNote: string;

  publicAnnotation: string;
};

type GradingDocumentData =
  Record<
    string,
    unknown
  >;

/* =========================================================
   Get grading result
   ========================================================= */

export async function getGradingResult(
  answerId: string
) {
  if (
    !answerId
  ) {
    return null;
  }

  const snapshot =
    await getDoc(
      doc(
        db,
        "gradings",
        answerId
      )
    );

  if (
    !snapshot.exists()
  ) {
    return null;
  }

  return normalizeGrading(
    snapshot.id,
    snapshot.data()
  );
}

/* =========================================================
   Get first review
   ========================================================= */

export async function getFirstReview(
  answerId: string
): Promise<
  FirstReview | null
> {
  if (
    !answerId
  ) {
    return null;
  }

  const snapshot =
    await getDoc(
      doc(
        db,
        "firstReviews",
        answerId
      )
    );

  if (
    !snapshot.exists()
  ) {
    return null;
  }

  return normalizeFirstReview(
    snapshot.id,
    snapshot.data()
  );
}

/* =========================================================
   Get second review
   ========================================================= */

export async function getSecondReview(
  answerId: string
): Promise<
  SecondReview | null
> {
  if (
    !answerId
  ) {
    return null;
  }

  const snapshot =
    await getDoc(
      doc(
        db,
        "secondReviews",
        answerId
      )
    );

  if (
    !snapshot.exists()
  ) {
    return null;
  }

  return normalizeSecondReview(
    snapshot.id,
    snapshot.data()
  );
}

/* =========================================================
   Automatic grading
   ========================================================= */

export async function runAutomaticGrading(
  answerId: string,
  questions: TestQuestion[],
  detectedAnswers:
    | Record<
        string,
        string
      >
    | undefined = undefined
) {
  const user =
    await getAppUser();

  if (
    !user
  ) {
    throw new Error(
      "ログインしてください。"
    );
  }

  assertGradingPermission(
    user.role
  );

  const answer =
    await getAnswerForGrading(
      answerId
    );

  if (
    !answer
  ) {
    throw new Error(
      "答案が見つかりません。"
    );
  }

  /*
   * 問題単位で採点方式を判断。
   *
   * automatic:
   *   自動採点
   *
   * manual:
   *   自動採点しない
   *   reviewRequired=true
   */
  const results =
    questions
      .sort(
        (
          a,
          b
        ) =>
          getQuestionOrder(
            a
          ) -
          getQuestionOrder(
            b
          )
      )
      .map(
        (
          question
        ) =>
          gradeQuestion(
            question,
            detectedAnswers?.[
              question.id
            ] ??
              ""
          )
      );

  const totalScore =
    calculateTotalScore(
      results
    );

  const totalMaxScore =
    calculateTotalMaxScore(
      results
    );

  const hasManual =
    results.some(
      (
        result
      ) =>
        result.reviewRequired
    );

  const gradingRef =
    doc(
      db,
      "gradings",
      answerId
    );

  await setDoc(
    gradingRef,
    {
      answerId,

      testId:
        answer.testId,

      subjectId:
        answer.subjectId,

      results,

      totalScore,

      totalMaxScore,

      status:
        hasManual
          ? "first_review"
          : "graded",

      reviewRequired:
        hasManual,

      internalNote:
        "",

      publicAnnotation:
        "",

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    }
  );

  await updateDoc(
    doc(
      db,
      "answers",
      answerId
    ),
    {
      status:
        "first_review",

      reviewRequired:
        hasManual,

      totalScore,

      totalMaxScore,

      processedAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    }
  );

  return {
    answerId,

    results,

    totalScore,

    totalMaxScore,

    reviewRequired:
      hasManual,
  };
}

/* =========================================================
   Grade one question
   ========================================================= */

function gradeQuestion(
  question: TestQuestion,
  answerText: string
): GradingResult {
  const normalizedAnswer =
    normalizeAnswerText(
      answerText
    );

  /*
   * 手動採点。
   */
  if (
    question.gradingMethod ===
    "manual"
  ) {
    return {
      questionId:
        question.id,

      questionNumber:
        question.questionNumber,

      answerText:
        answerText,

      mark:
        "△",

      score:
        0,

      maxScore:
        question.maxScore,

      confidence:
        0,

      reviewRequired:
        true,

      reason:
        "手動採点対象",

      rubric:
        question.rubric,
    };
  }

  /*
   * 自動採点なのに正答がない場合。
   *
   * 勝手に正解扱いしない。
   */
  if (
    !question.correctAnswer.trim()
  ) {
    return {
      questionId:
        question.id,

      questionNumber:
        question.questionNumber,

      answerText:
        answerText,

      mark:
        "△",

      score:
        0,

      maxScore:
        question.maxScore,

      confidence:
        0,

      reviewRequired:
        true,

      reason:
        "正答が設定されていません。",

      rubric:
        question.rubric,
    };
  }

  const correct =
    normalizeAnswerText(
      question.correctAnswer
    );

  const isCorrect =
    normalizedAnswer ===
    correct;

  const score =
    isCorrect
      ? question.maxScore
      : 0;

  const mark:
    GradingMark =
    isCorrect
      ? "○"
      : "×";

  /*
   * 自動採点問題でも
   * requiresReview=trueなら
   * 一次確認対象にする。
   */
  const reviewRequired =
    question.requiresReview;

  return {
    questionId:
      question.id,

    questionNumber:
      question.questionNumber,

    answerText:
      answerText,

    mark,

    score,

    maxScore:
      question.maxScore,

    confidence:
      1,

    reviewRequired,

    reason:
      isCorrect
        ? "正答一致"
        : "正答不一致",

    rubric:
      question.rubric,
  };
}

/* =========================================================
   Save first review
   ========================================================= */

export async function saveFirstReview(
  input: SaveReviewInput
) {
  const user =
    await getAppUser();

  if (
    !user
  ) {
    throw new Error(
      "ログインしてください。"
    );
  }

  assertReviewPermission(
    user.role
  );

  const answer =
    await getAnswerForGrading(
      input.answerId
    );

  if (
    !answer
  ) {
    throw new Error(
      "答案が見つかりません。"
    );
  }

  /*
   * 自分の権限範囲外の答案を
   * 更新できないようにする。
   */
  assertAnswerScope(
    answer,
    user
  );

  validateReviewResults(
    input.results
  );

  const totalScore =
    calculateTotalScore(
      input.results
    );

  const totalMaxScore =
    calculateTotalMaxScore(
      input.results
    );

  const reviewRef =
    doc(
      db,
      "firstReviews",
      input.answerId
    );

  await setDoc(
    reviewRef,
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

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    }
  );

  /*
   * 手動採点が残っていれば
   * first_reviewのまま。
   */
  const hasPendingManual =
    input.results.some(
      (
        result
      ) =>
        result.reviewRequired
    );

  /*
   * 手動採点が全部終わったら
   * second_reviewへ進める。
   */
  const nextStatus =
    hasPendingManual
      ? "first_review"
      : "second_review";

  await updateDoc(
    doc(
      db,
      "answers",
      input.answerId
    ),
    {
      status:
        nextStatus,

      reviewRequired:
        hasPendingManual,

      totalScore,

      totalMaxScore,

      updatedAt:
        serverTimestamp(),
    }
  );

  /*
   * gradingにも最新の一次確認結果を保存。
   */
  await setDoc(
    doc(
      db,
      "gradings",
      input.answerId
    ),
    {
      answerId:
        input.answerId,

      testId:
        input.testId,

      subjectId:
        input.subjectId,

      results:
        input.results,

      totalScore,

      totalMaxScore,

      status:
        nextStatus,

      reviewRequired:
        hasPendingManual,

      internalNote:
        input.internalNote ??
        "",

      publicAnnotation:
        input.publicAnnotation ??
        "",

      updatedAt:
        serverTimestamp(),
    },
    {
      merge:
        true,
    }
  );

  return {
    totalScore,

    totalMaxScore,

    status:
      nextStatus,
  };
}

/* =========================================================
   Save second review
   ========================================================= */

export async function saveSecondReview(
  input: SaveReviewInput
) {
  const user =
    await getAppUser();

  if (
    !user
  ) {
    throw new Error(
      "ログインしてください。"
    );
  }

  assertReviewPermission(
    user.role
  );

  const answer =
    await getAnswerForGrading(
      input.answerId
    );

  if (
    !answer
  ) {
    throw new Error(
      "答案が見つかりません。"
    );
  }

  assertAnswerScope(
    answer,
    user
  );

  if (
    answer.status !==
      "second_review" &&
    answer.status !==
      "confirmed"
  ) {
    throw new Error(
      "二次確認対象ではありません。"
    );
  }

  validateReviewResults(
    input.results
  );

  const first =
    await getFirstReview(
      input.answerId
    );

  /*
   * 一次確認がない答案を
   * 二次確認だけで確定しない。
   */
  if (
    !first
  ) {
    throw new Error(
      "一次確認結果がありません。"
    );
  }

  const disagreement =
    hasDisagreement(
      first.results,
      input.results
    );

  const totalScore =
    calculateTotalScore(
      input.results
    );

  const totalMaxScore =
    calculateTotalMaxScore(
      input.results
    );

  const secondReviewRef =
    doc(
      db,
      "secondReviews",
      input.answerId
    );

  await setDoc(
    secondReviewRef,
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

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    }
  );

  /*
   * 差異がある場合は
   * first_reviewへ戻す。
   */
  if (
    disagreement
  ) {
    await updateDoc(
      doc(
        db,
        "answers",
        input.answerId
      ),
      {
        status:
          "first_review",

        reviewRequired:
          true,

        totalScore,

        totalMaxScore,

        updatedAt:
          serverTimestamp(),
      }
    );

    return {
      disagreement:
        true,

      totalScore,

      totalMaxScore,

      status:
        "first_review" as const,
    };
  }

  /*
   * 差異なし。
   *
   * ここではまだconfirmedにしない。
   *
   * 最終確定はconfirmGrading()。
   */
  await updateDoc(
    doc(
      db,
      "answers",
      input.answerId
    ),
    {
      status:
        "second_review",

      reviewRequired:
        false,

      totalScore,

      totalMaxScore,

      updatedAt:
        serverTimestamp(),
    }
  );

  return {
    disagreement:
      false,

    totalScore,

    totalMaxScore,

    status:
      "second_review" as const,
  };
}

/* =========================================================
   Return to first review
   ========================================================= */

export async function returnToFirstReview(
  answerId: string
) {
  const user =
    await getAppUser();

  if (
    !user
  ) {
    throw new Error(
      "ログインしてください。"
    );
  }

  assertReviewPermission(
    user.role
  );

  const answer =
    await getAnswerForGrading(
      answerId
    );

  if (
    !answer
  ) {
    throw new Error(
      "答案が見つかりません。"
    );
  }

  assertAnswerScope(
    answer,
    user
  );

  await updateDoc(
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

  /*
   * 二次確認側の状態も
   * returnedとして記録。
   */
  const second =
    await getSecondReview(
      answerId
    );

  if (
    second
  ) {
    await updateDoc(
      doc(
        db,
        "secondReviews",
        answerId
      ),
      {
        status:
          "returned",

        updatedAt:
          serverTimestamp(),
      }
    );
  }
}

/* =========================================================
   Confirm grading
   ========================================================= */

export async function confirmGrading(
  answerIds: string[],
  confirmedBy: string
) {
  const user =
    await getAppUser();

  if (
    !user
  ) {
    throw new Error(
      "ログインしてください。"
    );
  }

  assertConfirmPermission(
    user.role
  );

  const uniqueIds =
    Array.from(
      new Set(
        answerIds.filter(
          Boolean
        )
      )
    );

  if (
    uniqueIds.length ===
    0
  ) {
    throw new Error(
      "確定対象の答案がありません。"
    );
  }

  const confirmed: string[] =
    [];

  for (
    const answerId of
      uniqueIds
  ) {
    const answer =
      await getAnswerForGrading(
        answerId
      );

    if (
      !answer
    ) {
      throw new Error(
        `答案 ${answerId} が見つかりません。`
      );
    }

    assertAnswerScope(
      answer,
      user
    );

    if (
      answer.status !==
      "second_review"
    ) {
      throw new Error(
        `答案 ${answerId} は二次確認完了状態ではありません。`
      );
    }

    const [
      first,
      second,
    ] =
      await Promise.all([
        getFirstReview(
          answerId
        ),

        getSecondReview(
          answerId
        ),
      ]);

    if (
      !first
    ) {
      throw new Error(
        `答案 ${answerId} は一次確認が完了していません。`
      );
    }

    if (
      !second ||
      second.status !==
        "completed"
    ) {
      throw new Error(
        `答案 ${answerId} は二次確認が完了していません。`
      );
    }

    if (
      second.disagreement
    ) {
      throw new Error(
        `答案 ${answerId} に採点差異があります。`
      );
    }

    /*
     * 最終確定。
     */
    await updateDoc(
      doc(
        db,
        "answers",
        answerId
      ),
      {
        status:
          "confirmed",

        reviewRequired:
          false,

        totalScore:
          second.totalScore,

        totalMaxScore:
          second.totalMaxScore,

        confirmedBy,

        confirmedAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp(),
      }
    );

    confirmed.push(
      answerId
    );
  }

  return {
    confirmed,
  };
}

/* =========================================================
   Disagreement
   ========================================================= */

export function hasDisagreement(
  firstResults: GradingResult[],
  secondResults: GradingResult[]
) {
  const secondMap =
    new Map<
      string,
      GradingResult
    >();

  secondResults.forEach(
    (
      result
    ) => {
      secondMap.set(
        result.questionId,
        result
      );
    }
  );

  for (
    const first of
      firstResults
  ) {
    const second =
      secondMap.get(
        first.questionId
      );

    if (
      !second
    ) {
      return true;
    }

    if (
      first.score !==
        second.score ||
      first.mark !==
        second.mark
    ) {
      return true;
    }
  }

  if (
    firstResults.length !==
    secondResults.length
  ) {
    return true;
  }

  return false;
}

/* =========================================================
   Validate
   ========================================================= */

function validateReviewResults(
  results: GradingResult[]
) {
  if (
    !Array.isArray(
      results
    )
  ) {
    throw new Error(
      "採点結果が不正です。"
    );
  }

  for (
    const result of
      results
  ) {
    if (
      !result.questionId
    ) {
      throw new Error(
        "問題IDがありません。"
      );
    }

    if (
      !Number.isFinite(
        result.score
      )
    ) {
      throw new Error(
        `問${result.questionNumber}の得点が不正です。`
      );
    }

    if (
      !Number.isFinite(
        result.maxScore
      )
    ) {
      throw new Error(
        `問${result.questionNumber}の配点が不正です。`
      );
    }

    if (
      result.score <
        0 ||
      result.score >
        result.maxScore
    ) {
      throw new Error(
        `問${result.questionNumber}の得点が範囲外です。`
      );
    }
  }
}

/* =========================================================
   Total
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
      safeNumber(
        result.score
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
      safeNumber(
        result.maxScore
      ),
    0
  );
}

/* =========================================================
   Permission
   ========================================================= */

function assertGradingPermission(
  role: UserRole
) {
  if (
    role ===
    "生徒"
  ) {
    throw new Error(
      "採点権限がありません。"
    );
  }
}

function assertReviewPermission(
  role: UserRole
) {
  if (
    role ===
    "生徒"
  ) {
    throw new Error(
      "確認権限がありません。"
    );
  }
}

function assertConfirmPermission(
  role: UserRole
) {
  if (
    role ===
    "生徒"
  ) {
    throw new Error(
      "採点確定権限がありません。"
    );
  }
}

/* =========================================================
   Answer scope
   ========================================================= */

function assertAnswerScope(
  answer: Answer,
  user: Awaited<
    ReturnType<
      typeof getAppUser
    >
  >
) {
  if (
    !user
  ) {
    throw new Error(
      "ログインしてください。"
    );
  }

  if (
    answer.organizationId !==
    user.organizationId
  ) {
    throw new Error(
      "この答案にアクセスする権限がありません。"
    );
  }

  if (
    user.role ===
    "本部管理者"
  ) {
    return;
  }

  if (
    user.role ===
      "校舎管理者" ||
    user.role ===
      "講師"
  ) {
    if (
      !user.schoolIds.includes(
        answer.schoolId
      )
    ) {
      throw new Error(
        "この答案にアクセスする権限がありません。"
      );
    }

    return;
  }

  if (
    user.role ===
    "生徒"
  ) {
    if (
      answer.studentId !==
      user.studentId
    ) {
      throw new Error(
        "この答案にアクセスする権限がありません。"
      );
    }

    return;
  }

  throw new Error(
    "この答案にアクセスする権限がありません。"
  );
}

/* =========================================================
   Answer
   ========================================================= */

async function getAnswerForGrading(
  answerId: string
): Promise<
  Answer | null
> {
  const snapshot =
    await getDoc(
      doc(
        db,
        "answers",
        answerId
      )
    );

  if (
    !snapshot.exists()
  ) {
    return null;
  }

  return normalizeAnswer(
    snapshot.id,
    snapshot.data()
  );
}

/* =========================================================
   Normalize grading
   ========================================================= */

function normalizeGrading(
  id: string,
  data: GradingDocumentData
) {
  const results =
    normalizeResults(
      data.results
    );

  return {
    id,

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

    results,

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
      ),

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
   Normalize first review
   ========================================================= */

function normalizeFirstReview(
  id: string,
  data: GradingDocumentData
): FirstReview {
  return {
    id,

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
   Normalize second review
   ========================================================= */

function normalizeSecondReview(
  id: string,
  data: GradingDocumentData
): SecondReview {
  return {
    id,

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
      item
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
          ),

        questionNumber:
          stringValue(
            data.questionNumber
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
          nullableString(
            data.reason
          ) ??
          "",

        rubric:
          nullableString(
            data.rubric
          ) ??
          "",
      };
    }
  );
}

/* =========================================================
   Normalize answer
   ========================================================= */

function normalizeAnswer(
  id: string,
  data: GradingDocumentData
): Answer {
  return {
    id,

    organizationId:
      stringValue(
        data.organizationId
      ),

    schoolId:
      stringValue(
        data.schoolId
      ),

    testId:
      stringValue(
        data.testId
      ),

    subjectId:
      stringValue(
        data.subjectId
      ),

    studentId:
      nullableString(
        data.studentId
      ),

    studentNumber:
      nullableString(
        data.studentNumber
      ),

    fileKey:
      stringValue(
        data.fileKey
      ),

    fileName:
      stringValue(
        data.fileName
      ),

    contentType:
      stringValue(
        data.contentType
      ),

    size:
      safeNumber(
        data.size
      ),

    status:
      normalizeAnswerStatus(
        data.status
      ),

    reviewRequired:
      data.reviewRequired ===
      true,

    totalScore:
      safeNumber(
        data.totalScore
      ),

    totalMaxScore:
      safeNumber(
        data.totalMaxScore
      ),

    qrText:
      stringValue(
        data.qrText
      ),

    qrConfidence:
      safeNumber(
        data.qrConfidence
      ),

    ocrConfidence:
      safeNumber(
        data.ocrConfidence
      ),

    processingError:
      stringValue(
        data.processingError
      ),

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,

    processedAt:
      data.processedAt,

    confirmedAt:
      data.confirmedAt,
  };
}

/* =========================================================
   Status
   ========================================================= */

function normalizeAnswerStatus(
  value: unknown
): Answer["status"] {
  switch (
    value
  ) {
    case "uploaded":
    case "processing":
    case "graded":
    case "first_review":
    case "second_review":
    case "confirmed":
    case "published":
    case "error":
      return value;

    default:
      return "uploaded";
  }
}

function normalizeReviewStatus(
  value: unknown
): FirstReview["status"] {
  switch (
    value
  ) {
    case "reviewing":
    case "completed":
    case "returned":
      return value;

    default:
      return "reviewing";
  }
}

function normalizeMark(
  value: unknown
): GradingMark {
  switch (
    value
  ) {
    case "○":
    case "△":
    case "×":
      return value;

    default:
      return "△";
  }
}

/* =========================================================
   Question order
   ========================================================= */

function getQuestionOrder(
  question: TestQuestion
) {
  const number =
    Number(
      question.questionNumber
    );

  if (
    Number.isFinite(
      number
    )
  ) {
    return number;
  }

  return Number.MAX_SAFE_INTEGER;
}

/* =========================================================
   Answer normalize
   ========================================================= */

function normalizeAnswerText(
  value: string
) {
  return value
    .trim()
    .toLowerCase()
    .replace(
      /\s+/g,
      ""
    )
    .replace(
      /　/g,
      ""
    );
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

function nullableString(
  value: unknown
) {
  return typeof value ===
    "string"
    ? value
    : null;
}

function safeNumber(
  value: unknown
) {
  const number =
    Number(
      value ??
        0
    );

  return Number.isFinite(
    number
  )
    ? number
    : 0;
}
