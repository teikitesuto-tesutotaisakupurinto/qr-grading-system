"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
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
  Retest,
  RetestStatus,
  Student,
  Test,
  TestQuestion,
  UserRole,
} from "@/lib/types";

/* =========================================================
   Types
   ========================================================= */

export type CreateRetestInput = {
  studentId: string;

  originalTestId: string;

  scheduledDate: string;
};

export type SaveRetestScoreInput = {
  retestId: string;

  score: number;

  note?: string;
};

export type RetestWithRelations =
  Retest & {
    student: Student | null;

    originalTest: Test | null;

    retestTest: Test | null;
  };

/* =========================================================
   Create retest
   ========================================================= */

export async function createRetest(
  input: CreateRetestInput
) {
  const user =
    await getAppUser();

  if (!user) {
    throw new Error(
      "ログインしてください。"
    );
  }

  assertCreatePermission(
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
    !input.studentId
  ) {
    throw new Error(
      "生徒を選択してください。"
    );
  }

  if (
    !input.originalTestId
  ) {
    throw new Error(
      "元テストを選択してください。"
    );
  }

  /*
   * 生徒取得
   */
  const studentSnapshot =
    await getDoc(
      doc(
        db,
        "students",
        input.studentId
      )
    );

  if (
    !studentSnapshot.exists()
  ) {
    throw new Error(
      "生徒が見つかりません。"
    );
  }

  const student =
    studentSnapshot.data();

  const studentSchoolId =
    stringValue(
      student.schoolId
    );

  if (
    !studentSchoolId
  ) {
    throw new Error(
      "生徒の校舎が設定されていません。"
    );
  }

  assertSchoolPermission(
    user,
    studentSchoolId
  );

  /*
   * 元テスト取得
   */
  const originalTestSnapshot =
    await getDoc(
      doc(
        db,
        "tests",
        input.originalTestId
      )
    );

  if (
    !originalTestSnapshot.exists()
  ) {
    throw new Error(
      "元テストが見つかりません。"
    );
  }

  const originalTest =
    originalTestSnapshot.data();

  if (
    originalTest.organizationId !==
    user.organizationId
  ) {
    throw new Error(
      "元テストにアクセスする権限がありません。"
    );
  }

  if (
    originalTest.isRetest ===
    true
  ) {
    throw new Error(
      "追試からさらに追試を作成することはできません。"
    );
  }

  if (
    originalTest.active ===
    false
  ) {
    throw new Error(
      "無効になっているテストから追試を作成できません。"
    );
  }

  /*
   * 同じ生徒・同じ元テストで
   * 未完了の追試がないか確認。
   */
  const existingSnapshot =
    await getDocs(
      query(
        collection(
          db,
          "retests"
        ),

        where(
          "organizationId",
          "==",
          user.organizationId
        ),

        where(
          "studentId",
          "==",
          input.studentId
        ),

        where(
          "originalTestId",
          "==",
          input.originalTestId
        )
      )
    );

  const hasOpenRetest =
    existingSnapshot.docs.some(
      (
        item
      ) => {
        const data =
          item.data();

        return (
          data.status ===
            "未受験" ||
          data.status ===
            "採点待ち" ||
          data.status ===
            "採点済み"
        );
      }
    );

  if (
    hasOpenRetest
  ) {
    throw new Error(
      "この生徒には未完了の追試がすでにあります。"
    );
  }

  /*
   * 追試テスト作成
   */
  const retestTestRef =
    doc(
      collection(
        db,
        "tests"
      )
    );

  const retestTestId =
    retestTestRef.id;

  const originalName =
    stringValue(
      originalTest.name
    );

  const retestName =
    `${originalName}（追試）`;

  await setDoc(
    retestTestRef,
    {
      organizationId:
        user.organizationId,

      schoolId:
        studentSchoolId,

      testId:
        retestTestId,

      name:
        retestName,

      subject:
        stringValue(
          originalTest.subject
        ),

      grade:
        stringValue(
          student.grade
        ),

      className:
        stringValue(
          student.className
        ),

      examDate:
        input.scheduledDate,

      totalScore:
        safeNumber(
          originalTest.totalScore
        ),

      active:
        true,

      /*
       * 追試フラグ
       */
      isRetest:
        true,

      originalTestId:
        input.originalTestId,

      /*
       * 追試は自動採点しない。
       */
      automaticGrading:
        false,

      createdBy:
        user.uid,

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    }
  );

  /*
   * 元テストの問題をコピー。
   */
  await copyTestQuestionsForRetest(
    input.originalTestId,
    retestTestId,
    user.organizationId
  );

  /*
   * Retestドキュメント
   */
  const retestRef =
    doc(
      collection(
        db,
        "retests"
      )
    );

  await setDoc(
    retestRef,
    {
      organizationId:
        user.organizationId,

      schoolId:
        studentSchoolId,

      originalTestId:
        input.originalTestId,

      studentId:
        input.studentId,

      studentNumber:
        stringValue(
          student.studentNumber
        ),

      retestTestId,

      scheduledDate:
        input.scheduledDate,

      status:
        "未受験",

      manualScore:
        null,

      manualMaxScore:
        safeNumber(
          originalTest.totalScore
        ),

      finalized:
        false,

      appliedToResult:
        false,

      createdBy:
        user.uid,

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    }
  );

  return {
    id:
      retestRef.id,

    retestTestId,

    originalTestId:
      input.originalTestId,

    studentId:
      input.studentId,
  };
}

