"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  orderBy,
  addDoc,
  updateDoc,
} from "firebase/firestore";

import {
  db,
} from "@/lib/firebase";

export type ReportSubject = {
  subject: string;
  score: number;
  maxScore: number;
  percentage: number;
  deviationScore?: number;
  rank?: number;
};

export type ReportSection = {
  name: string;
  score: number;
  maxScore: number;
};

export type ReportRubric = {
  name: string;
  score: number;
  maxScore: number;
};

export type GradeReportData = {
  studentName: string;
  studentNumber: string;

  testName: string;
  testDate: string;

  subjects: ReportSubject[];

  sections: ReportSection[];

  rubrics: ReportRubric[];

  totalScore: number;
  totalMaxScore: number;
  totalPercentage: number;

  totalDeviationScore?: number;

  overallRank?: number;
  schoolRank?: number;
  gradeRank?: number;
  classRank?: number;

  isRetest: boolean;

  publicComment?: string;
};

export type GradeReport = {
  id: string;

  testId: string;
  studentNumber: string;

  data: GradeReportData;

  status:
    | "draft"
    | "generated"
    | "published"
    | "paper_only";

  templateId?: string;

  createdAt?: unknown;
  updatedAt?: unknown;
};

/* =========================================================
   成績表取得
   ========================================================= */

export async function getGradeReport(
  reportId: string
): Promise<GradeReport | null> {
  const snapshot =
    await getDoc(
      doc(
        db,
        "gradeReports",
        reportId
      )
    );

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as GradeReport;
}

/* =========================================================
   生徒・テストから成績表取得
   ========================================================= */

export async function getStudentGradeReport(
  testId: string,
  studentNumber: string
): Promise<GradeReport | null> {
  const reportQuery =
    query(
      collection(
        db,
        "gradeReports"
      ),
      where(
        "testId",
        "==",
        testId
      ),
      where(
        "studentNumber",
        "==",
        studentNumber
      ),
      orderBy(
        "createdAt",
        "desc"
      )
    );

  const snapshot =
    await getDocs(
      reportQuery
    );

  if (snapshot.empty) {
    return null;
  }

  const item =
    snapshot.docs[0];

  return {
    id: item.id,
    ...item.data(),
  } as GradeReport;
}

/* =========================================================
   テストの成績表一覧
   ========================================================= */

export async function getGradeReports(
  testId: string
): Promise<GradeReport[]> {
  const reportQuery =
    query(
      collection(
        db,
        "gradeReports"
      ),
      where(
        "testId",
        "==",
        testId
      ),
      orderBy(
        "studentNumber",
        "asc"
      )
    );

  const snapshot =
    await getDocs(
      reportQuery
    );

  return snapshot.docs.map(
    (item) =>
      ({
        id: item.id,
        ...item.data(),
      }) as GradeReport
  );
}

/* =========================================================
   成績表作成
   ========================================================= */

export async function createGradeReport(
  input: {
    testId: string;

    studentNumber: string;

    data: GradeReportData;

    templateId?: string;

    isRetest?: boolean;
  }
): Promise<string> {
  validateStudentNumber(
    input.studentNumber
  );

  validateReportData(
    input.data
  );

  const status =
    input.isRetest ||
    input.data.isRetest
      ? "paper_only"
      : "generated";

  const reference =
    await addDoc(
      collection(
        db,
        "gradeReports"
      ),
      {
        testId:
          input.testId,

        studentNumber:
          input.studentNumber,

        data: {
          ...input.data,

          isRetest:
            Boolean(
              input.isRetest ??
                input.data
                  .isRetest
            ),
        },

        status,

        templateId:
          input.templateId,

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp(),
      }
    );

  return reference.id;
}

/* =========================================================
   成績表更新
   ========================================================= */

