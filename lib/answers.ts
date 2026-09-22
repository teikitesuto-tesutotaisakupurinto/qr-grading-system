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

import {
  ANSWER_BUCKET,
  createAnswerSignedUrl,
  createAnswerStoragePath,
  deleteAnswerImage,
  getSupabaseClient,
  uploadAnswerImage,
  validateAnswerFile,
} from "@/lib/supabase";

import type {
  Answer,
  AnswerStatus,
  UserRole,
} from "@/lib/types";

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

export type AnswerWithUrl =
  Answer & {
    signedUrl: string;
  };

/* =========================================================
   Create answer
   ========================================================= */

export async function createAnswer(
  input: CreateAnswerInput
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

  assertAnswerManager(
    user.role
  );

  if (
    !user.organizationId
  ) {
    throw new Error(
      "所属組織が設定されていません。"
    );
  }

  /*
   * クライアントから送られたorganizationIdを
   * そのまま信用しない。
   */
  if (
    input.organizationId !==
    user.organizationId
  ) {
    throw new Error(
      "所属組織が一致しません。"
    );
  }

  /*
   * 校舎権限。
   */
  if (
    user.role !==
    "本部管理者"
  ) {
    if (
      !user.schoolIds.includes(
        input.schoolId
      )
    ) {
      throw new Error(
        "この校舎の答案を登録する権限がありません。"
      );
    }
  }

  /*
   * ファイル検証。
   */
  const validation =
    validateAnswerFile(
      input.file
    );

  if (
    !validation.valid
  ) {
    throw new Error(
      validation.message
    );
  }

  /*
   * 答案IDを先に作成。
   *
   * Supabase Storageのパスにも
   * このIDを利用する。
   */
  const answerRef =
    doc(
      collection(
        db,
        "answers"
      )
    );

  const answerId =
    answerRef.id;

  const extension =
    getFileExtension(
      input.file
    );

  const storagePath =
    createAnswerStoragePath(
      input.organizationId,
      input.testId,
      input.subjectId,
      answerId,
      extension
    );

  /*
   * 先にStorageへ画像を保存。
   */
  await uploadAnswerImage(
    input.file,
    storagePath
  );

  try {
    /*
     * Firestoreには画像本体を保存しない。
     */
    await setDoc(
      answerRef,
      {
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

        /*
         * Supabase Storageの
         * bucket内パス。
         */
        fileKey:
          storagePath,

        fileName:
          input.file.name,

        contentType:
          input.file.type,

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

        uploadedBy:
          user.uid,

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp(),

        processedAt:
          null,

        confirmedAt:
          null,
      }
    );
  } catch (
    error
  ) {
    /*
     * Firestore登録に失敗したら
     * Storage側に孤児ファイルを残さない。
     */
    try {
      await deleteAnswerImage(
        storagePath
      );
    } catch (
      cleanupError
    ) {
      console.error(
        "Answer storage cleanup error:",
        cleanupError
      );
    }

    throw error;
  }

  return {
    id:
      answerId,

    storagePath,

    bucket:
      ANSWER_BUCKET,
  };
}

/* =========================================================
   Get answer
   ========================================================= */

