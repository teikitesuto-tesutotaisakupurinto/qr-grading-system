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

type RankingType =
  | "overall"
  | "school"
  | "grade"
  | "class"
  | "subject";

type RankingResult = {
  testId: string;

  studentNumber: string;

  rankingType: RankingType;

  subjectId?: string;

  rank: number;

  total: number;

  score: number;

  maxScore: number;
};

/* =========================================================
   順位計算
   ========================================================= */

export async function calculateTestRankings(
  testId: string
) {
  if (!testId.trim()) {
    throw new Error(
      "testIdがありません。"
    );
  }

  const [
    scoresSnapshot,
    studentsSnapshot,
  ] =
    await Promise.all([
      db
        .collection(
          "scores"
        )
        .where(
          "testId",
          "==",
          testId
        )
        .get(),

      db
        .collection(
          "students"
        )
        .get(),
    ]);

  if (
    scoresSnapshot.empty
  ) {
    return {
      testId,

      processed:
        0,

      rankings: [],
    };
  }

  const scores: ScoreDocument[] =
    scoresSnapshot.docs.map(
      (item) =>
        ({
          studentNumber:
            item.data()
              .studentNumber,

          testId:
            item.data()
              .testId,

          subjectId:
            item.data()
              .subjectId,

          score:
            Number(
              item.data()
                .score ??
                0
            ),

          maxScore:
            Number(
              item.data()
                .maxScore ??
                0
            ),

          percentage:
            Number(
              item.data()
                .percentage ??
                0
            ),
        }) as ScoreDocument
    );

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

  const totalScores =
    calculateTotalScores(
      scores
    );

  const results:
    RankingResult[] =
    [];

  /* =======================================================
     全校順位
     ======================================================= */

  const overall =
    createRanking(
      totalScores
    );

  results.push(
    ...overall.map(
      (item) => ({
        testId,

        studentNumber:
          item.studentNumber,

        rankingType:
          "overall",

        rank:
          item.rank,

        total:
          item.total,

        score:
          item.score,

        maxScore:
          item.maxScore,
      })
    )
  );

  /* =======================================================
     校舎順位
     ======================================================= */

  const schoolGroups =
    groupBy(
      totalScores,
      (item) =>
        studentMap.get(
          item.studentNumber
        )?.schoolId ??
        ""
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

    const ranking =
      createRanking(
        group
      );

    results.push(
      ...ranking.map(
        (item) => ({
          testId,

          studentNumber:
            item.studentNumber,

          rankingType:
            "school",

          rank:
            item.rank,

          total:
            item.total,

          score:
            item.score,

          maxScore:
            item.maxScore,
        })
      )
    );
  }

  /* =======================================================
     学年順位
     ======================================================= */

  const gradeGroups =
    groupBy(
      totalScores,
      (item) =>
        studentMap.get(
          item.studentNumber
        )?.grade ??
        ""
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

    const ranking =
      createRanking(
        group
      );

    results.push(
      ...ranking.map(
        (item) => ({
          testId,

          studentNumber:
            item.studentNumber,

          rankingType:
            "grade",

          rank:
            item.rank,

          total:
            item.total,

          score:
            item.score,

          maxScore:
            item.maxScore,
        })
      )
    );
  }

  /* =======================================================
     クラス順位
     ======================================================= */

  const classGroups =
    groupBy(
      totalScores,
      (item) =>
        studentMap.get(
          item.studentNumber
        )?.classId ??
        ""
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

    const ranking =
      createRanking(
        group
      );

    results.push(
      ...ranking.map(
        (item) => ({
          testId,

          studentNumber:
            item.studentNumber,

          rankingType:
            "class",

          rank:
            item.rank,

          total:
            item.total,

          score:
            item.score,

          maxScore:
            item.maxScore,
        })
      )
    );
  }

  /* =======================================================
     教科別順位
     ======================================================= */

  const subjectGroups =
    groupBy(
      scores,
      (item) =>
        item.subjectId
    );

  for (
    const [
      subjectId,
      group,
    ] of subjectGroups
  ) {
    const subjectRanking =
      createRanking(
        group.map(
          (item) => ({
            studentNumber:
              item.studentNumber,

            score:
              item.score,

            maxScore:
              item.maxScore,

            total:
              item.score,
          })
        )
      );

    results.push(
      ...subjectRanking.map(
        (item) => ({
          testId,

          studentNumber:
            item.studentNumber,

          rankingType:
            "subject",

          subjectId,

          rank:
            item.rank,

          total:
            item.total,

          score:
            item.score,

          maxScore:
            item.maxScore,
        })
      )
    );
  }

  /* =======================================================
     Firestore保存
     ======================================================= */

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
      const documentId = [
        result.testId,

        result.rankingType,

        result.subjectId ??
          "all",

        result.studentNumber,
      ].join("_");

      batch.set(
        db
          .collection(
            "rankings"
          )
          .doc(
            documentId
          ),
        {
          testId:
            result.testId,

          studentNumber:
            result.studentNumber,

          rankingType:
            result.rankingType,

          ...(result.subjectId
            ? {
                subjectId:
                  result.subjectId,
              }
            : {}),

          rank:
            result.rank,

          total:
            result.total,

          score:
            result.score,

          maxScore:
            result.maxScore,

          calculatedAt:
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

    rankings:
      results,
  };
}

/* =========================================================
   合計点
   ========================================================= */

function calculateTotalScores(
  scores: ScoreDocument[]
) {
  const map =
    new Map<
      string,
      {
        studentNumber: string;

        score: number;

        maxScore: number;

        total: number;
      }
    >();

  for (
    const score of
      scores
  ) {
    const current =
      map.get(
        score.studentNumber
      ) ?? {
        studentNumber:
          score.studentNumber,

        score: 0,

        maxScore: 0,

        total: 0,
      };

    current.score +=
      score.score;

    current.maxScore +=
      score.maxScore;

    current.total =
      current.score;

    map.set(
      score.studentNumber,
      current
    );
  }

  return Array.from(
    map.values()
  );
}

/* =========================================================
   順位
   ========================================================= */

function createRanking(
  values: Array<{
    studentNumber: string;

    score: number;

    maxScore: number;

    total: number;
  }>
) {
  const sorted =
    [...values].sort(
      (a, b) =>
        b.score -
        a.score
    );

  let previousScore:
    | number
    | null = null;

  let previousRank =
    0;

  return sorted.map(
    (item, index) => {
      const rank =
        previousScore ===
        item.score
          ? previousRank
          : index + 1;

      previousScore =
        item.score;

      previousRank =
        rank;

      return {
        ...item,

        rank,
      };
    }
  );
}

/* =========================================================
   グループ化
   ========================================================= */

function groupBy<T>(
  values: T[],
  getKey: (
    value: T
  ) => string
): Map<string, T[]> {
  const groups =
    new Map<
      string,
      T[]
    >();

  for (
    const value of
      values
  ) {
    const key =
      getKey(value);

    const group =
      groups.get(
        key
      ) ?? [];

    group.push(
      value
    );

    groups.set(
      key,
      group
    );
  }

  return groups;
}
