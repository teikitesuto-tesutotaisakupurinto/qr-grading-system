import {
  collection,
  getDocs,
  query,
  where,
  type CollectionReference,
  type DocumentData,
  type Query,
} from "firebase/firestore";

import {
  db,
} from "@/lib/firebase";

import type {
  UserRole,
} from "@/lib/types";

/* =========================================================
   Types
   ========================================================= */

export type FirestoreUser = {
  uid: string;

  organizationId: string | null;

  role: UserRole | null;

  schoolIds: string[];

  studentId: string | null;
};

export type ScopedDocument<
  T extends DocumentData = DocumentData
> = {
  id: string;

  data: T;
};

export type StudentScope = {
  id: string;

  organizationId: string;

  schoolId: string;
};

/* =========================================================
   Constants
   ========================================================= */

const FIRESTORE_IN_LIMIT = 10;

/* =========================================================
   Collection
   ========================================================= */

function getCollection<
  T extends DocumentData
>(
  collectionName: string
): CollectionReference<T> {
  return collection(
    db,
    collectionName
  ) as CollectionReference<T>;
}

/* =========================================================
   Organization query
   ========================================================= */

export function organizationQuery<
  T extends DocumentData
>(
  collectionName: string,
  organizationId: string
): Query<T> {
  return query(
    getCollection<T>(
      collectionName
    ),

    where(
      "organizationId",
      "==",
      organizationId
    )
  );
}

/* =========================================================
   Split school IDs
   ========================================================= */

function splitIntoChunks(
  values: string[],
  size: number
): string[][] {
  const result: string[][] = [];

  for (
    let i = 0;
    i < values.length;
    i += size
  ) {
    result.push(
      values.slice(
        i,
        i + size
      )
    );
  }

  return result;
}

/* =========================================================
   School queries
   ========================================================= */

export function schoolQueries<
  T extends DocumentData
>(
  collectionName: string,
  organizationId: string,
  schoolIds: string[]
): Query<T>[] {
  /*
   * schoolIdsが空なら、
   * 全校舎を取得してはいけない。
   */
  if (
    schoolIds.length === 0
  ) {
    return [
      query(
        getCollection<T>(
          collectionName
        ),

        where(
          "organizationId",
          "==",
          organizationId
        ),

        where(
          "schoolId",
          "==",
          "__NO_SCHOOL_ACCESS__"
        )
      ),
    ];
  }

  /*
   * Firestoreのin制限に合わせて
   * 10校舎ずつ分割。
   */
  const chunks =
    splitIntoChunks(
      schoolIds,
      FIRESTORE_IN_LIMIT
    );

  return chunks.map(
    (
      schoolChunk
    ) =>
      query(
        getCollection<T>(
          collectionName
        ),

        where(
          "organizationId",
          "==",
          organizationId
        ),

        where(
          "schoolId",
          "in",
          schoolChunk
        )
      )
  );
}

/* =========================================================
   Student query
   ========================================================= */

export function studentQuery<
  T extends DocumentData
>(
  collectionName: string,
  organizationId: string,
  studentId: string
): Query<T> {
  return query(
    getCollection<T>(
      collectionName
    ),

    where(
      "organizationId",
      "==",
      organizationId
    ),

    where(
      "studentId",
      "==",
      studentId
    )
  );
}

/* =========================================================
   Students
   ========================================================= */

export function studentsQueries(
  user: FirestoreUser
): Query<DocumentData>[] {
  if (
    !user.organizationId
  ) {
    return [];
  }

  switch (
    user.role
  ) {
    case "本部管理者":
      return [
        organizationQuery(
          "students",
          user.organizationId
        ),
      ];

    case "校舎管理者":
    case "講師":
      return schoolQueries(
        "students",
        user.organizationId,
        user.schoolIds
      );

    case "生徒":
      if (
        !user.studentId
      ) {
        return [];
      }

      /*
       * 生徒は自分のstudentIdだけ。
       */
      return [
        query(
          getCollection(
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
            user.studentId
          )
        ),
      ];

    default:
      return [];
  }
}

