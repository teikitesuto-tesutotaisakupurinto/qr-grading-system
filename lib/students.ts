"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  type DocumentSnapshot,
} from "firebase/firestore";

import {
  db,
} from "@/lib/firebase";

export type StudentStatus =
  | "在籍"
  | "休学"
  | "卒業"
  | "退塾";

export type Student = {
  id: string;

  name: string;

  schoolId: string;
  schoolName: string;

  grade: string;

  classId?: string;
  className: string;

  status: StudentStatus;

  createdAt?: unknown;
  updatedAt?: unknown;
};

export type StudentFilters = {
  schoolId?: string;
  grade?: string;
  className?: string;
  status?: StudentStatus;
  keyword?: string;
};

export type StudentPage = {
  students: Student[];

  lastDocument:
    | DocumentSnapshot
    | null;

  hasMore: boolean;
};

const STUDENT_COLLECTION =
  "students";

const PAGE_SIZE = 100;

/* =========================================================
   1人取得
   ========================================================= */

export async function getStudent(
  studentNumber: string
): Promise<Student | null> {
  validateStudentNumber(
    studentNumber
  );

  const snapshot =
    await getDoc(
      doc(
        db,
        STUDENT_COLLECTION,
        studentNumber
      )
    );

  if (!snapshot.exists()) {
    return null;
  }

  return convertStudent(
    snapshot.id,
    snapshot.data()
  );
}

/* =========================================================
   一覧
   ========================================================= */

export async function getStudents(
  filters: StudentFilters = {}
): Promise<Student[]> {
  const page =
    await getStudentsPage(
      filters,
      null
    );

  return page.students;
}

/* =========================================================
   ページング一覧
   ========================================================= */

export async function getStudentsPage(
  filters: StudentFilters = {},
  cursor:
    | DocumentSnapshot
    | null = null
): Promise<StudentPage> {
  const conditions = [];

  if (filters.schoolId) {
    conditions.push(
      where(
        "schoolId",
        "==",
        filters.schoolId
      )
    );
  }

  if (filters.grade) {
    conditions.push(
      where(
        "grade",
        "==",
        filters.grade
      )
    );
  }

  if (filters.className) {
    conditions.push(
      where(
        "className",
        "==",
        filters.className
      )
    );
  }

  if (filters.status) {
    conditions.push(
      where(
        "status",
        "==",
        filters.status
      )
    );
  }

  const studentQuery =
    query(
      collection(
        db,
        STUDENT_COLLECTION
      ),
      ...conditions,
      orderBy(
        "name",
        "asc"
      ),
      ...(cursor
        ? [
            startAfter(
              cursor
            ),
          ]
        : []),
      limit(
        PAGE_SIZE
      )
    );

  const snapshot =
    await getDocs(
      studentQuery
    );

  let students =
    snapshot.docs.map(
      (item) =>
        convertStudent(
          item.id,
          item.data()
        )
    );

  if (
    filters.keyword?.trim()
  ) {
    const keyword =
      filters.keyword
        .trim()
        .toLowerCase();

    students =
      students.filter(
        (student) =>
          student.id
            .toLowerCase()
            .includes(
              keyword
            ) ||
          student.name
            .toLowerCase()
            .includes(
              keyword
            )
      );
  }

  return {
    students,

    lastDocument:
      snapshot.docs.length > 0
        ? snapshot.docs[
            snapshot.docs.length -
              1
          ]
        : null,

    hasMore:
      snapshot.docs.length ===
      PAGE_SIZE,
  };
}

/* =========================================================
   生徒作成
   ========================================================= */

export async function createStudent(
  input: {
    studentNumber?: string;

    name: string;

    schoolId: string;
    schoolName: string;

    grade: string;

    classId?: string;
    className: string;

    status?: StudentStatus;
  }
): Promise<Student> {
  const studentNumber =
    input.studentNumber ??
    await generateStudentNumber();

  validateStudentNumber(
    studentNumber
  );

  validateStudentInput(
    input
  );

  const reference =
    doc(
      db,
      STUDENT_COLLECTION,
      studentNumber
    );

  const existing =
    await getDoc(
      reference
    );

  if (existing.exists()) {
    throw new Error(
      `生徒番号 ${studentNumber} は既に使用されています。`
    );
  }

  const student: Student = {
    id:
      studentNumber,

    name:
      input.name.trim(),

    schoolId:
      input.schoolId.trim(),

    schoolName:
      input.schoolName.trim(),

    grade:
      input.grade.trim(),

    classId:
      input.classId?.trim(),

    className:
      input.className.trim(),

    status:
      input.status ??
      "在籍",
  };

  await setDoc(
    reference,
    {
      ...student,

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    }
  );

  return student;
}

