"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import {
  httpsCallable,
} from "firebase/functions";

import {
  db,
} from "@/lib/firebase";

import {
  functions,
} from "@/lib/firebaseFunctions";

import {
  createAnswerSignedUrl,
  deleteAnswerFile,
} from "@/lib/supabase";

/* =========================================================
   Types
   ========================================================= */

export type AnswerStatus =
  | "uploaded"
  | "processing"
  | "graded"
  | "first_review"
  | "second_review"
  | "confirmed"
  | "published"
  | "error";

export type Answer = {
  id: string;

  organizationId?: string;

  schoolId?: string;

  testId: string;

  subjectId: string;

  studentId?: string | null;

  studentNumber?: string | null;

  fileKey: string;

  fileName: string;

  contentType: string;

  size: number;

  status: AnswerStatus;

  reviewRequired?: boolean;

  processingError?: string;

  totalScore?: number;

  totalMaxScore?: number;

  qrText?: string;

  qrConfidence?: number;

  ocrConfidence?: number;

  scorePublished?: boolean;

  scorePublishedAt?: unknown;

  createdAt?: unknown;

  updatedAt?: unknown;

  processedAt?: unknown;

  confirmedAt?: unknown;
};

export type AnswerWithUrl =
  Answer & {
    signedUrl:
      | string
      | null;
  };

export type GradingJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "completed_with_errors"
  | "failed"
  | string;

export type GradingJob = {
  id: string;

  testId?: string;

  subjectId?: string;

  requestedBy?: string;

  status: GradingJobStatus;

  total: number;

  processed: number;

  succeeded: number;

  reviewRequired: number;

  errors: number;

  currentChunk: number;

  totalChunks: number;

  errorMessage?: string;

  createdAt?: unknown;

  updatedAt?: unknown;

  startedAt?: unknown;

  completedAt?: unknown;
};

type CreateUploadUrlResponse = {
  success: boolean;

  answerId: string;

  fileKey: string;

  uploadUrl: string;
};

/* =========================================================
   Get one answer
   ========================================================= */

export async function getAnswer(
  answerId: string
): Promise<Answer | null> {
  if (
    !answerId.trim()
  ) {
    throw new Error(
      "答案IDが指定されていません。"
    );
  }

  try {
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
  } catch (
    error
  ) {
    throw toUserError(
      error,
      "答案を取得できませんでした。"
    );
  }
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

  let signedUrl:
    | string
    | null =
    null;

  if (
    answer.fileKey
  ) {
    try {
      signedUrl =
        await createAnswerSignedUrl(
          answer.fileKey
        );
    } catch (
      error
    ) {
      throw toUserError(
        error,
        "答案画像を取得できませんでした。"
      );
    }
  }

  return {
    ...answer,

    signedUrl,
  };
}

/* =========================================================
   Get answers
   ========================================================= */

/*
 * subjectIdは任意。
 *
 * テスト単位で答案を管理する場合、
 * subjectIdを指定しなくても取得できるようにする。
 */
export async function getAnswers(
  testId: string,
  subjectId?: string,
  status?: AnswerStatus
): Promise<Answer[]> {
  if (
    !testId.trim()
  ) {
    throw new Error(
      "テストIDが指定されていません。"
    );
  }

  try {
    const conditions = [
      where(
        "testId",
        "==",
        testId
      ),
    ];

    if (
      subjectId?.trim()
    ) {
      conditions.push(
        where(
          "subjectId",
          "==",
          subjectId
        )
      );
    }

    if (
      status
    ) {
      conditions.push(
        where(
          "status",
          "==",
          status
        )
      );
    }

    const snapshot =
      await getDocs(
        query(
          collection(
            db,
            "answers"
          ),
          ...conditions,
          orderBy(
            "createdAt",
            "asc"
          ),
          limit(
            1000
          )
        )
      );

    return snapshot.docs.map(
      (
        item
      ) =>
        normalizeAnswer(
          item.id,
          item.data()
        )
    );
  } catch (
    error
  ) {
    throw toUserError(
      error,
      "答案を取得できませんでした。"
    );
  }
}

/* =========================================================
   Get all answers for test
   ========================================================= */

export async function getAllAnswers(
  testId: string,
  subjectId?: string
): Promise<Answer[]> {
  return getAnswers(
    testId,
    subjectId
  );
}

/* =========================================================
   Request upload URL
   ========================================================= */

