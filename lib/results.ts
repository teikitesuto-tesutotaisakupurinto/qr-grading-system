"use client";

import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import {
  db,
} from "@/lib/firebase";

import {
  getAppUser,
} from "@/lib/auth";

import type {
  Answer,
  GradeReport,
  GradeReportSubject,
  GradingResult,
  StudentResult,
  UserRole,
} from "@/lib/types";

/* =========================================================
   Types
   ========================================================= */

export type CreateResultInput = {
  organizationId?: string;

  answerId: string;

  studentId: string;

  studentNumber: string;

  testId: string;

  testName: string;

  subject: string;

  schoolId: string;

  score: number;

  maxScore: number;

  source?:
    | "通常"
    | "追試";
};

export type ResultCalculation = {
  average:
    | number
    | null;

  deviationScore:
    | number
    | null;

  rank:
    | number
    | null;

  population:
    | number
    | null;
};

/* =========================================================
   Create result from confirmed answer
   ========================================================= */

export async function createResultFromConfirmedAnswer(
  input: CreateResultInput
) {
  const user =
    await getAppUser();

  if (
    !user
  ) {
    throw new Error(
      "ログインしてください。"
    );
  }

  assertResultManager(
    user.role
  );

  if (
    !user.organizationId
  ) {
    throw new Error(
      "所属組織が設定されていません。"
    );
  }

  if (
    input.organizationId &&
    input.organizationId !==
      user.organizationId
  ) {
    throw new Error(
      "所属組織が一致しません。"
    );
  }

  /*
   * 既存結果の重複作成を防ぐ。
   */
  const existing =
    await findResultByAnswerId(
      input.answerId
    );

  if (
    existing
  ) {
    return existing;
  }

  /*
   * 校舎権限。
   */
  if (
    user.role !==
    "本部管理者"
  ) {
    if (
      !user.schoolIds.includes(
        input.schoolId
      )
    ) {
      throw new Error(
        "この校舎の成績を作成する権限がありません。"
      );
    }
  }

  if (
    !input.studentId
  ) {
    throw new Error(
      "生徒IDがありません。"
    );
  }

  if (
    !input.testId
  ) {
    throw new Error(
      "テストIDがありません。"
    );
  }

  if (
    !Number.isFinite(
      input.score
    ) ||
    !Number.isFinite(
      input.maxScore
    )
  ) {
    throw new Error(
      "得点または満点が不正です。"
    );
  }

  if (
    input.score <
      0 ||
    input.score >
      input.maxScore
  ) {
    throw new Error(
      "得点が範囲外です。"
    );
  }

  const resultRef =
    doc(
      collection(
        db,
        "results"
      )
    );

  await setDoc(
    resultRef,
    {
      organizationId:
        user.organizationId,

      schoolId:
        input.schoolId,

      answerId:
        input.answerId,

      studentId:
        input.studentId,

      studentNumber:
        input.studentNumber,

      testId:
        input.testId,

      testName:
        input.testName,

      subject:
        input.subject,

      score:
        input.score,

      maxScore:
        input.maxScore,

      percentage:
        calculatePercentage(
          input.score,
          input.maxScore
        ),

      average:
        null,

      deviationScore:
        null,

      rank:
        null,

      population:
        null,

      source:
        input.source ??
        "通常",

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    }
  );

  return {
    id:
      resultRef.id,

    organizationId:
      user.organizationId,

    schoolId:
      input.schoolId,

    answerId:
      input.answerId,

    studentId:
      input.studentId,

    studentNumber:
      input.studentNumber,

    testId:
      input.testId,

    testName:
      input.testName,

    subject:
      input.subject,

    score:
      input.score,

    maxScore:
      input.maxScore,

    percentage:
      calculatePercentage(
        input.score,
        input.maxScore
      ),

    average:
      null,

    deviationScore:
      null,

    rank:
      null,

    population:
      null,

    source:
      input.source ??
      "通常",
  };
}

/* =========================================================
   Generate result from confirmed answer
   ========================================================= */

export async function generateResultFromAnswer(
  answer: Answer,
  testName: string,
  subject: string
) {
  if (
    answer.status !==
    "confirmed"
  ) {
    throw new Error(
      "採点確定済みの答案だけ成績化できます。"
    );
  }

  if (
    !answer.studentId
  ) {
    throw new Error(
      "答案に生徒が紐付いていません。"
    );
  }

  return createResultFromConfirmedAnswer(
    {
      organizationId:
        answer.organizationId,

      answerId:
        answer.id,

      studentId:
        answer.studentId,

      studentNumber:
        answer.studentNumber ??
        "",

      testId:
        answer.testId,

      testName,

      subject,

      schoolId:
        answer.schoolId,

      score:
        answer.totalScore,

      maxScore:
        answer.totalMaxScore,

      source:
        "通常",
    }
  );
}

