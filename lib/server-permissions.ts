import type {
  AppUser,
  UserRole,
} from "@/lib/types";

/* =========================================================
   Server User
   ========================================================= */

export type ServerUser = {
  uid: string;

  email:
    | string
    | null;

  name: string;

  role: UserRole;

  organizationId:
    | string
    | null;

  schoolIds: string[];

  studentId:
    | string
    | null;

  active: boolean;
};

/* =========================================================
   Convert AppUser
   ========================================================= */

export function toServerUser(
  user: AppUser
): ServerUser {
  return {
    uid:
      user.uid,

    email:
      user.email,

    name:
      user.name,

    role:
      user.role,

    organizationId:
      user.organizationId,

    schoolIds:
      user.schoolIds,

    studentId:
      user.studentId,

    active:
      user.active,
  };
}

/* =========================================================
   Organization
   ========================================================= */

export function canAccessOrganization(
  user:
    | ServerUser
    | null
    | undefined,
  organizationId: string
) {
  if (
    !user ||
    !user.active
  ) {
    return false;
  }

  if (
    user.role ===
    "本部管理者"
  ) {
    return (
      user.organizationId ===
      organizationId
    );
  }

  return (
    user.organizationId ===
    organizationId
  );
}

/* =========================================================
   School
   ========================================================= */

export function canAccessSchool(
  user:
    | ServerUser
    | null
    | undefined,
  schoolId: string
) {
  if (
    !user ||
    !user.active ||
    !schoolId
  ) {
    return false;
  }

  /*
   * 本部管理者は所属組織内の
   * すべての校舎にアクセスできる。
   *
   * 校舎管理者・講師は
   * schoolIdsに含まれる校舎のみ。
   */
  return (
    user.role ===
      "本部管理者" ||
    user.schoolIds.includes(
      schoolId
    )
  );
}

/* =========================================================
   Student
   ========================================================= */

export function canAccessStudent(
  user:
    | ServerUser
    | null
    | undefined,
  studentId: string,
  studentSchoolId?:
    | string
    | null
) {
  if (
    !user ||
    !user.active ||
    !studentId
  ) {
    return false;
  }

  /*
   * 本部管理者
   */
  if (
    user.role ===
    "本部管理者"
  ) {
    return true;
  }

  /*
   * 生徒本人
   */
  if (
    user.role ===
    "生徒"
  ) {
    return (
      user.studentId ===
      studentId
    );
  }

  /*
   * 校舎管理者・講師
   */
  if (
    user.role ===
      "校舎管理者" ||
    user.role ===
      "講師"
  ) {
    if (
      !studentSchoolId
    ) {
      return false;
    }

    return user.schoolIds.includes(
      studentSchoolId
    );
  }

  return false;
}

/* =========================================================
   User management
   ========================================================= */

export function canManageUsers(
  user:
    | ServerUser
    | null
    | undefined
) {
  if (
    !user ||
    !user.active
  ) {
    return false;
  }

  return (
    user.role ===
      "本部管理者" ||
    user.role ===
      "校舎管理者"
  );
}

/* =========================================================
   School management
   ========================================================= */

export function canManageSchools(
  user:
    | ServerUser
    | null
    | undefined
) {
  return (
    Boolean(
      user &&
        user.active
    ) &&
    user!.role ===
      "本部管理者"
  );
}

/* =========================================================
   Student management
   ========================================================= */

export function canManageStudents(
  user:
    | ServerUser
    | null
    | undefined
) {
  if (
    !user ||
    !user.active
  ) {
    return false;
  }

  return (
    user.role ===
      "本部管理者" ||
    user.role ===
      "校舎管理者"
  );
}

/* =========================================================
   Test management
   ========================================================= */

