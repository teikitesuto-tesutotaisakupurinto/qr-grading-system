import {
  createClient,
} from "https://esm.sh/@supabase/supabase-js@2.57.0";

/* =========================================================
   Environment
   ========================================================= */

const SUPABASE_URL =
  Deno.env.get(
    "SUPABASE_URL"
  ) ?? "";

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get(
    "SUPABASE_SERVICE_ROLE_KEY"
  ) ?? "";

const FIREBASE_PROJECT_ID =
  Deno.env.get(
    "FIREBASE_PROJECT_ID"
  ) ?? "";

const FIREBASE_CLIENT_EMAIL =
  Deno.env.get(
    "FIREBASE_CLIENT_EMAIL"
  ) ?? "";

const FIREBASE_PRIVATE_KEY =
  Deno.env.get(
    "FIREBASE_PRIVATE_KEY"
  ) ?? "";

/* =========================================================
   Supabase
   ========================================================= */

const supabase =
  createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession:
          false,

        autoRefreshToken:
          false,
      },
    }
  );

/* =========================================================
   Types
   ========================================================= */

type GradingMethod =
  | "選択式"
  | "数値"
  | "短答"
  | "記述"
  | "手動";

type GradingSettings = {
  automaticGrading: boolean;

  aiGrading: boolean;

  firstReviewRequired: boolean;

  secondReviewRequired: boolean;

  allowManualCorrection: boolean;
};

type QuestionConfig = {
  questionId: string;

  questionNumber: number;

  points: number;

  method: GradingMethod;

  answers: string[];

  caseSensitive?: boolean;

  partialCredit?: boolean;

  aiCriteria?: string;
};

type GradingConfig = {
  questions: QuestionConfig[];

  totalScore: number;

  settings: GradingSettings;
};

type AnswerDocument = {
  organizationId: string;

  testId: string;

  testCode?: string;

  studentId?: string | null;

  studentNumber?: string | null;

  schoolId?: string;

  status?: string;

  qrStatus?: string;

  ocrStatus?: string;

  gradingStatus?: string;

  firstReviewStatus?: string;

  secondReviewStatus?: string;

  finalized?: boolean;
};

type OCRBlock = {
  text: string;

  confidence:
    | number
    | null;

  boundingBox:
    | BoundingBox
    | null;

  page:
    | number
    | null;
};

type BoundingBox = {
  x: number;

  y: number;

  width: number;

  height: number;
};

type OCRResult = {
  answerId: string;

  fullText: string;

  blocks: OCRBlock[];
};

/* =========================================================
   CORS
   ========================================================= */

const corsHeaders = {
  "Access-Control-Allow-Origin":
    "*",

  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",

  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

/* =========================================================
   Response
   ========================================================= */

function json(
  body: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(
      body
    ),
    {
      status,

      headers: {
        ...corsHeaders,

        "Content-Type":
          "application/json",
      },
    }
  );
}

/* =========================================================
   Main
   ========================================================= */

