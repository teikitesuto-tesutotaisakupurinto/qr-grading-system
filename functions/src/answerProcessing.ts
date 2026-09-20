import {
  FieldValue,
  getFirestore,
  type DocumentData,
} from "firebase-admin/firestore";

import {
  recognizeStudentQr,
} from "./qrRecognition";

import {
  correctAnswerImage,
} from "./imageCorrection";

import {
  processAnswerPage,
} from "./ocr";

import {
  gradeAnswer,
} from "./autoGrading";

import {
  downloadAnswerFile,
} from "./supabase";

const db =
  getFirestore();

const CHUNK_SIZE = 100;

/* =========================================================
   型
   ========================================================= */

type JobInput = {
  testId: string;
  subjectId: string;
  answerIds: string[];
  requestedBy: string;
};

type ProcessResult = {
  success: boolean;
  reviewRequired: boolean;
};

/* =========================================================
   採点ジョブ作成
   ========================================================= */

export async function createAnswerProcessingJob(
  input: JobInput
): Promise<string> {
  const answerIds =
    Array.from(
      new Set(
        input.answerIds
      )
    );

  if (
    answerIds.length === 0
  ) {
    throw new Error(
      "処理対象の答案がありません。"
    );
  }

  const totalChunks =
    Math.ceil(
      answerIds.length /
        CHUNK_SIZE
    );

  const jobRef =
    db
      .collection(
        "gradingJobs"
      )
      .doc();

  const batch =
    db.batch();

  batch.set(
    jobRef,
    {
      testId:
        input.testId,

      subjectId:
        input.subjectId,

      requestedBy:
        input.requestedBy,

      status:
        "queued",

      total:
        answerIds.length,

      processed: 0,

      succeeded: 0,

      reviewRequired: 0,

      errors: 0,

      currentChunk: 0,

      totalChunks,

      createdAt:
        FieldValue.serverTimestamp(),

      updatedAt:
        FieldValue.serverTimestamp(),
    }
  );

  for (
    let index = 0;
    index < totalChunks;
    index++
  ) {
    const start =
      index *
      CHUNK_SIZE;

    const ids =
      answerIds.slice(
        start,
        start +
          CHUNK_SIZE
      );

    batch.set(
      jobRef
        .collection(
          "chunks"
        )
        .doc(
          String(index)
        ),
      {
        index,

        answerIds:
          ids,

        total:
          ids.length,

        processed: 0,

        succeeded: 0,

        reviewRequired: 0,

        errors: 0,

        status:
          "queued",

        createdAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),
      }
    );
  }

  await batch.commit();

  return jobRef.id;
}

/* =========================================================
   ジョブ実行
   ========================================================= */

