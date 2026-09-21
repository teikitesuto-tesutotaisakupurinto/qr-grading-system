"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import {
  auth,
  db,
} from "@/lib/firebase";

import {
  onAuthStateChanged,
} from "firebase/auth";

type UserRole =
  | "本部管理者"
  | "校舎管理者"
  | "講師"
  | "生徒";

type AppUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole | null;
  schoolIds: string[];
  active: boolean;
};

type School = {
  id: string;
  name: string;
};

type Invitation = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  schoolIds: string[];
  active: boolean;
};

const roles: UserRole[] = [
  "本部管理者",
  "校舎管理者",
  "講師",
  "生徒",
];

export default function UsersPage() {
  const [currentUid, setCurrentUid] =
    useState("");

  const [currentRole, setCurrentRole] =
    useState<UserRole | null>(null);

  const [organizationId, setOrganizationId] =
    useState("");

  const [users, setUsers] =
    useState<AppUser[]>([]);

  const [invitations, setInvitations] =
    useState<Invitation[]>([]);

  const [schools, setSchools] =
    useState<School[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [name, setName] =
    useState("");

  const [role, setRole] =
    useState<UserRole>("講師");

  const [selectedSchoolIds, setSelectedSchoolIds] =
    useState<string[]>([]);

  const [search, setSearch] =
    useState("");

  /*
   * ログインユーザー確認
   */
  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (firebaseUser) => {
          if (!firebaseUser) {
            window.location.replace(
              "/login"
            );

            return;
          }

          try {
            const userSnapshot =
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
              userSnapshot.empty
            ) {
              setError(
                "ユーザー情報が登録されていません。"
              );

              setLoading(false);

              return;
            }

            const userData =
              userSnapshot.docs[0].data();

            const userRole =
              isUserRole(
                userData.role
              )
                ? userData.role
                : null;

            setCurrentUid(
              firebaseUser.uid
            );

            setCurrentRole(
              userRole
            );

            setOrganizationId(
              typeof userData.organizationId ===
                "string"
                ? userData.organizationId
                : ""
            );
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "ユーザー情報を取得できませんでした。"
            );
          }
        }
      );

    return () => {
      unsubscribe();
    };
  }, []);

  /*
   * データ読み込み
   */
  useEffect(() => {
    if (!organizationId) {
      return;
    }

    void loadData();
  }, [organizationId]);

  async function loadData() {
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

      const loadedUsers: AppUser[] =
        userSnapshot.docs.map(
          (item) => {
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

      const loadedInvitations: Invitation[] =
        invitationSnapshot.docs.map(
          (item) => {
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

      const loadedSchools: School[] =
        schoolSnapshot.docs.map(
          (item) => ({
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
   * 招待作成
   */
  async function createInvitation() {
    if (saving) {
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

    if (!normalizedEmail.includes("@")) {
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

    if (
      !organizationId
    ) {
      setError(
        "組織情報がありません。"
      );

      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      /*
       * 既存ユーザー確認
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

      /*
       * 既存招待確認
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
        !existingInvitations.empty
      ) {
        throw new Error(
          "このメールアドレスにはすでに招待があります。"
        );
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
            selectedSchoolIds,

          active:
            true,

          createdBy:
            currentUid,

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
        "ユーザーを登録しました。対象者がGoogleでログインすると正式ユーザーになります。"
      );

      await loadData();
    } catch (err) {
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
   * 招待停止
   */
  async function deactivateInvitation(
    invitationId: string
  ) {
    try {
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

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "招待を停止できませんでした。"
      );
    }
  }

  /*
   * ユーザー停止
   */
  async function deactivateUser(
    userId: string
  ) {
    if (
      userId ===
      currentUid
    ) {
      setError(
        "自分自身のアカウントはこの画面から停止できません。"
      );

      return;
    }

    try {
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

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "ユーザーを停止できませんでした。"
      );
    }
  }

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
            .includes(keyword) ||
          item.email
            .toLowerCase()
            .includes(keyword)
      );
    }, [
      users,
      search,
    ]);

  if (
    currentRole !==
      "本部管理者" &&
    currentRole !==
      "校舎管理者"
  ) {
    return (
      <main
        style={{
          padding:
            32,
        }}
      >
        <h1>
          ユーザー管理
        </h1>

        <p>
          この機能を利用する権限がありません。
        </p>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight:
          "100vh",

        background:
          "#f5f6f8",

        padding:
          32,
      }}
    >
      <div
        style={{
          maxWidth:
            1400,

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
            }}
          >
            Googleアカウントの登録・権限・所属校舎を管理します。
          </p>
        </header>

        {error && (
          <div
            style={{
              marginBottom:
                16,

              padding:
                14,

              border:
                "1px solid #efb5b5",

              borderRadius:
                8,

              background:
                "#fff4f4",

              color:
                "#9b1c1c",
            }}
          >
            {error}
          </div>
        )}

        {message && (
          <div
            style={{
              marginBottom:
                16,

              padding:
                14,

              border:
                "1px solid #b8d9c0",

              borderRadius:
                8,

              background:
                "#f2faf4",

              color:
                "#25633a",
            }}
          >
            {message}
          </div>
        )}

        {/* =================================================
            新規ユーザー
            ================================================= */}

        <section
          style={{
            background:
              "#fff",

            border:
              "1px solid #e1e4e8",

            borderRadius:
              12,

            padding:
              24,

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
            登録したメールアドレスのGoogleアカウントでログインすると、正式ユーザーとして利用できます。
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
                style={inputStyle}
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
                style={inputStyle}
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
                style={inputStyle}
              >
                {roles.map(
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
                20,
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

              {schools.length ===
                0 && (
                <span
                  style={{
                    color:
                      "#777",
                  }}
                >
                  登録されている校舎がありません。
                </span>
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
            style={{
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

              opacity:
                saving
                  ? 0.6
                  : 1,
            }}
          >
            {saving
              ? "登録中..."
              : "ユーザーを登録"}
          </button>
        </section>

        {/* =================================================
            登録済みユーザー
            ================================================= */}

        <section
          style={{
            background:
              "#fff",

            border:
              "1px solid #e1e4e8",

            borderRadius:
              12,

            padding:
              24,

            marginBottom:
              24,
          }}
        >
          <div
            style={{
              display:
                "flex",

              alignItems:
                "center",

              justifyContent:
                "space-between",

              gap:
                16,
            }}
          >
            <h2>
              登録済みユーザー
            </h2>

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
              placeholder="氏名・メールで検索"
              style={{
                ...inputStyle,

                maxWidth:
                  280,
              }}
            />
          </div>

          {loading ? (
            <p>
              読み込み中...
            </p>
          ) : (
            <div
              style={{
                overflowX:
                  "auto",
              }}
            >
              <table
                style={{
                  width:
                    "100%",

                  borderCollapse:
                    "collapse",

                  marginTop:
                    16,
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={
                        tableHeader
                      }
                    >
                      氏名
                    </th>

                    <th
                      style={
                        tableHeader
                      }
                    >
                      メール
                    </th>

                    <th
                      style={
                        tableHeader
                      }
                    >
                      権限
                    </th>

                    <th
                      style={
                        tableHeader
                      }
                    >
                      状態
                    </th>

                    <th
                      style={
                        tableHeader
                      }
                    >
                      操作
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredUsers.map(
                    (
                      item
                    ) => (
                      <tr
                        key={
                          item.id
                        }
                      >
                        <td
                          style={
                            tableCell
                          }
                        >
                          {
                            item.name
                          }
                        </td>

                        <td
                          style={
                            tableCell
                          }
                        >
                          {
                            item.email
                          }
                        </td>

                        <td
                          style={
                            tableCell
                          }
                        >
                          {
                            item.role ??
                            "未設定"
                          }
                        </td>

                        <td
                          style={
                            tableCell
                          }
                        >
                          {item.active
                            ? "有効"
                            : "停止"}
                        </td>

                        <td
                          style={
                            tableCell
                          }
                        >
                          {item.active &&
                            item.id !==
                              currentUid && (
                              <button
                                type="button"
                                onClick={() =>
                                  deactivateUser(
                                    item.id
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

                  {filteredUsers.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan={
                          5
                        }
                        style={{
                          ...tableCell,

                          textAlign:
                            "center",

                          color:
                            "#777",

                          padding:
                            32,
                        }}
                      >
                        ユーザーがありません。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* =================================================
            招待・登録待ち
            ================================================= */}

        <section
          style={{
            background:
              "#fff",

            border:
              "1px solid #e1e4e8",

            borderRadius:
              12,

            padding:
              24,
          }}
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
              登録待ちユーザーはいません。
            </p>
          ) : (
            <div
              style={{
                overflowX:
                  "auto",
              }}
            >
              <table
                style={{
                  width:
                    "100%",

                  borderCollapse:
                    "collapse",

                  marginTop:
                    16,
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={
                        tableHeader
                      }
                    >
                      氏名
                    </th>

                    <th
                      style={
                        tableHeader
                      }
                    >
                      メール
                    </th>

                    <th
                      style={
                        tableHeader
                      }
                    >
                      権限
                    </th>

                    <th
                      style={
                        tableHeader
                      }
                    >
                      状態
                    </th>

                    <th
                      style={
                        tableHeader
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
                            tableCell
                          }
                        >
                          {
                            invitation.name
                          }
                        </td>

                        <td
                          style={
                            tableCell
                          }
                        >
                          {
                            invitation.email
                          }
                        </td>

                        <td
                          style={
                            tableCell
                          }
                        >
                          {
                            invitation.role
                          }
                        </td>

                        <td
                          style={
                            tableCell
                          }
                        >
                          {invitation.active
                            ? "招待中"
                            : "停止"}
                        </td>

                        <td
                          style={
                            tableCell
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

const inputStyle: React.CSSProperties =
  {
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

const tableHeader: React.CSSProperties =
  {
    padding:
      "11px 12px",

    textAlign:
      "left",

    borderBottom:
      "2px solid #ddd",

    whiteSpace:
      "nowrap",
  };

const tableCell: React.CSSProperties =
  {
    padding:
      "12px",

    borderBottom:
      "1px solid #eee",

    fontSize:
      14,
  };

const dangerButton: React.CSSProperties =
  {
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