Deno.serve(
  async (
    request
  ) => {
    if (
      request.method ===
      "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          headers:
            corsHeaders,
        }
      );
    }

    if (
      request.method !==
      "POST"
    ) {
      return json(
        {
          ok: false,

          message:
            "POSTで実行してください。",
        },
        405
      );
    }

    try {
      /*
       * -----------------------------------------------------
       * Environment check
       * -----------------------------------------------------
       */

      if (
        !SUPABASE_URL ||
        !SUPABASE_SERVICE_ROLE_KEY
      ) {
        console.error(
          "Supabase configuration is missing."
        );

        return json(
          {
            ok: false,

            message:
              "サーバー設定を確認してください。",
          },
          500
        );
      }

      if (
        !FIREBASE_PROJECT_ID ||
        !FIREBASE_CLIENT_EMAIL ||
        !FIREBASE_PRIVATE_KEY
      ) {
        console.error(
          "Firebase configuration is missing."
        );

        return json(
          {
            ok: false,

            message:
              "Firebaseサーバー設定を確認してください。",
          },
          500
        );
      }

      /*
       * -----------------------------------------------------
       * Request
       * -----------------------------------------------------
       */

      const body =
        await request.json();

      const answerId =
        typeof body.answerId ===
        "string"
          ? body.answerId
          : "";

      if (
        !answerId
      ) {
        return json(
          {
            ok: false,

            message:
              "答案IDが指定されていません。",
          },
          400
        );
      }

      /*
       * -----------------------------------------------------
       * Answer
       * -----------------------------------------------------
       */

      const answer =
        await getAnswer(
          answerId
        );

      if (
        !answer
      ) {
        return json(
          {
            ok: false,

            message:
              "答案情報が見つかりません。",
          },
          404
        );
      }

      /*
       * -----------------------------------------------------
       * OCR確認
       * -----------------------------------------------------
       */

      if (
        answer.ocrStatus !==
        "完了"
      ) {
        return json(
          {
            ok: false,

            answerId,

            status:
              "OCR未完了",

            message:
              "OCR処理が完了していません。",
          },
          409
        );
      }

      /*
       * -----------------------------------------------------
       * 既に確定済み
       * -----------------------------------------------------
       */

      if (
        answer.finalized ===
        true
      ) {
        return json({
          ok: true,

          answerId,

          status:
            "確定済み",
        });
      }

      /*
       * -----------------------------------------------------
       * 採点開始
       * -----------------------------------------------------
       */

      await updateAnswer(
        answerId,
        {
          status:
            "採点中",

          gradingStatus:
            "採点中",

          updatedAt:
            new Date().toISOString(),
        }
      );

      /*
       * -----------------------------------------------------
       * Test
       * -----------------------------------------------------
       */

      const test =
        await getTest(
          answer.testId
        );

      if (
        !test
      ) {
        await markGradingError(
          answerId,
          "テスト情報が見つかりません。"
        );

        return json(
          {
            ok: false,

            answerId,

            status:
              "採点失敗",

            message:
              "テスト情報が見つかりません。",
          },
          404
        );
      }

      /*
       * -----------------------------------------------------
       * Grading Config
       * -----------------------------------------------------
       */

      const gradingConfig =
        normalizeGradingConfig(
          test.gradingConfig,
          test.totalScore
        );

      /*
       * 問題別の採点設定がなければ、
       * 勝手に点数を付けない。
       */

      if (
        gradingConfig.questions
          .length ===
        0
      ) {
        await markGradingError(
          answerId,
          "このテストには採点設定が登録されていません。"
        );

        return json(
          {
            ok: false,

            answerId,

            status:
              "採点設定不足",

            message:
              "採点設定が登録されていません。",
          },
          422
        );
      }

      /*
       * -----------------------------------------------------
       * OCR Result
       * -----------------------------------------------------
       */

      const ocr =
        await getOCRResult(
          answerId
        );

      if (
        !ocr
      ) {
        await markGradingError(
          answerId,
          "OCR結果が見つかりません。"
        );

        return json(
          {
            ok: false,

            answerId,

            status:
              "採点失敗",

            message:
              "OCR結果が見つかりません。",
          },
          422
        );
      }

      /*
       * -----------------------------------------------------
       * 問題ごとに採点
       * -----------------------------------------------------
       */

      const results: GradingResult[] =
        [];

      let totalScore =
        0;

      let manualReviewRequired =
        false;

      for (
        const question of
          gradingConfig.questions
      ) {
        const answerText =
          extractQuestionAnswer(
            ocr,
            question
          );

        const result =
          gradeQuestion(
            question,
            answerText,
            gradingConfig.settings
          );

        results.push(
          result
        );

        totalScore +=
          result.score;

        if (
          result.reviewRequired
        ) {
          manualReviewRequired =
            true;
        }
      }

      /*
       * -----------------------------------------------------
       * 成績結果保存
       * -----------------------------------------------------
       */

      const reviewStatus =
        manualReviewRequired ||
        gradingConfig.settings
          .firstReviewRequired
          ? "一次確認待ち"
          : gradingConfig.settings
              .secondReviewRequired
            ? "二次確認待ち"
            : "確定可能";

      await saveGradingResult(
        answerId,
        {
          answerId,

          testId:
            answer.testId,

          studentId:
            answer.studentId ??
            null,

          studentNumber:
            answer.studentNumber ??
            null,

          totalScore,

          maxScore:
            gradingConfig.totalScore,

          percentage:
            gradingConfig.totalScore >
            0
              ? (
                  totalScore /
                  gradingConfig.totalScore
                ) *
                100
              : 0,

          reviewStatus,

          results,

          createdAt:
            new Date().toISOString(),

          updatedAt:
            new Date().toISOString(),
        }
      );

      /*
       * -----------------------------------------------------
       * Answer status
       * -----------------------------------------------------
       */

      await updateAnswer(
        answerId,
        {
          status:
            reviewStatus ===
            "一次確認待ち"
              ? "一次確認待ち"
              : reviewStatus ===
                  "二次確認待ち"
                ? "二次確認待ち"
                : "採点結果確認待ち",

          gradingStatus:
            "採点済み",

          firstReviewStatus:
            gradingConfig.settings
              .firstReviewRequired
              ? "未確認"
              : "不要",

          secondReviewStatus:
            gradingConfig.settings
              .secondReviewRequired
              ? "未確認"
              : "不要",

          updatedAt:
            new Date().toISOString(),
        }
      );

      return json({
        ok: true,

        answerId,

        status:
          reviewStatus,

        totalScore,

        maxScore:
          gradingConfig.totalScore,

        questionCount:
          results.length,

        reviewRequired:
          manualReviewRequired,
      });
    } catch (
      error
    ) {
      console.error(
        "process-grading error:",
        error
      );

      return json(
        {
          ok: false,

          message:
            "自動採点処理に失敗しました。",
        },
        500
      );
    }
  }
);