/* =========================================================
   Publish scores
   ========================================================= */

export async function publishScores(
  testId: string,
  subjectId?: string
) {
  const user =
    await getAppUser();

  if (
    !user
  ) {
    throw new Error(
      "ログインしてください。"
    );
  }

  assertResultManager(
    user.role
  );

  if (
    !user.organizationId
  ) {
    throw new Error(
      "所属組織が設定されていません。"
    );
  }

  if (
    !testId.trim()
  ) {
    throw new Error(
      "テストIDが指定されていません。"
    );
  }

  /*
   * 対象答案を取得。
   */
  const answerConstraints = [
    where(
      "organizationId",
      "==",
      user.organizationId
    ),

    where(
      "testId",
      "==",
      testId
    ),
  ];

  if (
    subjectId
  ) {
    answerConstraints.push(
      where(
        "subjectId",
        "==",
        subjectId
      )
    );
  }

  const answerSnapshot =
    await getDocs(
      query(
        collection(
          db,
          "answers"
        ),
        ...answerConstraints
      )
    );

  /*
   * 権限範囲内の答案だけを対象にする。
   */
  const answers =
    answerSnapshot.docs.filter(
      (
        item
      ) => {
        const data =
          item.data();

        if (
          user.role ===
          "本部管理者"
        ) {
          return true;
        }

        return user.schoolIds.includes(
          stringValue(
            data.schoolId
          )
        );
      }
    );

  if (
    answers.length ===
    0
  ) {
    throw new Error(
      "対象となる答案がありません。"
    );
  }

  /*
   * 全員・全答案が採点確定しているか確認。
   *
   * 1件でも未確定なら、
   * 点数公開へ進めない。
   */
  const unconfirmed =
    answers.filter(
      (
        item
      ) =>
        item.data().status !==
        "confirmed"
    );

  if (
    unconfirmed.length >
    0
  ) {
    throw new Error(
      `まだ採点が確定していない答案が${unconfirmed.length}件あります。全員の採点を確定してください。`
    );
  }

  /*
   * 全員確定済み。
   *
   * ここで初めて点数公開。
   */
  const answerChunks =
    chunk(
      answers,
      400
    );

  for (
    const current of
      answerChunks
  ) {
    const batch =
      writeBatch(
        db
      );

    for (
      const answer of
        current
    ) {
      batch.update(
        doc(
          db,
          "answers",
          answer.id
        ),
        {
          status:
            "published",

          scorePublished:
            true,

          scorePublishedAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        }
      );
    }

    await batch.commit();
  }

  /*
   * 点数公開後に成績計算。
   *
   * 既存の統計計算処理を利用する。
   */
  const calculation =
    await recalculateTestStatistics(
      testId,
      subjectId
    );

  return {
    testId,

    subjectId:
      subjectId ??
      null,

    publishedCount:
      answers.length,

    calculatedCount:
      calculation.count,

    average:
      calculation.average,

    standardDeviation:
      calculation.standardDeviation,

    results:
      calculation.results,
  };
}

/* =========================================================
   Recalculate test statistics
   ========================================================= */

export async function recalculateTestStatistics(
  testId: string,
  subject?: string
) {
  const user =
    await getAppUser();

  if (
    !user
  ) {
    throw new Error(
      "ログインしてください。"
    );
  }

  assertResultManager(
    user.role
  );

  if (
    !user.organizationId
  ) {
    throw new Error(
      "所属組織がありません。"
    );
  }

  const baseConstraints = [
    where(
      "organizationId",
      "==",
      user.organizationId
    ),

    where(
      "testId",
      "==",
      testId
    ),
  ];

  if (
    subject
  ) {
    baseConstraints.push(
      where(
        "subject",
        "==",
        subject
      )
    );
  }

  const snapshot =
    await getDocs(
      query(
        collection(
          db,
          "results"
        ),
        ...baseConstraints
      )
    );

  const results =
    snapshot.docs
      .map(
        (
          item
        ) =>
          normalizeResult(
            item.id,
            item.data()
          )
      )
      .filter(
        (
          result
        ) =>
          canAccessSchoolResult(
            result,
            user
          )
      );

  if (
    results.length ===
    0
  ) {
    return {
      count:
        0,

      average:
        null,

      standardDeviation:
        0,

      results:
        [],
    };
  }

  const scores =
    results.map(
      (
        result
      ) =>
        result.score
    );

  const average =
    calculateAverage(
      scores
    );

  const standardDeviation =
    calculateStandardDeviation(
      scores
    );

  const ranked =
    results.map(
      (
        result
      ) => {
        const deviation =
          calculateDeviationScore(
            result.score,
            average,
            standardDeviation
          );

        const rank =
          calculateRank(
            result.score,
            scores
          );

        return {
          ...result,

          average,

          deviationScore:
            deviation,

          rank,

          population:
            results.length,
        };
      }
    );

  /*
   * 一度に500件以上を扱わない。
   */
  const chunks =
    chunk(
      ranked,
      400
    );

  for (
    const current of
      chunks
  ) {
    const batch =
      writeBatch(
        db
      );

    for (
      const result of
        current
    ) {
      batch.update(
        doc(
          db,
          "results",
          result.id
        ),
        {
          average:
            result.average,

          deviationScore:
            result.deviationScore,

          rank:
            result.rank,

          population:
            result.population,

          updatedAt:
            serverTimestamp(),
        }
      );
    }

    await batch.commit();
  }

  return {
    count:
      ranked.length,

    average,

    standardDeviation,

    results:
      ranked,
  };
}

