import {
  collection,
  query,
  where,
  type CollectionReference,
  type DocumentData,
  type Query,
} from "firebase/firestore";

import type {
  UserRole,
} from "@/lib/types";

import {
  db,
} from "@/lib/firebase";

/* =========================================================
   Types
   ========================================================= */

export type FirestoreUser = {
  uid: string;

  organizationId:
    | string
    | null;

  role:
    | UserRole
    | null;

  schoolIds: string[];

  studentId:
    | string
    | null;
};

export type StudentScope = {
  id: string;

  organizationId: string;

  schoolId: string;
};

/* =========================================================
   Constants
   ========================================================= */

/*
 * Firestore の `in` / `array-contains-any` の
 * 1クエリあたりの値数を10件以内にする。
 */
const FIRESTORE_IN_LIMIT =
  10;

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
   Organization Query
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
   Split IDs
   ========================================================= */

function splitIntoChunks(
  values: string[],
  size: number
): string[][] {
  const result: string[][] =
    [];

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
   School Queries
   =========================================================
   11校舎以上でも対応。
   ========================================================= */

export function schoolQueries<
  T extends DocumentData
>(
  collectionName: string,
  organizationId: string,
  schoolIds: string[]
): Query<T>[] {
  if (
    schoolIds.length ===
    0
  ) {
    /*
     * 権限がない場合に
     * organization全件を取得しない。
     */
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

  const chunks =
    splitIntoChunks(
      schoolIds,
      FIRESTORE_IN_LIMIT
    );

  return chunks.map(
    (
      chunk
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
          chunk
        )
      )
  );
}

/* =========================================================
   Student Query
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

      return [
        studentQuery(
          "students",
          user.organizationId,
          user.studentId
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
      if (
        !user.studentId
      ) {
        return [];
      }

      return [
        studentQuery(
          "retests",
          user.organizationId,
          user.studentId
        ),
      ];

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

  /*
   * 本部管理者
   * → 全校舎
   */
  if (
    user.role ===
    "本部管理者"
  ) {
    return [
      organizationQuery(
        "schools",
        user.organizationId
      ),
    ];
  }

  /*
   * 校舎管理者・講師
   * → 自分のschoolIds
   */
  if (
    user.role ===
      "校舎管理者" ||
    user.role ===
      "講師"
  ) {
    return schoolQueries(
      "schools",
      user.organizationId,
      user.schoolIds
    );
  }

  return [];
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

  if (
    user.role ===
    "本部管理者"
  ) {
    return [
      organizationQuery(
        "usage",
        user.organizationId
      ),
    ];
  }

  if (
    user.role ===
    "校舎管理者"
  ) {
    return schoolQueries(
      "usage",
      user.organizationId,
      user.schoolIds
    );
  }

  return [];
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

  if (
    user.role ===
    "本部管理者"
  ) {
    return [
      organizationQuery(
        collectionName,
        user.organizationId
      ),
    ];
  }

  if (
    user.role ===
      "校舎管理者" ||
    user.role ===
      "講師"
  ) {
    return schoolQueries(
      collectionName,
      user.organizationId,
      user.schoolIds
    );
  }

  if (
    user.role ===
      "生徒" &&
    user.studentId
  ) {
    return [
      studentQuery(
        collectionName,
        user.organizationId,
        user.studentId
      ),
    ];
  }

  return [];
}

/* =========================================================
   Execute multiple queries
   =========================================================
   各ページから簡単に使えるように、
   Query[]をまとめて実行する。
   ========================================================= */

export async function getScopedDocs<
  T extends DocumentData
>(
  queries: Query<T>[]
): Promise<T[]> {
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
          item
        ) =>
          import(
            "firebase/firestore"
          ).then(
            ({
              getDocs,
            }) =>
              getDocs(
                item
              )
          )
      )
    );

  const map =
    new Map<
      string,
      T
    >();

  for (
    const snapshot of
      snapshots
  ) {
    for (
      const item of
        snapshot.docs
    ) {
      /*
       * 同じドキュメントが
       * 複数Queryに入っても重複しない。
       */
      map.set(
        item.id,
        item.data()
      );
    }
  }

  return Array.from(
    map.values()
  );
}

/* =========================================================
   Access checks
   ========================================================= */

export function canAccessSchool(
  user: FirestoreUser,
  schoolId: string
) {
  if (
    !user.organizationId
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

export function canAccessStudent(
  user: FirestoreUser,
  student: StudentScope
) {
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
   Role helpers
   ========================================================= */

export function isHeadOfficeAdmin(
  user: FirestoreUser
) {
  return (
    user.role ===
    "本部管理者"
  );
}

export function isSchoolAdmin(
  user: FirestoreUser
) {
  return (
    user.role ===
    "校舎管理者"
  );
}

export function isTeacher(
  user: FirestoreUser
) {
  return (
    user.role ===
    "講師"
  );
}

export function isStudent(
  user: FirestoreUser
) {
  return (
    user.role ===
    "生徒"
  );
}