/* =========================================================
   Question grading
   ========================================================= */

type GradingResult = {
  questionId: string;

  questionNumber: number;

  answer:
    | string
    | null;

  correctAnswers: string[];

  points: number;

  score: number;

  method: GradingMethod;

  result:
    | "正解"
    | "不正解"
    | "部分点"
    | "判定不能"
    | "手動採点";

  confidence:
    | number
    | null;

  reviewRequired: boolean;

  reason?: string;
};

function gradeQuestion(
  question: QuestionConfig,
  answerText:
    | string
    | null,
  settings: GradingSettings
): GradingResult {
  /*
   * 手動採点
   */

  if (
    question.method ===
    "手動"
  ) {
    return {
      questionId:
        question.questionId,

      questionNumber:
        question.questionNumber,

      answer:
        answerText,

      correctAnswers:
        question.answers,

      points:
        question.points,

      score:
        0,

      method:
        question.method,

      result:
        "手動採点",

      confidence:
        null,

      reviewRequired:
        true,

      reason:
        "手動採点が設定されています。",
    };
  }

  /*
   * 記述
   */

  if (
    question.method ===
    "記述"
  ) {
    /*
     * AI採点が有効でない場合、
     * 勝手に正誤判定しない。
     */

    if (
      !settings.aiGrading
    ) {
      return {
        questionId:
          question.questionId,

        questionNumber:
          question.questionNumber,

        answer:
          answerText,

        correctAnswers:
          question.answers,

        points:
          question.points,

        score:
          0,

        method:
          question.method,

        result:
          "判定不能",

        confidence:
          null,

        reviewRequired:
          true,

        reason:
          "記述式のAI採点が無効です。",
      };
    }

    /*
     * AI採点サービスはここで呼び出す。
     *
     * AI採点サービスが未設定の場合は
     * 人間確認へ回す。
     */

    return {
      questionId:
        question.questionId,

      questionNumber:
        question.questionNumber,

      answer:
        answerText,

      correctAnswers:
        question.answers,

      points:
        question.points,

      score:
        0,

      method:
        question.method,

      result:
        "判定不能",

      confidence:
        null,

      reviewRequired:
        true,

      reason:
        "記述答案はAI採点結果の確認が必要です。",
    };
  }

  /*
   * 回答なし
   */

  if (
    !answerText ||
    !answerText.trim()
  ) {
    return {
      questionId:
        question.questionId,

      questionNumber:
        question.questionNumber,

      answer:
        null,

      correctAnswers:
        question.answers,

      points:
        question.points,

      score:
        0,

      method:
        question.method,

      result:
        "不正解",

      confidence:
        1,

      reviewRequired:
        false,
    };
  }

  /*
   * 正答がない場合
   */

  if (
    question.answers.length ===
    0
  ) {
    return {
      questionId:
        question.questionId,

      questionNumber:
        question.questionNumber,

      answer:
        answerText,

      correctAnswers:
        [],

      points:
        question.points,

      score:
        0,

      method:
        question.method,

      result:
        "判定不能",

      confidence:
        null,

      reviewRequired:
        true,

      reason:
        "正答が登録されていません。",
    };
  }

  /*
   * 正規化
   */

  const normalizedAnswer =
    normalizeAnswer(
      answerText,
      question.caseSensitive ??
        false
    );

  const normalizedCorrect =
    question.answers.map(
      (
        answer
      ) =>
        normalizeAnswer(
          answer,
          question.caseSensitive ??
            false
        )
    );

  /*
   * 完全一致
   */

  if (
    normalizedCorrect.includes(
      normalizedAnswer
    )
  ) {
    return {
      questionId:
        question.questionId,

      questionNumber:
        question.questionNumber,

      answer:
        answerText,

      correctAnswers:
        question.answers,

      points:
        question.points,

      score:
        question.points,

      method:
        question.method,

      result:
        "正解",

      confidence:
        1,

      reviewRequired:
        settings.firstReviewRequired,
    };
  }

  /*
   * 数値
   *
   * OCRで余分な文字が入った場合を
   * 正規化する。
   */

  if (
    question.method ===
    "数値"
  ) {
    const answerNumber =
      parseNumericAnswer(
        normalizedAnswer
      );

    const correctNumbers =
      normalizedCorrect
        .map(
          (
            value
          ) =>
            parseNumericAnswer(
              value
            )
        )
        .filter(
          (
            value
          ): value is number =>
            value !==
            null
        );

    if (
      answerNumber !==
        null &&
      correctNumbers.some(
        (
          correct
        ) =>
          Math.abs(
            correct -
              answerNumber
          ) <
          0.000001
      )
    ) {
      return {
        questionId:
          question.questionId,

        questionNumber:
          question.questionNumber,

        answer:
          answerText,

        correctAnswers:
          question.answers,

        points:
          question.points,

        score:
          question.points,

        method:
          question.method,

        result:
          "正解",

        confidence:
          0.98,

        reviewRequired:
          settings.firstReviewRequired,
      };
    }
  }

  /*
   * 部分点
   */

  if (
    question.partialCredit
  ) {
    const partial =
      calculatePartialCredit(
        normalizedAnswer,
        normalizedCorrect,
        question.points
      );

    if (
      partial > 0
    ) {
      return {
        questionId:
          question.questionId,

        questionNumber:
          question.questionNumber,

        answer:
          answerText,

        correctAnswers:
          question.answers,

        points:
          question.points,

        score:
          partial,

        method:
          question.method,

        result:
          "部分点",

        confidence:
          0.8,

        reviewRequired:
          true,
      };
    }
  }

  /*
   * 不正解
   */

  return {
    questionId:
      question.questionId,

    questionNumber:
      question.questionNumber,

    answer:
      answerText,

    correctAnswers:
      question.answers,

    points:
      question.points,

    score:
      0,

    method:
      question.method,

    result:
      "不正解",

    confidence:
      0.95,

    reviewRequired:
      settings.firstReviewRequired,
  };
}

