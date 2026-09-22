import {
  collection,
  getDocs,
  query,
  where,
  type Query,
  type QueryConstraint,
  type DocumentData,
} from "firebase/firestore";

import {
  db,
} from "@/lib/firebase";

import type {
  UserRole,
} from "@/lib/types";

/* =========================================================
   User scope
   ========================================================= */

export type FirestoreUser = {
  uid: string;

  organizationId:
    | string
    | null;

  role: UserRole;

  schoolIds: string[];

  studentId:
    | string
    | null;
};

/* =========================================================
   Generic document
   ========================================================= */

export type ScopedDocument = {
  id: string;

  data: Record<
    string,
    unknown
  >;
};

/* =========================================================
   Scope helpers
   ========================================================= */

function organizationConstraint(
  user: FirestoreUser
): QueryConstraint {
  if (
    !user.organizationId
  ) {
    throw new Error(
      "organizationIdがありません。"
    );
  }

  return where(
    "organizationId",
    "==",
    user.organizationId
  );
}

function schoolConstraint(
  user: FirestoreUser
): QueryConstraint[] {
  if (
    user.schoolIds.length ===
    0
  ) {
    /*
     * where in [] は使用できないので、
     * 存在しない値を指定して0件にする。
     */
    return [
      where(
        "schoolId",
        "==",
        "__NO_SCHOOL_ACCESS__"
      ),
    ];
  }

  /*
   * Firestoreのinは最大値制限があるため、
   * ここでは1校舎ずつ取得できるように
   * query builder側で処理する。
   */
  return [];
}

/* =========================================================
   Scoped query descriptor
   ========================================================= */

export type ScopedQueryDescriptor = {
  collectionName: string;

  constraints: QueryConstraint[];

  /*
   * schoolIdsを使って複数queryを作る場合。
   */
  schoolScoped?: boolean;
};

/* =========================================================
   Create scoped queries
   ========================================================= */

export function buildScopedQueries(
  collectionName: string,
  user: FirestoreUser,
  additionalConstraints: QueryConstraint[] = []
): Query<
  DocumentData
>[] {
  if (
    !user.organizationId
  ) {
    throw new Error(
      "organizationIdがありません。"
    );
  }

  const base =
    collection(
      db,
      collectionName
    );

  /*
   * 本部管理者
   *
   * organization全体。
   */
  if (
    user.role ===
    "本部管理者"
  ) {
    return [
      query(
        base,
        organizationConstraint(
          user
        ),
        ...additionalConstraints
      ),
    ];
  }

  /*
   * 校舎管理者・講師
   *
   * 所属校舎だけ。
   *
   * 複数校舎に所属している場合は
   * schoolIdごとにqueryを分ける。
   */
  if (
    user.role ===
      "校舎管理者" ||
    user.role ===
      "講師"
  ) {
    if (
      user.schoolIds.length ===
      0
    ) {
      return [
        query(
          base,

          organizationConstraint(
            user
          ),

          where(
            "schoolId",
            "==",
            "__NO_SCHOOL_ACCESS__"
          ),

          ...additionalConstraints
        ),
      ];
    }

    return user.schoolIds.map(
      (
        schoolId
      ) =>
        query(
          base,

          organizationConstraint(
            user
          ),

          where(
            "schoolId",
            "==",
            schoolId
          ),

          ...additionalConstraints
        )
    );
  }

  /*
   * 生徒
   *
   * studentIdだけ。
   */
  if (
    user.role ===
    "生徒"
  ) {
    if (
      !user.studentId
    ) {
      return [
        query(
          base,

          organizationConstraint(
            user
          ),

          where(
            "studentId",
            "==",
            "__NO_STUDENT_ACCESS__"
          ),

          ...additionalConstraints
        ),
      ];
    }

    return [
      query(
        base,

        organizationConstraint(
          user
        ),

        where(
          "studentId",
          "==",
          user.studentId
        ),

        ...additionalConstraints
      ),
    ];
  }

  return [];
}

/* =========================================================
   Execute scoped queries
   ========================================================= */

