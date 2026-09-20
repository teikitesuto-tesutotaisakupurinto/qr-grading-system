import {
  getFirestore,
} from "firebase-admin/firestore";

const db = getFirestore();

type ScoreDocument = {
  studentNumber: string;
  testId: string;
  subjectId: string;
  score: number;
  maxScore: number;
  percentage: number;

  schoolId?: string;
  grade?: string;
  classId?: string;
};

type PopulationType =
  | "overall"
  | "school"
  | "grade"
  | "class";

type Population = {
  type: PopulationType;
  key: string;
  label: string;
  studentNumbers: string[];
};

type Statistics = {
  count: number;
  mean: number;
  standardDeviation: number;
};

type DeviationResult = {
  studentNumber: string;
  testId: string;
  subjectId: string;

  populationType: PopulationType;
  populationKey: string;

  score: number;
  mean: number;
  standardDeviation: number;
  deviationScore: number;

  calculatedAt: FirebaseFirestore.FieldValue;
};

/**
 * テスト全体の偏差値を計算します。
 */
export async function calculateTestDeviationScores(
  testId: string
) {
  const scoresSnapshot =
    await db
      .collection("scores")
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
      processed: 0,
      results: [],
    };
  }

  const scores =
    scoresSnapshot.docs.map(
      (doc) =>
        ({
          ...doc.data(),
        }) as ScoreDocument
    );

  const populations =
    await buildPopulations(
      scores
    );

  const resultIds: string[] =
    [];

  for (
    const population of
      populations
  ) {
    const populationScores =
      scores.filter((score) =>
        population.studentNumbers.includes(
          score.studentNumber
        )
      );

    const subjectIds =
      Array.from(
        new Set(
          populationScores.map(
            (score) =>
              score.subjectId
          )
        )
      );

    for (
      const subjectId of
        subjectIds
    ) {
      const subjectScores =
        populationScores.filter(
          (score) =>
            score.subjectId ===
            subjectId
        );

      const statistics =
        calculateStatistics(
          subjectScores
        );

      const batch =
        db.batch();

      for (
        const score of
          subjectScores
      ) {
        const deviation =
          calculateDeviationScore(
            score.score,
            statistics.mean,
            statistics.standardDeviation
          );

        const resultId =
          [
            testId,
            subjectId,
            score.studentNumber,
            population.type,
            population.key,
          ].join("_");

        const reference =
          db
            .collection(
              "deviationScores"
            )
            .doc(resultId);

        const result:
          DeviationResult = {
            studentNumber:
              score.studentNumber,

            testId,

            subjectId,

            populationType:
              population.type,

            populationKey:
              population.key,

            score:
              score.score,

            mean:
              statistics.mean,

            standardDeviation:
              statistics.standardDeviation,

            deviationScore:
              deviation,

            calculatedAt:
              FirebaseFirestore.FieldValue.serverTimestamp(),
          };

        batch.set(
          reference,
          result,
          {
            merge: true,
          }
        );

        /*
         * 生徒の scores にも
         * 母集団別偏差値を保存。
         */
        const scoreReference =
          db
            .collection("scores")
            .doc(
              `${testId}_${subjectId}_${score.studentNumber}`
            );

        batch.set(
          scoreReference,
          {
            deviationScores: {
              [population.type]: {
                key:
                  population.key,

                value:
                  deviation,
              },
            },
          },
          {
            merge: true,
          }
        );

        resultIds.push(
          resultId
        );
      }

      await batch.commit();
    }
  }

  return {
    testId,
    processed:
      resultIds.length,
    results: resultIds,
  };
}

/**
 * 母集団を作成します。
 *
 * 全校
 * 校舎
 * 学年
 * クラス
 */