/* =========================================================
   OCR answer extraction
   ========================================================= */

function extractQuestionAnswer(
  ocr: OCRResult,
  question: QuestionConfig
) {
  /*
   * 現段階ではOCRブロックの
   * 問題番号情報を利用する。
   *
   * 画像上の問題領域との対応付けは、
   * 後で答案レイアウト解析から
   * questionIdを付与する。
   */

  const marker =
    `${question.questionNumber}`;

  const matchingBlocks =
    ocr.blocks.filter(
      (
        block
      ) =>
        block.text
          .trim()
          .startsWith(
            marker
          )
    );

  if (
    matchingBlocks.length ===
    0
  ) {
    return null;
  }

  /*
   * 現段階では問題番号の後ろの文字を
   * 回答候補として取得。
   */

  const text =
    matchingBlocks
      .map(
        (
          block
        ) =>
          block.text
      )
      .join(" ")
      .replace(
        new RegExp(
          `^${question.questionNumber}[.．、:：]?`,
          "g"
        ),
        ""
      )
      .trim();

  return text ||
    null;
}

/* =========================================================
   Normalize answer
   ========================================================= */

function normalizeAnswer(
  value: string,
  caseSensitive: boolean
) {
  let result =
    value
      .normalize(
        "NFKC"
      )
      .trim()
      .replace(
        /\s+/g,
        ""
      );

  if (
    !caseSensitive
  ) {
    result =
      result.toLowerCase();
  }

  return result;
}

/* =========================================================
   Numeric answer
   ========================================================= */

