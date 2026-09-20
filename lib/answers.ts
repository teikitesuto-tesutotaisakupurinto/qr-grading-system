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

  createdAt?: unknown;
  updatedAt?: unknown;
};

type CreateUploadUrlResponse = {
  success: boolean;

  answerId: string;

  fileKey: string;

  uploadUrl: string;
};

/* =========================================================
   答案取得
   ========================================================= */

export async function getAnswer(
  answerId: string
): Promise<Answer | null> {
  const snapshot =
    await getDoc(
      doc(
        db,
        "answers",
        answerId
      )
    );

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as Answer;
}

/* =========================================================
   答案一覧
   ========================================================= */

export async function getAnswers(
  testId: string,
  subjectId: string,
  status?: AnswerStatus
): Promise<Answer[]> {
  const constraints = [
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

  if (status) {
    constraints.push(
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
        ...constraints,
        orderBy(
          "createdAt",
          "asc"
        ),
        limit(1000)
      )
    );

  return snapshot.docs.map(
    (item) =>
      ({
        id: item.id,
        ...item.data(),
      }) as Answer
  );
}

/* =========================================================
   Supabase署名付きアップロードURL
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
    await callable(input);

  return result.data;
}

/* =========================================================
   答案アップロード
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

  /*
   * ブラウザ → Supabase Storage
   *
   * Secret keyはブラウザには渡さない。
   */
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

  if (!response.ok) {
    throw new Error(
      `答案ファイルのアップロードに失敗しました。HTTP ${response.status}`
    );
  }

  /*
   * Functions側で作成された
   * Firestore answersドキュメントを取得。
   */
  const answer =
    await getAnswer(
      upload.answerId
    );

  if (!answer) {
    throw new Error(
      "答案情報を取得できませんでした。"
    );
  }

  return answer;
}

/* =========================================================
   複数答案アップロード
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
  const results: Answer[] =
    [];

  for (
    let index = 0;
    index < inputs.length;
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
   答案ステータス更新
   ========================================================= */

export async function updateAnswerStatus(
  answerId: string,
  status: AnswerStatus
) {
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
   生徒番号紐付け
   ========================================================= */

export async function assignAnswerStudent(
  answerId: string,
  studentNumber: string
) {
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
   自動採点開始
   ========================================================= */

export async function startAutoGrading(
  testId: string,
  subjectId: string,
  answerIds: string[]
) {
  if (
    answerIds.length === 0
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

      answerIds,
    });

  return result.data;
}

/* =========================================================
   採点ジョブ取得
   ========================================================= */

export type GradingJob = {
  id: string;

  testId?: string;
  subjectId?: string;

  status:
    | "queued"
    | "processing"
    | "completed"
    | "completed_with_errors"
    | "failed"
    | string;

  total: number;

  processed: number;

  succeeded: number;

  reviewRequired: number;

  errors: number;

  currentChunk?: number;

  totalChunks?: number;

  errorMessage?: string;
};

export async function getGradingJob(
  jobId: string
): Promise<GradingJob | null> {
  const snapshot =
    await getDoc(
      doc(
        db,
        "gradingJobs",
        jobId
      )
    );

  if (!snapshot.exists()) {
    return null;
  }

  const data =
    snapshot.data();

  return {
    id:
      snapshot.id,

    testId:
      typeof data.testId ===
      "string"
        ? data.testId
        : undefined,

    subjectId:
      typeof data.subjectId ===
      "string"
        ? data.subjectId
        : undefined,

    status:
      typeof data.status ===
      "string"
        ? data.status
        : "queued",

    total:
      Number(
        data.total ?? 0
      ),

    processed:
      Number(
        data.processed ?? 0
      ),

    succeeded:
      Number(
        data.succeeded ?? 0
      ),

    reviewRequired:
      Number(
        data.reviewRequired ??
          0
      ),

    errors:
      Number(
        data.errors ?? 0
      ),

    currentChunk:
      data.currentChunk !==
      undefined
        ? Number(
            data.currentChunk
          )
        : undefined,

    totalChunks:
      data.totalChunks !==
      undefined
        ? Number(
            data.totalChunks
          )
        : undefined,

    errorMessage:
      typeof data.errorMessage ===
      "string"
        ? data.errorMessage
        : undefined,
  };
}

/* =========================================================
   答案再処理
   ========================================================= */

export async function retryAnswer(
  answerId: string
) {
  const answer =
    await getAnswer(
      answerId
    );

  if (!answer) {
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
    [answerId]
  );
}

/* =========================================================
   採点確定
   ========================================================= */

export async function confirmAnswers(
  answerIds: string[]
) {
  if (
    answerIds.length === 0
  ) {
    throw new Error(
      "確定する答案がありません。"
    );
  }

  for (
    const answerId of
      answerIds
  ) {
    await updateAnswerStatus(
      answerId,
      "confirmed"
    );
  }
}

/* =========================================================
   公開
   ========================================================= */

export async function publishAnswers(
  answerIds: string[]
) {
  if (
    answerIds.length === 0
  ) {
    throw new Error(
      "公開する答案がありません。"
    );
  }

  for (
    const answerId of
      answerIds
  ) {
    await updateAnswerStatus(
      answerId,
      "published"
    );
  }
}

/* =========================================================
   ファイル検証
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
    file.size <= 0
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