export async function getScopedDocs(
  queries:
    | Query<DocumentData>[]
    | Query<DocumentData>
): Promise<
  ScopedDocument[]
> {
  const queryList =
    Array.isArray(
      queries
    )
      ? queries
      : [
          queries,
        ];

  if (
    queryList.length ===
    0
  ) {
    return [];
  }

  const snapshots =
    await Promise.all(
      queryList.map(
        (
          currentQuery
        ) =>
          getDocs(
            currentQuery
          )
      )
    );

  /*
   * 複数校舎queryで
   * 同じdocumentが重複した場合に備える。
   */
  const documents =
    new Map<
      string,
      ScopedDocument
    >();

  snapshots.forEach(
    (
      snapshot
    ) => {
      snapshot.docs.forEach(
        (
          document
        ) => {
          documents.set(
            document.id,
            {
              id:
                document.id,

              data:
                document.data() as Record<
                  string,
                  unknown
                >,
            }
          );
        }
      );
    }
  );

  return Array.from(
    documents.values()
  );
}

/* =========================================================
   Answers
   ========================================================= */

export function answersQueries(
  user: FirestoreUser
) {
  return buildScopedQueries(
    "answers",
    user
  );
}

/* =========================================================
   Students
   ========================================================= */

export function studentsQueries(
  user: FirestoreUser
) {
  return buildScopedQueries(
    "students",
    user
  );
}

/* =========================================================
   Tests
   ========================================================= */

export function testsQueries(
  user: FirestoreUser
) {
  return buildScopedQueries(
    "tests",
    user
  );
}

/* =========================================================
   Results
   ========================================================= */

export function resultsQueries(
  user: FirestoreUser
) {
  return buildScopedQueries(
    "results",
    user
  );
}

/* =========================================================
   Grade reports
   ========================================================= */

export function gradeReportsQueries(
  user: FirestoreUser
) {
  return buildScopedQueries(
    "gradeReports",
    user
  );
}

/* =========================================================
   Retests
   ========================================================= */

export function retestsQueries(
  user: FirestoreUser
) {
  return buildScopedQueries(
    "retests",
    user
  );
}

/* =========================================================
   Schools
   ========================================================= */

export function schoolsQueries(
  user: FirestoreUser
) {
  return buildScopedQueries(
    "schools",
    user
  );
}

/* =========================================================
   Test questions
   ========================================================= */

export function testQuestionsQueries(
  user: FirestoreUser,
  testId?: string
) {
  const constraints:
    QueryConstraint[] =
    [];

  if (
    testId
  ) {
    constraints.push(
      where(
        "testId",
        "==",
        testId
      )
    );
  }

  return buildScopedQueries(
    "testQuestions",
    user,
    constraints
  );
}

/* =========================================================
   Test subjects
   ========================================================= */

export function testSubjectsQueries(
  user: FirestoreUser,
  testId?: string
) {
  const constraints:
    QueryConstraint[] =
    [];

  if (
    testId
  ) {
    constraints.push(
      where(
        "testId",
        "==",
        testId
      )
    );
  }

  return buildScopedQueries(
    "testSubjects",
    user,
    constraints
  );
}

/* =========================================================
   Student history
   ========================================================= */

export function studentHistoryQueries(
  user: FirestoreUser,
  studentId?: string
) {
  const constraints:
    QueryConstraint[] =
    [];

  if (
    studentId
  ) {
    constraints.push(
      where(
        "studentId",
        "==",
        studentId
      )
    );
  }

  return buildScopedQueries(
    "studentHistory",
    user,
    constraints
  );
}

/* =========================================================
   User management
   ========================================================= */

export function usersQueries(
  user: FirestoreUser
) {
  /*
   * ユーザー管理は
   * 本部・校舎管理者だけ。
   */
  if (
    user.role ===
      "本部管理者" ||
    user.role ===
      "校舎管理者"
  ) {
    return buildScopedQueries(
      "users",
      user
    );
  }

  return [];
}

/* =========================================================
   Notifications
   ========================================================= */