/* =========================================================
   Create grade report
   ========================================================= */

export async function createGradeReport(
  studentId: string,
  testId: string
) {
  const user =
    await getAppUser();

  if (
    !user
  ) {
    throw new Error(
      "ログインしてください。"
    );
  }

  if (
    user.role ===
    "生徒"
  ) {
    /*
     * 生徒は自分の成績を
     * 直接生成できない。
     */
    throw new Error(
      "成績表を生成する権限がありません。"
    );
  }

  if (
    !user.organizationId
  ) {
    throw new Error(
      "所属組織がありません。"
    );
  }

  /*
   * 生徒情報。
   */
  const studentSnapshot =
    await getDocs(
      query(
        collection(
          db,
          "students"
        ),

        where(
          "organizationId",
          "==",
          user.organizationId
        ),

        where(
          "__name__",
          "==",
          studentId
        )
      )
    );

  /*
   * Firestoreではdocument IDの
   * where("__name__")より直接getDocする方が
   * 安定するため、見つからない場合は
   * document参照を使う。
   */

  let studentData:
    Record<
      string,
      unknown
    > | null =
    null;

  if (
    studentSnapshot.docs.length >
    0
  ) {
    studentData =
      studentSnapshot.docs[0].data();
  } else {
    const studentDoc =
      await import(
        "firebase/firestore"
      ).then(
        async ({
          getDoc,
          doc,
        }) =>
          getDoc(
            doc(
              db,
              "students",
              studentId
            )
          )
      );

    if (
      studentDoc.exists()
    ) {
      studentData =
        studentDoc.data();
    }
  }

  if (
    !studentData
  ) {
    throw new Error(
      "生徒が見つかりません。"
    );
  }

  const schoolId =
    stringValue(
      studentData.schoolId
    );

  if (
    !canAccessSchoolId(
      user,
      schoolId
    )
  ) {
    throw new Error(
      "この生徒の成績表を作成する権限がありません。"
    );
  }

  /*
   * テスト結果。
   */
  const resultSnapshot =
    await getDocs(
      query(
        collection(
          db,
          "results"
        ),

        where(
          "organizationId",
          "==",
          user.organizationId
        ),

        where(
          "studentId",
          "==",
          studentId
        ),

        where(
          "testId",
          "==",
          testId
        )
      )
    );

  const results =
    resultSnapshot.docs
      .map(
        (
          item
        ) =>
          normalizeResult(
            item.id,
            item.data()
          )
      )
      .filter(
        (
          result
        ) =>
          canAccessSchoolResult(
            result,
            user
          )
      );

  if (
    results.length ===
    0
  ) {
    throw new Error(
      "成績データがありません。"
    );
  }

  const testName =
    results[0].testName;

  /*
   * 科目ごとにまとめる。
   */
  const subjects =
    buildReportSubjects(
      results
    );

  const totalScore =
    subjects.reduce(
      (
        total,
        subject
      ) =>
        total +
        subject.score,
      0
    );

  const totalMaxScore =
    subjects.reduce(
      (
        total,
        subject
      ) =>
        total +
        subject.maxScore,
      0
    );

  const totalAverage =
    calculateNullableAverage(
      subjects.map(
        (
          subject
        ) =>
          subject.average
      )
    );

  const totalDeviation =
    calculateTotalDeviation(
      results
    );

  const totalRank =
    calculateTotalRank(
      results
    );

  const totalPopulation =
    calculateTotalPopulation(
      results
    );

  const reportRef =
    doc(
      collection(
        db,
        "gradeReports"
      )
    );

  const report: GradeReport =
    {
      id:
        reportRef.id,

      organizationId:
        user.organizationId,

      schoolId,

      studentId,

      studentNumber:
        stringValue(
          studentData.studentNumber
        ),

      studentName:
        stringValue(
          studentData.name
        ),

      schoolName:
        stringValue(
          studentData.schoolName
        ),

      grade:
        stringValue(
          studentData.grade
        ),

      className:
        stringValue(
          studentData.className
        ),

      gender:
        stringValue(
          studentData.gender
        ),

      enrolledSchool:
        stringValue(
          studentData.enrolledSchool
        ),

      testId,

      testName,

      examDate:
        "",

      subjects,

      totalScore,

      totalMaxScore,

      totalAverage,

      totalDeviation,

      totalRank,

      totalPopulation,

      createdAt:
        null,

      updatedAt:
        null,
    };

  await setDoc(
    reportRef,
    {
      ...report,

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    }
  );

  return report;
}