export async function updateGradeReport(
  reportId: string,
  changes: {
    data?: GradeReportData;

    templateId?: string;

    status?:
      | "draft"
      | "generated"
      | "published"
      | "paper_only";
  }
) {
  if (changes.data) {
    validateReportData(
      changes.data
    );
  }

  await updateDoc(
    doc(
      db,
      "gradeReports",
      reportId
    ),
    {
      ...changes,

      updatedAt:
        serverTimestamp(),
    }
  );
}

/* =========================================================
   成績表生成
   ========================================================= */

export async function generateGradeReport(
  testId: string,
  studentNumber: string,
  templateId?: string
): Promise<string> {
  validateStudentNumber(
    studentNumber
  );

  /*
   * 既存の成績表があれば更新。
   * なければ新規作成。
   */
  const existing =
    await getStudentGradeReport(
      testId,
      studentNumber
    );

  const data =
    await buildGradeReportData(
      testId,
      studentNumber
    );

  const isRetest =
    data.isRetest;

  const status =
    isRetest
      ? "paper_only"
      : "generated";

  if (existing) {
    await updateGradeReport(
      existing.id,
      {
        data,

        templateId,

        status,
      }
    );

    return existing.id;
  }

  return createGradeReport({
    testId,

    studentNumber,

    data,

    templateId,

    isRetest,
  });
}

/* =========================================================
   成績表データ構築
   ========================================================= */

async function buildGradeReportData(
  testId: string,
  studentNumber: string
): Promise<GradeReportData> {
  const [
    studentSnapshot,
    testSnapshot,
    scoreSnapshot,
    rankingSnapshot,
  ] = await Promise.all([
    getDoc(
      doc(
        db,
        "students",
        studentNumber
      )
    ),

    getDoc(
      doc(
        db,
        "tests",
        testId
      )
    ),

    getScores(
      testId,
      studentNumber
    ),

    getRankings(
      testId,
      studentNumber
    ),
  ]);

  if (
    !studentSnapshot.exists()
  ) {
    throw new Error(
      "生徒が存在しません。"
    );
  }

  if (
    !testSnapshot.exists()
  ) {
    throw new Error(
      "テストが存在しません。"
    );
  }

  const student =
    studentSnapshot.data();

  const test =
    testSnapshot.data();

  const subjects =
    scoreSnapshot.map(
      (score) => ({
        subject:
          String(
            score.subjectId
          ),

        score:
          Number(
            score.score ?? 0
          ),

        maxScore:
          Number(
            score.maxScore ?? 0
          ),

        percentage:
          Number(
            score.percentage ?? 0
          ),

        deviationScore:
          getDeviation(
            score
          ),

        rank:
          getSubjectRank(
            score
          ),
      })
    );

  const totalScore =
    subjects.reduce(
      (sum, subject) =>
        sum +
        subject.score,
      0
    );

  const totalMaxScore =
    subjects.reduce(
      (sum, subject) =>
        sum +
        subject.maxScore,
      0
    );

  const totalPercentage =
    totalMaxScore === 0
      ? 0
      : (totalScore /
          totalMaxScore) *
        100;

  return {
    studentName:
      String(
        student.name ?? ""
      ),

    studentNumber,

    testName:
      String(
        test.name ?? ""
      ),

    testDate:
      String(
        test.date ?? ""
      ),

    subjects,

    sections: [],

    rubrics: [],

    totalScore,

    totalMaxScore,

    totalPercentage,

    totalDeviationScore:
      undefined,

    overallRank:
      rankingSnapshot.overall,

    schoolRank:
      rankingSnapshot.school,

    gradeRank:
      rankingSnapshot.grade,

    classRank:
      rankingSnapshot.class,

    isRetest:
      Boolean(
        test.isRetest
      ),

    publicComment:
      "",
  };
}

/* =========================================================
   scores取得
   ========================================================= */

