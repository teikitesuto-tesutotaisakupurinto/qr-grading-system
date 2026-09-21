import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "./firebase";

import type {
  UserProfile,
  UserRole,
} from "../types";

/* =========================================================
   Role normalization
   ========================================================= */

export function normalizeUserRole(
  value: unknown
): UserRole | null {
  switch (value) {
    case "本部管理者":
    case "hq":
    case "head_office":
    case "headOfficeAdmin":
    case "本部":
      return "本部管理者";

    case "校舎管理者":
    case "school_admin":
    case "schoolAdmin":
    case "校舎":
      return "校舎管理者";

    case "講師":
    case "teacher":
      return "講師";

    case "生徒":
    case "student":
      return "生徒";

    default:
      return null;
  }
}

/* =========================================================
   Role check
   ========================================================= */

export function isUserRole(
  value: unknown
): value is UserRole {
  return (
    normalizeUserRole(
      value
    ) !== null
  );
}

/* =========================================================
   Current app user
   ========================================================= */

export async function getCurrentUserProfile(
  user: User | null
): Promise<UserProfile | null> {
  if (!user) {
    return null;
  }

  try {
    const snapshot =
      await getDoc(
        doc(
          db,
          "users",
          user.uid
        )
      );

    if (
      !snapshot.exists()
    ) {
      return null;
    }

    const data =
      snapshot.data();

    return {
      uid:
        user.uid,

      organizationId:
        typeof data.organizationId ===
        "string"
          ? data.organizationId
          : null,

      role:
        normalizeUserRole(
          data.role
        ),

      schoolIds:
        Array.isArray(
          data.schoolIds
        )
          ? data.schoolIds.filter(
              (
                value
              ): value is string =>
                typeof value ===
                "string"
            )
          : [],

      studentId:
        typeof data.studentId ===
        "string"
          ? data.studentId
          : null,

      name:
        typeof data.name ===
        "string"
          ? data.name
          : "",

      email:
        user.email,

      active:
        data.active !==
        false,
    };
  } catch (
    error
  ) {
    console.error(
      "Tsystem user profile error:",
      error
    );

    return null;
  }
}

/* =========================================================
   Alias
   =========================================================
   既存ページとの互換用
   ========================================================= */

export async function getAppUser() {
  return getCurrentUserProfile(
    auth.currentUser
  );
}

/* =========================================================
   Email / Password login
   ========================================================= */

export async function login(
  email: string,
  password: string
) {
  const normalizedEmail =
    email
      .trim()
      .toLowerCase();

  const credential =
    await signInWithEmailAndPassword(
      auth,
      normalizedEmail,
      password
    );

  const profile =
    await getCurrentUserProfile(
      credential.user
    );

  if (
    !profile ||
    !profile.active ||
    !profile.role ||
    !profile.organizationId
  ) {
    await signOut(
      auth
    );

    throw new Error(
      "このアカウントはTsystemで利用できません。"
    );
  }

  return profile;
}

/* =========================================================
   Google login
   ========================================================= */

export async function loginWithGoogle() {
  const provider =
    new GoogleAuthProvider();

  provider.setCustomParameters({
    prompt:
      "select_account",
  });

  const credential =
    await signInWithPopup(
      auth,
      provider
    );

  const profile =
    await getCurrentUserProfile(
      credential.user
    );

  if (
    !profile ||
    !profile.active ||
    !profile.role ||
    !profile.organizationId
  ) {
    await signOut(
      auth
    );

    throw new Error(
      "このGoogleアカウントはTsystemに登録されていません。"
    );
  }

  return profile;
}

/* =========================================================
   Logout
   ========================================================= */

export function logout() {
  return signOut(
    auth
  );
}

/* =========================================================
   Auth subscription
   ========================================================= */

export function subscribeAuth(
  callback: (
    user: User | null,
    profile: UserProfile | null
  ) => void
) {
  return onAuthStateChanged(
    auth,
    async (
      user
    ) => {
      const profile =
        await getCurrentUserProfile(
          user
        );

      callback(
        user,
        profile
      );
    }
  );
}

/* =========================================================
   Current Firebase user
   ========================================================= */

export function getFirebaseCurrentUser() {
  return auth.currentUser;
}

/* =========================================================
   Role helpers
   ========================================================= */

export function isHeadOfficeAdmin(
  user: UserProfile | null
) {
  return (
    user?.role ===
    "本部管理者"
  );
}

export function isSchoolAdmin(
  user: UserProfile | null
) {
  return (
    user?.role ===
    "校舎管理者"
  );
}

export function isTeacher(
  user: UserProfile | null
) {
  return (
    user?.role ===
    "講師"
  );
}

export function isStudent(
  user: UserProfile | null
) {
  return (
    user?.role ===
    "生徒"
  );
}

/* =========================================================
   School access
   ========================================================= */

export function canAccessSchool(
  user: UserProfile | null,
  schoolId: string
) {
  if (
    !user ||
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
   Student access
   ========================================================= */

export function canAccessStudent(
  user: UserProfile | null,
  studentId: string,
  schoolId?: string
) {
  if (
    !user ||
    !studentId
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