export async function processAnswerJob(
  jobId: string,
  jobData: DocumentData
) {
  const jobRef =
    db
      .collection(
        "gradingJobs"
      )
      .doc(jobId);

  const snapshot =
    await jobRef.get();

  if (!snapshot.exists) {
    throw new Error(
      "答案処理ジョブが存在しません。"
    );
  }

  const current =
    snapshot.data();

  if (
    current?.status ===
      "completed" ||
    current?.status ===
      "completed_with_errors"
  ) {
    return;
  }

  await jobRef.update({
    status:
      "processing",

    startedAt:
      FieldValue.serverTimestamp(),

    updatedAt:
      FieldValue.serverTimestamp(),
  });

  try {
    const chunks =
      await jobRef
        .collection(
          "chunks"
        )
        .orderBy(
          "index",
          "asc"
        )
        .get();

    for (
      const chunkDoc of
        chunks.docs
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

      await jobRef.update({
        currentChunk:
          Number(
            chunk.index
          ) + 1,

        updatedAt:
          FieldValue.serverTimestamp(),
      });
    }

    const finalSnapshot =
      await jobRef.get();

    const finalData =
      finalSnapshot.data();

    const status =
      Number(
        finalData?.errors ??
          0
      ) > 0
        ? "completed_with_errors"
        : "completed";

    await jobRef.update({
      status,

      completedAt:
        FieldValue.serverTimestamp(),

      updatedAt:
        FieldValue.serverTimestamp(),
    });
  } catch (error) {
    await jobRef.update({
      status:
        "failed",

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

/* =========================================================
   チャンク処理
   ========================================================= */

async function processChunk(
  jobId: string,
  chunkId: string,
  chunk: DocumentData,
  jobData: DocumentData
) {
  const chunkRef =
    db
      .collection(
        "gradingJobs"
      )
      .doc(jobId)
      .collection(
        "chunks"
      )
      .doc(chunkId);

  await chunkRef.update({
    status:
      "processing",

    startedAt:
      FieldValue.serverTimestamp(),

    updatedAt:
      FieldValue.serverTimestamp(),
  });

  let processed = 0;

  let succeeded = 0;

  let reviewRequired = 0;

  let errors = 0;

  const answerIds =
    Array.isArray(
      chunk.answerIds
    )
      ? (
          chunk.answerIds as string[]
        )
      : [];

  for (
    const answerId of
      answerIds
  ) {
    try {
      const result =
        await processSingleAnswer(
          answerId,
          jobData
        );

      succeeded++;

      if (
        result.reviewRequired
      ) {
        reviewRequired++;
      }
    } catch (error) {
      errors++;

      await saveAnswerProcessingError(
        answerId,
        error
      );
    }

    processed++;

    await chunkRef.update({
      processed,

      succeeded,

      reviewRequired,

      errors,

      updatedAt:
        FieldValue.serverTimestamp(),
    });

    await recalculateJobCounters(
      jobId
    );
  }

  await chunkRef.update({
    status:
      errors > 0
        ? "completed_with_errors"
        : "completed",

    completedAt:
      FieldValue.serverTimestamp(),

    updatedAt:
      FieldValue.serverTimestamp(),
  });

  await recalculateJobCounters(
    jobId
  );
}

/* =========================================================
   1答案処理
   ========================================================= */

async function processSingleAnswer(
  answerId: string,
  jobData: DocumentData
): Promise<ProcessResult> {
  const answerRef =
    db
      .collection(
        "answers"
      )
      .doc(answerId);

  const snapshot =
    await answerRef.get();

  if (!snapshot.exists) {
    throw new Error(
      `答案 ${answerId} が存在しません。`
    );
  }

  const answer =
    snapshot.data();

  if (!answer) {
    throw new Error(
      "答案データがありません。"
    );
  }

  if (
    answer.testId !==
    jobData.testId
  ) {
    throw new Error(
      "答案のテストIDが一致しません。"
    );
  }

  if (
    answer.subjectId !==
    jobData.subjectId
  ) {
    throw new Error(
      "答案の教科IDが一致しません。"
    );
  }

  const fileKey =
    answer.fileKey;

  if (
    typeof fileKey !==
      "string" ||
    !fileKey
  ) {
    throw new Error(
      "答案ファイルキーがありません。"
    );
  }

  await answerRef.update({
    status:
      "processing",

    processingStartedAt:
      FieldValue.serverTimestamp(),

    updatedAt:
      FieldValue.serverTimestamp(),
  });

  /*
   * Supabase StorageのPrivate Bucket
   * から答案を取得。
   */
  const buffer =
    await downloadAnswerFile(
      fileKey
    );

  if (
    buffer.length === 0
  ) {
    throw new Error(
      "答案ファイルが空です。"
    );
  }

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
  const qr =
    await recognizeStudentQr(
      corrected.buffer
    );

  if (
    !qr.studentNumber
  ) {
    throw new Error(
      "生徒番号QRを認識できませんでした。"
    );
  }

  if (
    !/^\d{6}$/.test(
      qr.studentNumber
    )
  ) {
    throw new Error(
      "認識した生徒番号が6桁ではありません。"
    );
  }

  /*
   * 既に生徒番号が登録されている場合、
   * QRと一致するか確認。
   */
  if (
    typeof answer.studentNumber ===
      "string" &&
    answer.studentNumber !==
      qr.studentNumber
  ) {
    throw new Error(
      "QRの生徒番号と登録済み生徒番号が一致しません。"
    );
  }

  /*
   * OCR
   */
  const ocr =
    await processAnswerPage(
      corrected.buffer,
      jobData.testId,
      jobData.subjectId
    );

  /*
   * 自動採点
   */
  const grading =
    await gradeAnswer({
      testId:
        jobData.testId,

      subjectId:
        jobData.subjectId,

      studentNumber:
        qr.studentNumber,

      answerId,

      ocrResult:
        ocr,
    });

  /*
   * 採点結果保存
   */
  await db
    .collection(
      "gradingResults"
    )
    .doc(answerId)
    .set(
      {
        answerId,

        testId:
          jobData.testId,

        subjectId:
          jobData.subjectId,

        studentNumber:
          qr.studentNumber,

        ocr,

        grading,

        reviewRequired:
          grading.reviewRequired,

        updatedAt:
          FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      }
    );

  /*
   * 答案状態更新
   */
  await answerRef.update({
    studentNumber:
      qr.studentNumber,

    status:
      "graded",

    qrRecognition: {
      studentNumber:
        qr.studentNumber,

      confidence:
        qr.confidence,
    },

    ocrCompleted:
      true,

    autoGraded:
      true,

    reviewRequired:
      grading.reviewRequired,

    processingCompletedAt:
      FieldValue.serverTimestamp(),

    updatedAt:
      FieldValue.serverTimestamp(),
  });

  return {
    success: true,

    reviewRequired:
      grading.reviewRequired,
  };
}

/* =========================================================
   エラー保存
   ========================================================= */

async function saveAnswerProcessingError(
  answerId: string,
  error: unknown
) {
  const message =
    error instanceof Error
      ? error.message
      : "不明な処理エラー";

  await db
    .collection(
      "answers"
    )
    .doc(answerId)
    .set(
      {
        status:
          "error",

        processingError:
          message,

        processingFailedAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      }
    );
}

/* =========================================================
   ジョブ集計
   ========================================================= */

async function recalculateJobCounters(
  jobId: string
) {
  const snapshot =
    await db
      .collection(
        "gradingJobs"
      )
      .doc(jobId)
      .collection(
        "chunks"
      )
      .get();

  let processed = 0;

  let succeeded = 0;

  let reviewRequired = 0;

  let errors = 0;

  for (
    const chunkDoc of
      snapshot.docs
  ) {
    const data =
      chunkDoc.data();

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
    .collection(
      "gradingJobs"
    )
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