async function buildPopulations(
  scores: ScoreDocument[]
): Promise<Population[]> {
  const studentsSnapshot =
    await db
      .collection("students")
      .get();

  const students =
    studentsSnapshot.docs.map(
      (doc) => ({
        id: doc.id,
        ...doc.data(),
      })
    );

  const populations: Population[] =
    [];

  /*
   * 全校
   */
  populations.push({
    type: "overall",
    key: "all",
    label: "全校",
    studentNumbers:
      students.map(
        (student) =>
          student.id
      ),
  });

  /*
   * 校舎
   */
  const schools =
    new Map<
      string,
      string[]
    >();

  for (
    const student of students
  ) {
    const schoolId =
      typeof student.schoolId ===
      "string"
        ? student.schoolId
        : "";

    if (!schoolId) {
      continue;
    }

    const current =
      schools.get(
        schoolId
      ) ?? [];

    current.push(
      student.id
    );

    schools.set(
      schoolId,
      current
    );
  }

  for (
    const [
      schoolId,
      studentNumbers,
    ] of schools
  ) {
    populations.push({
      type: "school",
      key: schoolId,
      label: schoolId,
      studentNumbers,
    });
  }

  /*
   * 学年
   */
  const grades =
    new Map<
      string,
      string[]
    >();

  for (
    const student of students
  ) {
    const grade =
      typeof student.grade ===
      "string"
        ? student.grade
        : "";

    if (!grade) {
      continue;
    }

    const current =
      grades.get(
        grade
      ) ?? [];

    current.push(
      student.id
    );

    grades.set(
      grade,
      current
    );
  }

  for (
    const [
      grade,
      studentNumbers,
    ] of grades
  ) {
    populations.push({
      type: "grade",
      key: grade,
      label: grade,
      studentNumbers,
    });
  }

  /*
   * クラス
   */
  const classes =
    new Map<
      string,
      string[]
    >();

  for (
    const student of students
  ) {
    const classId =
      typeof student.classId ===
      "string"
        ? student.classId
        : typeof student.className ===
          "string"
        ? student.className
        : "";

    if (!classId) {
      continue;
    }

    const current =
      classes.get(
        classId
      ) ?? [];

    current.push(
      student.id
    );

    classes.set(
      classId,
      current
    );
  }

  for (
    const [
      classId,
      studentNumbers,
    ] of classes
  ) {
    populations.push({
      type: "class",
      key: classId,
      label: classId,
      studentNumbers,
    });
  }

  /*
   * 実際にscoresに存在する生徒だけを
   *対象にするため、空母集団は除外。
   */
  const scoreStudentNumbers =
    new Set(
      scores.map(
        (score) =>
          score.studentNumber
      )
    );

  return populations
    .map((population) => ({
      ...population,
      studentNumbers:
        population.studentNumbers.filter(
          (studentNumber) =>
            scoreStudentNumbers.has(
              studentNumber
            )
        ),
    }))
    .filter(
      (population) =>
        population.studentNumbers
          .length > 0
    );
}

/**
 * 平均・標準偏差を計算します。
 */
function calculateStatistics(
  scores: ScoreDocument[]
): Statistics {
  const values =
    scores.map(
      (score) =>
        score.score
    );

  if (values.length === 0) {
    return {
      count: 0,
      mean: 0,
      standardDeviation: 0,
    };
  }

  const mean =
    values.reduce(
      (sum, value) =>
        sum + value,
      0
    ) / values.length;

  const variance =
    values.reduce(
      (sum, value) =>
        sum +
        Math.pow(
          value - mean,
          2
        ),
      0
    ) / values.length;

  return {
    count:
      values.length,

    mean,

    standardDeviation:
      Math.sqrt(
        variance
      ),
  };
}

/**
 * 偏差値 = 50 + 10 × (得点 - 平均) / 標準偏差
 */
function calculateDeviationScore(
  score: number,
  mean: number,
  standardDeviation: number
): number {
  if (
    standardDeviation === 0
  ) {
    return 50;
  }

  const value =
    50 +
    10 *
      ((score - mean) /
        standardDeviation);

  /*
   * 小数第1位まで。
   */
  return Math.round(
    value * 10
  ) / 10;
}
