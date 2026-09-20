import {
  FieldValue,
  getFirestore,
} from "firebase-admin/firestore";

import {
  getStorage,
} from "firebase-admin/storage";

import {
  processAnswerPage,
} from "./ocr";

import {
  recognizeStudentQr,
} from "./qrRecognition";

import {
  correctAnswerImage,
} from "./imageCorrection";

import {
  gradeAnswer,
} from "./autoGrading";

const db = getFirestore();
const storage = getStorage();

const CHUNK_SIZE = 450;

export type AnswerProcessingJob = {
  testId: string;
  subjectId: string;
  answerIds: string[];
  requestedBy: string;

  status:
    | "queued"
    | "processing"
    | "completed"
    | "completed_with_errors"
    | "failed";

  total: number;
  processed: number;
  succeeded: number;
  reviewRequired: number;
  errors: number;

  currentChunk: number;
  totalChunks: number;

  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;

  errorMessage?: string;
};

type JobInput = {
  testId: string;
  subjectId: string;
  answerIds: string[];
  requestedBy: string;
};

export async function createAnswerProcessingJob(
  input: JobInput
): Promise<string> {
  if (input.answerIds.length === 0) {
    throw new Error(
      "処理対象の答案がありません。"
    );
  }

  const chunks = Math.ceil(
    input.answerIds.length /
      CHUNK_SIZE
  );

  const jobRef = db
    .collection("gradingJobs")
    .doc();

  const now =
    FieldValue.serverTimestamp();

  await jobRef.set({
    testId: input.testId,
    subjectId: input.subjectId,
    answerIds: input.answerIds,

    requestedBy:
      input.requestedBy,

    status: "queued",

    total:
      input.answerIds.length,

    processed: 0,
    succeeded: 0,
    reviewRequired: 0,
    errors: 0,

    currentChunk: 0,
    totalChunks: chunks,

    createdAt: now,
    updatedAt: now,
  });

  for (
    let start = 0;
    start <
    input.answerIds.length;
    start += CHUNK_SIZE
  ) {
    const answerIds =
      input.answerIds.slice(
        start,
        start + CHUNK_SIZE
      );

    const chunkRef = jobRef
      .collection("chunks")
      .doc(
        String(
          Math.floor(
            start / CHUNK_SIZE
          )
        )
      );

    await chunkRef.set({
      answerIds,

      index: Math.floor(
        start / CHUNK_SIZE
      ),

      total:
        answerIds.length,

      processed: 0,
      succeeded: 0,
      reviewRequired: 0,
      errors: 0,

      status: "queued",

      createdAt: now,
      updatedAt: now,
    });
  }

  return jobRef.id;
}

export async function processAnswerJob(
  jobId: string,
  jobData: FirebaseFirestore.DocumentData
) {
  const jobRef = db
    .collection("gradingJobs")
    .doc(jobId);

  if (
    jobData.status ===
      "completed" ||
    jobData.status ===
      "failed"
  ) {
    return;
  }

  await jobRef.update({
    status: "processing",
    updatedAt:
      FieldValue.serverTimestamp(),
  });

  try {
    const chunksSnapshot =
      await jobRef
        .collection("chunks")
        .orderBy("index")
        .get();

    for (
      const chunkDoc of
        chunksSnapshot.docs
    ) {
      const chunk =
        chunkDoc.data();

      if (
        chunk.status ===
          "completed" ||
        chunk.status ===
          "completed_with_errors"
      ) {
        continue;
      }

      await processChunk(
        jobId,
        chunkDoc.id,
        chunk,
        jobData
      );
    }

    const finalSnapshot =
      await jobRef.get();

    const finalData =
      finalSnapshot.data();

    if (!finalData) {
      throw new Error(
        "処理ジョブが見つかりません。"
      );
    }

    const finalStatus =
      finalData.errors > 0
        ? "completed_with_errors"
        : "completed";

    await jobRef.update({
      status: finalStatus,
      updatedAt:
        FieldValue.serverTimestamp(),
    });
  } catch (error) {
    await jobRef.update({
      status: "failed",
      errorMessage:
        error instanceof Error
          ? error.message
          : "答案処理に失敗しました。",
      updatedAt:
        FieldValue.serverTimestamp(),
    });

    throw error;
  }
}