function parseNumericAnswer(
  value: string
) {
  const normalized =
    value
      .replace(
        /,/g,
        ""
      )
      .replace(
        /−/g,
        "-"
      );

  const match =
    normalized.match(
      /[-+]?\d+(?:\.\d+)?/
    );

  if (
    !match
  ) {
    return null;
  }

  const number =
    Number(
      match[0]
    );

  return Number.isFinite(
    number
  )
    ? number
    : null;
}

/* =========================================================
   Partial credit
   ========================================================= */

function calculatePartialCredit(
  answer: string,
  correctAnswers: string[],
  points: number
) {
  if (
    !answer ||
    correctAnswers.length ===
      0
  ) {
    return 0;
  }

  /*
   * 完全一致は既に処理済み。
   *
   * 正答に含まれる語句との
   * 単純な一致率を計算。
   *
   * 記述式ではこの値を最終点として
   * 確定せず、必ず確認へ回す。
   */

  const correct =
    correctAnswers[0];

  const tokens =
    correct
      .normalize(
        "NFKC"
      )
      .split(
        /[\s、，,。．.]+/
      )
      .filter(
        Boolean
      );

  if (
    tokens.length ===
    0
  ) {
    return 0;
  }

  const matched =
    tokens.filter(
      (
        token
      ) =>
        answer.includes(
          token
        )
    ).length;

  const ratio =
    matched /
    tokens.length;

  if (
    ratio <
    0.5
  ) {
    return 0;
  }

  return Math.floor(
    points *
      ratio *
      10
  ) /
    10;
}

/* =========================================================
   Grading config
   ========================================================= */

function normalizeGradingConfig(
  value: any,
  totalScore: number
): GradingConfig {
  const settings =
    normalizeGradingSettings(
      value?.settings
    );

  const rawQuestions =
    Array.isArray(
      value?.questions
    )
      ? value.questions
      : [];

  const questions =
    rawQuestions
      .map(
        (
          question: any,
          index: number
        ): QuestionConfig => ({
          questionId:
            typeof question.questionId ===
            "string"
              ? question.questionId
              : `q-${index + 1}`,

          questionNumber:
            typeof question.questionNumber ===
            "number"
              ? question.questionNumber
              : index + 1,

          points:
            typeof question.points ===
            "number"
              ? Math.max(
                  0,
                  question.points
                )
              : 0,

          method:
            isGradingMethod(
              question.method
            )
              ? question.method
              : "手動",

          answers:
            Array.isArray(
              question.answers
            )
              ? question.answers.filter(
                  (
                    answer: unknown
                  ): answer is string =>
                    typeof answer ===
                    "string"
                )
              : [],

          caseSensitive:
            question.caseSensitive ===
            true,

          partialCredit:
            question.partialCredit ===
            true,

          aiCriteria:
            typeof question.aiCriteria ===
            "string"
              ? question.aiCriteria
              : undefined,
        })
      );

  return {
    questions,

    totalScore:
      typeof value?.totalScore ===
      "number"
        ? value.totalScore
        : totalScore,

    settings,
  };
}

function normalizeGradingSettings(
  value: any
): GradingSettings {
  return {
    automaticGrading:
      value?.automaticGrading !==
      false,

    aiGrading:
      value?.aiGrading ===
      true,

    firstReviewRequired:
      value?.firstReviewRequired !==
      false,

    secondReviewRequired:
      value?.secondReviewRequired !==
      false,

    allowManualCorrection:
      value?.allowManualCorrection !==
      false,
  };
}

/* =========================================================
   Firebase / Firestore
   ========================================================= */

async function getFirestoreAccessToken() {
  const now =
    Math.floor(
      Date.now() /
        1000
    );

  const header =
    base64UrlEncode(
      JSON.stringify({
        alg:
          "RS256",

        typ:
          "JWT",
      })
    );

  const payload =
    base64UrlEncode(
      JSON.stringify({
        iss:
          FIREBASE_CLIENT_EMAIL,

        scope:
          "https://www.googleapis.com/auth/datastore",

        aud:
          "https://oauth2.googleapis.com/token",

        iat:
          now,

        exp:
          now + 3600,
      })
    );

  const input =
    `${header}.${payload}`;

  const key =
    await importPrivateKey(
      FIREBASE_PRIVATE_KEY
    );

  const signature =
    await crypto.subtle.sign(
      {
        name:
          "RSASSA-PKCS1-v1_5",
      },
      key,
      new TextEncoder().encode(
        input
      )
    );

  const jwt =
    `${input}.${base64UrlBytes(
      new Uint8Array(
        signature
      )
    )}`;

  const response =
    await fetch(
      "https://oauth2.googleapis.com/token",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          new URLSearchParams({
            grant_type:
              "urn:ietf:params:oauth:grant-type:jwt-bearer",

            assertion:
              jwt,
          }),
      }
    );

  if (
    !response.ok
  ) {
    console.error(
      await response.text()
    );

    throw new Error(
      "Firestore認証に失敗しました。"
    );
  }

  const data =
    await response.json();

  return data.access_token as string;
}