/* =========================================================
   Tests
   ========================================================= */

export function testsQueries(
  user: FirestoreUser
): Query<DocumentData>[] {
  if (
    !user.organizationId
  ) {
    return [];
  }

  switch (
    user.role
  ) {
    case "本部管理者":
      return [
        organizationQuery(
          "tests",
          user.organizationId
        ),
      ];

    case "校舎管理者":
    case "講師":
      return schoolQueries(
        "tests",
        user.organizationId,
        user.schoolIds
      );

    /*
     * 生徒のテスト一覧は、
     * 学習公開条件を別途指定して取得する。
     */
    case "生徒":
      return [];

    default:
      return [];
  }
}

/* =========================================================
   Answers
   ========================================================= */

export function answersQueries(
  user: FirestoreUser
): Query<DocumentData>[] {
  if (
    !user.organizationId
  ) {
    return [];
  }

  switch (
    user.role
  ) {
    case "本部管理者":
      return [
        organizationQuery(
          "answers",
          user.organizationId
        ),
      ];

    case "校舎管理者":
    case "講師":
      return schoolQueries(
        "answers",
        user.organizationId,
        user.schoolIds
      );

    case "生徒":
      if (
        !user.studentId
      ) {
        return [];
      }

      return [
        studentQuery(
          "answers",
          user.organizationId,
          user.studentId
        ),
      ];

    default:
      return [];
  }
}

/* =========================================================
   OCR Results
   ========================================================= */

export function ocrResultsQueries(
  user: FirestoreUser
): Query<DocumentData>[] {
  if (
    !user.organizationId
  ) {
    return [];
  }

  switch (
    user.role
  ) {
    case "本部管理者":
      return [
        organizationQuery(
          "answerOcrResults",
          user.organizationId
        ),
      ];

    case "校舎管理者":
    case "講師":
      return schoolQueries(
        "answerOcrResults",
        user.organizationId,
        user.schoolIds
      );

    case "生徒":
      if (
        !user.studentId
      ) {
        return [];
      }

      return [
        studentQuery(
          "answerOcrResults",
          user.organizationId,
          user.studentId
        ),
      ];

    default:
      return [];
  }
}

/* =========================================================
   Grading Results
   ========================================================= */

export function gradingResultsQueries(
  user: FirestoreUser
): Query<DocumentData>[] {
  if (
    !user.organizationId
  ) {
    return [];
  }

  switch (
    user.role
  ) {
    case "本部管理者":
      return [
        organizationQuery(
          "gradingResults",
          user.organizationId
        ),
      ];

    case "校舎管理者":
    case "講師":
      return schoolQueries(
        "gradingResults",
        user.organizationId,
        user.schoolIds
      );

    case "生徒":
      if (
        !user.studentId
      ) {
        return [];
      }

      return [
        studentQuery(
          "gradingResults",
          user.organizationId,
          user.studentId
        ),
      ];

    default:
      return [];
  }
}

/* =========================================================
   Retests
   ========================================================= */

export function retestsQueries(
  user: FirestoreUser
): Query<DocumentData>[] {
  if (
    !user.organizationId
  ) {
    return [];
  }

  switch (
    user.role
  ) {
    case "本部管理者":
      return [
        organizationQuery(
          "retests",
          user.organizationId
        ),
      ];

    case "校舎管理者":
    case "講師":
      return schoolQueries(
        "retests",
        user.organizationId,
        user.schoolIds
      );

    case "生徒":
      /*
       * 生徒は追試管理画面に入れない。
       */
      return [];

    default:
      return [];
  }
}

/* =========================================================
   Retest Results
   ========================================================= */