export function canManageTests(
  user:
    | ServerUser
    | null
    | undefined
) {
  if (
    !user ||
    !user.active
  ) {
    return false;
  }

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
   Answer management
   ========================================================= */

export function canManageAnswers(
  user:
    | ServerUser
    | null
    | undefined
) {
  if (
    !user ||
    !user.active
  ) {
    return false;
  }

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
   Grading
   ========================================================= */

export function canGrade(
  user:
    | ServerUser
    | null
    | undefined
) {
  if (
    !user ||
    !user.active
  ) {
    return false;
  }

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
   Confirm grading
   ========================================================= */

export function canConfirmGrading(
  user:
    | ServerUser
    | null
    | undefined
) {
  if (
    !user ||
    !user.active
  ) {
    return false;
  }

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
   Result management
   ========================================================= */

export function canManageResults(
  user:
    | ServerUser
    | null
    | undefined
) {
  if (
    !user ||
    !user.active
  ) {
    return false;
  }

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
   Report management
   ========================================================= */

export function canManageReports(
  user:
    | ServerUser
    | null
    | undefined
) {
  if (
    !user ||
    !user.active
  ) {
    return false;
  }

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
   Retest
   ========================================================= */

export function canManageRetests(
  user:
    | ServerUser
    | null
    | undefined
) {
  if (
    !user ||
    !user.active
  ) {
    return false;
  }

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
   QR stickers
   ========================================================= */

export function canManageQRStickers(
  user:
    | ServerUser
    | null
    | undefined
) {
  if (
    !user ||
    !user.active
  ) {
    return false;
  }

  return (
    user.role ===
      "本部管理者" ||
    user.role ===
      "校舎管理者"
  );
}

/* =========================================================
   System settings
   ========================================================= */

export function canManageSettings(
  user:
    | ServerUser
    | null
    | undefined
) {
  return (
    Boolean(
      user &&
        user.active
    ) &&
    user!.role ===
      "本部管理者"
  );
}

/* =========================================================
   Head office
   ========================================================= */

export function isHeadOfficeAdmin(
  user:
    | ServerUser
    | null
    | undefined
) {
  return (
    user?.active ===
      true &&
    user.role ===
      "本部管理者"
  );
}

/* =========================================================
   School admin
   ========================================================= */

export function isSchoolAdmin(
  user:
    | ServerUser
    | null
    | undefined
) {
  return (
    user?.active ===
      true &&
    user.role ===
      "校舎管理者"
  );
}

/* =========================================================
   Teacher
   ========================================================= */

export function isTeacher(
  user:
    | ServerUser
    | null
    | undefined
) {
  return (
    user?.active ===
      true &&
    user.role ===
      "講師"
  );
}

/* =========================================================
   Student
   ========================================================= */

export function isStudent(
  user:
    | ServerUser
    | null
    | undefined
) {
  return (
    user?.active ===
      true &&
    user.role ===
      "生徒"
  );
}

/* =========================================================
   Role comparison
   ========================================================= */

export function hasRole(
  user:
    | ServerUser
    | null
    | undefined,
  roles: UserRole[]
) {
  if (
    !user ||
    !user.active
  ) {
    return false;
  }

  return roles.includes(
    user.role
  );
}

/* =========================================================
   School scope
   ========================================================= */

export function hasSchoolAccess(
  user:
    | ServerUser
    | null
    | undefined,
  schoolIds: string[]
) {
  if (
    !user ||
    !user.active
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
    schoolIds.length ===
    0
  ) {
    return false;
  }

  return schoolIds.some(
    (
      schoolId
    ) =>
      user.schoolIds.includes(
        schoolId
      )
  );
}

/* =========================================================
   Organization scope
   ========================================================= */

export function assertOrganizationAccess(
  user:
    | ServerUser
    | null
    | undefined,
  organizationId: string
) {
  if (
    !user ||
    !user.active
  ) {
    throw new Error(
      "認証が必要です。"
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
    user.organizationId !==
    organizationId
  ) {
    throw new Error(
      "この組織にアクセスする権限がありません。"
    );
  }

  return true;
}

/* =========================================================
   School scope assertion
   ========================================================= */

export function assertSchoolAccess(
  user:
    | ServerUser
    | null
    | undefined,
  schoolId: string
) {
  if (
    !user ||
    !user.active
  ) {
    throw new Error(
      "認証が必要です。"
    );
  }

  if (
    !canAccessSchool(
      user,
      schoolId
    )
  ) {
    throw new Error(
      "この校舎にアクセスする権限がありません。"
    );
  }

  return true;
}

/* =========================================================
   Student scope assertion
   ========================================================= */

export function assertStudentAccess(
  user:
    | ServerUser
    | null
    | undefined,
  studentId: string,
  studentSchoolId?:
    | string
    | null
) {
  if (
    !user ||
    !user.active
  ) {
    throw new Error(
      "認証が必要です。"
    );
  }

  if (
    !canAccessStudent(
      user,
      studentId,
      studentSchoolId
    )
  ) {
    throw new Error(
      "この生徒にアクセスする権限がありません。"
    );
  }

  return true;
}