async function firestoreGet(
  path: string
) {
  const token =
    await getFirestoreAccessToken();

  const response =
    await fetch(
      `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`,
      {
        headers: {
          Authorization:
            `Bearer ${token}`,
        },
      }
    );

  if (
    response.status ===
    404
  ) {
    return null;
  }

  if (
    !response.ok
  ) {
    console.error(
      await response.text()
    );

    throw new Error(
      "Firestoreからデータを取得できませんでした。"
    );
  }

  return response.json();
}

async function firestorePatch(
  path: string,
  fields: Record<
    string,
    unknown
  >
) {
  const token =
    await getFirestoreAccessToken();

  const response =
    await fetch(
      `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`,
      {
        method:
          "PATCH",

        headers: {
          Authorization:
            `Bearer ${token}`,

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            fields:
              objectToFirestoreFields(
                fields
              ),
          }),
      }
    );

  if (
    !response.ok
  ) {
    console.error(
      await response.text()
    );

    throw new Error(
      "Firestoreの更新に失敗しました。"
    );
  }

  return response.json();
}

/* =========================================================
   Test
   ========================================================= */

async function getTest(
  testId: string
) {
  const document =
    await firestoreGet(
      `tests/${testId}`
    );

  if (
    !document?.fields
  ) {
    return null;
  }

  return firestoreFieldsToObject(
    document.fields
  ) as any;
}

/* =========================================================
   Answer
   ========================================================= */

async function getAnswer(
  answerId: string
): Promise<AnswerDocument | null> {
  const document =
    await firestoreGet(
      `answers/${answerId}`
    );

  if (
    !document?.fields
  ) {
    return null;
  }

  return firestoreFieldsToObject(
    document.fields
  ) as AnswerDocument;
}

async function updateAnswer(
  answerId: string,
  fields: Record<
    string,
    unknown
  >
) {
  await firestorePatch(
    `answers/${answerId}`,
    fields
  );
}

async function markGradingError(
  answerId: string,
  message: string
) {
  await updateAnswer(
    answerId,
    {
      status:
        "採点失敗",

      gradingStatus:
        "失敗",

      gradingError:
        message,

      updatedAt:
        new Date().toISOString(),
    }
  );
}

/* =========================================================
   OCR
   ========================================================= */

async function getOCRResult(
  answerId: string
): Promise<OCRResult | null> {
  const document =
    await firestoreGet(
      `answerOcrResults/${answerId}`
    );

  if (
    !document?.fields
  ) {
    return null;
  }

  const data =
    firestoreFieldsToObject(
      document.fields
    ) as any;

  const blocks =
    Array.isArray(
      data.blocks
    )
      ? data.blocks
      : [];

  return {
    answerId,

    fullText:
      typeof data.fullText ===
      "string"
        ? data.fullText
        : "",

    blocks:
      blocks,
  };
}

/* =========================================================
   Grading result
   ========================================================= */

async function saveGradingResult(
  answerId: string,
  result: Record<
    string,
    unknown
  >
) {
  await firestorePatch(
    `gradingResults/${answerId}`,
    result
  );

  /*
   * 問題別結果も保存。
   */

  const results =
    Array.isArray(
      result.results
    )
      ? result.results
      : [];

  for (
    let index = 0;
    index < results.length;
    index++
  ) {
    await firestorePatch(
      `gradingResults/${answerId}/questions/question-${index + 1}`,
      results[index] as Record<
        string,
        unknown
      >
    );
  }
}

/* =========================================================
   Validation
   ========================================================= */

function isGradingMethod(
  value: unknown
): value is GradingMethod {
  return (
    value ===
      "選択式" ||
    value ===
      "数値" ||
    value ===
      "短答" ||
    value ===
      "記述" ||
    value ===
      "手動"
  );
}