/* =========================================================
   Copy test questions
   ========================================================= */

export async function copyTestQuestionsForRetest(
  originalTestId: string,
  retestTestId: string,
  organizationId: string
) {
  const snapshot =
    await getDocs(
      query(
        collection(
          db,
          "testQuestions"
        ),

        where(
          "organizationId",
          "==",
          organizationId
        ),

        where(
          "testId",
          "==",
          originalTestId
        )
      )
    );

  if (
    snapshot.empty
  ) {
    return {
      copied:
        0,
    };
  }

  /*
   * Firestore batchは最大500操作なので
   * 400件ずつ処理。
   */
  const documents =
    snapshot.docs;

  let copied =
    0;

  for (
    let index = 0;
    index <
    documents.length;
    index +=
      400
  ) {
    const current =
      documents.slice(
        index,
        index +
          400
      );

    const batch =
      writeBatch(
        db
      );

    current.forEach(
      (
        source
      ) => {
        const data =
          source.data();

        const destination =
          doc(
            collection(
              db,
              "testQuestions"
            )
          );

        batch.set(
          destination,
          {
            organizationId,

            testId:
              retestTestId,

            questionNumber:
              stringValue(
                data.questionNumber
              ),

            title:
              stringValue(
                data.title
              ),

            maxScore:
              safeNumber(
                data.maxScore
              ),

            /*
             * 追試では自動採点しない。
             */
            gradingMethod:
              "manual",

            /*
             * 元の正答を
             * 自動採点に利用しない。
             */
            correctAnswer:
              "",

            rubric:
              stringValue(
                data.rubric
              ),

            requiresReview:
              true,

            order:
              safeNumber(
                data.order
              ),

            sourceQuestionId:
              source.id,

            createdAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp(),
          }
        );

        copied +=
          1;
      }
    );

    await batch.commit();
  }

  return {
    copied,
  };
}

/* =========================================================
   Get retest
   ========================================================= */

export async function getRetest(
  retestId: string
) {
  const user =
    await getAppUser();

  if (!user) {
    throw new Error(
      "ログインしてください。"
    );
  }

  const snapshot =
    await getDoc(
      doc(
        db,
        "retests",
        retestId
      )
    );

  if (
    !snapshot.exists()
  ) {
    return null;
  }

  const retest =
    normalizeRetest(
      snapshot.id,
      snapshot.data()
    );

  assertRetestAccess(
    user,
    retest
  );

  return retest;
}

/* =========================================================
   Get retest with relations
   ========================================================= */

export async function getRetestWithRelations(
  retestId: string
): Promise<
  RetestWithRelations | null