export function retestResultsQueries(
  user: FirestoreUser
): Query<DocumentData>[] {
  if (
    !user.organizationId
  ) {
    return [];
  }

  switch (
    user.role
  ) {
    case "本部管理者":
      return [
        organizationQuery(
          "retestResults",
          user.organizationId
        ),
      ];

    case "校舎管理者":
    case "講師":
      return schoolQueries(
        "retestResults",
        user.organizationId,
        user.schoolIds
      );

    case "生徒":
      if (
        !user.studentId
      ) {
        return [];
      }

      return [
        studentQuery(
          "retestResults",
          user.organizationId,
          user.studentId
        ),
      ];

    default:
      return [];
  }
}

/* =========================================================
   Student History
   ========================================================= */

export function studentHistoryQueries(
  user: FirestoreUser
): Query<DocumentData>[] {
  if (
    !user.organizationId
  ) {
    return [];
  }

  switch (
    user.role
  ) {
    case "本部管理者":
      return [
        organizationQuery(
          "studentHistory",
          user.organizationId
        ),
      ];

    case "校舎管理者":
      return schoolQueries(
        "studentHistory",
        user.organizationId,
        user.schoolIds
      );

    case "講師":
      return [];

    case "生徒":
      if (
        !user.studentId
      ) {
        return [];
      }

      return [
        studentQuery(
          "studentHistory",
          user.organizationId,
          user.studentId
        ),
      ];

    default:
      return [];
  }
}

/* =========================================================
   Student Number Registry
   ========================================================= */

export function studentNumberRegistryQueries(
  user: FirestoreUser
): Query<DocumentData>[] {
  if (
    !user.organizationId
  ) {
    return [];
  }

  /*
   * 生徒番号Registryは
   * 組織単位で管理。
   */
  if (
    user.role ===
      "本部管理者" ||
    user.role ===
      "校舎管理者"
  ) {
    return [
      organizationQuery(
        "studentNumberRegistry",
        user.organizationId
      ),
    ];
  }

  return [];
}

/* =========================================================
   System Logs
   ========================================================= */

export function systemLogsQueries(
  user: FirestoreUser
): Query<DocumentData>[] {
  if (
    !user.organizationId
  ) {
    return [];
  }

  switch (
    user.role
  ) {
    case "本部管理者":
      return [
        organizationQuery(
          "systemLogs",
          user.organizationId
        ),
      ];

    case "校舎管理者":
      return schoolQueries(
        "systemLogs",
        user.organizationId,
        user.schoolIds
      );

    default:
      return [];
  }
}

/* =========================================================
   Schools
   ========================================================= */

export function schoolsQueries(
  user: FirestoreUser
): Query<DocumentData>[] {
  if (
    !user.organizationId
  ) {
    return [];
  }

  switch (
    user.role
  ) {
    case "本部管理者":
      return [
        organizationQuery(
          "schools",
          user.organizationId
        ),
      ];

    case "校舎管理者":
    case "講師":
      return schoolQueries(
        "schools",
        user.organizationId,
        user.schoolIds
      );

    default:
      return [];
  }
}

/* =========================================================
   Usage
   ========================================================= */

export function usageQueries(
  user: FirestoreUser
): Query<DocumentData>[] {
  if (
    !user.organizationId
  ) {
    return [];
  }

  switch (
    user.role
  ) {
    case "本部管理者":
      return [
        organizationQuery(
          "usage",
          user.organizationId
        ),
      ];

    case "校舎管理者":
      return schoolQueries(
        "usage",
        user.organizationId,
        user.schoolIds
      );

    default:
      return [];
  }
}

/* =========================================================
   Generic scoped queries
   ========================================================= */

export function scopedQueries(
  collectionName: string,
  user: FirestoreUser
): Query<DocumentData>[] {
  if (
    !user.organizationId
  ) {
    return [];
  }

  switch (
    user.role
  ) {
    case "本部管理者":
      return [
        organizationQuery(
          collectionName,
          user.organizationId
        ),
      ];

    case "校舎管理者":
    case "講師":
      return schoolQueries(
        collectionName,
        user.organizationId,
        user.schoolIds
      );

    case "生徒":
      if (
        !user.studentId
      ) {
        return [];
      }

      return [
        studentQuery(
          collectionName,
          user.organizationId,
          user.studentId
        ),
      ];

    default:
      return [];
  }
}