export function notificationsQueries(
  user: FirestoreUser
) {
  /*
   * 通知はrecipientUserIdで
   * 自分の通知だけを取得。
   */
  if (
    !user.organizationId
  ) {
    return [];
  }

  return [
    query(
      collection(
        db,
        "notifications"
      ),

      where(
        "organizationId",
        "==",
        user.organizationId
      ),

      where(
        "recipientUserId",
        "==",
        user.uid
      )
    ),
  ];
}

/* =========================================================
   Messages
   ========================================================= */

export function messagesQueries(
  user: FirestoreUser
) {
  /*
   * メッセージの基本scope。
   *
   * 詳細なtarget判定は
   * 表示側でも行う。
   */
  return buildScopedQueries(
    "messages",
    user
  );
}

/* =========================================================
   System logs
   ========================================================= */

export function systemLogsQueries(
  user: FirestoreUser
) {
  /*
   * システムログは本部管理者のみ。
   */
  if (
    user.role !==
    "本部管理者"
  ) {
    return [];
  }

  return buildScopedQueries(
    "systemLogs",
    user
  );
}

/* =========================================================
   QR stickers
   ========================================================= */

export function qrStickerQueries(
  user: FirestoreUser
) {
  return buildScopedQueries(
    "studentQRCodes",
    user
  );
}

/* =========================================================
   Subjects
   ========================================================= */

export function subjectsQueries(
  user: FirestoreUser
) {
  return buildScopedQueries(
    "subjects",
    user
  );
}

/* =========================================================
   Classes
   ========================================================= */

export function classesQueries(
  user: FirestoreUser
) {
  return buildScopedQueries(
    "classes",
    user
  );
}

/* =========================================================
   Teacher assignments
   ========================================================= */

export function teacherAssignmentsQueries(
  user: FirestoreUser
) {
  /*
   * 本部管理者・校舎管理者・講師。
   *
   * 生徒は取得不可。
   */
  if (
    user.role ===
    "生徒"
  ) {
    return [];
  }

  return buildScopedQueries(
    "teacherAssignments",
    user
  );
}

/* =========================================================
   Permission helpers
   ========================================================= */

export function canAccessOrganization(
  user: FirestoreUser,
  organizationId: string
) {
  return (
    Boolean(
      user.organizationId
    ) &&
    user.organizationId ===
      organizationId
  );
}

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

  if (
    user.role ===
      "校舎管理者" ||
    user.role ===
      "講師"
  ) {
    return user.schoolIds.includes(
      schoolId
    );
  }

  return false;
}

export function canAccessStudent(
  user: FirestoreUser,
  studentId: string
) {
  if (
    user.role ===
      "本部管理者" ||
    user.role ===
      "校舎管理者"
  ) {
    return true;
  }

  if (
    user.role ===
    "講師"
  ) {
    return true;
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

export function canManageStudents(
  user: FirestoreUser
) {
  return (
    user.role ===
      "本部管理者" ||
    user.role ===
      "校舎管理者"
  );
}

export function canManageTests(
  user: FirestoreUser
) {
  return (
    user.role ===
      "本部管理者" ||
    user.role ===
      "校舎管理者" ||
    user.role ===
      "講師"
  );
}

export function canManageUsers(
  user: FirestoreUser
) {
  return (
    user.role ===
      "本部管理者" ||
    user.role ===
      "校舎管理者"
  );
}

export function canConfirmGrading(
  user: FirestoreUser
) {
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
   Validate user
   ========================================================= */

export function assertValidScopeUser(
  user:
    | FirestoreUser
    | null
    | undefined
) {
  if (
    !user
  ) {
    throw new Error(
      "ログインユーザーがありません。"
    );
  }

  if (
    !user.uid
  ) {
    throw new Error(
      "ユーザーIDがありません。"
    );
  }

  if (
    !user.organizationId
  ) {
    throw new Error(
      "所属組織が設定されていません。"
    );
  }

  if (
    !user.role
  ) {
    throw new Error(
      "ユーザー権限が設定されていません。"
    );
  }

  return user;
}
