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
  writeBatch,
} from "firebase/firestore";

import {
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";

import {
  httpsCallable,
} from "firebase/functions";

import {
  db,
  storage,
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

  filePath: string;
  downloadUrl?: string;

  fileName: string;
  contentType: string;
  size: number;

  status: AnswerStatus;

  reviewRequired?: boolean;

  processingError?: string;

  createdAt?: unknown;
  updatedAt?: unknown;
};

export type UploadAnswerInput = {
  testId: string;
  subjectId: string;

  studentNumber?: string;

  file: File;
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
   テスト・教科別答案取得
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

  const answerQuery =
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
    );

  const snapshot =
    await getDocs(
      answerQuery
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
   答案アップロード
   ========================================================= */

export async function uploadAnswer(
  input: UploadAnswerInput
): Promise<Answer> {
  validateUpload(
    input
  );

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
    getExtension(
      input.file.name
    );

  const filePath =
    [
      "answers",
      input.testId,
      input.subjectId,
      input.studentNumber ??
        "unassigned",
      `${answerId}.${extension}`,
    ].join("/");

  const storageReference =
    ref(
      storage,
      filePath
    );

  await uploadBytes(
    storageReference,
    input.file,
    {
      contentType:
        input.file.type,
      customMetadata: {
        answerId,
        testId:
          input.testId,
        subjectId:
          input.subjectId,
      },
    }
  );

  const downloadUrl =
    await getDownloadURL(
      storageReference
    );

  const answer: Answer = {
    id: answerId,

    testId:
      input.testId,

    subjectId:
      input.subjectId,

    studentNumber:
      input.studentNumber,

    filePath,

    downloadUrl,

    fileName:
      input.file.name,

    contentType:
      input.file.type,

    size:
      input.file.size,

    status:
      "uploaded",
  };

  await updateDoc(
    answerRef,
    {
      ...answer,

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    }
  );

  return answer;
}

/* =========================================================
   複数答案アップロード
   ========================================================= */

export async function uploadAnswers(
  inputs: UploadAnswerInput[],
  onProgress?: (
    completed: number,
    total: number
  ) => void
): Promise<Answer[]> {
  if (
    inputs.length === 0
  ) {
    return [];
  }

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
  const reference =
    doc(
      db,
      "answers",
      answerId
    );

  await updateDoc(
    reference,
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

  const reference =
    doc(
      db,
      "answers",
      answerId
    );

  await updateDoc(
    reference,
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
   処理ジョブ取得
   ========================================================= */

export async function getGradingJob(
  jobId: string
) {
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

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

/* =========================================================
   答案を再処理
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

  const result =
    await startAutoGrading(
      answer.testId,
      answer.subjectId,
      [answerId]
    );

  return result;
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
      "確定対象の答案がありません。"
    );
  }

  const batch =
    writeBatch(db);

  for (
    const answerId of
      answerIds
  ) {
    batch.update(
      doc(
        db,
        "answers",
        answerId
      ),
      {
        status:
          "confirmed",

        updatedAt:
          serverTimestamp(),
      }
    );
  }

  await batch.commit();
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
      "公開対象の答案がありません。"
    );
  }

  const batch =
    writeBatch(db);

  for (
    const answerId of
      answerIds
  ) {
    batch.update(
      doc(
        db,
        "answers",
        answerId
      ),
      {
        status:
          "published",

        publishedAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp(),
      }
    );
  }

  await batch.commit();
}

/* =========================================================
   バリデーション
   ========================================================= */

function validateUpload(
  input: UploadAnswerInput
) {
  if (
    !input.testId.trim()
  ) {
    throw new Error(
      "テストIDがありません。"
    );
  }

  if (
    !input.subjectId.trim()
  ) {
    throw new Error(
      "教科IDがありません。"
    );
  }

  if (
    input.studentNumber &&
    !/^\d{6}$/.test(
      input.studentNumber
    )
  ) {
    throw new Error(
      "生徒番号は6桁数字で指定してください。"
    );
  }

  if (!input.file) {
    throw new Error(
      "答案ファイルがありません。"
    );
  }

  const allowedTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
  ];

  if (
    !allowedTypes.includes(
      input.file.type
    )
  ) {
    throw new Error(
      "PDF・JPG・PNGのみアップロードできます。"
    );
  }

  const maxSize =
    20 * 1024 * 1024;

  if (
    input.file.size >
    maxSize
  ) {
    throw new Error(
      "答案ファイルは20MB以下にしてください。"
    );
  }
}

/* =========================================================
   拡張子
   ========================================================= */

function getExtension(
  fileName: string
): string {
  const parts =
    fileName.split(".");

  if (
    parts.length < 2
  ) {
    return "bin";
  }

  return (
    parts[
      parts.length - 1
    ].toLowerCase()
  );
}