async function getScores(
  testId: string,
  studentNumber: string
) {
  const scoreQuery =
    query(
      collection(
        db,
        "scores"
      ),
      where(
        "testId",
        "==",
        testId
      ),
      where(
        "studentNumber",
        "==",
        studentNumber
      )
    );

  const snapshot =
    await getDocs(
      scoreQuery
    );

  return snapshot.docs.map(
    (item) => ({
      id: item.id,
      ...item.data(),
    })
  );
}

/* =========================================================
   順位取得
   ========================================================= */

async function getRankings(
  testId: string,
  studentNumber: string
): Promise<{
  overall?: number;
  school?: number;
  grade?: number;
  class?: number;
}> {
  const rankingQuery =
    query(
      collection(
        db,
        "rankings"
      ),
      where(
        "testId",
        "==",
        testId
      ),
      where(
        "studentNumber",
        "==",
        studentNumber
      )
    );

  const snapshot =
    await getDocs(
      rankingQuery
    );

  const result: {
    overall?: number;
    school?: number;
    grade?: number;
    class?: number;
  } = {};

  for (
    const item of
      snapshot.docs
  ) {
    const data =
      item.data();

    const type =
      data.rankingType;

    const rank =
      Number(
        data.rank
      );

    if (
      !Number.isFinite(
        rank
      )
    ) {
      continue;
    }

    if (
      type === "overall"
    ) {
      result.overall =
        rank;
    }

    if (
      type === "school"
    ) {
      result.school =
        rank;
    }

    if (
      type === "grade"
    ) {
      result.grade =
        rank;
    }

    if (
      type === "class"
    ) {
      result.class =
        rank;
    }
  }

  return result;
}

/* =========================================================
   偏差値取得
   ========================================================= */

function getDeviation(
  score: Record<
    string,
    unknown
  >
): number | undefined {
  const deviations =
    score.deviationScores;

  if (
    !deviations ||
    typeof deviations !==
      "object"
  ) {
    return undefined;
  }

  const overall =
    (
      deviations as Record<
        string,
        unknown
      >
    ).overall;

  if (
    typeof overall ===
      "object" &&
    overall !== null
  ) {
    const value =
      (
        overall as Record<
          string,
          unknown
        >
      ).value;

    return Number.isFinite(
      Number(value)
    )
      ? Number(value)
      : undefined;
  }

  return undefined;
}

/* =========================================================
   教科順位取得
   ========================================================= */

function getSubjectRank(
  score: Record<
    string,
    unknown
  >
): number | undefined {
  const rankings =
    score.rankings;

  if (
    !rankings ||
    typeof rankings !==
      "object"
  ) {
    return undefined;
  }

  const subjectRank =
    (
      rankings as Record<
        string,
        unknown
      >
    ).subjectRank;

  if (
    typeof subjectRank ===
      "object" &&
    subjectRank !== null
  ) {
    const rank =
      (
        subjectRank as Record<
          string,
          unknown
        >
      ).rank;

    return Number.isFinite(
      Number(rank)
    )
      ? Number(rank)
      : undefined;
  }

  return undefined;
}

/* =========================================================
   バリデーション
   ========================================================= */

function validateStudentNumber(
  value: string
) {
  if (
    !/^\d{6}$/.test(
      value
    )
  ) {
    throw new Error(
      "生徒番号は6桁数字で指定してください。"
    );
  }
}

function validateReportData(
  data: GradeReportData
) {
  validateStudentNumber(
    data.studentNumber
  );

  if (
    !data.studentName
  ) {
    throw new Error(
      "生徒名がありません。"
    );
  }

  if (
    !data.testName
  ) {
    throw new Error(
      "テスト名がありません。"
    );
  }

  if (
    data.totalScore <
      0 ||
    data.totalScore >
      data.totalMaxScore
  ) {
    throw new Error(
      "合計点が不正です。"
    );
  }

  for (
    const subject of
      data.subjects
  ) {
    if (
      subject.score <
        0 ||
      subject.score >
        subject.maxScore
    ) {
      throw new Error(
        `${subject.subject}の得点が不正です。`
      );
    }
  }
}