> {
  const retest =
    await getRetest(
      retestId
    );

  if (
    !retest
  ) {
    return null;
  }

  const [
    studentSnapshot,
    originalTestSnapshot,
    retestTestSnapshot,
  ] =
    await Promise.all([
      getDoc(
        doc(
          db,
          "students",
          retest.studentId
        )
      ),

      getDoc(
        doc(
          db,
          "tests",
          retest.originalTestId
        )
      ),

      getDoc(
        doc(
          db,
          "tests",
          retest.retestTestId
        )
      ),
    ]);

  return {
    ...retest,

    student:
      studentSnapshot.exists()
        ? normalizeStudent(
            studentSnapshot.id,
            studentSnapshot.data()
          )
        : null,

    originalTest:
      originalTestSnapshot.exists()
        ? normalizeTest(
            originalTestSnapshot.id,
            originalTestSnapshot.data()
          )
        : null,

    retestTest:
      retestTestSnapshot.exists()
        ? normalizeTest(
            retestTestSnapshot.id,
            retestTestSnapshot.data()
          )
        : null,
  };
}

/* =========================================================
   Save manual score
   ========================================================= */

export async function saveRetestScore(
  input: SaveRetestScoreInput
) {
  const user =
    await getAppUser();

  if (!user) {
    throw new Error(
      "ログインしてください。"
    );
  }

  assertGradingPermission(
    user.role
  );

  const retest =
    await getRetest(
      input.retestId
    );

  if (
    !retest
  ) {
    throw new Error(
      "追試が見つかりません。"
    );
  }

  if (
    retest.status ===
    "確定"
  ) {
    throw new Error(
      "確定済みの追試は変更できません。"
    );
  }

  if (
    !Number.isFinite(
      input.score
    )
  ) {
    throw new Error(
      "得点が不正です。"
    );
  }

  if (
    input.score <
      0 ||
    input.score >
      retest.manualMaxScore
  ) {
    throw new Error(
      `得点は0〜${retest.manualMaxScore}点で入力してください。`
    );
  }

  await updateDoc(
    doc(
      db,
      "retests",
      retest.id
    ),
    {
      manualScore:
        input.score,

      status:
        "採点済み",

      finalized:
        false,

      appliedToResult:
        false,

      internalNote:
        input.note ??
        "",

      updatedAt:
        serverTimestamp(),
    }
  );

  return {
    ...retest,

    manualScore:
      input.score,

    status:
      "採点済み" as const,

    finalized:
      false,

    appliedToResult:
      false,
  };
}

/* =========================================================
   Finalize
   ========================================================= */

export async function finalizeRetest(
  retestId: string
) {
  const user =
    await getAppUser();

  if (!user) {
    throw new Error(
      "ログインしてください。"
    );
  }

  assertFinalizePermission(
    user.role
  );

  const retest =
    await getRetest(
      retestId
    );

  if (
    !retest
  ) {
    throw new Error(
      "追試が見つかりません。"
    );
  }

  if (
    retest.status !==
    "採点済み"
  ) {
    throw new Error(
      "採点済みの追試だけ確定できます。"
    );
  }

  if (
    retest.manualScore ===
    null
  ) {
    throw new Error(
      "得点がありません。"
    );
  }

  await updateDoc(
    doc(
      db,
      "retests",
      retest.id
    ),
    {
      status:
        "確定",

      finalized:
        true,

      updatedAt:
        serverTimestamp(),
    }
  );

  return {
    ...retest,

    status:
      "確定" as const,

    finalized:
      true,
  };
}

/* =========================================================
   Apply result
   ========================================================= */

