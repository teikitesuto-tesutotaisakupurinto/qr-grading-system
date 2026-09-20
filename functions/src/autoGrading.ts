import {
  getFirestore,
} from "firebase-admin/firestore";

import {
  processAnswerRegions,
  type OcrRegionResult,
  type OcrResult,
} from "./ocr";

import {
  downloadAnswerFile,
} from "./supabase";

const db =
  getFirestore();

/* =========================================================
   型
   ========================================================= */

export type Mark =
  | "○"
  | "△"
  | "×";

export type GradingMethod =
  | "auto"
  | "manual"
  | "both";

export type QuestionSetting = {
  id: string;

  testId: string;

  subjectId: string;

  sectionId?: string;

  questionNumber: string;

  correctAnswer: string;

  maxScore: number;

  gradingMethod:
    | "auto"
    | "manual"
    | "both";

  rubric?: string;

  answerRegionId?: string;

  requireHumanReview?: boolean;

  numericTolerance?: number;

  acceptedAnswers?: string[];
};

export type QuestionGradingResult = {
  questionId: string;

  questionNumber: string;

  mark: Mark;

  score: number;

  maxScore: number;

  answerText: string;

  confidence: number;

  reviewRequired: boolean;

  reason?: string;

  rubric?: string;
};

export type AutoGradingInput = {
  testId: string;

  subjectId: string;

  studentNumber: string;

  answerId: string;

  ocrResult: OcrResult;
};

export type AutoGradingOutput = {
  studentNumber: string;

  answerId: string;

  results: QuestionGradingResult[];

  totalScore: number;

  totalMaxScore: number;

  reviewRequired: boolean;
};

/* =========================================================
   自動採点
   ========================================================= */

export async function gradeAnswer(
  input: AutoGradingInput
): Promise<AutoGradingOutput> {
  const questions =
    await getQuestionSettings(
      input.testId,
      input.subjectId
    );

  if (
    questions.length === 0
  ) {
    throw new Error(
      "採点設定が登録されていません。"
    );
  }

  const image =
    await getAnswerImage(
      input.answerId
    );

  const regions =
    await processAnswerRegions(
      image,
      input.testId,
      input.subjectId
    );

  const results:
    QuestionGradingResult[] =
    [];

  for (
    const question of
      questions
  ) {
    const region =
      findRegionForQuestion(
        question,
        regions
      );

    results.push(
      gradeQuestion(
        question,
        region,
        input.ocrResult
      )
    );
  }

  const totalScore =
    results.reduce(
      (sum, result) =>
        sum + result.score,
      0
    );

  const totalMaxScore =
    results.reduce(
      (sum, result) =>
        sum + result.maxScore,
      0
    );

  return {
    studentNumber:
      input.studentNumber,

    answerId:
      input.answerId,

    results,

    totalScore,

    totalMaxScore,

    reviewRequired:
      results.some(
        (result) =>
          result.reviewRequired
      ),
  };
}

/* =========================================================
   採点設定
   ========================================================= */

async function getQuestionSettings(
  testId: string,
  subjectId: string
): Promise<QuestionSetting[]> {
  const snapshot =
    await db
      .collection(
        "questions"
      )
      .where(
        "testId",
        "==",
        testId
      )
      .where(
        "subjectId",
        "==",
        subjectId
      )
      .get();

  return snapshot.docs
    .map(
      (item) =>
        ({
          id: item.id,

          ...item.data(),
        }) as QuestionSetting
    )
    .sort(
      (a, b) =>
        compareQuestionNumber(
          a.questionNumber,
          b.questionNumber
        )
    );
}

/* =========================================================
   Supabaseから答案取得
   ========================================================= */

async function getAnswerImage(
  answerId: string
): Promise<Buffer> {
  const snapshot =
    await db
      .collection(
        "answers"
      )
      .doc(answerId)
      .get();

  if (!snapshot.exists) {
    throw new Error(
      `答案が存在しません: ${answerId}`
    );
  }

  const data =
    snapshot.data();

  const fileKey =
    data?.fileKey;

  if (
    typeof fileKey !==
      "string" ||
    !fileKey
  ) {
    throw new Error(
      "答案ファイルキーがありません。"
    );
  }

  return downloadAnswerFile(
    fileKey
  );
}

/* =========================================================
   問題と解答枠の紐付け
   ========================================================= */

function findRegionForQuestion(
  question: QuestionSetting,
  regions: OcrRegionResult[]
): OcrRegionResult | null {
  if (
    question.answerRegionId
  ) {
    return (
      regions.find(
        (region) =>
          region.regionId ===
          question.answerRegionId
      ) ?? null
    );
  }

  return (
    regions.find(
      (region) =>
        region.questionId ===
        question.id
    ) ?? null
  );
}

/* =========================================================
   1問採点
   ========================================================= */

