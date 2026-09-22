"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import {
  db,
} from "@/lib/firebase";

import {
  createAnswerSignedUrl,
  createAnswerStoragePath,
  deleteAnswerImage,
  uploadAnswerImage,
} from "@/lib/supabase";

import type {
  Answer,
  AnswerStatus,
  FirestoreUser,
} from "@/lib/types";

import {
  canAccessSchool,
  canAccessStudent,
} from "@/lib/firestore-scope";

/* =========================================================
   Types
   ========================================================= */

export type CreateAnswerInput = {
  organizationId: string;

  schoolId: string;

  testId: string;

  subjectId: string;

  studentId:
    | string
    | null;

  studentNumber:
    | string
    | null;

  file: File;
};

export type UpdateAnswerStatusInput = {
  answerId: string;

  status: AnswerStatus;

  errorMessage?: string;
};

export type AnswerWithUrl =
  Answer & {
    signedUrl:
      | string
      | null;
  };

/* =========================================================
   Create answer
   ========================================================= */

export async function createAnswer(
  input: CreateAnswerInput
): Promise<Answer> {
  validateCreateAnswerInput(
    input
  );

  /*
   * 先にFirestoreの答案IDを作る。
   */
  const answerReference =
    doc(
      collection(
        db,
        "answers"
      )
    );

  const answerId =
    answerReference.id;

  /*
   * 拡張子を取得。
   */
  const extension =
    getFileExtension(
      input.file.name
    );

  /*
   * Supabase Storage上の保存先。
   *
   * organizationId
   * / testId
   * / subjectId
   * / answerId.ext
   */
  const storagePath =
    createAnswerStoragePath(
      input.organizationId,
      input.testId,
      input.subjectId,
      answerId,
      extension
    );

  /*
   * 画像本体はSupabaseへ。
   */
  await uploadAnswerImage(
    input.file,
    storagePath
  );

  /*
   * Firestoreにはメタデータだけ保存。
   */
  const answerData = {
    organizationId:
      input.organizationId,

    schoolId:
      input.schoolId,

    testId:
      input.testId,

    subjectId:
      input.subjectId,

    studentId:
      input.studentId,

    studentNumber:
      input.studentNumber,

    fileKey:
      storagePath,

    fileName:
      input.file.name,

    contentType:
      input.file.type ||
      "application/octet-stream",

    size:
      input.file.size,

    status:
      "uploaded" as AnswerStatus,

    reviewRequired:
      false,

    totalScore:
      0,

    totalMaxScore:
      0,

    qrText:
      "",

    qrConfidence:
      0,

    ocrConfidence:
      0,

    processingError:
      "",

    createdAt:
      serverTimestamp(),

    updatedAt:
      serverTimestamp(),
  };

  try {
    await updateDoc(
      answerReference,
      answerData
    );
  } catch (
    error
  ) {
    /*
     * Firestore登録に失敗した場合、
     * Storageに残った画像を削除。
     */
    try {
      await deleteAnswerImage(
        storagePath
      );
    } catch (
      cleanupError
    ) {
      console.error(
        "Answer image cleanup failed:",
        cleanupError
      );
    }

    throw error;
  }

  return {
    id:
      answerId,

    organizationId:
      input.organizationId,

    schoolId:
      input.schoolId,

    testId:
      input.testId,

    subjectId:
      input.subjectId,

    studentId:
      input.studentId,

    studentNumber:
      input.studentNumber,

    fileKey:
      storagePath,

    fileName:
      input.file.name,

    contentType:
      input.file.type ||
      "application/octet-stream",

    size:
      input.file.size,

    status:
      "uploaded",

    reviewRequired:
      false,

    totalScore:
      0,

    totalMaxScore:
      0,

    qrText:
      "",

    qrConfidence:
      0,

    ocrConfidence:
      0,

    processingError:
      "",

    createdAt:
      undefined,

    updatedAt:
      undefined,
  };
}

/* =========================================================
   Get answer
   ========================================================= */

