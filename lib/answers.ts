"use client";

import {
  collection,
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

/* =========================================================
   Answer
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

  testId: string;

  subjectId: string;

  studentNumber?: string;

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

  createdAt?: unknown;

  updatedAt?: unknown;

  processedAt?: unknown;
};

/* =========================================================
   Grading Job
   ========================================================= */

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

/* =========================================================
   Upload response
   ========================================================= */

type CreateUploadUrlResponse = {
  success: boolean;

  answerId: string;

  fileKey: string;

  uploadUrl: string;
};

/* =========================================================
   Get answer
   ========================================================= */

export async function getAnswer(
  answerId: string
): Promise<Answer | null> {
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
   Get answers
   ========================================================= */

export async function getAnswers(
  testId: string,
  subjectId: string,
  status?: AnswerStatus
): Promise<Answer[]> {
  if (
    !testId.trim()
  ) {
    throw new Error(
      "testIdが指定されていません。"
    );
  }

  if (
    !subjectId.trim()
  ) {
    throw new Error(
      "subjectIdが指定されていません。"
    );
  }

  const conditions = [
    where(
      "testId",
      "==",
      testId
    ),

    where(
      "subjectId",
      "==",
      subjectId
    ),
  ];

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
}

/* =========================================================
   Upload URL
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

  return result.data;
}

/* =========================================================
   Upload answer
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

      studentNumber:
        input.studentNumber,
    });

  if (
    !upload.success
  ) {
    throw new Error(
      "答案アップロードURLを取得できませんでした。"
    );
  }

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
   Upload answers
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
  const results: Answer[] = [];

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
   Status
   ========================================================= */

export async function updateAnswerStatus(
  answerId: string,
  status: AnswerStatus
): Promise<void> {
  if (
    !answerId.trim()
  ) {
    throw new Error(
      "answerIdが指定されていません。"
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

      updatedAt:
        serverTimestamp(),
    }
  );
}

/* =========================================================
   Assign student
   ========================================================= */

export async function assignAnswerStudent(
  answerId: string,
  studentNumber: string
): Promise<void> {
  if (
    !/^\d{6}$/.test(
      studentNumber
    )
  ) {
    throw new Error(
      "生徒番号は6桁数字で指定してください。"
    );
  }

  await updateDoc(
    doc(
      db,
      "answers",
      answerId
    ),
    {
      studentNumber,

      updatedAt:
        serverTimestamp(),
    }
  );
}

/* =========================================================
   Start auto grading
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
      "testIdが指定されていません。"
    );
  }

  if (
    !subjectId.trim()
  ) {
    throw new Error(
      "subjectIdが指定されていません。"
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

  return result.data;
}

/* =========================================================
   Get grading job
   ========================================================= */

export async function getGradingJob(
  jobId: string
): Promise<GradingJob | null> {
  if (
    !jobId.trim()
  ) {
    throw new Error(
      "jobIdが指定されていません。"
    );
  }

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
      stringValue(
        data.testId
      ),

    subjectId:
      stringValue(
        data.subjectId
      ),

    requestedBy:
      stringValue(
        data.requestedBy
      ),

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
      stringValue(
        data.errorMessage
      ),

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,

    startedAt:
      data.startedAt,

    completedAt:
      data.completedAt,
  };
}

/* =========================================================
   Wait
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
          "答案処理ジョブが失敗しました。"
      );
    }

    await sleep(
      intervalMs
    );
  }

  throw new Error(
    "答案処理ジョブがタイムアウトしました。"
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
  await updateStatuses(
    answerIds,
    "published"
  );
}

/* =========================================================
   Bulk status
   ========================================================= */

async function updateStatuses(
  answerIds: string[],
  status: AnswerStatus
) {
  const ids =
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

    testId:
      stringValue(
        data.testId
      ),

    subjectId:
      stringValue(
        data.subjectId
      ),

    studentNumber:
      nullableString(
        data.studentNumber
      ) ??
      undefined,

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

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,

    processedAt:
      data.processedAt,
  };
}

/* =========================================================
   File validation
   ========================================================= */

function validateFile(
  file: File
) {
  const allowedTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
  ];

  if (
    !allowedTypes.includes(
      file.type
    )
  ) {
    throw new Error(
      "PDF・JPG・PNGのみアップロードできます。"
    );
  }

  const maxSize =
    20 *
    1024 *
    1024;

  if (
    file.size <=
    0
  ) {
    throw new Error(
      "空のファイルはアップロードできません。"
    );
  }

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
   Status
   ========================================================= */

function normalizeAnswerStatus(
  value: unknown
): AnswerStatus {
  const statuses: AnswerStatus[] = [
    "uploaded",
    "processing",
    "graded",
    "first_review",
    "second_review",
    "confirmed",
    "published",
    "error",
  ];

  if (
    typeof value ===
      "string" &&
    statuses.includes(
      value as AnswerStatus
    )
  ) {
    return value as AnswerStatus;
  }

  return "uploaded";
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