/* =========================================================
   更新
   ========================================================= */

export async function updateStudent(
  studentNumber: string,
  changes: Partial<
    Omit<Student, "id">
  >
) {
  validateStudentNumber(
    studentNumber
  );

  const reference =
    doc(
      db,
      STUDENT_COLLECTION,
      studentNumber
    );

  const existing =
    await getDoc(
      reference
    );

  if (!existing.exists()) {
    throw new Error(
      "更新対象の生徒が存在しません。"
    );
  }

  const data: Record<
    string,
    unknown
  > = {
    ...changes,

    updatedAt:
      serverTimestamp(),
  };

  if (
    changes.name !==
    undefined
  ) {
    data.name =
      changes.name.trim();
  }

  if (
    changes.schoolId !==
    undefined
  ) {
    data.schoolId =
      changes.schoolId.trim();
  }

  if (
    changes.schoolName !==
    undefined
  ) {
    data.schoolName =
      changes.schoolName.trim();
  }

  if (
    changes.grade !==
    undefined
  ) {
    data.grade =
      changes.grade.trim();
  }

  if (
    changes.className !==
    undefined
  ) {
    data.className =
      changes.className.trim();
  }

  if (
    changes.classId !==
    undefined
  ) {
    data.classId =
      changes.classId?.trim();
  }

  await updateDoc(
    reference,
    data
  );
}

/* =========================================================
   CSV
   ========================================================= */

export async function updateStudentsFromCsv(
  rows: Array<
    Record<string, string>
  >
): Promise<{
  updated: number;
  created: number;

  errors: Array<{
    row: number;
    message: string;
  }>;
}> {
  let updated = 0;
  let created = 0;

  const errors: Array<{
    row: number;
    message: string;
  }> = [];

  for (
    let index = 0;
    index < rows.length;
    index++
  ) {
    const row =
      rows[index];

    try {
      const studentNumber =
        row["生徒番号"]
          ?.trim();

      const name =
        row["氏名"]
          ?.trim();

      const schoolId =
        row["校舎ID"]
          ?.trim() ||
        row["校舎"]
          ?.trim();

      const schoolName =
        row["校舎名"]
          ?.trim() ||
        row["校舎"]
          ?.trim();

      const grade =
        row["学年"]
          ?.trim();

      const classId =
        row["クラスID"]
          ?.trim();

      const className =
        row["クラス"]
          ?.trim();

      const status =
        row["在籍状況"]
          ?.trim() ||
        "在籍";

      if (!studentNumber) {
        throw new Error(
          "生徒番号がありません。"
        );
      }

      if (!name) {
        throw new Error(
          "氏名がありません。"
        );
      }

      if (!schoolId) {
        throw new Error(
          "校舎がありません。"
        );
      }

      if (!schoolName) {
        throw new Error(
          "校舎名がありません。"
        );
      }

      if (!grade) {
        throw new Error(
          "学年がありません。"
        );
      }

      if (!className) {
        throw new Error(
          "クラスがありません。"
        );
      }

      validateStudentNumber(
        studentNumber
      );

      if (
        !isStudentStatus(
          status
        )
      ) {
        throw new Error(
          "在籍状況が不正です。"
        );
      }

      const existing =
        await getStudent(
          studentNumber
        );

      if (existing) {
        await updateStudent(
          studentNumber,
          {
            name,
            schoolId,
            schoolName,
            grade,
            classId,
            className,
            status,
          }
        );

        updated++;
      } else {
        await createStudent({
          studentNumber,
          name,
          schoolId,
          schoolName,
          grade,
          classId,
          className,
          status,
        });

        created++;
      }
    } catch (error) {
      errors.push({
        row:
          index + 2,

        message:
          error instanceof Error
            ? error.message
            : "登録に失敗しました。",
      });
    }
  }

  return {
    updated,
    created,
    errors,
  };
}