/* =========================================================
   Execute scoped queries
   ========================================================= */

export async function getScopedDocs<
  T extends DocumentData
>(
  queries: Query<T>[]
): Promise<
  ScopedDocument<T>[]
> {
  if (
    queries.length ===
    0
  ) {
    return [];
  }

  const snapshots =
    await Promise.all(
      queries.map(
        (
          currentQuery
        ) =>
          getDocs(
            currentQuery
          )
      )
    );

  /*
   * document IDをキーにして重複除去。
   */
  const documents =
    new Map<
      string,
      ScopedDocument<T>
    >();

  for (
    const snapshot of
      snapshots
  ) {
    for (
      const document of
        snapshot.docs
    ) {
      documents.set(
        document.id,
        {
          id:
            document.id,

          data:
            document.data(),
        }
      );
    }
  }

  return Array.from(
    documents.values()
  );
}

/* =========================================================
   Access: School
   ========================================================= */

export function canAccessSchool(
  user: FirestoreUser,
  schoolId: string
): boolean {
  if (
    !user.organizationId ||
    !schoolId
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

/* =========================================================
   Access: Student
   ========================================================= */

export function canAccessStudent(
  user: FirestoreUser,
  student: StudentScope
): boolean {
  if (
    !user.organizationId
  ) {
    return false;
  }

  if (
    user.organizationId !==
    student.organizationId
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
      student.schoolId
    );
  }

  if (
    user.role ===
    "生徒"
  ) {
    return (
      user.studentId ===
      student.id
    );
  }

  return false;
}

/* =========================================================
   Access: Own data
   ========================================================= */

export function canAccessOwnStudentData(
  user: FirestoreUser,
  studentId: string
): boolean {
  return (
    user.role ===
      "生徒" &&
    user.studentId ===
      studentId
  );
}

/* =========================================================
   Role helpers
   ========================================================= */

export function isHeadOfficeAdmin(
  user: FirestoreUser
): boolean {
  return (
    user.role ===
    "本部管理者"
  );
}

export function isSchoolAdmin(
  user: FirestoreUser
): boolean {
  return (
    user.role ===
    "校舎管理者"
  );
}

export function isTeacher(
  user: FirestoreUser
): boolean {
  return (
    user.role ===
    "講師"
  );
}

export function isStudent(
  user: FirestoreUser
): boolean {
  return (
    user.role ===
    "生徒"
  );
}

export function isStaff(
  user: FirestoreUser
): boolean {
  return (
    user.role ===
      "本部管理者" ||
    user.role ===
      "校舎管理者" ||
    user.role ===
      "講師"
  );
}

/* =========================================================
   School management
   ========================================================= */

export function canManageSchool(
  user: FirestoreUser,
  schoolId: string
): boolean {
  if (
    user.role ===
    "本部管理者"
  ) {
    return true;
  }

  if (
    user.role ===
    "校舎管理者"
  ) {
    return user.schoolIds.includes(
      schoolId
    );
  }

  return false;
}

/* =========================================================
   Student management
   ========================================================= */

export function canManageStudent(
  user: FirestoreUser,
  schoolId: string
): boolean {
  if (
    user.role ===
    "本部管理者"
  ) {
    return true;
  }

  if (
    user.role ===
    "校舎管理者"
  ) {
    return user.schoolIds.includes(
      schoolId
    );
  }

  return false;
}

/* =========================================================
   Test management
   ========================================================= */

export function canManageTest(
  user: FirestoreUser,
  schoolId: string
): boolean {
  if (
    user.role ===
    "本部管理者"
  ) {
    return true;
  }

  if (
    user.role ===
    "校舎管理者"
  ) {
    return user.schoolIds.includes(
      schoolId
    );
  }

  return false;
}
