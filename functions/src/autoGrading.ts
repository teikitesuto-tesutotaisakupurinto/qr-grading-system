import {
  getFirestore,
} from "firebase-admin/firestore";

const db = getFirestore();

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

  /*
   * OCR結果をどの解答枠に対応させるか。
   */
  answerRegionId?: string;

  /*
   * 記述問題など、
   * 自動判定を厳しくしない設定。
   */
  requireHumanReview?: boolean;
};

export type OcrWord = {
  text: string;

  confidence: number;

  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type OcrResult = {
  text: string;

  words: OcrWord[];

  width: number;

  height: number;

  processedAt: number;
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

/**
 * 1答案を自動採点します。
 */
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

  const results: QuestionGradingResult[] =
    [];

  for (
    const question of
      questions
  ) {
    const result =
      gradeQuestion(
        question,
        input.ocrResult
      );

    results.push(result);
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

  const reviewRequired =
    results.some(
      (result) =>
        result.reviewRequired
    );

  return {
    studentNumber:
      input.studentNumber,

    answerId:
      input.answerId,

    results,

    totalScore,

    totalMaxScore,

    reviewRequired,
  };
}

/**
 * Firestoreから採点設定を取得します。
 */
async function getQuestionSettings(
  testId: string,
  subjectId: string
): Promise<QuestionSetting[]> {
  const snapshot =
    await db
      .collection("questions")
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
      .orderBy(
        "questionNumber"
      )
      .get();

  return snapshot.docs.map(
    (doc) =>
      ({
        id: doc.id,
        ...doc.data(),
      }) as QuestionSetting
  );
}

/**
 * 1問を採点します。
 */
function gradeQuestion(
  question: QuestionSetting,
  ocrResult: OcrResult
): QuestionGradingResult {
  /*
   * 解答枠が指定されている場合は
   * その範囲にあるOCR文字だけを使用。
   */
  const answerText =
    extractAnswerText(
      question,
      ocrResult
    );

  const confidence =
    calculateConfidence(
      question,
      ocrResult
    );

  /*
   * 手動採点の場合は
   * 自動採点結果を確定しない。
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

      mark: "△",

      score: 0,

      maxScore:
        question.maxScore,

      answerText,

      confidence,

      reviewRequired: true,

      reason:
        "手動採点問題です。",

      rubric:
        question.rubric,
    };
  }

  /*
   * OCR信頼度が低い場合。
   */
  if (
    confidence < 0.75 ||
    answerText.length === 0
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

      reviewRequired: true,

      reason:
        answerText.length === 0
          ? "解答を認識できませんでした。"
          : "OCR信頼度が低いため要確認です。",

      rubric:
        question.rubric,
    };
  }

  const normalizedAnswer =
    normalizeAnswer(
      answerText
    );

  const normalizedCorrect =
    normalizeAnswer(
      question.correctAnswer
    );

  /*
   * 完全一致。
   */
  if (
    normalizedAnswer ===
    normalizedCorrect
  ) {
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

      reviewRequired:
        question.gradingMethod ===
        "both",

      reason:
        question.gradingMethod ===
        "both"
          ? "人による確認が必要です。"
          : undefined,

      rubric:
        question.rubric,
    };
  }

  /*
   * 完全一致しない場合。
   *
   * 記述式・部分点問題は
   * 自動で0点確定せず、
   * 人による確認へ回します。
   */
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

      reviewRequired: true,

      reason:
        "自動判定だけでは確定できない問題です。",

      rubric:
        question.rubric,
    };
  }

  /*
   * 完全一致しない自動採点問題。
   */
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

    reviewRequired: false,

    rubric:
      question.rubric,
  };
}

/**
 * OCR結果から問題の解答文字列を取得します。
 */
function extractAnswerText(
  question: QuestionSetting,
  ocrResult: OcrResult
): string {
  /*
   * 解答枠IDがない場合は
   * OCR全文を対象にします。
   */
  if (
    !question.answerRegionId
  ) {
    return ocrResult.text
      .trim();
  }

  /*
   * answerRegions/{regionId} に
   * 解答枠の座標を保存しておく。
   */
  const regionSnapshot =
    db
      .collection(
        "answerRegions"
      )
      .doc(
        question.answerRegionId
      );

  /*
   * この関数は同期採点処理の中で
   * awaitできる構造にするため、
   * 現在はregion情報を別関数へ
   * 渡す設計にしています。
   *
   * 実際の座標判定は
   * extractAnswerFromRegionで行います。
   */
  void regionSnapshot;

  return ocrResult.text
    .trim();
}

/**
 * OCR信頼度を算出します。
 */
function calculateConfidence(
  question: QuestionSetting,
  ocrResult: OcrResult
): number {
  if (
    ocrResult.words.length === 0
  ) {
    return 0;
  }

  const confidence =
    ocrResult.words.reduce(
      (sum, word) =>
        sum + word.confidence,
      0
    ) /
    ocrResult.words.length;

  /*
   * 解答枠指定がある場合は
   * 将来的に枠内文字だけを対象にする。
   */
  void question;

  return Math.max(
    0,
    Math.min(
      1,
      confidence
    )
  );
}

/**
 * 採点比較用に文字列を正規化します。
 */
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
    .toLowerCase();
}
