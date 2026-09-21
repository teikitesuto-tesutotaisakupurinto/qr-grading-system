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

const IN_LIMIT =
  10;

function getCollection<
  T extends DocumentData
>(
  name: string
) {
  return collection(
    db,
    name
  ) as CollectionReference<T>;
}

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

function chunks(
  values: string[]
) {
  const result: string[][] =
    [];

  for (
    let i = 0;
    i < values.length;
    i += IN_LIMIT
  ) {
    result.push(
      values.slice(
        i,
        i + IN_LIMIT
      )
    );
  }

  return result;
}

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
    return [];
  }

  return chunks(
    schoolIds
  ).map(
    (
      schoolChunk
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
          schoolChunk
        )
      )
  );
}

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
        "gradeReports",
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
      "gradeReports",
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
   Registry
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
   Generic
   ========================================================= */

export function scopedQueries(
  name: string,
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
        name,
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
      name,
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
        name,
        user.organizationId,
        user.studentId
      ),
    ];
  }

  return [];
}

/* =========================================================
   Execute
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
