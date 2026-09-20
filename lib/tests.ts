import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import {
  db,
} from "@/lib/firebase";

export type TestStatus =
  | "draft"
  | "published"
  | "grading"
  | "confirmed"
  | "closed";

export type TestTargetType =
  | "all"
  | "school"
  | "grade"
  | "class";

export type TestTarget = {
  type: TestTargetType;

  schoolIds?: string[];

  grades?: string[];

  classIds?: string[];
};

export type Test = {
  id: string;

  name: string;

  date: string;

  status: TestStatus;

  target: TestTarget;

  subjectIds: string[];

  createdBy: string;

  createdAt?: unknown;

  updatedAt?: unknown;
};

export type TestSubject = {
  id: string;

  testId: string;

  name: string;

  order: number;

  maxScore: number;

  createdAt?: unknown;

  updatedAt?: unknown;
};

export type TestSection = {
  id: string;

  testId: string;

  subjectId: string;

  name: string;

  order: number;

  createdAt?: unknown;

  updatedAt?: unknown;
};

/* =========================================================
   Tests
   ========================================================= */

export async function getTest(
  testId: string
): Promise<Test | null> {
  const snapshot =
    await getDoc(
      doc(
        db,
        "tests",
        testId
      )
    );

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as Test;
}

export async function getTests(
  status?: TestStatus
): Promise<Test[]> {
  const reference =
    collection(
      db,
      "tests"
    );

  const testQuery = status
    ? query(
        reference,
        where(
          "status",
          "==",
          status
        ),
        orderBy(
          "date",
          "desc"
        )
      )
    : query(
        reference,
        orderBy(
          "date",
          "desc"
        )
      );

  const snapshot =
    await getDocs(
      testQuery
    );

  return snapshot.docs.map(
    (item) =>
      ({
        id: item.id,
        ...item.data(),
      }) as Test
  );
}

export async function createTest(
  input: {
    name: string;

    date: string;

    target: TestTarget;

    createdBy: string;
  }
): Promise<string> {
  if (!input.name.trim()) {
    throw new Error(
      "テスト名を入力してください。"
    );
  }

  if (!input.date) {
    throw new Error(
      "実施日を指定してください。"
    );
  }

  validateTarget(
    input.target
  );

  const reference =
    await addDoc(
      collection(
        db,
        "tests"
      ),
      {
        name:
          input.name.trim(),

        date:
          input.date,

        status:
          "draft",

        target:
          input.target,

        subjectIds: [],

        createdBy:
          input.createdBy,

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp(),
      }
    );

  return reference.id;
}

export async function updateTest(
  testId: string,
  changes: Partial<
    Omit<
      Test,
      "id"
    >
  >
) {
  const reference =
    doc(
      db,
      "tests",
      testId
    );

  const existing =
    await getDoc(
      reference
    );

  if (!existing.exists()) {
    throw new Error(
      "テストが存在しません。"
    );
  }

  if (
    changes.target
  ) {
    validateTarget(
      changes.target
    );
  }

  await updateDoc(
    reference,
    {
      ...changes,

      updatedAt:
        serverTimestamp(),
    }
  );
}

export async function updateTestStatus(
  testId: string,
  status: TestStatus
) {
  const reference =
    doc(
      db,
      "tests",
      testId
    );

  await updateDoc(
    reference,
    {
      status,

      updatedAt:
        serverTimestamp(),
    }
  );
}

export async function deleteTest(
  testId: string
) {
  const reference =
    doc(
      db,
      "tests",
      testId
    );

  const snapshot =
    await getDoc(
      reference
    );

  if (!snapshot.exists()) {
    throw new Error(
      "削除対象のテストがありません。"
    );
  }

  /*
   * 本番では答案・採点・成績が残るため、
   * 公開済みテストの削除は避ける。
   */
  const data =
    snapshot.data();

  if (
    data.status ===
      "published" ||
    data.status ===
      "closed"
  ) {
    throw new Error(
      "公開済みまたは終了済みのテストは削除できません。"
    );
  }

  await deleteDoc(
    reference
  );
}

/* =========================================================
   Test Subjects
   ========================================================= */

export async function getTestSubjects(
  testId: string
): Promise<TestSubject[]> {
  const testQuery =
    query(
      collection(
        db,
        "testSubjects"
      ),
      where(
        "testId",
        "==",
        testId
      ),
      orderBy(
        "order",
        "asc"
      )
    );

  const snapshot =
    await getDocs(
      testQuery
    );

  return snapshot.docs.map(
    (item) =>
      ({
        id: item.id,
        ...item.data(),
      }) as TestSubject
  );
}

