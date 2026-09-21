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
} from "./firebase";

import type {
  UserRole,
} from "../types";

/* =========================================================
   User
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

/* =========================================================
   Scoped document
   ========================================================= */

export type ScopedDocument<
  T extends DocumentData =
    DocumentData
> = {
  id: string;

  data: T;
};

/* =========================================================
   Constants
   ========================================================= */

const IN_LIMIT =
  10;

/* =========================================================
   Collection
   ========================================================= */

function getCollection<
  T extends DocumentData
>(
  name: string
): CollectionReference<T> {
  return collection(
    db,
    name
  ) as CollectionReference<T>;
}

/* =========================================================
   Organization
   ========================================================= */

export function organizationQuery<
  T extends DocumentData
>(
  name: string,
  organizationId: string
): Query<T> {
  return query(
    getCollection<T>(
      name
    ),

    where(
      "organizationId",
      "==",
      organizationId
    )
  );
}

/* =========================================================
   Split
   ========================================================= */

function splitIntoChunks(
  values: string[],
  size: number
) {
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
   School
   ========================================================= */

export function schoolQueries<
  T extends DocumentData
>(
  name: string,
  organizationId: string,
  schoolIds: string[]
): Query<T>[] {
  if (
    schoolIds.length ===
    0
  ) {
    return [
      query(
        getCollection<T>(
          name
        ),

        where(
          "organizationId",
          "==",
          organizationId
        ),

        where(
          "schoolId",
          "==",
          "__NO_ACCESS__"
        )
      ),
    ];
  }

  const chunks =
    splitIntoChunks(
      schoolIds,
      IN_LIMIT
    );

  return chunks.map(
    (
      chunk
    ) =>
      query(
        getCollection<T>(
          name
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
   Student
   ========================================================= */

export function studentQuery<
  T extends DocumentData
>(
  name: string,
  organizationId: string,
  studentId: string
): Query<T> {
  return query(
    getCollection<T>(
      name
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
) {
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
        "students",
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
      "students",
      user.organizationId,
      user.schoolIds
    );
  }

  if (
    user.role ===
      "生徒" &&
    user.studentId
  ) {
    /*
     * 生徒のstudentIdは
     * studentsドキュメントのID。
     */
    return [
      query(
        getCollection(
          "students"
        ),

        where(
          "__name__",
          "==",
          user.studentId
        )
      ),
    ];
  }

  return [];
}

/* =========================================================
   Tests
   ========================================================= */

export function testsQueries(
  user: FirestoreUser
) {
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
        "tests",
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
      "tests",
      user.organizationId,
      user.schoolIds
    );
  }

  return [];
}

/* =========================================================
   Answers
   ========================================================= */

export function answersQueries(
  user: FirestoreUser
) {
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
        "answers",
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
      "answers",
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
        "answers",
        user.organizationId,
        user.studentId
      ),
    ];
  }

  return [];
}

/* =========================================================
   Retests
   ========================================================= */

export function retestsQueries(
  user: FirestoreUser
) {
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
        "retests",
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
      "retests",
      user.organizationId,
      user.schoolIds
    );
  }

  return [];
}

/* =========================================================
   Results
   ========================================================= */

export function resultsQueries(
  user: FirestoreUser
) {
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
        "results",
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
      "results",
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
        "results",
        user.organizationId,
        user.studentId
      ),
    ];
  }

  return [];
}

/* =========================================================
   Report cards
   ========================================================= */

export function reportCardsQueries(
  user: FirestoreUser
) {
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
        "reportCards",
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
      "reportCards",
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
        "reportCards",
        user.organizationId,
        user.studentId
      ),
    ];
  }

  return [];
}

/* =========================================================
   Grading results
   ========================================================= */

export function gradingResultsQueries(
  user: FirestoreUser
) {
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
        "gradingResults",
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
      "gradingResults",
      user.organizationId,
      user.schoolIds
    );
  }

  return [];
}

/* =========================================================
   OCR results
   ========================================================= */

export function ocrResultsQueries(
  user: FirestoreUser
) {
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
        "answerOcrResults",
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
      "answerOcrResults",
      user.organizationId,
      user.schoolIds
    );
  }

  return [];
}

/* =========================================================
   Schools
   ========================================================= */

export function schoolsQueries(
  user: FirestoreUser
) {
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
        "schools",
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
      "schools",
      user.organizationId,
      user.schoolIds
    );
  }

  return [];
}

/* =========================================================
   Student number registry
   ========================================================= */

export function studentNumberRegistryQueries(
  user: FirestoreUser
) {
  if (
    !user.organizationId
  ) {
    return [];
  }

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
   History
   ========================================================= */

export function studentHistoryQueries(
  user: FirestoreUser
) {
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
        "studentHistory",
        user.organizationId
      ),
    ];
  }

  if (
    user.role ===
    "校舎管理者"
  ) {
    return schoolQueries(
      "studentHistory",
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
        "studentHistory",
        user.organizationId,
        user.studentId
      ),
    ];
  }

  return [];
}

/* =========================================================
   Logs
   ========================================================= */

export function systemLogsQueries(
  user: FirestoreUser
) {
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
        "systemLogs",
        user.organizationId
      ),
    ];
  }

  if (
    user.role ===
    "校舎管理者"
  ) {
    return schoolQueries(
      "systemLogs",
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
) {
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
   Scoped documents
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

  const map =
    new Map<
      string,
      ScopedDocument<T>
    >();

  for (
    const snapshot of
      snapshots
  ) {
    for (
      const item of
        snapshot.docs
    ) {
      map.set(
        item.id,
        {
          id:
            item.id,

          data:
            item.data(),
        }
      );
    }
  }

  return Array.from(
    map.values()
  );
}

/* =========================================================
   Existing page compatibility
   =========================================================
   既存ページが単数Queryを要求しているため残す。
   ========================================================= */

export function testsQuery(
  user: FirestoreUser
): Query<DocumentData> | null {
  return (
    testsQueries(
      user
    )[0] ??
    null
  );
}

export function studentsQuery(
  user: FirestoreUser
): Query<DocumentData> | null {
  return (
    studentsQueries(
      user
    )[0] ??
    null
  );
}

export function answersQuery(
  user: FirestoreUser
): Query<DocumentData> | null {
  return (
    answersQueries(
      user
    )[0] ??
    null
  );
}

export function retestsQuery(
  user: FirestoreUser
): Query<DocumentData> | null {
  return (
    retestsQueries(
      user
    )[0] ??
    null
  );
}

/* =========================================================
   Access helpers
   ========================================================= */

export function canAccessSchool(
  user: FirestoreUser,
  schoolId: string
) {
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
  studentId: string,
  schoolId?: string
) {
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
    return (
      !!schoolId &&
      user.schoolIds.includes(
        schoolId
      )
    );
  }

  if (
    user.role ===
    "生徒"
  ) {
    return (
      user.studentId ===
      studentId
    );
  }

  return false;
}