async function processChunk(
  jobId: string,
  chunkId: string,
  chunk: FirebaseFirestore.DocumentData,
  jobData: FirebaseFirestore.DocumentData
) {
  const jobRef = db
    .collection("gradingJobs")
    .doc(jobId);

  const chunkRef = jobRef
    .collection("chunks")
    .doc(chunkId);

  await chunkRef.update({
    status: "processing",
    updatedAt:
      FieldValue.serverTimestamp(),
  });

  let processed = 0;
  let succeeded = 0;
  let reviewRequired = 0;
  let errors = 0;

  for (
    const answerId of
      chunk.answerIds as string[]
  ) {
    try {
      const result =
        await processSingleAnswer(
          answerId,
          jobData
        );

      processed++;

      if (result.success) {
        succeeded++;
      }

      if (
        result.reviewRequired
      ) {
        reviewRequired++;
      }
    } catch (error) {
      processed++;
      errors++;

      await saveAnswerProcessingError(
        answerId,
        error
      );
    }

    await chunkRef.update({
      processed,
      succeeded,
      reviewRequired,
      errors,
      updatedAt:
        FieldValue.serverTimestamp(),
    });

    await jobRef.update({
      processed:
        FieldValue.increment(1),

      succeeded:
        resultSucceededIncrement(
          true,
          false
        ),

      updatedAt:
        FieldValue.serverTimestamp(),
    });
  }

  const chunkStatus =
    errors > 0
      ? "completed_with_errors"
      : "completed";

  await chunkRef.update({
    status: chunkStatus,
    updatedAt:
      FieldValue.serverTimestamp(),
  });

  /*
   * 親ジョブの集計値を正確に再集計します。
   * 同時実行によるカウントずれを防ぎます。
   */
  await recalculateJobCounters(
    jobId
  );
}

function resultSucceededIncrement(
  _success: boolean,
  _review: boolean
) {
  /*
   * 実際の値はチャンク再集計で確定するため、
   * 親ジョブでは直接加算しません。
   */
  return FieldValue.increment(0);
}

async function processSingleAnswer(
  answerId: string,
  jobData: FirebaseFirestore.DocumentData
) {
  const answerRef = db
    .collection("answers")
    .doc(answerId);

  const answerSnapshot =
    await answerRef.get();

  if (!answerSnapshot.exists) {
    throw new Error(
      `答案 ${answerId} が存在しません。`
    );
  }

  const answer =
    answerSnapshot.data();

  if (!answer) {
    throw new Error(
      `答案 ${answerId} のデータを取得できません。`
    );
  }

  await answerRef.update({
    status: "processing",
    updatedAt:
      FieldValue.serverTimestamp(),
  });

  const filePath =
    answer.filePath;

  if (
    typeof filePath !==
    "string"
  ) {
    throw new Error(
      "答案ファイルのパスがありません。"
    );
  }

  const bucket =
    storage.bucket();

  const file =
    bucket.file(filePath);

  const [buffer] =
    await file.download();

  /*
   * 画像補正
   */
  const corrected =
    await correctAnswerImage(
      buffer
    );

  /*
   * QR認識
   */
  const qrResult =
    await recognizeStudentQr(
      corrected.buffer
    );

  if (!qrResult.studentNumber) {
    throw new Error(
      "生徒QRコードを認識できませんでした。"
    );
  }

  /*
   * OCR
   */
  const ocrResult =
    await processAnswerPage(
      corrected.buffer,
      jobData.testId,
      jobData.subjectId
    );

  /*
   * 自動採点
   */
  const gradingResult =
    await gradeAnswer({
      testId:
        jobData.testId,

      subjectId:
        jobData.subjectId,

      studentNumber:
        qrResult.studentNumber,

      answerId,

      ocrResult,
    });

  await db
    .collection("gradingResults")
    .doc(answerId)
    .set(
      {
        answerId,

        testId:
          jobData.testId,

        subjectId:
          jobData.subjectId,

        studentNumber:
          qrResult.studentNumber,

        ocr:
          ocrResult,

        grading:
          gradingResult,

        reviewRequired:
          gradingResult.reviewRequired,

        updatedAt:
          FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      }
    );

  await answerRef.update({
    studentNumber:
      qrResult.studentNumber,

    status:
      gradingResult.reviewRequired
        ? "graded"
        : "graded",

    updatedAt:
      FieldValue.serverTimestamp(),
  });

  return {
    success: true,

    reviewRequired:
      gradingResult.reviewRequired,
  };
}

async function saveAnswerProcessingError(
  answerId: string,
  error: unknown
) {
  const message =
    error instanceof Error
      ? error.message
      : "不明な処理エラー";

  await db
    .collection("answers")
    .doc(answerId)
    .set(
      {
        status: "error",

        processingError:
          message,

        updatedAt:
          FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      }
    );
}

async function recalculateJobCounters(
  jobId: string
) {
  const chunks =
    await db
      .collection("gradingJobs")
      .doc(jobId)
      .collection("chunks")
      .get();

  let processed = 0;
  let succeeded = 0;
  let reviewRequired = 0;
  let errors = 0;

  for (
    const chunk of
      chunks.docs
  ) {
    const data =
      chunk.data();

    processed +=
      Number(
        data.processed ?? 0
      );

    succeeded +=
      Number(
        data.succeeded ?? 0
      );

    reviewRequired +=
      Number(
        data.reviewRequired ??
          0
      );

    errors +=
      Number(
        data.errors ?? 0
      );
  }

  await db
    .collection("gradingJobs")
    .doc(jobId)
    .update({
      processed,
      succeeded,
      reviewRequired,
      errors,
      updatedAt:
        FieldValue.serverTimestamp(),
    });
}