export async function getAnswer(
  answerId: string
) {
  if (
    !answerId
  ) {
    return null;
  }

  const user =
    await getAppUser();

  if (
    !user
  ) {
    throw new Error(
      "ログインしてください。"
    );
  }

  const answerRef =
    doc(
      db,
      "answers",
      answerId
    );

  const snapshot =
    await getDoc(
      answerRef
    );

  if (
    !snapshot.exists()
  ) {
    return null;
  }

  const data =
    snapshot.data();

  const answer =
    normalizeAnswer(
      snapshot.id,
      data
    );

  /*
   * アプリ側でも必ず権限確認。
   */
  if (
    !canViewAnswer(
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
   Get answer with signed URL
   ========================================================= */

export async function getAnswerWithUrl(
  answerId: string
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
    throw new Error(
      "答案画像の保存先が設定されていません。"
    );
  }

  const signedUrl =
    await createAnswerSignedUrl(
      answer.fileKey,
      3600
    );

  if (
    !signedUrl
  ) {
    throw new Error(
      "答案画像URLを取得できませんでした。"
    );
  }

  return {
    ...answer,

    signedUrl,
  };
}

/* =========================================================
   Update answer status
   ========================================================= */

export async function updateAnswerStatus(
  answerId: string,
  status: AnswerStatus,
  extra:
    | Record<
        string,
        unknown
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

  assertAnswerManager(
    user.role
  );

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

  await updateDoc(
    doc(
      db,
      "answers",
      answerId
    ),
    {
      status,

      ...(extra ??
        {}),

      updatedAt:
        serverTimestamp(),
    }
  );
}

/* =========================================================
   Processing state
   ========================================================= */

export async function markAnswerProcessing(
  answerId: string
) {
  await updateAnswerStatus(
    answerId,
    "processing",
    {
      processingError:
        "",
    }
  );
}

/* =========================================================
   Mark grading completed
   ========================================================= */

export async function markAnswerGraded(
  answerId: string,
  totalScore: number,
  totalMaxScore: number,
  reviewRequired: boolean
) {
  await updateAnswerStatus(
    answerId,
    reviewRequired
      ? "first_review"
      : "graded",
    {
      totalScore:
        safeNumber(
          totalScore
        ),

      totalMaxScore:
        safeNumber(
          totalMaxScore
        ),

      reviewRequired:
        reviewRequired,

      processingError:
        "",
    }
  );
}

/* =========================================================
   Mark error
   ========================================================= */

export async function markAnswerError(
  answerId: string,
  message: string
) {
  await updateAnswerStatus(
    answerId,
    "error",
    {
      processingError:
        message,

      reviewRequired:
        false,
    }
  );
}

/* =========================================================
   Update QR
   ========================================================= */

export async function updateAnswerQR(
  answerId: string,
  qrText: string,
  confidence: number
) {
  await updateAnswerStatus(
    answerId,
    "processing",
    {
      qrText:
        qrText.trim(),

      qrConfidence:
        normalizeConfidence(
          confidence
        ),
    }
  );
}

/* =========================================================
   Update OCR
   ========================================================= */

export async function updateAnswerOCR(
  answerId: string,
  confidence: number
) {
  await updateAnswerStatus(
    answerId,
    "processing",
    {
      ocrConfidence:
        normalizeConfidence(
          confidence
        ),
    }
  );
}

/* =========================================================
   Confirm answer
   ========================================================= */

export async function confirmAnswer(
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

  if (
    user.role ===
    "生徒"
  ) {
    throw new Error(
      "答案を確定する権限がありません。"
    );
  }

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

  if (
    answer.status !==
    "second_review"
  ) {
    throw new Error(
      "二次確認済みの答案だけ確定できます。"
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
        "confirmed",

      confirmedAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    }
  );
}

/* =========================================================
   Publish answer
   ========================================================= */

export async function publishAnswer(
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

  if (
    user.role ===
    "生徒"
  ) {
    throw new Error(
      "答案を公開する権限がありません。"
    );
  }

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

  if (
    answer.status !==
    "confirmed"
  ) {
    throw new Error(
      "確定済みの答案だけ公開できます。"
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
        "published",

      updatedAt:
        serverTimestamp(),
    }
  );
}

/* =========================================================
   Replace image
   ========================================================= */

export async function replaceAnswerFile(
  answerId: string,
  file: File
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

  assertAnswerManager(
    user.role
  );

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

  const validation =
    validateAnswerFile(
      file
    );

  if (
    !validation.valid
  ) {
    throw new Error(
      validation.message
    );
  }

  const extension =
    getFileExtension(
      file
    );

  const newPath =
    createAnswerStoragePath(
      answer.organizationId,
      answer.testId,
      answer.subjectId,
      answer.id,
      extension
    );

  /*
   * 新しいファイルを先にアップロード。
   */
  await uploadAnswerImage(
    file,
    newPath
  );

  try {
    await updateDoc(
      doc(
        db,
        "answers",
        answerId
      ),
      {
        fileKey:
          newPath,

        fileName:
          file.name,

        contentType:
          file.type,

        size:
          file.size,

        /*
         * 画像が変わったので
         * 再処理対象に戻す。
         */
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

        processedAt:
          null,

        confirmedAt:
          null,

        updatedAt:
          serverTimestamp(),
      }
    );
  } catch (
    error
  ) {
    try {
      await deleteAnswerImage(
        newPath
      );
    } catch (
      cleanupError
    ) {
      console.error(
        "Replacement cleanup error:",
        cleanupError
      );
    }

    throw error;
  }

  /*
   * 古い画像はFirestore更新成功後に削除。
   */
  if (
    answer.fileKey &&
    answer.fileKey !==
      newPath
  ) {
    try {
      await deleteAnswerImage(
        answer.fileKey
      );
    } catch (
      cleanupError
    ) {
      /*
       * 古いファイル削除失敗は
       * 新しい答案自体を無効にはしない。
       */
      console.error(
        "Old answer image cleanup error:",
        cleanupError
      );
    }
  }

  return {
    path:
      newPath,
  };
}

/* =========================================================
   Delete answer
   ========================================================= */

export async function deleteAnswer(
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

  /*
   * 答案削除は管理者のみ。
   */
  if (
    user.role !==
      "本部管理者" &&
    user.role !==
      "校舎管理者"
  ) {
    throw new Error(
      "答案を削除する権限がありません。"
    );
  }

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
   * Firestoreを先に削除すると
   * Storage削除失敗時に孤児ファイルが残るため、
   * 先にStorageを削除する。
   */
  if (
    answer.fileKey
  ) {
    await deleteAnswerImage(
      answer.fileKey
    );
  }

  /*
   * Firestore側は直接deleteではなく、
   * この関数から一元管理。
   */
  const answerRef =
    doc(
      db,
      "answers",
      answerId
    );

  const {
    deleteDoc,
  } =
    await import(
      "firebase/firestore"
    );

  await deleteDoc(
    answerRef
  );
}

/* =========================================================
   Access
   ========================================================= */

function canViewAnswer(
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
    return false;
  }

  if (
    !user.organizationId ||
    answer.organizationId !==
      user.organizationId
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
    return true;
  }

  /*
   * 校舎管理者
   */
  if (
    user.role ===
    "校舎管理者"
  ) {
    return user.schoolIds.includes(
      answer.schoolId
    );
  }

  /*
   * 講師
   */
  if (
    user.role ===
    "講師"
  ) {
    return user.schoolIds.includes(
      answer.schoolId
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
      Boolean(
        user.studentId
      ) &&
      answer.studentId ===
        user.studentId
    );
  }

  return false;
}

/* =========================================================
   Permission
   ========================================================= */

function assertAnswerManager(
  role: UserRole
) {
  const allowed =
    role ===
      "本部管理者" ||
    role ===
      "校舎管理者" ||
    role ===
      "講師";

  if (
    !allowed
  ) {
    throw new Error(
      "答案を管理する権限がありません。"
    );
  }
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
   File extension
   ========================================================= */

function getFileExtension(
  file: File
) {
  const name =
    file.name
      .split(
        "."
      )
      .pop()
      ?.toLowerCase();

  if (
    name
  ) {
    return name;
  }

  switch (
    file.type
  ) {
    case "image/jpeg":
      return "jpg";

    case "image/png":
      return "png";

    case "image/webp":
      return "webp";

    case "application/pdf":
      return "pdf";

    default:
      return "bin";
  }
}

/* =========================================================
   Confidence
   ========================================================= */

function normalizeConfidence(
  value: number
) {
  const number =
    Number(
      value
    );

  if (
    !Number.isFinite(
      number
    )
  ) {
    return 0;
  }

  /*
   * 0〜1でも0〜100でも受ける。
   * Firestoreには0〜1で統一。
   */
  if (
    number > 1
  ) {
    return Math.min(
      1,
      Math.max(
        0,
        number /
          100
      )
    );
  }

  return Math.min(
    1,
    Math.max(
      0,
      number
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
      value ??
        0
    );

  return Number.isFinite(
    number
  )
    ? number
    : 0;
}
