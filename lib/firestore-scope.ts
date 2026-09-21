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

/* =========================================================
   Internal helpers
   ========================================================= */

function getCollection<T extends DocumentData>(
  collectionName: string
): CollectionReference<T> {
  return collection(
    db,
    collectionName
  ) as CollectionReference<T>;
}

/*
 * schoolIds が空の場合でも、
 * 組織全体を取得してしまわないようにする。
 */
function noSchoolQuery<T extends DocumentData>(
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
    ),

    where(
      "schoolId",
      "==",
      "__NO_SCHOOL_ACCESS__"
    )
  );
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
   School scope
   =========================================================
   本部管理者:
   全校舎ではなく organization 全体

   校舎管理者・講師:
   schoolIds に含まれる校舎のみ
   ========================================================= */

export function schoolQuery<
  T extends DocumentData
>(
  collectionName: string,
  organizationId: string,
  schoolIds: string[]
): Query<T> {
  if (
    schoolIds.length ===
    0
  ) {
    return noSchoolQuery<T>(
      collectionName,
      organizationId
    );
  }

  /*
   * Firestore の "in" は最大10件。
   *
   * 校舎が10校を超える場合は、
   * 呼び出し側で複数Queryを実行して
   * 結合する必要がある。
   */
  const ids =
    schoolIds.slice(
      0,
      10
    );

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
      "schoolId",
      "in",
      ids
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
   Student document collections
   ========================================================= */

export function studentDocumentQuery<
  T extends DocumentData
>(
  collectionName: string,
  organizationId: string,
  studentId: string
): Query<T> {
  return studentQuery<T>(
    collectionName,
    organizationId,
    studentId
  );
}

/* =========================================================
   Students
   ========================================================= */

export function studentsQuery(
  user: FirestoreUser
) {
  if (
    !user.organizationId
  ) {
    return null;
  }

  switch (
    user.role
  ) {
    case "本部管理者":
      return organizationQuery(
        "students",
        user.organizationId
      );

    case "校舎管理者":
    case "講師":
      return schoolQuery(
        "students",
        user.organizationId,
        user.schoolIds
      );

    case "生徒":
      if (
        !user.studentId
      ) {
        return null;
      }

      return studentQuery(
        "students",
        user.organizationId,
        user.studentId
      );

    default:
      return null;
  }
}

/* =========================================================
   Tests
   ========================================================= */

export function testsQuery(
  user: FirestoreUser
) {
  if (
    !user.organizationId
  ) {
    return null;
  }

  switch (
    user.role
  ) {
    case "本部管理者":
      return organizationQuery(
        "tests",
        user.organizationId
      );

    case "校舎管理者":
    case "講師":
      return schoolQuery(
        "tests",
        user.organizationId,
        user.schoolIds
      );

    /*
     * 生徒用テスト一覧は、
     * 公開対象など別条件で取得する。
     */
    case "生徒":
      return null;

    default:
      return null;
  }
}

/* =========================================================
   Answers
   ========================================================= */

export function answersQuery(
  user: FirestoreUser
) {
  if (
    !user.organizationId
  ) {
    return null;
  }

  switch (
    user.role
  ) {
    case "本部管理者":
      return organizationQuery(
        "answers",
        user.organizationId
      );

    case "校舎管理者":
    case "講師":
      return schoolQuery(
        "answers",
        user.organizationId,
        user.schoolIds
      );

    case "生徒":
      if (
        !user.studentId
      ) {
        return null;
      }

      return studentQuery(
        "answers",
        user.organizationId,
        user.studentId
      );

    default:
      return null;
  }
}

/* =========================================================
   OCR Results
   ========================================================= */

export function ocrResultsQuery(
  user: FirestoreUser
) {
  if (
    !user.organizationId
  ) {
    return null;
  }

  /*
   * answerOcrResults 自体には
   * schoolId がない旧構造を想定しない。
   *
   * 本番では answer と同じ範囲を取得できる
   * schoolId / organizationId を持たせる。
   */

  switch (
    user.role
  ) {
    case "本部管理者":
      return organizationQuery(
        "answerOcrResults",
        user.organizationId
      );

    case "校舎管理者":
    case "講師":
      return schoolQuery(
        "answerOcrResults",
        user.organizationId,
        user.schoolIds
      );

    case "生徒":
      if (
        !user.studentId
      ) {
        return null;
      }

      return studentQuery(
        "answerOcrResults",
        user.organizationId,
        user.studentId
      );

    default:
      return null;
  }
}

/* =========================================================
   Grading Results
   ========================================================= */

export function gradingResultsQuery(
  user: FirestoreUser
) {
  if (
    !user.organizationId
  ) {
    return null;
  }

  switch (
    user.role
  ) {
    case "本部管理者":
      return organizationQuery(
        "gradingResults",
        user.organizationId
      );

    case "校舎管理者":
    case "講師":
      return schoolQuery(
        "gradingResults",
        user.organizationId,
        user.schoolIds
      );

    case "生徒":
      if (
        !user.studentId
      ) {
        return null;
      }

      return studentQuery(
        "gradingResults",
        user.organizationId,
        user.studentId
      );

    default:
      return null;
  }
}

/* =========================================================
   Retests
   ========================================================= */

export function retestsQuery(
  user: FirestoreUser
) {
  if (
    !user.organizationId
  ) {
    return null;
  }

  switch (
    user.role
  ) {
    case "本部管理者":
      return organizationQuery(
        "retests",
        user.organizationId
      );

    case "校舎管理者":
    case "講師":
      return schoolQuery(
        "retests",
        user.organizationId,
        user.schoolIds
      );

    case "生徒":
      if (
        !user.studentId
      ) {
        return null;
      }

      return studentQuery(
        "retests",
        user.organizationId,
        user.studentId
      );

    default:
      return null;
  }
}

/* =========================================================
   Retest Results
   ========================================================= */

export function retestResultsQuery(
  user: FirestoreUser
) {
  if (
    !user.organizationId
  ) {
    return null;
  }

  switch (
    user.role
  ) {
    case "本部管理者":
      return organizationQuery(
        "retestResults",
        user.organizationId
      );

    case "校舎管理者":
    case "講師":
      return schoolQuery(
        "retestResults",
        user.organizationId,
        user.schoolIds
      );

    case "生徒":
      if (
        !user.studentId
      ) {
        return null;
      }

      return studentQuery(
        "retestResults",
        user.organizationId,
        user.studentId
      );

    default:
      return null;
  }
}

/* =========================================================
   Student History
   ========================================================= */

export function studentHistoryQuery(
  user: FirestoreUser
) {
  if (
    !user.organizationId
  ) {
    return null;
  }

  switch (
    user.role
  ) {
    case "本部管理者":
      return organizationQuery(
        "studentHistory",
        user.organizationId
      );

    case "校舎管理者":
      return schoolQuery(
        "studentHistory",
        user.organizationId,
        user.schoolIds
      );

    case "講師":
      /*
       * 講師には生徒履歴管理を
       * 開放しない。
       */
      return null;

    case "生徒":
      if (
        !user.studentId
      ) {
        return null;
      }

      return studentQuery(
        "studentHistory",
        user.organizationId,
        user.studentId
      );

    default:
      return null;
  }
}

/* =========================================================
   System Logs
   ========================================================= */

export function systemLogsQuery(
  user: FirestoreUser
) {
  if (
    !user.organizationId
  ) {
    return null;
  }

  switch (
    user.role
  ) {
    case "本部管理者":
      return organizationQuery(
        "systemLogs",
        user.organizationId
      );

    case "校舎管理者":
      return schoolQuery(
        "systemLogs",
        user.organizationId,
        user.schoolIds
      );

    default:
      return null;
  }
}

/* =========================================================
   Schools
   ========================================================= */

export function schoolsQuery(
  user: FirestoreUser
) {
  if (
    !user.organizationId
  ) {
    return null;
  }

  /*
   * schoolsには必ず
   * organizationIdを持たせる。
   */

  if (
    user.role ===
    "本部管理者"
  ) {
    return organizationQuery(
      "schools",
      user.organizationId
    );
  }

  if (
    user.role ===
      "校舎管理者" ||
    user.role ===
      "講師"
  ) {
    return schoolQuery(
      "schools",
      user.organizationId,
      user.schoolIds
    );
  }

  return null;
}

/* =========================================================
   Usage
   ========================================================= */

export function usageQuery(
  user: FirestoreUser
) {
  if (
    !user.organizationId
  ) {
    return null;
  }

  if (
    user.role ===
    "本部管理者"
  ) {
    return organizationQuery(
      "usage",
      user.organizationId
    );
  }

  if (
    user.role ===
    "校舎管理者"
  ) {
    return schoolQuery(
      "usage",
      user.organizationId,
      user.schoolIds
    );
  }

  return null;
}

/* =========================================================
   Permission helpers
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
  student: StudentScope
) {
  if (
    !user.organizationId ||
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

export type StudentScope = {
  id: string;

  organizationId: string;

  schoolId: string;
};

/* =========================================================
   Empty query helper
   ========================================================= */

export function noAccessQuery<
  T extends DocumentData
>(
  collectionName: string
): Query<T> {
  /*
   * organizationIdに絶対に一致しない
   * ダミー値を使用する。
   */
  return query(
    getCollection<T>(
      collectionName
    ),

    where(
      "organizationId",
      "==",
      "__NO_ACCESS__"
    )
  );
}