export async function applyRetestToResult(
  retestId: string
) {
  const user =
    await getAppUser();

  if (!user) {
    throw new Error(
      "ログインしてください。"
    );
  }

  assertFinalizePermission(
    user.role
  );

  const retest =
    await getRetest(
      retestId
    );

  if (
    !retest
  ) {
    throw new Error(
      "追試が見つかりません。"
    );
  }

  if (
    retest.status !==
    "確定"
  ) {
    throw new Error(
      "確定済みの追試だけ成績へ反映できます。"
    );
  }

  if (
    retest.manualScore ===
    null
  ) {
    throw new Error(
      "追試得点がありません。"
    );
  }

  if (
    retest.appliedToResult
  ) {
    throw new Error(
      "この追試はすでに成績へ反映されています。"
    );
  }

  /*
   * 追試テスト取得
   */
  const testSnapshot =
    await getDoc(
      doc(
        db,
        "tests",
        retest.retestTestId
      )
    );

  if (
    !testSnapshot.exists()
  ) {
    throw new Error(
      "追試テストが見つかりません。"
    );
  }

  const test =
    testSnapshot.data();

  /*
   * 生徒取得
   */
  const studentSnapshot =
    await getDoc(
      doc(
        db,
        "students",
        retest.studentId
      )
    );

  if (
    !studentSnapshot.exists()
  ) {
    throw new Error(
      "生徒が見つかりません。"
    );
  }

  /*
   * すでに同じ追試結果が
   * 作成されていないか確認。
   */
  const existingSnapshot =
    await getDocs(
      query(
        collection(
          db,
          "results"
        ),

        where(
          "organizationId",
          "==",
          retest.organizationId
        ),

        where(
          "retestId",
          "==",
          retest.id
        )
      )
    );

  if (
    !existingSnapshot.empty
  ) {
    /*
     * 既存結果がある場合は
     * appliedだけ整合させる。
     */
    await updateDoc(
      doc(
        db,
        "retests",
        retest.id
      ),
      {
        appliedToResult:
          true,

        updatedAt:
          serverTimestamp(),
      }
    );

    return {
      resultId:
        existingSnapshot
          .docs[0]
          .id,

      alreadyExists:
        true,
    };
  }

  /*
   * 追試結果は通常結果と別レコード。
   */
  const resultRef =
    doc(
      collection(
        db,
        "results"
      )
    );

  const maxScore =
    retest.manualMaxScore;

  const score =
    retest.manualScore;

  await setDoc(
    resultRef,
    {
      organizationId:
        retest.organizationId,

      schoolId:
        retest.schoolId,

      answerId:
        null,

      retestId:
        retest.id,

      studentId:
        retest.studentId,

      studentNumber:
        retest.studentNumber,

      testId:
        retest.retestTestId,

      testName:
        stringValue(
          test.name
        ),

      subject:
        stringValue(
          test.subject
        ),

      score,

      maxScore,

      percentage:
        maxScore > 0
          ? score /
              maxScore *
            100
          : 0,

      average:
        null,

      deviationScore:
        null,

      rank:
        null,

      population:
        null,

      source:
        "追試",

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    }
  );

  await updateDoc(
    doc(
      db,
      "retests",
      retest.id
    ),
    {
      appliedToResult:
        true,

      updatedAt:
        serverTimestamp(),
    }
  );

  return {
    resultId:
      resultRef.id,

    alreadyExists:
      false,
  };
}

/* =========================================================
   Mark student attended
   ========================================================= */

export async function markRetestAttended(
  retestId: string
) {
  const user =
    await getAppUser();

  if (!user) {
    throw new Error(
      "ログインしてください。"
    );
  }

  assertGradingPermission(
    user.role
  );

  const retest =
    await getRetest(
      retestId
    );

  if (
    !retest
  ) {
    throw new Error(
      "追試が見つかりません。"
    );
  }

  if (
    retest.status !==
    "未受験"
  ) {
    throw new Error(
      "未受験の追試だけ受験済みに変更できます。"
    );
  }

  await updateDoc(
    doc(
      db,
      "retests",
      retest.id
    ),
    {
      status:
        "採点待ち",

      updatedAt:
        serverTimestamp(),
    }
  );
}

/* =========================================================
   Access
   ========================================================= */

function assertRetestAccess(
  user: Awaited<
    ReturnType<
      typeof getAppUser
    >
  >,
  retest: Retest
) {
  if (!user) {
    throw new Error(
      "ログインしてください。"
    );
  }

  if (
    retest.organizationId !==
    user.organizationId
  ) {
    throw new Error(
      "この追試にアクセスする権限がありません。"
    );
  }

  if (
    user.role ===
    "本部管理者"
  ) {
    return;
  }

  if (
    user.role ===
      "校舎管理者" ||
    user.role ===
      "講師"
  ) {
    if (
      !user.schoolIds.includes(
        retest.schoolId
      )
    ) {
      throw new Error(
        "この追試にアクセスする権限がありません。"
      );
    }

    return;
  }

  if (
    user.role ===
    "生徒"
  ) {
    if (
      user.studentId !==
      retest.studentId
    ) {
      throw new Error(
        "この追試にアクセスする権限がありません。"
      );
    }

    return;
  }

  throw new Error(
    "この追試にアクセスする権限がありません。"
  );
}