/* =========================================================
   Find result by answer
   ========================================================= */

async function findResultByAnswerId(
  answerId: string
) {
  const user =
    await getAppUser();

  if (
    !user?.organizationId
  ) {
    return null;
  }

  const snapshot =
    await getDocs(
      query(
        collection(
          db,
          "results"
        ),

        where(
          "organizationId",
          "==",
          user.organizationId
        ),

        where(
          "answerId",
          "==",
          answerId
        )
      )
    );

  const item =
    snapshot.docs[0];

  if (
    !item
  ) {
    return null;
  }

  return normalizeResult(
    item.id,
    item.data()
  );
}

/* =========================================================
   Report subjects
   ========================================================= */

function buildReportSubjects(
  results: StudentResult[]
): GradeReportSubject[] {
  const grouped =
    new Map<
      string,
      StudentResult[]
    >();

  results.forEach(
    (
      result
    ) => {
      const current =
        grouped.get(
          result.subject
        ) ??
        [];

      current.push(
        result
      );

      grouped.set(
        result.subject,
        current
      );
    }
  );

  return Array.from(
    grouped.entries()
  ).map(
    (
      [
        subject,
        items,
      ]
    ) => {
      const maxScore =
        items.reduce(
          (
            total,
            item
          ) =>
            total +
            item.maxScore,
          0
        );

      const score =
        items.reduce(
          (
            total,
            item
          ) =>
            total +
            item.score,
          0
        );

      return {
        subject,

        maxScore,

        score,

        average:
          calculateNullableAverage(
            items.map(
              (
                item
              ) =>
                item.average
            )
          ),

        deviation:
          calculateNullableAverage(
            items.map(
              (
                item
              ) =>
                item.deviationScore
            )
          ),

        rank:
          items.length ===
          1
            ? items[0].rank
            : null,

        population:
          items.length ===
          1
            ? items[0].population
            : null,

        distribution:
          [],
      };
    }
  );
}

/* =========================================================
   Statistics
   ========================================================= */

export function calculatePercentage(
  score: number,
  maxScore: number
) {
  if (
    !Number.isFinite(
      score
    ) ||
    !Number.isFinite(
      maxScore
    ) ||
    maxScore <=
      0
  ) {
    return 0;
  }

  return (
    score /
    maxScore *
    100
  );
}

export function calculateAverage(
  values: number[]
) {
  if (
    values.length ===
    0
  ) {
    return 0;
  }

  return (
    values.reduce(
      (
        total,
        value
      ) =>
        total +
        value,
      0
    ) /
    values.length
  );
}

export function calculateStandardDeviation(
  values: number[]
) {
  if (
    values.length <
    2
  ) {
    return 0;
  }

  const average =
    calculateAverage(
      values
    );

  const variance =
    values.reduce(
      (
        total,
        value
      ) =>
        total +
        Math.pow(
          value -
            average,
          2
        ),
      0
    ) /
    values.length;

  return Math.sqrt(
    variance
  );
}

export function calculateDeviationScore(
  score: number,
  average:
    | number
    | null,
  standardDeviation:
    | number
    | null
) {
  if (
    average ===
      null ||
    standardDeviation ===
      null ||
    standardDeviation ===
      0
  ) {
    return null;
  }

  return (
    50 +
    10 *
      (
        (score -
          average) /
        standardDeviation
      )
  );
}

export function calculateRank(
  score: number,
  scores: number[]
) {
  const higher =
    scores.filter(
      (
        current
      ) =>
        current >
        score
    ).length;

  return (
    higher +
    1
  );
}