export async function getAnswer(
  answerId: string
): Promise<Answer | null> {
  if (
    !answerId.trim()
  ) {
    return null;
  }

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
   Get answer with signed URL
   ========================================================= */

export async function getAnswerWithUrl(
  answerId: string,
  expiresIn = 3600
): Promise<
  AnswerWithUrl | null
> {
  const answer =
    await getAnswer(
      answerId
    );

  if (
    !answer
  ) {
    return null;
  }

  if (
    !answer.fileKey
  ) {
    return {
      ...answer,

      signedUrl:
        null,
    };
  }

  const signedUrl =
    await createAnswerSignedUrl(
      answer.fileKey,
      expiresIn
    );

  return {
    ...answer,

    signedUrl,
  };
}

/* =========================================================
   Verify answer access
   ========================================================= */

export async function getAnswerForUser(
  answerId: string,
  user: FirestoreUser
): Promise<Answer | null> {
  const answer =
    await getAnswer(
      answerId
    );

  if (
    !answer
  ) {
    return null;
  }

  if (
    !canAccessAnswer(
      answer,
      user
    )
  ) {
    throw new Error(
      "この答案を閲覧する権限がありません。"
    );
  }

  return answer;
}

/* =========================================================
   Signed URL for authorized user
   ========================================================= */

export async function getAnswerImageUrl(
  answerId: string,
  user: FirestoreUser,
  expiresIn = 3600
) {
  const answer =
    await getAnswerForUser(
      answerId,
      user
    );

  if (
    !answer
  ) {
    return null;
  }

  if (
    !answer.fileKey
  ) {
    return null;
  }

  return createAnswerSignedUrl(
    answer.fileKey,
    expiresIn
  );
}

/* =========================================================
   Update status
   ========================================================= */

export async function updateAnswerStatus(
  input: UpdateAnswerStatusInput
) {
  if (
    !input.answerId.trim()
  ) {
    throw new Error(
      "答案IDがありません。"
    );
  }

  const updateData: Record<
    string,
    unknown
  > = {
    status:
      input.status,

    updatedAt:
      serverTimestamp(),
  };

  if (
    input.errorMessage !==
    undefined
  ) {
    updateData.processingError =
      input.errorMessage;
  }

  await updateDoc(
    doc(
      db,
      "answers",
      input.answerId
    ),
    updateData
  );
}

/* =========================================================
   Update QR result
   ========================================================= */

export async function updateAnswerQR(
  answerId: string,
  qrText: string,
  confidence: number
) {
  if (
    !answerId.trim()
  ) {
    throw new Error(
      "答案IDがありません。"
    );
  }

  await updateDoc(
    doc(
      db,
      "answers",
      answerId
    ),
    {
      qrText:
        qrText.trim(),

      qrConfidence:
        normalizeConfidence(
          confidence
        ),

      updatedAt:
        serverTimestamp(),
    }
  );
}

/* =========================================================
   Update OCR result
   ========================================================= */

export async function updateAnswerOCR(
  answerId: string,
  confidence: number
) {
  if (
    !answerId.trim()
  ) {
    throw new Error(
      "答案IDがありません。"
    );
  }

  await updateDoc(
    doc(
      db,
      "answers",
      answerId
    ),
    {
      ocrConfidence:
        normalizeConfidence(
          confidence
        ),

      updatedAt:
        serverTimestamp(),
    }
  );
}

/* =========================================================
   Update grading summary
   ========================================================= */

export async function updateAnswerScore(
  answerId: string,
  totalScore: number,
  totalMaxScore: number,
  reviewRequired: boolean
) {
  if (
    !answerId.trim()
  ) {
    throw new Error(
      "答案IDがありません。"
    );
  }

  const score =
    normalizeScore(
      totalScore,
      totalMaxScore
    );

  await updateDoc(
    doc(
      db,
      "answers",
      answerId
    ),
    {
      totalScore:
        score,

      totalMaxScore:
        Math.max(
          0,
          totalMaxScore
        ),

      reviewRequired:
        reviewRequired ===
        true,

      status:
        reviewRequired
          ? "first_review"
          : "graded",

      updatedAt:
        serverTimestamp(),
    }
  );
}

/* =========================================================
   Mark processing
   ========================================================= */

export async function markAnswerProcessing(
  answerId: string
) {
  await updateAnswerStatus({
    answerId,

    status:
      "processing",
  });
}

/* =========================================================
   Mark graded
   ========================================================= */

export async function markAnswerGraded(
  answerId: string,
  totalScore: number,
  totalMaxScore: number,
  reviewRequired: boolean
) {
  await updateAnswerScore(
    answerId,
    totalScore,
    totalMaxScore,
    reviewRequired
  );
}

/* =========================================================
   Mark error
   ========================================================= */

export async function markAnswerError(
  answerId: string,
  message: string
) {
  await updateAnswerStatus({
    answerId,

    status:
      "error",

    errorMessage:
      message,
  });
}

/* =========================================================
   Delete answer
   ========================================================= */

export async function deleteAnswer(
  answerId: string,
  user: FirestoreUser
) {
  const answer =
    await getAnswer(
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
   * 削除権限は本部管理者のみ。
   *
   * 必要なら後で校舎管理者にも
   * 付与できる。
   */
  if (
    user.role !==
    "本部管理者"
  ) {
    throw new Error(
      "答案を削除する権限がありません。"
    );
  }

  /*
   * Storage削除。
   */
  if (
    answer.fileKey
  ) {
    await deleteAnswerImage(
      answer.fileKey
    );
  }

  /*
   * Firestore削除。
   */
  await deleteDoc(
    doc(
      db,
      "answers",
      answerId
    )
  );
}

/* =========================================================
   Access
   ========================================================= */

function canAccessAnswer(
  answer: Answer,
  user: FirestoreUser
) {
  if (
    !user.role
  ) {
    return false;
  }

  /*
   * 本部管理者
   */
  if (
    user.role ===
    "本部管理者"
  ) {
    return (
      answer.organizationId ===
      user.organizationId
    );
  }

  /*
   * 校舎管理者・講師
   */
  if (
    user.role ===
      "校舎管理者" ||
    user.role ===
      "講師"
  ) {
    return (
      answer.organizationId ===
        user.organizationId &&
      user.schoolIds.includes(
        answer.schoolId
      )
    );
  }

  /*
   * 生徒
   */
  if (
    user.role ===
    "生徒"
  ) {
    return (
      answer.organizationId ===
        user.organizationId &&
      answer.studentId ===
        user.studentId
    );
  }

  return false;
}

/* =========================================================
   Normalize
   ========================================================= */

function normalizeAnswer(
  id: string,
  data: Record<
    string,
    unknown
  >
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
      normalizeStatus(
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
   Validation
   ========================================================= */

function validateCreateAnswerInput(
  input: CreateAnswerInput
) {
  if (
    !input.organizationId
  ) {
    throw new Error(
      "組織IDがありません。"
    );
  }

  if (
    !input.schoolId
  ) {
    throw new Error(
      "校舎IDがありません。"
    );
  }

  if (
    !input.testId
  ) {
    throw new Error(
      "テストIDがありません。"
    );
  }

  if (
    !input.subjectId
  ) {
    throw new Error(
      "教科IDがありません。"
    );
  }

  if (
    !input.file
  ) {
    throw new Error(
      "答案ファイルがありません。"
    );
  }

  if (
    input.file.size <=
    0
  ) {
    throw new Error(
      "空のファイルは登録できません。"
    );
  }

  /*
   * 答案画像として許可。
   */
  const allowedTypes =
    new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ]);

  if (
    !allowedTypes.has(
      input.file.type
    )
  ) {
    throw new Error(
      "JPEG、PNG、WebP、PDFの答案ファイルのみ登録できます。"
    );
  }

  /*
   * 20MBまで。
   */
  const maxSize =
    20 *
    1024 *
    1024;

  if (
    input.file.size >
    maxSize
  ) {
    throw new Error(
      "答案ファイルは20MB以下にしてください。"
    );
  }

  /*
   * 生徒番号が入力されている場合は
   * 6桁固定。
   */
  if (
    input.studentNumber &&
    !/^\d{6}$/.test(
      input.studentNumber
    )
  ) {
    throw new Error(
      "生徒番号は6桁で指定してください。"
    );
  }
}

/* =========================================================
   Extension
   ========================================================= */

function getFileExtension(
  fileName: string
) {
  const lastDot =
    fileName.lastIndexOf(
      "."
    );

  if (
    lastDot ===
    -1
  ) {
    return "bin";
  }

  const extension =
    fileName.slice(
      lastDot + 1
    );

  const cleaned =
    extension
      .replace(
        /[^a-zA-Z0-9]/g,
        ""
      )
      .toLowerCase();

  return cleaned ||
    "bin";
}

/* =========================================================
   Status
   ========================================================= */

function normalizeStatus(
  value: unknown
): AnswerStatus {
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

/* =========================================================
   Confidence
   ========================================================= */

function normalizeConfidence(
  value: number
) {
  const number =
    safeNumber(
      value
    );

  return Math.min(
    1,
    Math.max(
      0,
      number
    )
  );
}

/* =========================================================
   Score
   ========================================================= */

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
      value ?? 0
    );

  return Number.isFinite(
    number
  )
    ? number
    : 0;
}