async function requestUploadUrl(
  input: {
    testId: string;

    subjectId: string;

    fileName: string;

    contentType: string;

    size: number;

    studentNumber?: string;
  }
): Promise<CreateUploadUrlResponse> {
  try {
    const callable =
      httpsCallable<
        {
          testId: string;

          subjectId: string;

          fileName: string;

          contentType: string;

          size: number;

          studentNumber?: string;
        },
        CreateUploadUrlResponse
      >(
        functions,
        "createAnswerUploadUrl"
      );

    const result =
      await callable(
        input
      );

    if (
      !result.data?.success
    ) {
      throw new Error(
        "答案アップロードの受付に失敗しました。"
      );
    }

    return result.data;
  } catch (
    error
  ) {
    throw toUserError(
      error,
      "答案アップロードを開始できませんでした。"
    );
  }
}

/* =========================================================
   Upload one answer
   ========================================================= */

export async function uploadAnswer(
  input: {
    testId: string;

    subjectId: string;

    studentNumber?: string;

    file: File;
  }
): Promise<Answer> {
  validateFile(
    input.file
  );

  if (
    !input.testId.trim()
  ) {
    throw new Error(
      "テストを選択してください。"
    );
  }

  if (
    !input.subjectId.trim()
  ) {
    throw new Error(
      "教科情報がありません。"
    );
  }

  const upload =
    await requestUploadUrl({
      testId:
        input.testId,

      subjectId:
        input.subjectId,

      fileName:
        input.file.name,

      contentType:
        input.file.type,

      size:
        input.file.size,

      /*
       * 通常は未指定。
       *
       * 生徒番号は答案上のQRから
       * 後段で特定する。
       */
      studentNumber:
        input.studentNumber,
    });

  if (
    !upload.answerId
  ) {
    throw new Error(
      "答案IDを取得できませんでした。"
    );
  }

  if (
    !upload.uploadUrl
  ) {
    throw new Error(
      "答案アップロード先を取得できませんでした。"
    );
  }

  try {
    const response =
      await fetch(
        upload.uploadUrl,
        {
          method:
            "PUT",

          headers: {
            "Content-Type":
              input.file.type,
          },

          body:
            input.file,
        }
      );

    if (
      !response.ok
    ) {
      throw new Error(
        `答案ファイルのアップロードに失敗しました。HTTP ${response.status}`
      );
    }
  } catch (
    error
  ) {
    throw toUserError(
      error,
      "答案ファイルをアップロードできませんでした。"
    );
  }

  /*
   * アップロード直後のFirestoreデータ。
   */
  const answer =
    await getAnswer(
      upload.answerId
    );

  if (
    !answer
  ) {
    throw new Error(
      "アップロードした答案情報を取得できませんでした。"
    );
  }

  return answer;
}

/* =========================================================
   Upload multiple answers
   ========================================================= */

export async function uploadAnswers(
  inputs: Array<{
    testId: string;

    subjectId: string;

    studentNumber?: string;

    file: File;
  }>,
  onProgress?: (
    completed: number,
    total: number
  ) => void
): Promise<Answer[]> {
  if (
    inputs.length ===
    0
  ) {
    throw new Error(
      "アップロードする答案がありません。"
    );
  }

  const results: Answer[] =
    [];

  for (
    let index = 0;
    index <
    inputs.length;
    index++
  ) {
    const answer =
      await uploadAnswer(
        inputs[index]
      );

    results.push(
      answer
    );

    onProgress?.(
      index + 1,
      inputs.length
    );
  }

  return results;
}

/* =========================================================
   Update answer status
   ========================================================= */

export async function updateAnswerStatus(
  answerId: string,
  status: AnswerStatus
): Promise<void> {
  if (
    !answerId.trim()
  ) {
    throw new Error(
      "答案IDが指定されていません。"
    );
  }

  try {
    await updateDoc(
      doc(
        db,
        "answers",
        answerId
      ),
      {
        status,

        updatedAt:
          serverTimestamp(),
      }
    );
  } catch (
    error
  ) {
    throw toUserError(
      error,
      "答案の状態を更新できませんでした。"
    );
  }
}

/* =========================================================
   Assign student by number
   ========================================================= */

/*
 * 生徒番号から生徒マスターを検索し、
 *
 * studentId
 * schoolId
 * studentNumber
 *
 * を答案へ自動紐付けする。
 *
 * 校舎は入力させない。
 */
