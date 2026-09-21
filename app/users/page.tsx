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
};

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole | null;
  schoolIds: string[];
  active: boolean;
};

type Invitation = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  schoolIds: string[];
  active: boolean;
};

type School = {
  id: string;
  name: string;
};

const roles: UserRole[] = [
  "本部管理者",
  "校舎管理者",
  "講師",
  "生徒",
];

export default function UsersPage() {
  const [
    currentUser,
    setCurrentUser,
  ] = useState<CurrentUser | null>(null);

  const [
    users,
    setUsers,
  ] = useState<ManagedUser[]>([]);

  const [
    invitations,
    setInvitations,
  ] = useState<Invitation[]>([]);

  const [
    schools,
    setSchools,
  ] = useState<School[]>([]);

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
  ] = useState<UserRole>("講師");

  const [
    selectedSchoolIds,
    setSelectedSchoolIds,
  ] = useState<string[]>([]);

  /*
   * ========================================================
   * 現在のユーザー
   * ========================================================
   */

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (firebaseUser) => {
          if (!firebaseUser) {
            setLoading(false);

            setError(
              "ログイン状態を確認できません。"
            );

            return;
          }

          try {
            const userRef = doc(
              db,
              "users",
              firebaseUser.uid
            );

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
            });
          } catch (err) {
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

  /*
   * ========================================================
   * 組織データ読み込み
   * ========================================================
   */

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

      /*
       * ユーザー
       */

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

              active:
                data.active !==
                false,
            };
          }
        );

      /*
       * 招待
       */

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

              active:
                data.active !==
                false,
            };
          }
        );

      /*
       * 校舎
       */

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

      setUsers(
        loadedUsers
      );

      setInvitations(
        loadedInvitations
      );

      setSchools(
        loadedSchools
      );
    } catch (err) {
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

  /*
   * ========================================================
   * 招待登録
   * ========================================================
   */

  async function createInvitation() {
    if (saving) {
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
      !currentUser.organizationId
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

    if (!normalizedEmail) {
      setError(
        "Googleアカウントのメールアドレスを入力してください。"
      );

      return;
    }

    if (
      !normalizedEmail.includes("@")
    ) {
      setError(
        "正しいメールアドレスを入力してください。"
      );

      return;
    }

    if (!trimmedName) {
      setError(
        "氏名を入力してください。"
      );

      return;
    }

    /*
     * 校舎管理者は
     * 本部管理者権限を付与できない。
     */

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

    /*
     * 校舎管理者は
     * 自分の所属校舎だけ。
     */

    if (
      currentUser.role ===
        "校舎管理者"
    ) {
      const allowed =
        selectedSchoolIds.every(
          (
            schoolId
          ) =>
            currentUser.organizationId &&
            currentUser.organizationId ===
              organizationIdOfSchool(
                schoolId,
                schools
              )
        );

      /*
       * 組織IDは現在のユーザーと
       * 同じなので、最終的な
       * 校舎アクセス制御はRulesで行う。
       *
       * ここでは空選択も許可しない。
       */
      if (
        selectedSchoolIds.length ===
        0
      ) {
        setError(
          "所属校舎を1つ以上選択してください。"
        );

        return;
      }

      void allowed;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      /*
       * 同一組織の既存ユーザー
       */

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
              currentUser.organizationId
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

      /*
       * 既存招待
       */

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
              currentUser.organizationId
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

      await addDoc(
        collection(
          db,
          "userInvitations"
        ),
        {
          organizationId:
            currentUser.organizationId,

          email:
            normalizedEmail,

          name:
            trimmedName,

          role,

          schoolIds:
            selectedSchoolIds,

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
      setRole("講師");
      setSelectedSchoolIds([]);

      setMessage(
        "ユーザー登録を受け付けました。対象者が登録したGoogleアカウントでログインすると、正式ユーザー化されます。"
      );

      await loadData(
        currentUser.organizationId
      );
    } catch (err) {
      console.error(
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "ユーザー登録に失敗しました。"
      );
    } finally {
      setSaving(false);
    }
  }

  /*
   * ========================================================
   * ユーザー停止
   * ========================================================
   */

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
    } catch (err) {
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

  /*
   * ========================================================
   * 招待停止
   * ========================================================
   */

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
    } catch (err) {
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

  /*
   * ========================================================
   * 検索
   * ========================================================
   */

  const filteredUsers =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      if (!keyword) {
        return users;
      }

      return users.filter(
        (item) =>
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

  /*
   * ========================================================
   * 権限なし
   * ========================================================
   */

  if (
    currentUser &&
    currentUser.role !==
      "本部管理者" &&
    currentUser.role !==
      "校舎管理者"
  ) {
    return (
      <main
        style={pageStyle}
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

  return (
    <main
      style={pageStyle}
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
            Googleアカウント、権限、所属校舎を管理します。
          </p>
        </header>

        {error && (
          <Message
            type="error"
            message={error}
          />
        )}

        {message && (
          <Message
            type="success"
            message={message}
          />
        )}

        {/* ==================================================
            登録
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
            登録するGoogleアカウントのメールアドレスを指定してください。
            パスワードはこのシステムでは管理しません。
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
                  setRole(
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
              {schools.map(
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
                              current
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
            登録済みユーザー
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
                {users.length}
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
            登録待ち
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
                    ) => (
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
                    )
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
  currentUid,
  onDeactivate,
}: {
  users: ManagedUser[];
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
            ) => (
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
            )
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
      {message}
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

function organizationIdOfSchool(
  schoolId: string,
  schools: School[]
): string | null {
  const school =
    schools.find(
      (
        item
      ) =>
        item.id ===
        schoolId
    );

  return school
    ? school.id
    : null;
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
