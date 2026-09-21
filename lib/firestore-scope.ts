import {
  collection,
  query,
  where,
  type Query,
  type DocumentData,
  type CollectionReference,
} from "firebase/firestore";

import type {
  UserRole,
} from "@/lib/types";

import {
  db,
} from "@/lib/firebase";

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
   基本
   ========================================================= */

function baseCollection(
  collectionName: string
) {
  return collection(
    db,
    collectionName
  );
}

/* =========================================================
   組織のみ
   本部管理者用
   ========================================================= */

export function organizationQuery<T extends DocumentData>(
  collectionName: string,
  organizationId: string
): Query<T> {
  return query(
    baseCollection(
      collectionName
    ) as CollectionReference<T>,
    where(
      "organizationId",
      "==",
      organizationId
    )
  );
}

/* =========================================================
   校舎単位
   校舎管理者・講師用
   ========================================================= */

export function schoolQuery<T extends DocumentData>(
  collectionName: string,
  organizationId: string,
  schoolIds: string[]
): Query<T> {
  /*
   * Firestoreのarray-contains-anyを使って、
   * schoolIdsのどれかに一致するデータだけ取得。
   */

  if (
    schoolIds.length ===
    0
  ) {
    /*
     * 権限のないユーザーに
     * 全件取得させない。
     *
     * schoolIdsが空なら
     * 意図的に0件になる条件を使う。
     */
    return query(
      baseCollection(
        collectionName
      ) as CollectionReference<T>,
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

  /*
   * array-contains-anyは最大10件。
   * schoolIdsが10を超える組織では、
   * 呼び出し側で分割する必要がある。
   */
  const limitedSchoolIds =
    schoolIds.slice(
      0,
      10
    );

  return query(
    baseCollection(
      collectionName
    ) as CollectionReference<T>,
    where(
      "organizationId",
      "==",
      organizationId
    ),
    where(
      "schoolId",
      "in",
      limitedSchoolIds
    )
  );
}

/* =========================================================
   生徒本人
   ========================================================= */

export function studentQuery<T extends DocumentData>(
  collectionName: string,
  organizationId: string,
  studentId: string
): Query<T> {
  return query(
    baseCollection(
      collectionName
    ) as CollectionReference<T>,
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
   生徒本人のテスト結果
   ========================================================= */

export function studentTestResultQuery<T extends DocumentData>(
  collectionName: string,
  organizationId: string,
  studentId: string,
  testId?: string
): Query<T> {
  const ref =
    baseCollection(
      collectionName
    ) as CollectionReference<T>;

  if (
    testId
  ) {
    return query(
      ref,

      where(
        "organizationId",
        "==",
        organizationId
      ),

      where(
        "studentId",
        "==",
        studentId
      ),

      where(
        "testId",
        "==",
        testId
      )
    );
  }

  return query(
    ref,

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
   権限別 students query
   ========================================================= */

export function studentsQuery(
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
      "students",
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
      "students",
      user.organizationId,
      user.schoolIds
    );
  }

  /*
   * 生徒は自分だけ。
   */
  if (
    user.role ===
      "生徒" &&
    user.studentId
  ) {
    return studentQuery(
      "students",
      user.organizationId,
      user.studentId
    );
  }

  return null;
}

/* =========================================================
   権限別 tests query
   ========================================================= */

export function testsQuery(
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
      "tests",
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
      "tests",
      user.organizationId,
      user.schoolIds
    );
  }

  /*
   * 生徒用。
   *
   * 生徒側では必要なテストだけ
   * 別途取得する。
   */
  return null;
}

/* =========================================================
   権限別 answers query
   ========================================================= */

export function answersQuery(
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
      "answers",
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
    return studentQuery(
      "answers",
      user.organizationId,
      user.studentId
    );
  }

  return null;
}

/* =========================================================
   権限別 retests query
   ========================================================= */

export function retestsQuery(
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
      "retests",
      user.organizationId
    );
  }

  /*
   * retests自体にはschoolIdを持たせず、
   * studentIdから校舎を判定するRulesなので、
   * クライアントから全校舎retetsをqueryすると
   * Rules上問題になる。
   *
   * 本番ではretetsにもschoolIdを保存する。
   *
   * 以降の登録処理で必ずschoolIdを
   * 保存する前提。
   */
  if (
    user.role ===
      "校舎管理者" ||
    user.role ===
      "講師"
  ) {
    return schoolQuery(
      "retests",
      user.organizationId,
      user.schoolIds
    );
  }

  if (
    user.role ===
      "生徒" &&
    user.studentId
  ) {
    return studentQuery(
      "retests",
      user.organizationId,
      user.studentId
    );
  }

  return null;
}

/* =========================================================
   権限別 retestResults query
   ========================================================= */

export function retestResultsQuery(
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
      "retestResults",
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
      "retestResults",
      user.organizationId,
      user.schoolIds
    );
  }

  if (
    user.role ===
      "生徒" &&
    user.studentId
  ) {
    return studentQuery(
      "retestResults",
      user.organizationId,
      user.studentId
    );
  }

  return null;
}

/* =========================================================
   systemLogs
   ========================================================= */

export function systemLogsQuery(
  user: FirestoreUser
) {
  if (
    !user.organizationId
  ) {
    return null;
  }

  /*
   * systemLogsには必ず
   * organizationIdとschoolIdを保存する
   * 仕様にする。
   */

  if (
    user.role ===
    "本部管理者"
  ) {
    return organizationQuery(
      "systemLogs",
      user.organizationId
    );
  }

  if (
    user.role ===
      "校舎管理者"
  ) {
    return schoolQuery(
      "systemLogs",
      user.organizationId,
      user.schoolIds
    );
  }

  return null;
}

/* =========================================================
   Utility
   ========================================================= */

export function canUseSchool(
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
