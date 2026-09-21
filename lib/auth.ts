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

export type AppUser =
  UserProfile;

/* =========================================================
   Role
   ========================================================= */

export function normalizeUserRole(
  value: unknown
): UserRole | null {
  switch (
    value
  ) {
    case "本部管理者":
    case "hq":
    case "head_office":
    case "headOfficeAdmin":
      return "本部管理者";

    case "校舎管理者":
    case "school_admin":
    case "schoolAdmin":
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
   User
   ========================================================= */

export async function getCurrentUserProfile(
  firebaseUser:
    | User
    | null
): Promise<UserProfile | null> {
  if (
    !firebaseUser
  ) {
    return null;
  }

  const snapshot =
    await getDoc(
      doc(
        db,
        "users",
        firebaseUser.uid
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
      firebaseUser.uid,

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
      typeof data.email ===
      "string"
        ? data.email
        : firebaseUser.email,

    active:
      data.active !==
      false,
  };
}

/* =========================================================
   getAppUser
   ========================================================= */

export async function getAppUser(
  firebaseUser?:
    | User
    | null
) {
  return getCurrentUserProfile(
    firebaseUser ??
      auth.currentUser
  );
}

/* =========================================================
   Login
   ========================================================= */

export async function login(
  email: string,
  password: string
) {
  const credential =
    await signInWithEmailAndPassword(
      auth,
      email
        .trim()
        .toLowerCase(),
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
   Google
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
   observeAuth
   ========================================================= */

export function observeAuth(
  onUser: (
    user:
      | AppUser
      | null
  ) => void,

  onError?: (
    error: unknown
  ) => void
) {
  let disposed =
    false;

  const unsubscribe =
    onAuthStateChanged(
      auth,
      async (
        firebaseUser
      ) => {
        if (
          disposed
        ) {
          return;
        }

        try {
          const user =
            await getAppUser(
              firebaseUser
            );

          if (
            disposed
          ) {
            return;
          }

          onUser(
            user
          );
        } catch (
          error
        ) {
          if (
            disposed
          ) {
            return;
          }

          if (
            onError
          ) {
            onError(
              error
            );
          } else {
            onUser(
              null
            );
          }
        }
      }
    );

  return () => {
    disposed =
      true;

    unsubscribe();
  };
}

/* =========================================================
   subscribeAuth
   ========================================================= */

export function subscribeAuth(
  callback: (
    firebaseUser:
      | User
      | null,
    appUser:
      | UserProfile
      | null
  ) => void,

  onError?: (
    error: unknown
  ) => void
) {
  return onAuthStateChanged(
    auth,
    async (
      firebaseUser
    ) => {
      try {
        const appUser =
          await getAppUser(
            firebaseUser
          );

        callback(
          firebaseUser,
          appUser
        );
      } catch (
        error
      ) {
        onError?.(
          error
        );
      }
    }
  );
}

/* =========================================================
   Role helpers
   ========================================================= */

export function isHeadOfficeAdmin(
  user:
    | UserProfile
    | null
) {
  return (
    user?.role ===
    "本部管理者"
  );
}

export function isSchoolAdmin(
  user:
    | UserProfile
    | null
) {
  return (
    user?.role ===
    "校舎管理者"
  );
}

export function isTeacher(
  user:
    | UserProfile
    | null
) {
  return (
    user?.role ===
    "講師"
  );
}

export function isStudent(
  user:
    | UserProfile
    | null
) {
  return (
    user?.role ===
    "生徒"
  );
}

export function isStaff(
  user:
    | UserProfile
    | null
) {
  return (
    user?.role ===
      "本部管理者" ||
    user?.role ===
      "校舎管理者" ||
    user?.role ===
      "講師"
  );
}

/* =========================================================
   Access
   ========================================================= */

export function canAccessSchool(
  user:
    | UserProfile
    | null,
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

export function canAccessStudent(
  user:
    | UserProfile
    | null,
  studentId: string,
  schoolId?: string
) {
  if (
    !user
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
