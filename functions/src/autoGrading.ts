import {
  getFirestore,
} from "firebase-admin/firestore";

import {
  processAnswerRegions,
  type OcrRegionResult,
} from "./ocr";

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

  answerRegionId?: string;

  requireHumanReview?: boolean;

  /*
   * 数値解答で許容する誤差。
   * 例：
   * 正解 3.14
   * tolerance 0.01
   */
  numericTolerance?: number;

  /*
   * 記号・選択肢の表記ゆれを
   * 同一とみなすための設定。
   */
  acceptedAnswers?: string[];
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

  confidence: number;

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

/* =========================================================
   1答案の自動採点
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

  /*
   * 問題別の解答枠OCR。
   */
  const regionResults =
    await processAnswerRegions(
      await getAnswerImage(
        input.answerId
      ),
      input.testId,
      input.subjectId
    );

  const results: QuestionGradingResult[] =
    [];

  for (
    const question of
      questions
  ) {
    const region =
      findRegionForQuestion(
        question,
        regionResults
      );

    const result =
      gradeQuestion(
        question,
        region,
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

/* =========================================================
   採点設定取得
   ========================================================= */

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
      .get();

  return snapshot.docs
    .map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
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
   答案画像取得
   ========================================================= */

async function getAnswerImage(
  answerId: string
): Promise<Buffer> {
  const answerSnapshot =
    await db
      .collection("answers")
      .doc(answerId)
      .get();

  if (
    !answerSnapshot.exists
  ) {
    throw new Error(
      `答案が存在しません: ${answerId}`
    );
  }

  const answer =
    answerSnapshot.data();

  const filePath =
    answer?.filePath;

  if (
    typeof filePath !==
    "string" ||
    !filePath
  ) {
    throw new Error(
      "答案ファイルパスがありません。"
    );
  }

  const {
    getStorage,
  } = await import(
    "firebase-admin/storage"
  );

  const bucket =
    getStorage().bucket();

  const file =
    bucket.file(filePath);

  const [exists] =
    await file.exists();

  if (!exists) {
    throw new Error(
      `答案画像がStorageに存在しません: ${filePath}`
    );
  }

  const [buffer] =
    await file.download();

  return buffer;
}

/* =========================================================
   問題とOCR枠の紐付け
   ========================================================= */

function findRegionForQuestion(
  question: QuestionSetting,
  regions: OcrRegionResult[]
): OcrRegionResult | null {
  /*
   * answerRegionIdが設定されている場合。
   */
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

  /*
   * questionIdで紐付け。
   */
  return (
    regions.find(
      (region) =>
        region.questionId ===
        question.id
    ) ?? null
  );
}

/* =========================================================
   1問の採点
   ========================================================= */

function gradeQuestion(
  question: QuestionSetting,
  region: OcrRegionResult | null,
  fullOcr: OcrResult
): QuestionGradingResult {
  /*
   * OCR対象を決定。
   */
  const answerText =
    region?.text?.trim() ||
    "";

  const confidence =
    region
      ? region.confidence
      : fullOcr.confidence;

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
   * 解答枠そのものが存在しない。
   */
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

      reviewRequired: true,

      reason:
        "問題に対応する解答枠が見つかりません。",

      rubric:
        question.rubric,
    };
  }

  /*
   * OCRできなかった。
   */
  if (
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

      answerText: "",

      confidence,

      reviewRequired: true,

      reason:
        "解答をOCRできませんでした。",

      rubric:
        question.rubric,
    };
  }

  /*
   * OCR信頼度が低い。
   */
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

      reviewRequired: true,

      reason:
        "OCR信頼度が低いため要確認です。",

      rubric:
        question.rubric,
    };
  }

  /*
   * 正解判定。
   */
  const isCorrect =
    isAnswerCorrect(
      answerText,
      question
    );

  if (isCorrect) {
    /*
     * bothの場合は、
     * 正解でも人による確認を残す。
     */
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

  /*
   * 自動採点できない記述式などは
   * ×確定せず、人確認へ。
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
        "自動判定だけでは採点を確定できません。",

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

/* =========================================================
   正解判定
   ========================================================= */

function isAnswerCorrect(
  answer: string,
  question: QuestionSetting
): boolean {
  const normalizedAnswer =
    normalizeAnswer(
      answer
    );

  const accepted = [
    question.correctAnswer,

    ...(question.acceptedAnswers ??
      []),
  ];

  /*
   * 通常の完全一致。
   */
  for (
    const expected of accepted
  ) {
    if (
      normalizeAnswer(
        expected
      ) ===
      normalizedAnswer
    ) {
      return true;
    }
  }

  /*
   * 数値問題。
   */
  if (
    question.numericTolerance !==
      undefined
  ) {
    const answerNumber =
      parseNumber(
        normalizedAnswer
      );

    const correctNumber =
      parseNumber(
        normalizeAnswer(
          question.correctAnswer
        )
      );

    if (
      answerNumber !== null &&
      correctNumber !== null
    ) {
      return (
        Math.abs(
          answerNumber -
            correctNumber
        ) <=
        question.numericTolerance
      );
    }
  }

  return false;
}

/* =========================================================
   解答文字列正規化
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
   数値変換
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
   問題番号ソート
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
    let i = 0;
    i < length;
    i++
  ) {
    const aNumber =
      Number(
        aParts[i] ?? 0
      );

    const bNumber =
      Number(
        bParts[i] ?? 0
      );

    if (
      aNumber !==
      bNumber
    ) {
      return (
        aNumber -
        bNumber
      );
    }
  }

  return a.localeCompare(
    b,
    "ja"
  );
}