/* =========================================================
   Firestore conversion
   ========================================================= */

function firestoreFieldsToObject(
  fields: Record<
    string,
    any
  >
) {
  const result:
    Record<
      string,
      unknown
    > = {};

  for (
    const [
      key,
      value,
    ] of Object.entries(
      fields
    )
  ) {
    result[key] =
      firestoreValueToJS(
        value
      );
  }

  return result;
}

function firestoreValueToJS(
  value: any
): unknown {
  if (
    value.stringValue !==
    undefined
  ) {
    return value.stringValue;
  }

  if (
    value.integerValue !==
    undefined
  ) {
    return Number(
      value.integerValue
    );
  }

  if (
    value.doubleValue !==
    undefined
  ) {
    return value.doubleValue;
  }

  if (
    value.booleanValue !==
    undefined
  ) {
    return value.booleanValue;
  }

  if (
    value.timestampValue !==
    undefined
  ) {
    return value.timestampValue;
  }

  if (
    value.nullValue !==
    undefined
  ) {
    return null;
  }

  if (
    value.arrayValue
  ) {
    return (
      value.arrayValue.values ??
      []
    ).map(
      (
        item: any
      ) =>
        firestoreValueToJS(
          item
        )
    );
  }

  if (
    value.mapValue
  ) {
    return firestoreFieldsToObject(
      value.mapValue.fields ??
        {}
    );
  }

  return null;
}

function objectToFirestoreFields(
  data: Record<
    string,
    unknown
  >
) {
  const fields:
    Record<
      string,
      unknown
    > = {};

  for (
    const [
      key,
      value,
    ] of Object.entries(
      data
    )
  ) {
    fields[key] =
      jsToFirestoreValue(
        value
      );
  }

  return fields;
}

function jsToFirestoreValue(
  value: unknown
): Record<
  string,
  unknown
> {
  if (
    value ===
    null
  ) {
    return {
      nullValue:
        null,
    };
  }

  if (
    typeof value ===
    "string"
  ) {
    return {
      stringValue:
        value,
    };
  }

  if (
    typeof value ===
    "boolean"
  ) {
    return {
      booleanValue:
        value,
    };
  }

  if (
    typeof value ===
    "number"
  ) {
    if (
      Number.isInteger(
        value
      )
    ) {
      return {
        integerValue:
          String(
            value
          ),
      };
    }

    return {
      doubleValue:
        value,
    };
  }

  if (
    Array.isArray(
      value
    )
  ) {
    return {
      arrayValue: {
        values:
          value.map(
            (
              item
            ) =>
              jsToFirestoreValue(
                item
              )
          ),
      },
    };
  }

  if (
    typeof value ===
    "object"
  ) {
    return {
      mapValue: {
        fields:
          objectToFirestoreFields(
            value as Record<
              string,
              unknown
            >
          ),
      },
    };
  }

  return {
    nullValue:
      null,
  };
}

/* =========================================================
   Base64
   ========================================================= */

function base64UrlEncode(
  value: string
) {
  return base64UrlBytes(
    new TextEncoder().encode(
      value
    )
  );
}

function base64UrlBytes(
  bytes: Uint8Array
) {
  let binary =
    "";

  for (
    const byte of bytes
  ) {
    binary += String.fromCharCode(
      byte
    );
  }

  return btoa(
    binary
  )
    .replace(
      /\+/g,
      "-"
    )
    .replace(
      /\//g,
      "_"
    )
    .replace(
      /=+$/,
      ""
    );
}

/* =========================================================
   Private key
   ========================================================= */

async function importPrivateKey(
  pem: string
) {
  const normalized =
    pem
      .replace(
        /\\n/g,
        "\n"
      )
      .replace(
        "-----BEGIN PRIVATE KEY-----",
        ""
      )
      .replace(
        "-----END PRIVATE KEY-----",
        ""
      )
      .replace(
        /\s/g,
        ""
      );

  const binary =
    atob(
      normalized
    );

  const bytes =
    new Uint8Array(
      binary.length
    );

  for (
    let i = 0;
    i < binary.length;
    i++
  ) {
    bytes[i] =
      binary.charCodeAt(
        i
      );
  }

  return crypto.subtle.importKey(
    "pkcs8",
    bytes.buffer,
    {
      name:
        "RSASSA-PKCS1-v1_5",

      hash:
        "SHA-256",
    },
    false,
    [
      "sign",
    ]
  );
}