export async function createTestSubject(
  input: {
    testId: string;

    name: string;

    order: number;

    maxScore: number;
  }
): Promise<string> {
  if (!input.name.trim()) {
    throw new Error(
      "教科名を入力してください。"
    );
  }

  if (
    !Number.isFinite(
      input.maxScore
    ) ||
    input.maxScore <= 0
  ) {
    throw new Error(
      "満点は1以上で指定してください。"
    );
  }

  const reference =
    await addDoc(
      collection(
        db,
        "testSubjects"
      ),
      {
        testId:
          input.testId,

        name:
          input.name.trim(),

        order:
          input.order,

        maxScore:
          input.maxScore,

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp(),
      }
    );

  await updateTestSubjectIds(
    input.testId
  );

  return reference.id;
}

export async function updateTestSubject(
  subjectId: string,
  changes: Partial<
    Omit<
      TestSubject,
      "id"
    >
  >
) {
  await updateDoc(
    doc(
      db,
      "testSubjects",
      subjectId
    ),
    {
      ...changes,

      updatedAt:
        serverTimestamp(),
    }
  );

  if (changes.testId) {
    await updateTestSubjectIds(
      changes.testId
    );
  }
}

export async function deleteTestSubject(
  subjectId: string
) {
  const reference =
    doc(
      db,
      "testSubjects",
      subjectId
    );

  const snapshot =
    await getDoc(
      reference
    );

  if (!snapshot.exists()) {
    return;
  }

  const data =
    snapshot.data();

  await deleteDoc(
    reference
  );

  if (
    typeof data.testId ===
    "string"
  ) {
    await updateTestSubjectIds(
      data.testId
    );
  }
}

async function updateTestSubjectIds(
  testId: string
) {
  const subjects =
    await getTestSubjects(
      testId
    );

  await updateDoc(
    doc(
      db,
      "tests",
      testId
    ),
    {
      subjectIds:
        subjects.map(
          (subject) =>
            subject.id
        ),

      updatedAt:
        serverTimestamp(),
    }
  );
}

/* =========================================================
   Test Sections
   ========================================================= */

export async function getTestSections(
  testId: string,
  subjectId: string
): Promise<TestSection[]> {
  const sectionQuery =
    query(
      collection(
        db,
        "testSections"
      ),
      where(
        "testId",
        "==",
        testId
      ),
      where(
        "subjectId",
        "==",
        subjectId
      ),
      orderBy(
        "order",
        "asc"
      )
    );

  const snapshot =
    await getDocs(
      sectionQuery
    );

  return snapshot.docs.map(
    (item) =>
      ({
        id: item.id,
        ...item.data(),
      }) as TestSection
  );
}

export async function createTestSection(
  input: {
    testId: string;

    subjectId: string;

    name: string;

    order: number;
  }
): Promise<string> {
  if (!input.name.trim()) {
    throw new Error(
      "大問名を入力してください。"
    );
  }

  const reference =
    await addDoc(
      collection(
        db,
        "testSections"
      ),
      {
        testId:
          input.testId,

        subjectId:
          input.subjectId,

        name:
          input.name.trim(),

        order:
          input.order,

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp(),
      }
    );

  return reference.id;
}

export async function updateTestSection(
  sectionId: string,
  changes: Partial<
    Omit<
      TestSection,
      "id"
    >
  >
) {
  await updateDoc(
    doc(
      db,
      "testSections",
      sectionId
    ),
    {
      ...changes,

      updatedAt:
        serverTimestamp(),
    }
  );
}

export async function deleteTestSection(
  sectionId: string
) {
  await deleteDoc(
    doc(
      db,
      "testSections",
      sectionId
    )
  );
}

/* =========================================================
   対象範囲バリデーション
   ========================================================= */

function validateTarget(
  target: TestTarget
) {
  if (
    target.type ===
    "school"
  ) {
    if (
      !target.schoolIds ||
      target.schoolIds.length ===
        0
    ) {
      throw new Error(
        "対象校舎を1つ以上指定してください。"
      );
    }
  }

  if (
    target.type ===
    "grade"
  ) {
    if (
      !target.grades ||
      target.grades.length ===
        0
    ) {
      throw new Error(
        "対象学年を1つ以上指定してください。"
      );
    }
  }

  if (
    target.type ===
    "class"
  ) {
    if (
      !target.classIds ||
      target.classIds.length ===
        0
    ) {
      throw new Error(
        "対象クラスを1つ以上指定してください。"
      );
    }
  }
}
