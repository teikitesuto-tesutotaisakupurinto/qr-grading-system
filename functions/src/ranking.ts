import {
  FieldValue,
  getFirestore,
} from "firebase-admin/firestore";

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

type RankingCandidate = {
  studentNumber: string;

  score: number;

  maxScore: number;

  total: number;
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
  ] = await Promise.all([
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

      processed: 0,

      rankings:
        [] as RankingResult[],
    };
  }

  const scores: ScoreDocument[] =
    scoresSnapshot.docs.map(
      (item) => {
        const data =
          item.data();

        return {
          studentNumber:
            typeof data.studentNumber ===
            "string"
              ? data.studentNumber
              : "",

          testId:
            typeof data.testId ===
            "string"
              ? data.testId
              : testId,

          subjectId:
            typeof data.subjectId ===
            "string"
              ? data.subjectId
              : "",

          score:
            Number(
              data.score ?? 0
            ),

          maxScore:
            Number(
              data.maxScore ??
                0
            ),

          percentage:
            Number(
              data.percentage ??
                0
            ),
        };
      }
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
     全校
     ======================================================= */

  addRankingResults(
    results,

    testId,

    "overall",

    createRanking(
      totalScores
    )
  );

  /* =======================================================
     校舎
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

    addRankingResults(
      results,

      testId,

      "school",

      createRanking(
        group
      )
    );
  }

  /* =======================================================
     学年
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

    addRankingResults(
      results,

      testId,

      "grade",

      createRanking(
        group
      )
    );
  }

  /* =======================================================
     クラス
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

    addRankingResults(
      results,

      testId,

      "class",

      createRanking(
        group
      )
    );
  }

  /* =======================================================
     教科
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
    if (!subjectId) {
      continue;
    }

    const candidates:
      RankingCandidate[] =
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
      );

    addRankingResults(
      results,

      testId,

      "subject",

      createRanking(
        candidates
      ),

      subjectId
    );
  }

  /* =======================================================
     保存
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
      const documentId =
        [
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
   結果追加
   ========================================================= */

function addRankingResults(
  output: RankingResult[],
  testId: string,
  rankingType: RankingType,
  rankings: Array<
    RankingCandidate & {
      rank: number;
    }
  >,
  subjectId?: string
) {
  for (
    const item of
      rankings
  ) {
    output.push({
      testId,

      studentNumber:
        item.studentNumber,

      rankingType,

      ...(subjectId
        ? {
            subjectId,
          }
        : {}),

      rank:
        item.rank,

      total:
        item.total,

      score:
        item.score,

      maxScore:
        item.maxScore,
    });
  }
}

/* =========================================================
   合計点
   ========================================================= */

function calculateTotalScores(
  scores: ScoreDocument[]
): RankingCandidate[] {
  const map =
    new Map<
      string,
      RankingCandidate
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
  values: RankingCandidate[]
): Array<
  RankingCandidate & {
    rank: number;
  }
> {
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