/* =========================================================
   生徒番号
   ========================================================= */

export async function generateStudentNumber(): Promise<string> {
  for (
    let attempt = 0;
    attempt < 100;
    attempt++
  ) {
    const number =
      String(
        Math.floor(
          100000 +
            Math.random() *
              900000
        )
      );

    const snapshot =
      await getDoc(
        doc(
          db,
          STUDENT_COLLECTION,
          number
        )
      );

    if (!snapshot.exists()) {
      return number;
    }
  }

  throw new Error(
    "使用可能な6桁生徒番号を発行できませんでした。"
  );
}

/* =========================================================
   校舎
   ========================================================= */

export async function getStudentsBySchool(
  schoolId: string
): Promise<Student[]> {
  const snapshot =
    await getDocs(
      query(
        collection(
          db,
          STUDENT_COLLECTION
        ),
        where(
          "schoolId",
          "==",
          schoolId
        ),
        where(
          "status",
          "==",
          "在籍"
        ),
        orderBy(
          "name",
          "asc"
        )
      )
    );

  return snapshot.docs.map(
    (item) =>
      convertStudent(
        item.id,
        item.data()
      )
  );
}

/* =========================================================
   学年
   ========================================================= */

export async function getStudentsByGrade(
  schoolId: string,
  grade: string
): Promise<Student[]> {
  const snapshot =
    await getDocs(
      query(
        collection(
          db,
          STUDENT_COLLECTION
        ),
        where(
          "schoolId",
          "==",
          schoolId
        ),
        where(
          "grade",
          "==",
          grade
        ),
        where(
          "status",
          "==",
          "在籍"
        ),
        orderBy(
          "name",
          "asc"
        )
      )
    );

  return snapshot.docs.map(
    (item) =>
      convertStudent(
        item.id,
        item.data()
      )
  );
}

/* =========================================================
   クラス
   ========================================================= */

export async function getStudentsByClass(
  classId: string
): Promise<Student[]> {
  const snapshot =
    await getDocs(
      query(
        collection(
          db,
          STUDENT_COLLECTION
        ),
        where(
          "classId",
          "==",
          classId
        ),
        where(
          "status",
          "==",
          "在籍"
        ),
        orderBy(
          "name",
          "asc"
        )
      )
    );

  return snapshot.docs.map(
    (item) =>
      convertStudent(
        item.id,
        item.data()
      )
  );
}

/* =========================================================
   変換
   ========================================================= */

function convertStudent(
  id: string,
  data: Record<
    string,
    unknown
  >
): Student {
  return {
    id,

    name:
      typeof data.name ===
      "string"
        ? data.name
        : "",

    schoolId:
      typeof data.schoolId ===
      "string"
        ? data.schoolId
        : "",

    schoolName:
      typeof data.schoolName ===
      "string"
        ? data.schoolName
        : "",

    grade:
      typeof data.grade ===
      "string"
        ? data.grade
        : "",

    classId:
      typeof data.classId ===
      "string"
        ? data.classId
        : undefined,

    className:
      typeof data.className ===
      "string"
        ? data.className
        : "",

    status:
      isStudentStatus(
        data.status
      )
        ? data.status
        : "在籍",

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

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

function validateStudentInput(
  input: {
    name: string;
    schoolId: string;
    schoolName: string;
    grade: string;
    className: string;
  }
) {
  if (!input.name.trim()) {
    throw new Error(
      "氏名を入力してください。"
    );
  }

  if (!input.schoolId.trim()) {
    throw new Error(
      "校舎を指定してください。"
    );
  }

  if (
    !input.schoolName.trim()
  ) {
    throw new Error(
      "校舎名を入力してください。"
    );
  }

  if (!input.grade.trim()) {
    throw new Error(
      "学年を指定してください。"
    );
  }

  if (
    !input.className.trim()
  ) {
    throw new Error(
      "クラスを指定してください。"
    );
  }
}

function isStudentStatus(
  value: unknown
): value is StudentStatus {
  return (
    value === "在籍" ||
    value === "休学" ||
    value === "卒業" ||
    value === "退塾"
  );
}
