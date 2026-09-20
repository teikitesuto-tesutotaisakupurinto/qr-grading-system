import {
  collection,
  deleteDoc,
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
  DocumentSnapshot,
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
   生徒取得
   ========================================================= */

export async function getStudent(
  studentNumber: string
): Promise<Student | null> {
  if (
    !/^\d{6}$/.test(
      studentNumber
    )
  ) {
    throw new Error(
      "生徒番号は6桁数字で指定してください。"
    );
  }

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
   生徒一覧
   ========================================================= */

export async function getStudents(
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

  /*
   * keyword検索はFirestoreだけでは
   * 部分一致検索ができないため、
   * 本番では専用検索インデックスを追加する。
   *
   * 現時点では取得後の完全一致候補として扱う。
   */
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
      limit(PAGE_SIZE)
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
            .includes(keyword) ||
          student.name
            .toLowerCase()
            .includes(keyword)
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
   生徒登録
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
      input.schoolId,

    schoolName:
      input.schoolName.trim(),

    grade:
      input.grade.trim(),

    classId:
      input.classId,

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
   生徒更新
   ========================================================= */

export async function updateStudent(
  studentNumber: string,
  changes: Partial<
    Omit<
      Student,
      "id"
    >
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

  const updateData: Record<
    string,
    unknown
  > = {
    ...changes,

    updatedAt:
      serverTimestamp(),
  };

  if (changes.name !== undefined) {
    updateData.name =
      changes.name.trim();
  }

  if (
    changes.schoolName !==
    undefined
  ) {
    updateData.schoolName =
      changes.schoolName.trim();
  }

  if (
    changes.grade !==
    undefined
  ) {
    updateData.grade =
      changes.grade.trim();
  }

  if (
    changes.className !==
    undefined
  ) {
    updateData.className =
      changes.className.trim();
  }

  await updateDoc(
    reference,
    updateData
  );
}

/* =========================================================
   生徒削除
   ========================================================= */

export async function deleteStudent(
  studentNumber: string
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
      "削除対象の生徒が存在しません。"
    );
  }

  /*
   * 本番運用では成績・答案を保持するため、
   * 原則として物理削除ではなく
   * 退塾状態に変更する運用を推奨。
   */
  await updateDoc(
    reference,
    {
      status:
        "退塾",

      updatedAt:
        serverTimestamp(),
    }
  );
}

/* =========================================================
   生徒番号発行
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

    const reference =
      doc(
        db,
        STUDENT_COLLECTION,
        number
      );

    const snapshot =
      await getDoc(
        reference
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
   クラス別生徒取得
   ========================================================= */

export async function getStudentsByClass(
  classId: string
): Promise<Student[]> {
  if (!classId.trim()) {
    return [];
  }

  const studentQuery =
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
    );

  const snapshot =
    await getDocs(
      studentQuery
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
   校舎別生徒取得
   ========================================================= */

export async function getStudentsBySchool(
  schoolId: string
): Promise<Student[]> {
  if (!schoolId.trim()) {
    return [];
  }

  const studentQuery =
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
    );

  const snapshot =
    await getDocs(
      studentQuery
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
   学年別生徒取得
   ========================================================= */

export async function getStudentsByGrade(
  schoolId: string,
  grade: string
): Promise<Student[]> {
  const studentQuery =
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
    );

  const snapshot =
    await getDocs(
      studentQuery
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
   データ変換
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

/* =========================================================
   バリデーション
   ========================================================= */

function validateStudentNumber(
  value: string
) {
  if (
    !/^\d{6}$/.test(value)
  ) {
    throw new Error(
      "生徒番号は6桁の数字で指定してください。"
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
