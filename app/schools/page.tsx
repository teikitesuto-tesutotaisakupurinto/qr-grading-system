"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import {
  onAuthStateChanged,
} from "firebase/auth";

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

type School = {
  id: string;
  organizationId: string;
  name: string;
  logoUrl: string;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export default function SchoolsPage() {
  const [currentUser, setCurrentUser] =
    useState<CurrentUser | null>(null);

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

  const [schoolName, setSchoolName] =
    useState("");

  const [search, setSearch] =
    useState("");

  /*
   * ========================================================
   * 認証ユーザー取得
   * ========================================================
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
              setError(
                "ユーザー情報が登録されていません。"
              );

              setLoading(false);

              return;
            }

            const data =
              snapshot.docs[0].data();

            const role =
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

              role,
            });
          } catch (err) {
            console.error(err);

            setError(
              err instanceof Error
                ? err.message
                : "ユーザー情報を取得できませんでした。"
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
   * 校舎読み込み
   * ========================================================
   */

  useEffect(() => {
    if (
      !currentUser?.organizationId
    ) {
      return;
    }

    void loadSchools(
      currentUser.organizationId
    );
  }, [
    currentUser?.organizationId,
  ]);

  async function loadSchools(
    organizationId: string
  ) {
    try {
      setLoading(true);
      setError("");

      const snapshot =
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

      const items: School[] =
        snapshot.docs.map(
          (item) => {
            const data =
              item.data();

            return {
              id:
                item.id,

              organizationId:
                organizationId,

              name:
                typeof data.name ===
                "string"
                  ? data.name
                  : "",

              logoUrl:
                typeof data.logoUrl ===
                "string"
                  ? data.logoUrl
                  : "",

              active:
                data.active !==
                false,

              createdAt:
                data.createdAt,

              updatedAt:
                data.updatedAt,
            };
          }
        );

      setSchools(
        items
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "校舎情報を取得できませんでした。"
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * ========================================================
   * 校舎作成
   * ========================================================
   */

  async function createSchool() {
    if (saving) {
      return;
    }

    if (
      currentUser?.role !==
      "本部管理者"
    ) {
      setError(
        "校舎を作成できる権限がありません。"
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

    const name =
      schoolName.trim();

    if (!name) {
      setError(
        "校舎名を入力してください。"
      );

      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      /*
       * 新しい校舎ID
       */
      const schoolRef =
        doc(
          collection(
            db,
            "schools"
          )
        );

      /*
       * 本部管理者が作成した校舎。
       */
      await writeBatch(
        db
      )
        .set(
          schoolRef,
          {
            organizationId:
              currentUser.organizationId,

            name,

            logoUrl:
              "",

            active:
              true,

            createdAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp(),
          }
        )
        .commit();

      setSchoolName("");

      setMessage(
        "校舎を登録しました。"
      );

      await loadSchools(
        currentUser.organizationId
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "校舎の登録に失敗しました。"
      );
    } finally {
      setSaving(false);
    }
  }

  /*
   * ========================================================
   * 校舎有効/停止
   * ========================================================
   */

  async function toggleSchool(
    school: School
  ) {
    if (
      currentUser?.role !==
      "本部管理者"
    ) {
      setError(
        "校舎状態を変更できる権限がありません。"
      );

      return;
    }

    try {
      setError("");
      setMessage("");

      await updateDoc(
        doc(
          db,
          "schools",
          school.id
        ),
        {
          active:
            !school.active,

          updatedAt:
            serverTimestamp(),
        }
      );

      setMessage(
        school.active
          ? "校舎を停止しました。"
          : "校舎を有効にしました。"
      );

      if (
        currentUser.organizationId
      ) {
        await loadSchools(
          currentUser.organizationId
        );
      }
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "校舎状態の変更に失敗しました。"
      );
    }
  }

  /*
   * ========================================================
   * 検索
   * ========================================================
   */

  const filteredSchools =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      if (!keyword) {
        return schools;
      }

      return schools.filter(
        (school) =>
          school.name
            .toLowerCase()
            .includes(
              keyword
            )
      );
    }, [
      schools,
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
        style={{
          minHeight:
            "100vh",

          padding:
            32,

          background:
            "#f5f6f8",
        }}
      >
        <section
          style={
            cardStyle
          }
        >
          <h1>
            学校・校舎
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
      style={{
        minHeight:
          "100vh",

        padding:
          32,

        background:
          "#f5f6f8",
      }}
    >
      <div
        style={{
          maxWidth:
            1200,

          margin:
            "0 auto",
        }}
      >
        {/* =================================================
            Header
            ================================================= */}

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
            学校・校舎
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
            校舎と校舎ごとの基本情報を管理します。
          </p>
        </header>

        {/* =================================================
            Message
            ================================================= */}

        {error && (
          <div
            style={{
              ...messageStyle,

              borderColor:
                "#efb5b5",

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
              ...messageStyle,

              borderColor:
                "#b8d9c0",

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
            New School
            ================================================= */}

        {currentUser?.role ===
          "本部管理者" && (
          <section
            style={{
              ...cardStyle,

              marginBottom:
                24,
            }}
          >
            <h2>
              校舎を登録
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
              新しい校舎を組織に追加します。
            </p>

            <div
              style={{
                display:
                  "flex",

                gap:
                  12,

                alignItems:
                  "end",

                marginTop:
                  20,
              }}
            >
              <label
                style={{
                  flex:
                    1,
                }}
              >
                校舎名

                <input
                  value={
                    schoolName
                  }
                  onChange={(
                    event
                  ) =>
                    setSchoolName(
                      event.target
                        .value
                    )
                  }
                  placeholder="本校"
                  style={
                    inputStyle
                  }
                />
              </label>

              <button
                type="button"
                disabled={
                  saving
                }
                onClick={
                  createSchool
                }
                style={
                  primaryButton
                }
              >
                {saving
                  ? "登録中..."
                  : "校舎を登録"}
              </button>
            </div>
          </section>
        )}

        {/* =================================================
            School List
            ================================================= */}

        <section
          style={
            cardStyle
          }
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

              marginBottom:
                18,
            }}
          >
            <div>
              <h2
                style={{
                  margin:
                    0,
                }}
              >
                校舎一覧
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
                {schools.length}
                校
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
              placeholder="校舎名を検索"
              style={{
                ...inputStyle,

                maxWidth:
                  260,

                marginTop:
                  0,
              }}
            />
          </div>

          {loading ? (
            <p>
              読み込み中...
            </p>
          ) : filteredSchools.length ===
            0 ? (
            <div
              style={{
                padding:
                  40,

                textAlign:
                  "center",

                color:
                  "#777",
              }}
            >
              校舎がありません。
            </div>
          ) : (
            <div
              style={{
                display:
                  "grid",

                gridTemplateColumns:
                  "repeat(auto-fill, minmax(280px, 1fr))",

                gap:
                  16,
              }}
            >
              {filteredSchools.map(
                (
                  school
                ) => (
                  <article
                    key={
                      school.id
                    }
                    style={{
                      padding:
                        20,

                      border:
                        "1px solid #e1e4e8",

                      borderRadius:
                        10,

                      background:
                        "#fff",
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
                          12,
                      }}
                    >
                      <h3
                        style={{
                          margin:
                            0,

                          fontSize:
                            17,
                        }}
                      >
                        {
                          school.name
                        }
                      </h3>

                      <span
                        style={{
                          padding:
                            "4px 8px",

                          borderRadius:
                            999,

                          background:
                            school.active
                              ? "#eef8f1"
                              : "#f3f3f3",

                          color:
                            school.active
                              ? "#28733f"
                              : "#777",

                          fontSize:
                            11,

                          fontWeight:
                            600,
                        }}
                      >
                        {school.active
                          ? "有効"
                          : "停止"}
                      </span>
                    </div>

                    <div
                      style={{
                        marginTop:
                          18,

                        fontSize:
                          12,

                        color:
                          "#888",

                        wordBreak:
                          "break-all",
                      }}
                    >
                      校舎ID
                      <br />
                      {
                        school.id
                      }
                    </div>

                    {currentUser?.role ===
                      "本部管理者" && (
                      <button
                        type="button"
                        onClick={() =>
                          toggleSchool(
                            school
                          )
                        }
                        style={{
                          marginTop:
                            18,

                          width:
                            "100%",

                          padding:
                            "9px 12px",

                          border:
                            "1px solid #ccc",

                          borderRadius:
                            7,

                          background:
                            "#fff",

                          color:
                            school.active
                              ? "#a00000"
                              : "#25633a",

                          cursor:
                            "pointer",
                        }}
                      >
                        {school.active
                          ? "校舎を停止"
                          : "校舎を有効化"}
                      </button>
                    )}
                  </article>
                )
              )}
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

const cardStyle: React.CSSProperties =
  {
    padding:
      24,

    background:
      "#fff",

    border:
      "1px solid #e1e4e8",

    borderRadius:
      12,
  };

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

    outline:
      "none",
  };

const primaryButton: React.CSSProperties =
  {
    height:
      44,

    padding:
      "0 20px",

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

    whiteSpace:
      "nowrap",

    cursor:
      "pointer",
  };

const messageStyle: React.CSSProperties =
  {
    marginBottom:
      16,

    padding:
      14,

    border:
      "1px solid",

    borderRadius:
      8,

    lineHeight:
      1.6,
  };