/* =========================================================
   Total stats
   ========================================================= */

function calculateTotalDeviation(
  results: StudentResult[]
) {
  const values =
    results
      .map(
        (
          result
        ) =>
          result.deviationScore
      )
      .filter(
        (
          value
        ): value is number =>
          value !==
          null
      );

  if (
    values.length ===
    0
  ) {
    return null;
  }

  return calculateAverage(
    values
  );
}

function calculateTotalRank(
  results: StudentResult[]
) {
  const ranks =
    results
      .map(
        (
          result
        ) =>
          result.rank
      )
      .filter(
        (
          value
        ): value is number =>
          value !==
          null
      );

  if (
    ranks.length ===
    0
  ) {
    return null;
  }

  return Math.min(
    ...ranks
  );
}

function calculateTotalPopulation(
  results: StudentResult[]
) {
  const populations =
    results
      .map(
        (
          result
        ) =>
          result.population
      )
      .filter(
        (
          value
        ): value is number =>
          value !==
          null
      );

  if (
    populations.length ===
    0
  ) {
    return null;
  }

  return Math.max(
    ...populations
  );
}

function calculateNullableAverage(
  values: (
    | number
    | null
  )[]
) {
  const valid =
    values.filter(
      (
        value
      ): value is number =>
        value !==
        null
    );

  if (
    valid.length ===
    0
  ) {
    return null;
  }

  return calculateAverage(
    valid
  );
}

/* =========================================================
   Permission
   ========================================================= */

function assertResultManager(
  role: UserRole
) {
  if (
    role ===
    "生徒"
  ) {
    throw new Error(
      "成績を管理する権限がありません。"
    );
  }
}

function canAccessSchoolId(
  user: Awaited<
    ReturnType<
      typeof getAppUser
    >
  >,
  schoolId: string
) {
  if (
    !user
  ) {
    return false;
  }

  if (
    user.role ===
    "本部管理者"
  ) {
    return true;
  }

  return user.schoolIds.includes(
    schoolId
  );
}

function canAccessSchoolResult(
  result: StudentResult,
  user: Awaited<
    ReturnType<
      typeof getAppUser
    >
  >
) {
  if (
    !user
  ) {
    return false;
  }

  if (
    result.organizationId !==
    user.organizationId
  ) {
    return false;
  }

  if (
    user.role ===
    "本部管理者"
  ) {
    return true;
  }

  if (
    user.role ===
      "校舎管理者" ||
    user.role ===
      "講師"
  ) {
    return user.schoolIds.includes(
      result.schoolId
    );
  }

  if (
    user.role ===
    "生徒"
  ) {
    return (
      result.studentId ===
      user.studentId
    );
  }

  return false;
}

/* =========================================================
   Normalize
   ========================================================= */

function normalizeResult(
  id: string,
  data: Record<
    string,
    unknown
  >
): StudentResult {
  const score =
    safeNumber(
      data.score
    );

  const maxScore =
    safeNumber(
      data.maxScore
    );

  return {
    id,

    organizationId:
      stringValue(
        data.organizationId
      ),

    schoolId:
      stringValue(
        data.schoolId
      ),

    studentId:
      stringValue(
        data.studentId
      ),

    studentNumber:
      stringValue(
        data.studentNumber
      ),

    testId:
      stringValue(
        data.testId
      ),

    testName:
      stringValue(
        data.testName
      ),

    subject:
      stringValue(
        data.subject
      ),

    score,

    maxScore,

    percentage:
      safeNullableNumber(
        data.percentage
      ) ??
      calculatePercentage(
        score,
        maxScore
      ),

    average:
      nullableNumber(
        data.average
      ),

    deviationScore:
      nullableNumber(
        data.deviationScore
      ),

    rank:
      nullableNumber(
        data.rank
      ),

    population:
      nullableNumber(
        data.population
      ),

    source:
      data.source ===
      "追試"
        ? "追試"
        : "通常",

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

/* =========================================================
   Chunk
   ========================================================= */

function chunk<T>(
  values: T[],
  size: number
) {
  const result:
    T[][] =
    [];

  for (
    let index = 0;
    index <
    values.length;
    index +=
      size
  ) {
    result.push(
      values.slice(
        index,
        index +
          size
      )
    );
  }

  return result;
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

function nullableNumber(
  value: unknown
) {
  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ""
  ) {
    return null;
  }

  const number =
    Number(
      value
    );

  return Number.isFinite(
    number
  )
    ? number
    : null;
}

function safeNullableNumber(
  value: unknown
) {
  const number =
    Number(
      value
    );

  return Number.isFinite(
    number
  )
    ? number
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
