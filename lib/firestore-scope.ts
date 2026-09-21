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

export type ScopedDocument<
  T extends DocumentData =
    DocumentData
> = {
  id: string;

  data: T;
};

/* =========================================================
   Utility
   ========================================================= */

const FIRESTORE_IN_LIMIT =
  10;

function collectionRef<
  T extends DocumentData
>(
  name: string
): CollectionReference<T> {
  return collection(
    db,
    name
  ) as CollectionReference<T>;
}

function splitIntoChunks(
  values: string[],
  size = FIRESTORE_IN_LIMIT
) {
  const chunks: string[][] =
    [];

  for (
    let i = 0;
    i < values.length;
    i += size
  ) {
    chunks.push(
      values.slice(
        i,
        i + size
      )
    );
  }

  return chunks;
}

/* =========================================================
   Organization scope
   ========================================================= */

export function organizationQuery<
  T extends DocumentData
>(
  collectionName: string,
  organizationId: string
): Query<T> {
  return query(
    collectionRef<T>(
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
   School scope
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
    return [];
  }

  return splitIntoChunks(
    schoolIds
  ).map(
    (
      ids
    ) =>
      query(
        collectionRef<T>(
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
          ids
        )
      )
  );
}

/* =========================================================
   Student scope
   ========================================================= */

export function studentQuery<
  T extends DocumentData
>(
  collectionName: string,
  organizationId: string,
  studentId: string
): Query<T> {
  return query(
    collectionRef<T>(
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
   Generic scope
   ========================================================= */

export function scopedQueries<
  T extends DocumentData
>(
  collectionName: string,
  user: FirestoreUser
): Query<T>[] {
  if (
    !user.organizationId ||
    !user.role
  ) {
    return [];
  }

  switch (
    user.role
  ) {
    case "本部管理者":
      return [
        organizationQuery<T>(
          collectionName,
          user.organizationId
        ),
      ];

    case "校舎管理者":
    case "講師":
      return schoolQueries<T>(
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
        studentQuery<T>(
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
       * 生徒本人は自分の
       * studentsドキュメントだけ。
       */
      return [
        query(
          collectionRef(
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
) {
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
      /*
       * 生徒はテスト管理画面には
       * 入れない。
       */
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
) {
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
      /*
       * 生徒は採点結果管理には
       * アクセスしない。
       */
      return [];

    default:
      return [];
  }
}

/* =========================================================
   First reviews
   ========================================================= */

export function firstReviewsQueries(
  user: FirestoreUser
) {
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
          "firstReviews",
          user.organizationId
        ),
      ];

    case "校舎管理者":
    case "講師":
      return schoolQueries(
        "firstReviews",
        user.organizationId,
        user.schoolIds
      );

    default:
      return [];
  }
}

/* =========================================================
   Second reviews
   ========================================================= */

export function secondReviewsQueries(
  user: FirestoreUser
) {
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
          "secondReviews",
          user.organizationId
        ),
      ];

    case "校舎管理者":
    case "講師":
      return schoolQueries(
        "secondReviews",
        user.organizationId,
        user.schoolIds
      );

    default:
      return [];
  }
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

  switch (
    user.role
  ) {
    case "本部管理者":
      return [
        organizationQuery(
          "results",
          user.organizationId
        ),
      ];

    case "校舎管理者":
    case "講師":
      return schoolQueries(
        "results",
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
          "results",
          user.organizationId,
          user.studentId
        ),
      ];

    default:
      return [];
  }
}

/* =========================================================
   Grade reports
   ========================================================= */

export function gradeReportsQueries(
  user: FirestoreUser
) {
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
          "gradeReports",
          user.organizationId
        ),
      ];

    case "校舎管理者":
    case "講師":
      return schoolQueries(
        "gradeReports",
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
          "gradeReports",
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
) {
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
       * 生徒には追試管理機能を
       * 表示しない。
       */
      return [];

    default:
      return [];
  }
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
   Student history
   ========================================================= */

export function studentHistoryQueries(
  user: FirestoreUser
) {
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

    case "講師":
      /*
       * 講師には生徒の変更履歴管理を
       * 表示しない。
       */
      return [];

    default:
      return [];
  }
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
   System logs
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
   Student-specific result
   ========================================================= */

export function ownResultsQuery(
  user: FirestoreUser
) {
  if (
    !user.organizationId ||
    user.role !==
      "生徒" ||
    !user.studentId
  ) {
    return null;
  }

  return studentQuery(
    "results",
    user.organizationId,
    user.studentId
  );
}

/* =========================================================
   Student-specific reports
   ========================================================= */

export function ownGradeReportsQuery(
  user: FirestoreUser
) {
  if (
    !user.organizationId ||
    user.role !==
      "生徒" ||
    !user.studentId
  ) {
    return null;
  }

  return studentQuery(
    "gradeReports",
    user.organizationId,
    user.studentId
  );
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
   * 複数校舎にまたがるクエリの
   * 重複をdocument IDで除去。
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
      const item of
        snapshot.docs
    ) {
      documents.set(
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
    documents.values()
  );
}

/* =========================================================
   Existing API compatibility
   ========================================================= */

export function testsQuery(
  user: FirestoreUser
) {
  return (
    testsQueries(
      user
    )[0] ??
    null
  );
}

export function studentsQuery(
  user: FirestoreUser
) {
  return (
    studentsQueries(
      user
    )[0] ??
    null
  );
}

export function answersQuery(
  user: FirestoreUser
) {
  return (
    answersQueries(
      user
    )[0] ??
    null
  );
}

export function retestsQuery(
  user: FirestoreUser
) {
  return (
    retestsQueries(
      user
    )[0] ??
    null
  );
}

export function resultsQuery(
  user: FirestoreUser
) {
  return (
    resultsQueries(
      user
    )[0] ??
    null
  );
}

export function gradeReportsQuery(
  user: FirestoreUser
) {
  return (
    gradeReportsQueries(
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
    !user.role
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
  studentId: string,
  schoolId?: string
) {
  if (
    !user.role
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
    return Boolean(
      schoolId &&
        user.schoolIds.includes(
          schoolId
        )
    );
  }

  return (
    user.role ===
      "生徒" &&
    user.studentId ===
      studentId
  );
}

export function canAccessOrganization(
  user: FirestoreUser,
  organizationId: string
) {
  return (
    user.role ===
      "本部管理者" &&
    user.organizationId ===
      organizationId
  );
}
