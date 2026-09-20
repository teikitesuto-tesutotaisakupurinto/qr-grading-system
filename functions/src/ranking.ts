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
};

type StudentInfo = {
  id: string;
  schoolId?: string;
  grade?: string;
  classId?: string;
  className?: string;
};

type RankingType =
  | "overall"
  | "school"
  | "grade"
  | "class"
  | "subject";

type RankingResult = {
  studentNumber: string;
  testId: string;
  subjectId: string;

  rankingType: RankingType;
  rankingKey: string;

  score: number;
  rank: number;
  participantCount: number;

  calculatedAt: FirebaseFirestore.FieldValue;
};

export async function calculateTestRankings(
  testId: string
) {
  const [
    scoresSnapshot,
    studentsSnapshot,
  ] = await Promise.all([
    db
      .collection("scores")
      .where(
        "testId",
        "==",
        testId
      )
      .get(),

    db
      .collection("students")
      .get(),
  ]);

  if (scoresSnapshot.empty) {
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

  const students =
    studentsSnapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        }) as StudentInfo
    );

  const studentMap =
    new Map(
      students.map(
        (student) => [
          student.id,
          student,
        ]
      )
    );

  const subjectIds =
    Array.from(
      new Set(
        scores.map(
          (score) =>
            score.subjectId
        )
      )
    );

  const resultIds: string[] =
    [];

  for (
    const subjectId of
      subjectIds
  ) {
    const subjectScores =
      scores.filter(
        (score) =>
          score.subjectId ===
          subjectId
      );

    /*
     * 全校
     */
    await calculatePopulationRanking(
      testId,
      subjectId,
      subjectScores,
      "overall",
      "all",
      resultIds
    );

    /*
     * 校舎
     */
    const schoolGroups =
      groupBy(
        subjectScores,
        (score) =>
          studentMap.get(
            score.studentNumber
          )?.schoolId ?? ""
      );

    for (
      const [
        schoolId,
        group,
      ] of schoolGroups
    ) {
      if (!schoolId) {
        continue;
      }

      await calculatePopulationRanking(
        testId,
        subjectId,
        group,
        "school",
        schoolId,
        resultIds
      );
    }

    /*
     * 学年
     */
    const gradeGroups =
      groupBy(
        subjectScores,
        (score) =>
          studentMap.get(
            score.studentNumber
          )?.grade ?? ""
      );

    for (
      const [
        grade,
        group,
      ] of gradeGroups
    ) {
      if (!grade) {
        continue;
      }

      await calculatePopulationRanking(
        testId,
        subjectId,
        group,
        "grade",
        grade,
        resultIds
      );
    }

    /*
     * クラス
     */
    const classGroups =
      groupBy(
        subjectScores,
        (score) => {
          const student =
            studentMap.get(
              score.studentNumber
            );

          return (
            student?.classId ??
            student?.className ??
            ""
          );
        }
      );

    for (
      const [
        classId,
        group,
      ] of classGroups
    ) {
      if (!classId) {
        continue;
      }

      await calculatePopulationRanking(
        testId,
        subjectId,
        group,
        "class",
        classId,
        resultIds
      );
    }

    /*
     * 教科別順位は、
     * subjectId自体をキーとして保存。
     *
     * 教科ごとの全校順位と同じ母集団なので、
     * subjectタイプとしても保持します。
     */
    await calculatePopulationRanking(
      testId,
      subjectId,
      subjectScores,
      "subject",
      subjectId,
      resultIds
    );
  }

  return {
    testId,
    processed:
      resultIds.length,
    results: resultIds,
  };
}

async function calculatePopulationRanking(
  testId: string,
  subjectId: string,
  scores: ScoreDocument[],
  rankingType: RankingType,
  rankingKey: string,
  resultIds: string[]
) {
  if (scores.length === 0) {
    return;
  }

  /*
   * 高得点順。
   */
  const sorted =
    [...scores].sort(
      (a, b) =>
        b.score - a.score
    );

  /*
   * 同点は同順位。
   *
   * 例：
   *
   * 90点 → 1位
   * 90点 → 1位
   * 85点 → 3位
   */
  const ranks =
    new Map<
      string,
      number
    >();

  let previousScore:
    | number
    | undefined;

  let previousRank = 0;

  for (
    let index = 0;
    index < sorted.length;
    index++
  ) {
    const current =
      sorted[index];

    const rank =
      previousScore ===
      current.score
        ? previousRank
        : index + 1;

    ranks.set(
      current.studentNumber,
      rank
    );

    previousScore =
      current.score;

    previousRank =
      rank;
  }

  /*
   * Firestoreの1バッチ上限を考慮。
   */
  const batchSize = 400;

  for (
    let start = 0;
    start < sorted.length;
    start += batchSize
  ) {
    const batch =
      db.batch();

    const chunk =
      sorted.slice(
        start,
        start + batchSize
      );

    for (
      const score of chunk
    ) {
      const rank =
        ranks.get(
          score.studentNumber
        ) ?? sorted.length;

      const resultId =
        [
          testId,
          subjectId,
          score.studentNumber,
          rankingType,
          rankingKey,
        ].join("_");

      const reference =
        db
          .collection(
            "rankings"
          )
          .doc(resultId);

      const result:
        RankingResult = {
          studentNumber:
            score.studentNumber,

          testId,

          subjectId,

          rankingType,

          rankingKey,

          score:
            score.score,

          rank,

          participantCount:
            sorted.length,

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
       * scoresにも順位を保存。
       */
      const scoreReference =
        db
          .collection("scores")
          .doc(
            `${testId}_${subjectId}_${score.studentNumber}`
          );

      const fieldName =
        rankingType ===
        "subject"
          ? "subjectRank"
          : `${rankingType}Rank`;

      batch.set(
        scoreReference,
        {
          rankings: {
            [fieldName]: {
              key:
                rankingKey,

              rank,

              participantCount:
                sorted.length,
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

function groupBy<T>(
  items: T[],
  getKey: (item: T) => string
): Map<string, T[]> {
  const groups =
    new Map<
      string,
      T[]
    >();

  for (
    const item of items
  ) {
    const key =
      getKey(item);

    if (!groups.has(key)) {
      groups.set(
        key,
        []
      );
    }

    groups
      .get(key)!
      .push(item);
  }

  return groups;
}
