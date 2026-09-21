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
} from "./types";

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

/* =========================================================
   Profile
   ========================================================= */

export async function getCurrentUserProfile(
  firebaseUser:
    | User
    | null
) {
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
      stringOrNull(
        data.organizationId
      ),

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
      stringOrNull(
        data.studentId
      ),

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
  } satisfies UserProfile;
}

/* =========================================================
   Compatibility
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
   Email login
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

  const user =
    await getAppUser(
      credential.user
    );

  if (
    !user ||
    !user.active ||
    !user.role ||
    !user.organizationId
  ) {
    await signOut(
      auth
    );

    throw new Error(
      "このアカウントはTsystemで利用できません。"
    );
  }

  return user;
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

  const user =
    await getAppUser(
      credential.user
    );

  if (
    !user ||
    !user.active ||
    !user.role ||
    !user.organizationId
  ) {
    await signOut(
      auth
    );

    throw new Error(
      "このGoogleアカウントはTsystemに登録されていません。"
    );
  }

  return user;
}

/* =========================================================
   Auth observer
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
   Logout
   ========================================================= */

export async function logout() {
  await signOut(
    auth
  );
}

/* =========================================================
   Role
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

/* =========================================================
   Scope
   ========================================================= */

export function canAccessSchool(
  user:
    | UserProfile
    | null,
  schoolId: string
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

/* =========================================================
   Helpers
   ========================================================= */

function stringOrNull(
  value: unknown
) {
  return typeof value ===
    "string"
    ? value
    : null;
}