function gradeQuestion(
  question: QuestionSetting,
  region: OcrRegionResult | null,
  fullOcr: OcrResult
): QuestionGradingResult {
  const answerText =
    region?.text?.trim() ??
    "";

  const confidence =
    region
      ? region.confidence
      : fullOcr.confidence;

  if (
    question.gradingMethod ===
    "manual"
  ) {
    return {
      questionId:
        question.id,

      questionNumber:
        question.questionNumber,

      mark: "△",

      score: 0,

      maxScore:
        question.maxScore,

      answerText,

      confidence,

      reviewRequired:
        true,

      reason:
        "手動採点問題です。",

      rubric:
        question.rubric,
    };
  }

  if (!region) {
    return {
      questionId:
        question.id,

      questionNumber:
        question.questionNumber,

      mark: "△",

      score: 0,

      maxScore:
        question.maxScore,

      answerText: "",

      confidence: 0,

      reviewRequired:
        true,

      reason:
        "問題に対応する解答枠が見つかりません。",

      rubric:
        question.rubric,
    };
  }

  if (!answerText) {
    return {
      questionId:
        question.id,

      questionNumber:
        question.questionNumber,

      mark: "△",

      score: 0,

      maxScore:
        question.maxScore,

      answerText: "",

      confidence,

      reviewRequired:
        true,

      reason:
        "解答をOCRできませんでした。",

      rubric:
        question.rubric,
    };
  }

  if (
    confidence < 0.75
  ) {
    return {
      questionId:
        question.id,

      questionNumber:
        question.questionNumber,

      mark: "△",

      score: 0,

      maxScore:
        question.maxScore,

      answerText,

      confidence,

      reviewRequired:
        true,

      reason:
        "OCR信頼度が低いため要確認です。",

      rubric:
        question.rubric,
    };
  }

  const correct =
    isAnswerCorrect(
      answerText,
      question
    );

  if (correct) {
    const reviewRequired =
      question.gradingMethod ===
      "both";

    return {
      questionId:
        question.id,

      questionNumber:
        question.questionNumber,

      mark: "○",

      score:
        question.maxScore,

      maxScore:
        question.maxScore,

      answerText,

      confidence,

      reviewRequired,

      reason:
        reviewRequired
          ? "自動採点後の人確認が必要です。"
          : undefined,

      rubric:
        question.rubric,
    };
  }

  if (
    question.gradingMethod ===
      "both" ||
    question.requireHumanReview
  ) {
    return {
      questionId:
        question.id,

      questionNumber:
        question.questionNumber,

      mark: "△",

      score: 0,

      maxScore:
        question.maxScore,

      answerText,

      confidence,

      reviewRequired:
        true,

      reason:
        "自動判定だけでは採点を確定できません。",

      rubric:
        question.rubric,
    };
  }

  return {
    questionId:
      question.id,

    questionNumber:
      question.questionNumber,

    mark: "×",

    score: 0,

    maxScore:
      question.maxScore,

    answerText,

    confidence,

    reviewRequired:
      false,

    rubric:
      question.rubric,
  };
}

/* =========================================================
   正解判定
   ========================================================= */

function isAnswerCorrect(
  answer: string,
  question: QuestionSetting
): boolean {
  const normalized =
    normalizeAnswer(
      answer
    );

  const accepted = [
    question.correctAnswer,

    ...(question.acceptedAnswers ??
      []),
  ];

  for (
    const expected of
      accepted
  ) {
    if (
      normalizeAnswer(
        expected
      ) === normalized
    ) {
      return true;
    }
  }

  if (
    question.numericTolerance !==
      undefined
  ) {
    const actual =
      parseNumber(
        normalized
      );

    const expected =
      parseNumber(
        normalizeAnswer(
          question.correctAnswer
        )
      );

    if (
      actual !== null &&
      expected !== null
    ) {
      return (
        Math.abs(
          actual -
            expected
        ) <=
        question.numericTolerance
      );
    }
  }

  return false;
}

/* =========================================================
   正規化
   ========================================================= */

function normalizeAnswer(
  value: string
): string {
  return value
    .normalize("NFKC")
    .replace(
      /\s+/g,
      ""
    )
    .replace(
      /[。．、,，]/g,
      ""
    )
    .toLowerCase()
    .trim();
}

/* =========================================================
   数値
   ========================================================= */

function parseNumber(
  value: string
): number | null {
  const normalized =
    value.replace(
      /[^0-9.+\-eE]/g,
      ""
    );

  if (!normalized) {
    return null;
  }

  const number =
    Number(
      normalized
    );

  return Number.isFinite(
    number
  )
    ? number
    : null;
}

/* =========================================================
   問題番号
   ========================================================= */

function compareQuestionNumber(
  a: string,
  b: string
): number {
  const aParts =
    a.match(/\d+/g);

  const bParts =
    b.match(/\d+/g);

  if (
    !aParts ||
    !bParts
  ) {
    return a.localeCompare(
      b,
      "ja"
    );
  }

  const length =
    Math.max(
      aParts.length,
      bParts.length
    );

  for (
    let index = 0;
    index < length;
    index++
  ) {
    const left =
      Number(
        aParts[index] ??
          0
      );

    const right =
      Number(
        bParts[index] ??
          0
      );

    if (
      left !== right
    ) {
      return (
        left - right
      );
    }
  }

  return a.localeCompare(
    b,
    "ja"
  );
}