export async function assignAnswerStudent(
  answerId: string,
  studentNumber: string
): Promise<{
  studentId: string;
  studentNumber: string;
  schoolId: string;
}> {
  if (
    !answerId.trim()
  ) {
    throw new Error(
      "答案IDが指定されていません。"
    );
  }

  const normalized =
    studentNumber
      .trim();

  if (
    !/^\d{6}$/.test(
      normalized
    )
  ) {
    throw new Error(
      "生徒番号は6桁数字で指定してください。"
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

  try {
    /*
     * 組織IDが答案に入っている場合は
     * 同じ組織の生徒だけを検索する。
     */
    const conditions = [];

    if (
      answer.organizationId
    ) {
      conditions.push(
        where(
          "organizationId",
          "==",
          answer.organizationId
        )
      );
    }

    conditions.push(
      where(
        "studentNumber",
        "==",
        normalized
      )
    );

    conditions.push(
      where(
        "active",
        "==",
        true
      )
    );

    const snapshot =
      await getDocs(
        query(
          collection(
            db,
            "students"
          ),
          ...conditions,
          limit(
            2
          )
        )
      );

    if (
      snapshot.empty
    ) {
      throw new Error(
        "この生徒番号の生徒情報が見つかりません。"
      );
    }

    if (
      snapshot.docs.length >
      1
    ) {
      throw new Error(
        "同じ生徒番号の生徒情報が複数あります。生徒管理を確認してください。"
      );
    }

    const studentDoc =
      snapshot.docs[0];

    const student =
      studentDoc.data();

    const schoolId =
      stringValue(
        student.schoolId
      );

    if (
      !schoolId
    ) {
      throw new Error(
        "生徒の所属校舎が設定されていません。"
      );
    }

    await updateDoc(
      doc(
        db,
        "answers",
        answerId
      ),
      {
        studentId:
          studentDoc.id,

        studentNumber:
          normalized,

        schoolId,

        updatedAt:
          serverTimestamp(),
      }
    );

    return {
      studentId:
        studentDoc.id,

      studentNumber:
        normalized,

      schoolId,
    };
  } catch (
    error
  ) {
    throw toUserError(
      error,
      "生徒情報を答案に紐付けられませんでした。"
    );
  }
}

/* =========================================================
   Start automatic grading
   ========================================================= */

export async function startAutoGrading(
  testId: string,
  subjectId: string,
  answerIds: string[]
) {
  if (
    !testId.trim()
  ) {
    throw new Error(
      "テストIDが指定されていません。"
    );
  }

  if (
    !subjectId.trim()
  ) {
    throw new Error(
      "教科IDが指定されていません。"
    );
  }

  const uniqueIds =
    Array.from(
      new Set(
        answerIds.filter(
          (
            id
          ): id is string =>
            typeof id ===
              "string" &&
            id.trim() !== ""
        )
      )
    );

  if (
    uniqueIds.length ===
    0
  ) {
    throw new Error(
      "処理対象の答案がありません。"
    );
  }

  try {
    const callable =
      httpsCallable<
        {
          testId: string;

          subjectId: string;

          answerIds: string[];
        },
        {
          success: boolean;

          jobId: string;

          total: number;

          status: string;
        }
      >(
        functions,
        "startAnswerProcessing"
      );

    const result =
      await callable({
        testId,

        subjectId,

        answerIds:
          uniqueIds,
      });

    if (
      !result.data?.success
    ) {
      throw new Error(
        "自動採点処理を開始できませんでした。"
      );
    }

    return result.data;
  } catch (
    error
  ) {
    throw toUserError(
      error,
      "自動採点処理を開始できませんでした。"
    );
  }
}

/* =========================================================
   Get grading job
   ========================================================= */

export async function getGradingJob(
  jobId: string
): Promise<
  GradingJob | null
> {
  if (
    !jobId.trim()
  ) {
    throw new Error(
      "採点ジョブIDが指定されていません。"
    );
  }

  try {
    const snapshot =
      await getDoc(
        doc(
          db,
          "gradingJobs",
          jobId
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

      testId:
        nullableString(
          data.testId
        ) ??
        undefined,

      subjectId:
        nullableString(
          data.subjectId
        ) ??
        undefined,

      requestedBy:
        nullableString(
          data.requestedBy
        ) ??
        undefined,

      status:
        stringValue(
          data.status
        ) ||
        "queued",

      total:
        safeNumber(
          data.total
        ),

      processed:
        safeNumber(
          data.processed
        ),

      succeeded:
        safeNumber(
          data.succeeded
        ),

      reviewRequired:
        safeNumber(
          data.reviewRequired
        ),

      errors:
        safeNumber(
          data.errors
        ),

      currentChunk:
        safeNumber(
          data.currentChunk
        ),

      totalChunks:
        safeNumber(
          data.totalChunks
        ),

      errorMessage:
        nullableString(
          data.errorMessage
        ) ??
        undefined,

      createdAt:
        data.createdAt,

      updatedAt:
        data.updatedAt,

      startedAt:
        data.startedAt,

      completedAt:
        data.completedAt,
    };
  } catch (
    error
  ) {
    throw toUserError(
      error,
      "採点状況を取得できませんでした。"
    );
  }
}

/* =========================================================
   Wait for grading job
   ========================================================= */

export async function waitForGradingJob(
  jobId: string,
  options?: {
    intervalMs?: number;

    timeoutMs?: number;

    onUpdate?: (
      job: GradingJob
    ) => void;
  }
): Promise<GradingJob> {
  const intervalMs =
    options?.intervalMs ??
    2000;

  const timeoutMs =
    options?.timeoutMs ??
    10 *
      60 *
      1000;

  const started =
    Date.now();

  while (
    Date.now() -
      started <
    timeoutMs
  ) {
    const job =
      await getGradingJob(
        jobId
      );

    if (
      !job
    ) {
      throw new Error(
        "採点ジョブが見つかりません。"
      );
    }

    options?.onUpdate?.(
      job
    );

    if (
      job.status ===
        "completed" ||
      job.status ===
        "completed_with_errors"
    ) {
      return job;
    }

    if (
      job.status ===
      "failed"
    ) {
      throw new Error(
        job.errorMessage ||
          "答案処理に失敗しました。"
      );
    }

    await sleep(
      intervalMs
    );
  }

  throw new Error(
    "答案処理がタイムアウトしました。"
  );
}

/* =========================================================
   Retry
   ========================================================= */

export async function retryAnswer(
  answerId: string
) {
  const answer =
    await getAnswer(
      answerId
    );

  if (
    !answer
  ) {
    throw new Error(
      "答案が存在しません。"
    );
  }

  await updateAnswerStatus(
    answerId,
    "uploaded"
  );

  return startAutoGrading(
    answer.testId,
    answer.subjectId,
    [
      answerId,
    ]
  );
}

/* =========================================================
   Review transitions
   ========================================================= */

export async function moveToFirstReview(
  answerIds: string[]
) {
  await updateStatuses(
    answerIds,
    "first_review"
  );
}

export async function moveToSecondReview(
  answerIds: string[]
) {
  await updateStatuses(
    answerIds,
    "second_review"
  );
}

export async function confirmAnswers(
  answerIds: string[]
) {
  await updateStatuses(
    answerIds,
    "confirmed"
  );
}

export async function publishAnswers(
  answerIds: string[]
) {
  const ids =
    normalizeIds(
      answerIds
    );

  if (
    ids.length ===
    0
  ) {
    throw new Error(
      "公開対象の答案がありません。"
    );
  }

  for (
    const answerId of
      ids
  ) {
    try {
      await updateDoc(
        doc(
          db,
          "answers",
          answerId
        ),
        {
          status:
            "published",

          scorePublished:
            true,

          scorePublishedAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        }
      );
    } catch (
      error
    ) {
      throw toUserError(
        error,
        "点数を公開できませんでした。"
      );
    }
  }
}

/* =========================================================
   Bulk status
   ========================================================= */

async function updateStatuses(
  answerIds: string[],
  status: AnswerStatus
) {
  const ids =
    normalizeIds(
      answerIds
    );

  if (
    ids.length ===
    0
  ) {
    throw new Error(
      "対象答案がありません。"
    );
  }

  for (
    const answerId of
      ids
  ) {
    await updateAnswerStatus(
      answerId,
      status
    );
  }
}

/* =========================================================
   Delete answer
   ========================================================= */

export async function deleteAnswer(
  answerId: string
) {
  if (
    !answerId.trim()
  ) {
    throw new Error(
      "答案IDが指定されていません。"
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
      "削除する答案が見つかりません。"
    );
  }

  if (
    answer.status ===
      "confirmed" ||
    answer.status ===
      "published"
  ) {
    throw new Error(
      "確定済みの答案は削除できません。"
    );
  }

  try {
    if (
      answer.fileKey
    ) {
      await deleteAnswerFile(
        answer.fileKey
      );
    }

    await deleteDoc(
      doc(
        db,
        "answers",
        answerId
      )
    );

    return {
      success:
        true,

      answerId,
    };
  } catch (
    error
  ) {
    throw toUserError(
      error,
      "答案を削除できませんでした。"
    );
  }
}

/* =========================================================
   Normalize answer
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
      nullableString(
        data.organizationId
      ) ??
      undefined,

    schoolId:
      nullableString(
        data.schoolId
      ) ??
      undefined,

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
      typeof data.reviewRequired ===
      "boolean"
        ? data.reviewRequired
        : undefined,

    processingError:
      nullableString(
        data.processingError
      ) ??
      undefined,

    totalScore:
      data.totalScore !==
      undefined
        ? safeNumber(
            data.totalScore
          )
        : undefined,

    totalMaxScore:
      data.totalMaxScore !==
      undefined
        ? safeNumber(
            data.totalMaxScore
          )
        : undefined,

    qrText:
      nullableString(
        data.qrText
      ) ??
      undefined,

    qrConfidence:
      data.qrConfidence !==
      undefined
        ? safeNumber(
            data.qrConfidence
          )
        : undefined,

    ocrConfidence:
      data.ocrConfidence !==
      undefined
        ? safeNumber(
            data.ocrConfidence
          )
        : undefined,

    scorePublished:
      typeof data.scorePublished ===
      "boolean"
        ? data.scorePublished
        : undefined,

    scorePublishedAt:
      data.scorePublishedAt,

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
   File validation
   ========================================================= */

function validateFile(
  file: File
) {
  const allowedTypes =
    new Set([
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);

  const name =
    file.name.toLowerCase();

  const allowedExtension =
    name.endsWith(
      ".pdf"
    ) ||
    name.endsWith(
      ".jpg"
    ) ||
    name.endsWith(
      ".jpeg"
    ) ||
    name.endsWith(
      ".png"
    ) ||
    name.endsWith(
      ".webp"
    );

  if (
    !allowedTypes.has(
      file.type
    ) &&
    !allowedExtension
  ) {
    throw new Error(
      "PDF・JPG・PNG・WebPのみアップロードできます。"
    );
  }

  if (
    file.size <=
    0
  ) {
    throw new Error(
      "空のファイルはアップロードできません。"
    );
  }

  const maxSize =
    20 *
    1024 *
    1024;

  if (
    file.size >
    maxSize
  ) {
    throw new Error(
      "答案ファイルは20MB以下にしてください。"
    );
  }
}

/* =========================================================
   IDs
   ========================================================= */

function normalizeIds(
  ids: string[]
) {
  return Array.from(
    new Set(
      ids.filter(
        (
          id
        ): id is string =>
          typeof id ===
            "string" &&
          id.trim() !== ""
      )
    )
  );
}

/* =========================================================
   Status
   ========================================================= */

function normalizeAnswerStatus(
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
   User-facing error
   ========================================================= */

function toUserError(
  error: unknown,
  fallback: string
): Error {
  const message =
    error instanceof Error
      ? error.message
      : String(
          error ??
            ""
        );

  /*
   * Firebaseの内部エラーを
   * そのまま利用者へ表示しない。
   */
  if (
    message.includes(
      "Missing or insufficient permissions"
    ) ||
    message.includes(
      "permission-denied"
    ) ||
    message.includes(
      "PERMISSION_DENIED"
    )
  ) {
    return new Error(
      "この操作を実行する権限がありません。"
    );
  }

  if (
    message.includes(
      "unauthenticated"
    ) ||
    message.includes(
      "UNAUTHENTICATED"
    )
  ) {
    return new Error(
      "ログインが必要です。"
    );
  }

  if (
    message.includes(
      "not-found"
    ) ||
    message.includes(
      "NOT_FOUND"
    )
  ) {
    return new Error(
      "対象のデータが見つかりません。"
    );
  }

  /*
   * すでにこちらで作った
   * 日本語エラーはそのまま使用。
   */
  if (
    /[ぁ-んァ-ヶ一-龯]/.test(
      message
    )
  ) {
    return new Error(
      message
    );
  }

  return new Error(
    fallback
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

/* =========================================================
   Sleep
   ========================================================= */

function sleep(
  milliseconds: number
): Promise<void> {
  return new Promise(
    (
      resolve
    ) => {
      setTimeout(
        resolve,
        milliseconds
      );
    }
  );
}
