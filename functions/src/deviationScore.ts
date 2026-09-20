import {
  FieldValue,
  getFirestore,
} from "firebase-admin/firestore";

/* =========================================================
   Firestore
   ========================================================= */

const db =
  getFirestore();

/* =========================================================
   型
   ========================================================= */

type ScoreDocument = {
  id?: string;

  studentNumber: string;

  testId: string;

  subjectId: string;

  score: number;

  maxScore: number;

  percentage: number;
};

type StudentInfo = {
  id: string;

  schoolId?: string;

  grade?: string;

  classId?: string;

  className?: string;
};

type DeviationResult = {
  studentNumber: string;

  testId: string;

  subjectId: string;

  score: number;

  maxScore: number;

  percentage: number;

  deviationScore: number;

  population: number;

  mean: number;

  standardDeviation: number;
};

/* =========================================================
   テスト偏差値計算
   ========================================================= */

export async function calculateTestDeviationScores(
  testId: string
) {
  if (!testId.trim()) {
    throw new Error(
      "testIdがありません。"
    );
  }

  const scoresSnapshot =
    await db
      .collection(
        "scores"
      )
      .where(
        "testId",
        "==",
        testId
      )
      .get();

  if (
    scoresSnapshot.empty
  ) {
    return {
      testId,

      processed:
        0,

      results: [],
    };
  }

  const scores: ScoreDocument[] =
    scoresSnapshot.docs.map(
      (item) =>
        ({
          id: item.id,

          ...item.data(),
        }) as ScoreDocument
    );

  const studentsSnapshot =
    await db
      .collection(
        "students"
      )
      .get();

  const students: StudentInfo[] =
    studentsSnapshot.docs.map(
      (item) =>
        ({
          id: item.id,

          ...item.data(),
        }) as StudentInfo
    );

  const studentMap =
    new Map<
      string,
      StudentInfo
    >();

  for (
    const student of
      students
  ) {
    studentMap.set(
      student.id,
      student
    );
  }

  const grouped =
    new Map<
      string,
      ScoreDocument[]
    >();

  for (
    const score of
      scores
  ) {
    const key =
      score.subjectId;

    const list =
      grouped.get(
        key
      ) ?? [];

    list.push(
      score
    );

    grouped.set(
      key,
      list
    );
  }

  const results:
    DeviationResult[] =
    [];

  for (
    const [
      subjectId,
      subjectScores,
    ] of grouped
  ) {
    const values =
      subjectScores
        .map(
          (score) =>
            Number(
              score.score
            )
        )
        .filter(
          (value) =>
            Number.isFinite(
              value
            )
        );

    if (
      values.length === 0
    ) {
      continue;
    }

    const mean =
      calculateMean(
        values
      );

    const standardDeviation =
      calculateStandardDeviation(
        values,
        mean
      );

    for (
      const score of
        subjectScores
    ) {
      const student =
        studentMap.get(
          score.studentNumber
        );

      const percentage =
        Number.isFinite(
          score.percentage
        )
          ? score.percentage
          : score.maxScore > 0
          ? (
              score.score /
              score.maxScore
            ) *
            100
          : 0;

      const deviationScore =
        calculateDeviation(
          score.score,
          mean,
          standardDeviation
        );

      results.push({
        studentNumber:
          score.studentNumber,

        testId,

        subjectId,

        score:
          score.score,

        maxScore:
          score.maxScore,

        percentage,

        deviationScore,

        population:
          values.length,

        mean,

        standardDeviation,
      });

      /*
       * StudentInfoを参照して、
       * 校舎・学年・クラス別計算へ
       * 拡張できるようにしておく。
       */
      void student;
    }
  }

  /*
   * Firestore保存
   */
  const BATCH_SIZE = 400;

  for (
    let start = 0;
    start < results.length;
    start += BATCH_SIZE
  ) {
    const batch =
      db.batch();

    const chunk =
      results.slice(
        start,
        start +
          BATCH_SIZE
      );

    for (
      const result of
        chunk
    ) {
      const id =
        createDeviationDocumentId(
          result
        );

      const reference =
        db
          .collection(
            "deviationScores"
          )
          .doc(id);

      batch.set(
        reference,
        {
          studentNumber:
            result.studentNumber,

          testId:
            result.testId,

          subjectId:
            result.subjectId,

          score:
            result.score,

          maxScore:
            result.maxScore,

          percentage:
            result.percentage,

          deviationScore:
            result.deviationScore,

          population:
            result.population,

          mean:
            result.mean,

          standardDeviation:
            result.standardDeviation,

          updatedAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge: true,
        }
      );
    }

    await batch.commit();
  }

  return {
    testId,

    processed:
      results.length,

    results,
  };
}

/* =========================================================
   平均
   ========================================================= */

function calculateMean(
  values: number[]
): number {
  if (
    values.length === 0
  ) {
    return 0;
  }

  const total =
    values.reduce(
      (sum, value) =>
        sum + value,
      0
    );

  return (
    total /
    values.length
  );
}

/* =========================================================
   標準偏差
   ========================================================= */

function calculateStandardDeviation(
  values: number[],
  mean: number
): number {
  if (
    values.length <= 1
  ) {
    return 0;
  }

  const variance =
    values.reduce(
      (sum, value) => {
        const difference =
          value - mean;

        return (
          sum +
          difference *
            difference
        );
      },
      0
    ) /
    values.length;

  return Math.sqrt(
    variance
  );
}

/* =========================================================
   偏差値
   ========================================================= */

function calculateDeviation(
  score: number,
  mean: number,
  standardDeviation: number
): number {
  if (
    standardDeviation ===
      0 ||
    !Number.isFinite(
      standardDeviation
    )
  ) {
    return 50;
  }

  return (
    50 +
    10 *
      (
        (score -
          mean) /
        standardDeviation
      )
  );
}

/* =========================================================
   Document ID
   ========================================================= */

function createDeviationDocumentId(
  result: DeviationResult
): string {
  return [
    result.testId,

    result.subjectId,

    result.studentNumber,
  ].join("_");
}