/* =========================================================
   School permission
   ========================================================= */

function assertSchoolPermission(
  user: Awaited<
    ReturnType<
      typeof getAppUser
    >
  >,
  schoolId: string
) {
  if (!user) {
    throw new Error(
      "ログインしてください。"
    );
  }

  if (
    user.role ===
    "本部管理者"
  ) {
    return;
  }

  if (
    !user.schoolIds.includes(
      schoolId
    )
  ) {
    throw new Error(
      "この校舎へのアクセス権限がありません。"
    );
  }
}

/* =========================================================
   Permissions
   ========================================================= */

function assertCreatePermission(
  role: UserRole
) {
  if (
    role !==
      "本部管理者" &&
    role !==
      "校舎管理者"
  ) {
    throw new Error(
      "追試を作成する権限がありません。"
    );
  }
}

function assertGradingPermission(
  role: UserRole
) {
  if (
    role ===
    "生徒"
  ) {
    throw new Error(
      "追試を採点する権限がありません。"
    );
  }
}

function assertFinalizePermission(
  role: UserRole
) {
  if (
    role !==
      "本部管理者" &&
    role !==
      "校舎管理者"
  ) {
    throw new Error(
      "追試を確定する権限がありません。"
    );
  }
}

/* =========================================================
   Normalize Retest
   ========================================================= */

function normalizeRetest(
  id: string,
  data: Record<
    string,
    unknown
  >
): Retest {
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

    originalTestId:
      stringValue(
        data.originalTestId
      ),

    studentId:
      stringValue(
        data.studentId
      ),

    studentNumber:
      stringValue(
        data.studentNumber
      ),

    retestTestId:
      stringValue(
        data.retestTestId
      ),

    scheduledDate:
      stringValue(
        data.scheduledDate
      ),

    status:
      normalizeStatus(
        data.status
      ),

    manualScore:
      nullableNumber(
        data.manualScore
      ),

    manualMaxScore:
      safeNumber(
        data.manualMaxScore
      ),

    finalized:
      data.finalized ===
      true,

    appliedToResult:
      data.appliedToResult ===
      true,

    createdBy:
      stringValue(
        data.createdBy
      ),

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

/* =========================================================
   Normalize Student
   ========================================================= */

function normalizeStudent(
  id: string,
  data: Record<
    string,
    unknown
  >
): Student {
  return {
    id,

    organizationId:
      stringValue(
        data.organizationId
      ),

    studentNumber:
      stringValue(
        data.studentNumber
      ),

    name:
      stringValue(
        data.name
      ),

    grade:
      stringValue(
        data.grade
      ),

    className:
      stringValue(
        data.className
      ),

    schoolId:
      stringValue(
        data.schoolId
      ),

    active:
      data.active !==
      false,

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

/* =========================================================
   Normalize Test
   ========================================================= */

function normalizeTest(
  id: string,
  data: Record<
    string,
    unknown
  >
): Test {
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

    testId:
      stringValue(
        data.testId
      ) ||
      id,

    name:
      stringValue(
        data.name
      ),

    subject:
      stringValue(
        data.subject
      ),

    grade:
      stringValue(
        data.grade
      ),

    className:
      stringValue(
        data.className
      ),

    examDate:
      stringValue(
        data.examDate
      ),

    totalScore:
      safeNumber(
        data.totalScore
      ),

    active:
      data.active !==
      false,

    isRetest:
      data.isRetest ===
      true,

    originalTestId:
      nullableString(
        data.originalTestId
      ),

    automaticGrading:
      data.automaticGrading ===
      true,

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

/* =========================================================
   Status
   ========================================================= */

function normalizeStatus(
  value: unknown
): RetestStatus {
  switch (
    value
  ) {
    case "未受験":
    case "採点待ち":
    case "採点済み":
    case "確定":
      return value;

    default:
      return "未受験";
  }
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

function nullableString(
  value: unknown
) {
  return typeof value ===
    "string"
    ? value
    : null;
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
