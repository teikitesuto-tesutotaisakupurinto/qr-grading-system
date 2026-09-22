"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  addDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "@/lib/firebase";

/* =========================================================
   Types
   ========================================================= */

type UserRole =
  | "本部管理者"
  | "校舎管理者"
  | "講師"
  | "生徒";

type CurrentUser = {
  uid: string;
  name: string;
  email: string | null;
  organizationId: string | null;
  role: UserRole | null;
  schoolIds: string[];
};

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole | null;
  schoolIds: string[];
  studentId: string | null;
  active: boolean;
};

type Invitation = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  schoolIds: string[];
  studentId: string | null;
  active: boolean;
};

type School = {
  id: string;
  name: string;
};

type Student = {
  id: string;
  studentNumber: string;
  name: string;
  grade: string;
  className: string;
  schoolId: string;
  schoolName: string;
  active: boolean;
};

const roles: UserRole[] = [
  "本部管理者",
  "校舎管理者",
  "講師",
  "生徒",
];

/* =========================================================
   Page
   ========================================================= */

export default function UsersPage() {
  const [
    currentUser,
    setCurrentUser,
  ] = useState<CurrentUser | null>(
    null
  );

  const [
    users,
    setUsers,
  ] = useState<ManagedUser[]>(
    []
  );

  const [
    invitations,
    setInvitations,
  ] = useState<Invitation[]>(
    []
  );

  const [
    schools,
    setSchools,
  ] = useState<School[]>(
    []
  );

  const [
    students,
    setStudents,
  ] = useState<Student[]>(
    []
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    name,
    setName,
  ] = useState("");

  const [
    role,
    setRole,
  ] = useState<UserRole>(
    "講師"
  );

  const [
    selectedSchoolIds,
    setSelectedSchoolIds,
  ] = useState<string[]>(
    []
  );

  const [
    selectedStudentId,
    setSelectedStudentId,
  ] = useState("");

  /* =======================================================
     Current user
     ======================================================= */

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (
          firebaseUser
        ) => {
          if (!firebaseUser) {
            setLoading(false);

            setError(
              "ログイン状態を確認できません。"
            );

            return;
          }

          try {
            const snapshot =
              await getDocs(
                query(
                  collection(
                    db,
                    "users"
                  ),
                  where(
                    "__name__",
                    "==",
                    firebaseUser.uid
                  )
                )
              );

            if (
              snapshot.empty
            ) {
              setLoading(false);

              setError(
                "ユーザー情報が登録されていません。"
              );

              return;
            }

            const data =
              snapshot.docs[0].data();

            const userRole =
              isUserRole(
                data.role
              )
                ? data.role
                : null;

            const schoolIds =
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
                : [];

            setCurrentUser({
              uid:
                firebaseUser.uid,

              name:
                typeof data.name ===
                "string"
                  ? data.name
                  : firebaseUser.displayName ??
                    "",

              email:
                firebaseUser.email,

              organizationId:
                typeof data.organizationId ===
                "string"
                  ? data.organizationId
                  : null,

              role:
                userRole,

              schoolIds,
            });

            setLoading(false);
          } catch (
            err
          ) {
            console.error(
              err
            );

            setError(
              err instanceof Error
                ? err.message
                : "ユーザー情報を取得できません。"
            );

            setLoading(false);
          }
        }
      );

    return () => {
      unsubscribe();
    };
  }, []);

  /* =======================================================
     Organization data
     ======================================================= */

  useEffect(() => {
    if (
      !currentUser?.organizationId
    ) {
      return;
    }

    void loadData(
      currentUser.organizationId
    );
  }, [
    currentUser?.organizationId,
  ]);

  async function loadData(
    organizationId: string
  ) {
    try {
      setLoading(true);
      setError("");

      /* Users */

      const userSnapshot =
        await getDocs(
          query(
            collection(
              db,
              "users"
            ),
            where(
              "organizationId",
              "==",
              organizationId
            )
          )
        );

      const loadedUsers =
        userSnapshot.docs.map(
          (
            item
          ): ManagedUser => {
            const data =
              item.data();

            return {
              id:
                item.id,

              name:
                typeof data.name ===
                "string"
                  ? data.name
                  : "",

              email:
                typeof data.email ===
                "string"
                  ? data.email
                  : "",

              role:
                isUserRole(
                  data.role
                )
                  ? data.role
                  : null,

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

              active:
                data.active !==
                false,
            };
          }
        );

      /* Invitations */

      const invitationSnapshot =
        await getDocs(
          query(
            collection(
              db,
              "userInvitations"
            ),
            where(
              "organizationId",
              "==",
              organizationId
            )
          )
        );

      const loadedInvitations =
        invitationSnapshot.docs.map(
          (
            item
          ): Invitation => {
            const data =
              item.data();

            return {
              id:
                item.id,

              email:
                typeof data.email ===
                "string"
                  ? data.email
                  : "",

              name:
                typeof data.name ===
                "string"
                  ? data.name
                  : "",

              role:
                isUserRole(
                  data.role
                )
                  ? data.role
                  : "講師",

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

              active:
                data.active !==
                false,
            };
          }
        );

      /* Schools */

      const schoolSnapshot =
        await getDocs(
          query(
            collection(
              db,
              "schools"
            ),
            where(
              "organizationId",
              "==",
              organizationId
            )
          )
        );

      const loadedSchools =
        schoolSnapshot.docs.map(
          (
            item
          ): School => ({
            id:
              item.id,

            name:
              typeof item.data()
                .name ===
              "string"
                ? item.data()
                    .name
                : "",
          })
        );

      /* Students */

      const studentSnapshot =
        await getDocs(
          query(
            collection(
              db,
              "students"
            ),
            where(
              "organizationId",
              "==",
              organizationId
            )
          )
        );

      const schoolMap =
        new Map<string, string>(
          loadedSchools.map(
            (
              school
            ) => [
              school.id,
              school.name,
            ]
          )
        );

      const loadedStudents =
        studentSnapshot.docs
          .map(
            (
              item
            ): Student => {
              const data =
                item.data();

              const schoolId =
                typeof data.schoolId ===
                "string"
                  ? data.schoolId
                  : "";

              return {
                id:
                  item.id,

                studentNumber:
                  typeof data.studentNumber ===
                  "string"
                    ? data.studentNumber
                    : "",

                name:
                  typeof data.name ===
                  "string"
                    ? data.name
                    : "",

                grade:
                  typeof data.grade ===
                  "string"
                    ? data.grade
                    : "",

                className:
                  typeof data.className ===
                  "string"
                    ? data.className
                    : "",

                schoolId,

                schoolName:
                  typeof data.schoolName ===
                  "string"
                    ? data.schoolName
                    : schoolMap.get(
                        schoolId
                      ) ??
                      "",

                active:
                  data.active !==
                  false,
              };
            }
          )
          .filter(
            (
              student
            ) =>
              student.active
          );

      setUsers(
        loadedUsers
      );

      setInvitations(
        loadedInvitations
      );

      setSchools(
        loadedSchools
      );

      setStudents(
        loadedStudents
      );
    } catch (
      err
    ) {
      console.error(
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "データを取得できませんでした。"
      );
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     Available students
     ======================================================= */

  const availableStudents =
    useMemo(() => {
      if (
        !currentUser
      ) {
        return [];
      }

      if (
        currentUser.role ===
        "本部管理者"
      ) {
        return students;
      }

      if (
        currentUser.role ===
        "校舎管理者"
      ) {
        return students.filter(
          (
            student
          ) =>
            currentUser.schoolIds.includes(
              student.schoolId
            )
        );
      }

      return [];
    }, [
      students,
      currentUser,
    ]);

  /* =======================================================
     Selected student
     ======================================================= */

  const selectedStudent =
    availableStudents.find(
      (
        student
      ) =>
        student.id ===
        selectedStudentId
    ) ??
    null;

  /* =======================================================
     Role change
     ======================================================= */

  function handleRoleChange(
    nextRole: UserRole
  ) {
    setRole(
      nextRole
    );

    if (
      nextRole !==
      "生徒"
    ) {
      setSelectedStudentId(
        ""
      );
    }

    if (
      nextRole ===
      "生徒"
    ) {
      setSelectedSchoolIds(
        []
      );
    }
  }

  /* =======================================================
     Student change
     ======================================================= */

  function handleStudentChange(
    studentId: string
  ) {
    setSelectedStudentId(
      studentId
    );

    const student =
      availableStudents.find(
        (
          item
        ) =>
          item.id ===
          studentId
      );

    if (
      !student
    ) {
      return;
    }

    if (
      student.schoolId
    ) {
      setSelectedSchoolIds([
        student.schoolId,
      ]);
    }

    if (
      student.name
    ) {
      setName(
        student.name
      );
    }
  }

  /* =======================================================
     Create invitation
     ======================================================= */

  async function createInvitation() {
    if (
      saving
    ) {
      return;
    }

    if (
      currentUser?.role !==
        "本部管理者" &&
      currentUser?.role !==
        "校舎管理者"
    ) {
      setError(
        "ユーザーを登録する権限がありません。"
      );

      return;
    }

    if (
      !currentUser?.organizationId
    ) {
      setError(
        "組織情報がありません。"
      );

      return;
    }

    const normalizedEmail =
      email
        .trim()
        .toLowerCase();

    const trimmedName =
      name.trim();

    if (
      !normalizedEmail
    ) {
      setError(
        "Googleアカウントのメールアドレスを入力してください。"
      );

      return;
    }

    if (
      !normalizedEmail.includes(
        "@"
      )
    ) {
      setError(
        "正しいメールアドレスを入力してください。"
      );

      return;
    }

    if (
      !trimmedName
    ) {
      setError(
        "氏名を入力してください。"
      );

      return;
    }

    if (
      currentUser.role ===
        "校舎管理者" &&
      role ===
        "本部管理者"
    ) {
      setError(
        "校舎管理者は本部管理者を登録できません。"
      );

      return;
    }

    if (
      role ===
      "生徒"
    ) {
      if (
        !selectedStudentId
      ) {
        setError(
          "生徒アカウントには既存の生徒情報を選択してください。"
        );

        return;
      }

      if (
        !selectedStudent
      ) {
        setError(
          "選択した生徒情報が見つかりません。"
        );

        return;
      }

      if (
        !selectedStudent.schoolId
      ) {
        setError(
          "選択した生徒に校舎が設定されていません。"
        );

        return;
      }

      if (
        currentUser.role ===
          "校舎管理者" &&
        !currentUser.schoolIds.includes(
          selectedStudent.schoolId
        )
      ) {
        setError(
          "所属していない校舎の生徒は登録できません。"
        );

        return;
      }
    }

    if (
      role !==
        "生徒" &&
      selectedSchoolIds.length ===
        0
    ) {
      setError(
        "所属校舎を1つ以上選択してください。"
      );

      return;
    }

    if (
      currentUser.role ===
        "校舎管理者"
    ) {
      const invalidSchool =
        selectedSchoolIds.some(
          (
            schoolId
          ) =>
            !currentUser.schoolIds.includes(
              schoolId
            )
        );

      if (
        invalidSchool
      ) {
        setError(
          "所属していない校舎を指定することはできません。"
        );

        return;
      }
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const organizationId =
        currentUser.organizationId;

      const existingUsers =
        await getDocs(
          query(
            collection(
              db,
              "users"
            ),
            where(
              "organizationId",
              "==",
              organizationId
            ),
            where(
              "email",
              "==",
              normalizedEmail
            )
          )
        );

      if (
        !existingUsers.empty
      ) {
        throw new Error(
          "このメールアドレスはすでにユーザー登録されています。"
        );
      }

      if (
        role ===
        "生徒"
      ) {
        const existingStudentUsers =
          await getDocs(
            query(
              collection(
                db,
                "users"
              ),
              where(
                "organizationId",
                "==",
                organizationId
              ),
              where(
                "studentId",
                "==",
                selectedStudentId
              )
            )
          );

        if (
          !existingStudentUsers.empty
        ) {
          throw new Error(
            "この生徒にはすでにアカウントが紐付いています。"
          );
        }
      }

      const existingInvitations =
        await getDocs(
          query(
            collection(
              db,
              "userInvitations"
            ),
            where(
              "organizationId",
              "==",
              organizationId
            ),
            where(
              "email",
              "==",
              normalizedEmail
            ),
            where(
              "active",
              "==",
              true
            )
          )
        );

      if (
        !existingInvitations.empty
      ) {
        throw new Error(
          "このメールアドレスにはすでに有効な登録待ちがあります。"
        );
      }

      if (
        role ===
        "生徒"
      ) {
        const existingStudentInvitations =
          await getDocs(
            query(
              collection(
                db,
                "userInvitations"
              ),
              where(
                "organizationId",
                "==",
                organizationId
              ),
              where(
                "studentId",
                "==",
                selectedStudentId
              ),
              where(
                "active",
                "==",
                true
              )
            )
          );

        if (
          !existingStudentInvitations.empty
        ) {
          throw new Error(
            "この生徒にはすでに登録待ちのアカウントがあります。"
          );
        }
      }

      await addDoc(
        collection(
          db,
          "userInvitations"
        ),
        {
          organizationId,

          email:
            normalizedEmail,

          name:
            trimmedName,

          role,

          schoolIds:
            role ===
            "生徒"
              ? [
                  selectedStudent!.schoolId,
                ]
              : selectedSchoolIds,

          studentId:
            role ===
            "生徒"
              ? selectedStudentId
              : null,

          active:
            true,

          createdBy:
            currentUser.uid,

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        }
      );

      setEmail("");
      setName("");
      setRole(
        "講師"
      );
      setSelectedSchoolIds(
        []
      );
      setSelectedStudentId(
        ""
      );

      setMessage(
        role ===
        "生徒"
          ? "生徒アカウントの登録待ちを作成しました。指定したGoogleアカウントでログインすると、既存の生徒情報と紐付いた状態で利用できます。"
          : "ユーザー登録を受け付けました。"
      );

      await loadData(
        organizationId
      );
    } catch (
      err
    ) {
      console.error(
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "ユーザー登録に失敗しました。"
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  /* =======================================================
     Deactivate user
     ======================================================= */

  async function deactivateUser(
    userId: string
  ) {
    if (
      !currentUser
    ) {
      return;
    }

    if (
      userId ===
      currentUser.uid
    ) {
      setError(
        "自分自身のアカウントは停止できません。"
      );

      return;
    }

    try {
      setError("");
      setMessage("");

      await updateDoc(
        doc(
          db,
          "users",
          userId
        ),
        {
          active:
            false,

          updatedAt:
            serverTimestamp(),
        }
      );

      setMessage(
        "ユーザーを停止しました。"
      );

      if (
        currentUser.organizationId
      ) {
        await loadData(
          currentUser.organizationId
        );
      }
    } catch (
      err
    ) {
      console.error(
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "ユーザーを停止できませんでした。"
      );
    }
  }

  /* =======================================================
     Deactivate invitation
     ======================================================= */

  async function deactivateInvitation(
    invitationId: string
  ) {
    try {
      setError("");
      setMessage("");

      await updateDoc(
        doc(
          db,
          "userInvitations",
          invitationId
        ),
        {
          active:
            false,

          updatedAt:
            serverTimestamp(),
        }
      );

      setMessage(
        "登録待ちを停止しました。"
      );

      if (
        currentUser?.organizationId
      ) {
        await loadData(
          currentUser.organizationId
        );
      }
    } catch (
      err
    ) {
      console.error(
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "登録待ちを停止できませんでした。"
      );
    }
  }

  /* =======================================================
     Search
     ======================================================= */

  const filteredUsers =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      if (
        !keyword
      ) {
        return users;
      }

      return users.filter(
        (
          item
        ) =>
          item.name
            .toLowerCase()
            .includes(
              keyword
            ) ||
          item.email
            .toLowerCase()
            .includes(
              keyword
            )
      );
    }, [
      users,
      search,
    ]);

  /* =======================================================
     Loading
     ======================================================= */

  if (
    loading
  ) {
    return (
      <main
        style={
          pageStyle
        }
      >
        <section
          style={
            cardStyle
          }
        >
          <strong>
            ユーザー情報を読み込んでいます...
          </strong>
        </section>
      </main>
    );
  }

  /* =======================================================
     Permission
     ======================================================= */

  if (
    currentUser &&
    currentUser.role !==
      "本部管理者" &&
    currentUser.role !==
      "校舎管理者"
  ) {
    return (
      <main
        style={
          pageStyle
        }
      >
        <section
          style={
            cardStyle
          }
        >
          <h1>
            ユーザー管理
          </h1>

          <p>
            この機能を利用する権限がありません。
          </p>
        </section>
      </main>
    );
  }

  /* =======================================================
     Render
     ======================================================= */

  return (
    <main
      style={
        pageStyle
      }
    >
      <div
        style={{
          maxWidth:
            1300,

          margin:
            "0 auto",
        }}
      >
        <header
          style={{
            marginBottom:
              28,
          }}
        >
          <h1
            style={{
              margin:
                "0 0 8px",
            }}
          >
            ユーザー管理
          </h1>

          <p
            style={{
              margin: 0,
              color:
                "#666",
              lineHeight:
                1.7,
            }}
          >
            Googleアカウント、権限、所属校舎、生徒情報を管理します。
          </p>
        </header>

        {error && (
          <Message
            type="error"
            message={
              error
            }
          />
        )}

        {message && (
          <Message
            type="success"
            message={
              message
            }
          />
        )}

        {/* ==================================================
            User registration
            ================================================== */}

        <section
          style={{
            ...cardStyle,
            marginBottom:
              24,
          }}
        >
          <h2>
            ユーザーを登録
          </h2>

          <p
            style={{
              color:
                "#666",
              fontSize:
                13,
              lineHeight:
                1.7,
            }}
          >
            Googleアカウントのメールアドレスを指定して登録します。
            生徒の場合は、登録済みの生徒情報を選択して紐付けます。
          </p>

          <div
            style={{
              display:
                "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",
              gap:
                16,
              marginTop:
                20,
            }}
          >
            <label>
              Googleメールアドレス

              <input
                value={
                  email
                }
                onChange={(
                  event
                ) =>
                  setEmail(
                    event.target
                      .value
                  )
                }
                placeholder="example@gmail.com"
                style={
                  inputStyle
                }
              />
            </label>

            <label>
              氏名

              <input
                value={
                  name
                }
                onChange={(
                  event
                ) =>
                  setName(
                    event.target
                      .value
                  )
                }
                placeholder="山田太郎"
                style={
                  inputStyle
                }
              />
            </label>

            <label>
              権限

              <select
                value={
                  role
                }
                onChange={(
                  event
                ) =>
                  handleRoleChange(
                    event.target
                      .value as UserRole
                  )
                }
                style={
                  inputStyle
                }
              >
                {roles
                  .filter(
                    (
                      item
                    ) =>
                      currentUser?.role ===
                        "本部管理者" ||
                      item !==
                        "本部管理者"
                  )
                  .map(
                    (
                      item
                    ) => (
                      <option
                        key={
                          item
                        }
                        value={
                          item
                        }
                      >
                        {
                          item
                        }
                      </option>
                    )
                  )}
              </select>
            </label>
          </div>

          {/* Student linking */}

          {role ===
            "生徒" && (
            <div
              style={{
                marginTop:
                  22,

                padding:
                  16,

                border:
                  "1px solid #ddd",

                borderRadius:
                  10,

                background:
                  "#fafafa",
              }}
            >
              <strong>
                生徒情報との紐付け
              </strong>

              <p
                style={{
                  margin:
                    "5px 0 12px",

                  color:
                    "#777",

                  fontSize:
                    12,

                  lineHeight:
                    1.6,
                }}
              >
                既に生徒管理へ登録されている生徒を選択してください。
              </p>

              <select
                value={
                  selectedStudentId
                }
                onChange={(
                  event
                ) =>
                  handleStudentChange(
                    event.target
                      .value
                  )
                }
                style={
                  inputStyle
                }
              >
                <option value="">
                  生徒を選択してください
                </option>

                {availableStudents.map(
                  (
                    student
                  ) => (
                    <option
                      key={
                        student.id
                      }
                      value={
                        student.id
                      }
                    >
                      {
                        student.studentNumber
                      }
                      {"　"}
                      {
                        student.name
                      }
                      {"　"}
                      {
                        student.grade
                      }
                      {"　"}
                      {
                        student.className
                      }
                      {student.schoolName &&
                        `　${student.schoolName}`}
                    </option>
                  )
                )}
              </select>

              {selectedStudent && (
                <div
                  style={{
                    marginTop:
                      12,

                    padding:
                      12,

                    background:
                      "#fff",

                    border:
                      "1px solid #e5e5e5",

                    borderRadius:
                      7,

                    fontSize:
                      12,

                    lineHeight:
                      1.8,
                  }}
                >
                  <strong>
                    {
                      selectedStudent.name
                    }
                  </strong>

                  <div>
                    生徒番号：
                    {
                      selectedStudent.studentNumber
                    }
                  </div>

                  <div>
                    学年：
                    {
                      selectedStudent.grade
                    }
                  </div>

                  <div>
                    クラス：
                    {
                      selectedStudent.className ||
                      "—"
                    }
                  </div>

                  <div>
                    校舎：
                    {
                      selectedStudent.schoolName ||
                      "—"
                    }
                  </div>

                  <div
                    style={{
                      marginTop:
                        6,

                      color:
                        "#25633a",

                      fontWeight:
                        600,
                    }}
                  >
                    この生徒のIDがGoogleアカウントに紐付けられます。
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Schools */}

          {role !==
            "生徒" && (
            <div
              style={{
                marginTop:
                  22,
              }}
            >
              <strong>
                所属校舎
              </strong>

              <div
                style={{
                  display:
                    "flex",

                  flexWrap:
                    "wrap",

                  gap:
                    12,

                  marginTop:
                    12,
                }}
              >
                {schools
                  .filter(
                    (
                      school
                    ) =>
                      currentUser
                        ? currentUser.role ===
                            "本部管理者" ||
                          currentUser.schoolIds.includes(
                            school.id
                          )
                        : false
                  )
                  .map(
                    (
                      school
                    ) => {
                      const checked =
                        selectedSchoolIds.includes(
                          school.id
                        );

                      return (
                        <label
                          key={
                            school.id
                          }
                          style={{
                            display:
                              "flex",

                            alignItems:
                              "center",

                            gap:
                              7,

                            cursor:
                              "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={
                              checked
                            }
                            onChange={() => {
                              setSelectedSchoolIds(
                                (
                                  current: string[]
                                ) =>
                                  checked
                                    ? current.filter(
                                        (
                                          id
                                        ) =>
                                          id !==
                                          school.id
                                      )
                                    : [
                                        ...current,
                                        school.id,
                                      ]
                              );
                            }}
                          />

                          {
                            school.name
                          }
                        </label>
                      );
                    }
                  )}
              </div>
            </div>
          )}

          {/* Student school */}

          {role ===
            "生徒" &&
            selectedStudent && (
              <div
                style={{
                  marginTop:
                    14,

                  padding:
                    10,

                  background:
                    "#f5f8ff",

                  borderRadius:
                    7,

                  fontSize:
                    12,
                }}
              >
                所属校舎：
                <strong>
                  {
                    selectedStudent.schoolName ||
                    "未設定"
                  }
                </strong>

                <div
                  style={{
                    marginTop:
                      3,

                    color:
                      "#777",
                  }}
                >
                  生徒マスターの所属校舎を自動的に使用します。
                </div>
              </div>
            )}

          <button
            type="button"
            disabled={
              saving
            }
            onClick={
              createInvitation
            }
            style={
              primaryButton
            }
          >
            {saving
              ? "登録中..."
              : "ユーザーを登録"}
          </button>
        </section>

        {/* ==================================================
            Users
            ================================================== */}

        <section
          style={{
            ...cardStyle,
            marginBottom:
              24,
          }}
        >
          <div
            style={{
              display:
                "flex",

              justifyContent:
                "space-between",

              alignItems:
                "center",

              gap:
                16,
            }}
          >
            <div>
              <h2
                style={{
                  margin:
                    0,
                }}
              >
                登録済みユーザー
              </h2>

              <p
                style={{
                  margin:
                    "6px 0 0",

                  color:
                    "#777",

                  fontSize:
                    13,
                }}
              >
                {
                  users.length
                }
                人
              </p>
            </div>

            <input
              value={
                search
              }
              onChange={(
                event
              ) =>
                setSearch(
                  event.target
                    .value
                )
              }
              placeholder="氏名・メールを検索"
              style={{
                ...inputStyle,

                maxWidth:
                  280,

                marginTop:
                  0,
              }}
            />
          </div>

          <UserTable
            users={
              filteredUsers
            }
            students={
              students
            }
            currentUid={
              currentUser?.uid ??
              ""
            }
            onDeactivate={
              deactivateUser
            }
          />
        </section>

        {/* ==================================================
            Invitations
            ================================================== */}

        <section
          style={
            cardStyle
          }
        >
          <h2>
            登録待ちユーザー
          </h2>

          {invitations.length ===
          0 ? (
            <p
              style={{
                color:
                  "#777",
              }}
            >
              登録待ちはありません。
            </p>
          ) : (
            <div
              style={{
                overflowX:
                  "auto",
              }}
            >
              <table
                style={
                  tableStyle
                }
              >
                <thead>
                  <tr>
                    <th
                      style={
                        thStyle
                      }
                    >
                      氏名
                    </th>

                    <th
                      style={
                        thStyle
                      }
                    >
                      Googleメール
                    </th>

                    <th
                      style={
                        thStyle
                      }
                    >
                      権限
                    </th>

                    <th
                      style={
                        thStyle
                      }
                    >
                      生徒情報
                    </th>

                    <th
                      style={
                        thStyle
                      }
                    >
                      状態
                    </th>

                    <th
                      style={
                        thStyle
                      }
                    >
                      操作
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {invitations.map(
                    (
                      invitation
                    ) => {
                      const student =
                        invitation.studentId
                          ? students.find(
                              (
                                item
                              ) =>
                                item.id ===
                                invitation.studentId
                            )
                          : null;

                      return (
                        <tr
                          key={
                            invitation.id
                          }
                        >
                          <td
                            style={
                              tdStyle
                            }
                          >
                            {
                              invitation.name
                            }
                          </td>

                          <td
                            style={
                              tdStyle
                            }
                          >
                            {
                              invitation.email
                            }
                          </td>

                          <td
                            style={
                              tdStyle
                            }
                          >
                            {
                              invitation.role
                            }
                          </td>

                          <td
                            style={
                              tdStyle
                            }
                          >
                            {student
                              ? `${student.studentNumber} ${student.name}`
                              : invitation.studentId
                                ? "生徒情報あり"
                                : "—"}
                          </td>

                          <td
                            style={
                              tdStyle
                            }
                          >
                            {invitation.active
                              ? "登録待ち"
                              : "停止"}
                          </td>

                          <td
                            style={
                              tdStyle
                            }
                          >
                            {invitation.active && (
                              <button
                                type="button"
                                onClick={() =>
                                  deactivateInvitation(
                                    invitation.id
                                  )
                                }
                                style={
                                  dangerButton
                                }
                              >
                                停止
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

/* =========================================================
   User table
   ========================================================= */

function UserTable({
  users,
  students,
  currentUid,
  onDeactivate,
}: {
  users: ManagedUser[];

  students: Student[];

  currentUid: string;

  onDeactivate: (
    userId: string
  ) => void;
}) {
  if (
    users.length ===
    0
  ) {
    return (
      <p
        style={{
          marginTop:
            24,

          color:
            "#777",
        }}
      >
        ユーザーがありません。
      </p>
    );
  }

  return (
    <div
      style={{
        overflowX:
          "auto",

        marginTop:
          20,
      }}
    >
      <table
        style={
          tableStyle
        }
      >
        <thead>
          <tr>
            <th
              style={
                thStyle
              }
            >
              氏名
            </th>

            <th
              style={
                thStyle
              }
            >
              メール
            </th>

            <th
              style={
                thStyle
              }
            >
              権限
            </th>

            <th
              style={
                thStyle
              }
            >
              生徒情報
            </th>

            <th
              style={
                thStyle
              }
            >
              状態
            </th>

            <th
              style={
                thStyle
              }
            >
              操作
            </th>
          </tr>
        </thead>

        <tbody>
          {users.map(
            (
              user
            ) => {
              const student =
                user.studentId
                  ? students.find(
                      (
                        item
                      ) =>
                        item.id ===
                        user.studentId
                    )
                  : null;

              return (
                <tr
                  key={
                    user.id
                  }
                >
                  <td
                    style={
                      tdStyle
                    }
                  >
                    {
                      user.name
                    }
                  </td>

                  <td
                    style={
                      tdStyle
                    }
                  >
                    {
                      user.email
                    }
                  </td>

                  <td
                    style={
                      tdStyle
                    }
                  >
                    {
                      user.role ??
                      "未設定"
                    }
                  </td>

                  <td
                    style={
                      tdStyle
                    }
                  >
                    {student
                      ? `${student.studentNumber} ${student.name}`
                      : user.studentId
                        ? "紐付け済み"
                        : "—"}
                  </td>

                  <td
                    style={
                      tdStyle
                    }
                  >
                    {user.active
                      ? "有効"
                      : "停止"}
                  </td>

                  <td
                    style={
                      tdStyle
                    }
                  >
                    {user.active &&
                      user.id !==
                        currentUid && (
                        <button
                          type="button"
                          onClick={() =>
                            onDeactivate(
                              user.id
                            )
                          }
                          style={
                            dangerButton
                          }
                        >
                          停止
                        </button>
                      )}
                  </td>
                </tr>
              );
            }
          )}
        </tbody>
      </table>
    </div>
  );
}

/* =========================================================
   Message
   ========================================================= */

function Message({
  type,
  message,
}: {
  type:
    | "error"
    | "success";

  message: string;
}) {
  return (
    <div
      style={{
        marginBottom:
          16,

        padding:
          14,

        border:
          "1px solid",

        borderColor:
          type ===
          "error"
            ? "#efb5b5"
            : "#b8d9c0",

        borderRadius:
          8,

        background:
          type ===
          "error"
            ? "#fff4f4"
            : "#f2faf4",

        color:
          type ===
          "error"
            ? "#9b1c1c"
            : "#25633a",

        lineHeight:
          1.6,
      }}
    >
      {
        message
      }
    </div>
  );
}

/* =========================================================
   Helpers
   ========================================================= */

function isUserRole(
  value: unknown
): value is UserRole {
  return (
    value ===
      "本部管理者" ||
    value ===
      "校舎管理者" ||
    value ===
      "講師" ||
    value ===
      "生徒"
  );
}

/* =========================================================
   Styles
   ========================================================= */

const pageStyle:
  React.CSSProperties = {
    minHeight:
      "100vh",

    padding:
      32,

    background:
      "#f5f6f8",
  };

const cardStyle:
  React.CSSProperties = {
    padding:
      24,

    background:
      "#fff",

    border:
      "1px solid #e1e4e8",

    borderRadius:
      12,
  };

const inputStyle:
  React.CSSProperties = {
    display:
      "block",

    width:
      "100%",

    marginTop:
      7,

    padding:
      "11px 12px",

    border:
      "1px solid #ccc",

    borderRadius:
      7,

    background:
      "#fff",
  };

const primaryButton:
  React.CSSProperties = {
    marginTop:
      24,

    padding:
      "11px 22px",

    border:
      "none",

    borderRadius:
      7,

    background:
      "#111",

    color:
      "#fff",

    fontWeight:
      600,

    cursor:
      "pointer",
  };

const dangerButton:
  React.CSSProperties = {
    padding:
      "7px 12px",

    border:
      "1px solid #d99",

    borderRadius:
      6,

    background:
      "#fff",

    color:
      "#a00000",

    cursor:
      "pointer",
  };

const tableStyle:
  React.CSSProperties = {
    width:
      "100%",

    borderCollapse:
      "collapse",
  };

const thStyle:
  React.CSSProperties = {
    padding:
      "11px 12px",

    textAlign:
      "left",

    borderBottom:
      "2px solid #ddd",

    whiteSpace:
      "nowrap",
  };

const tdStyle:
  React.CSSProperties = {
    padding:
      "12px",

    borderBottom:
      "1px solid #eee",

    fontSize:
      14,
  };
