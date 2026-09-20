"use client";

import { useMemo, useState } from "react";

import SchoolHeader from "@/components/SchoolHeader";

type Role =
  | "本部管理者"
  | "校舎管理者"
  | "講師"
  | "生徒";

type UserStatus = "有効" | "停止";

type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  school: string;
  status: UserStatus;
};

const initialUsers: User[] = [
  {
    id: "user-001",
    name: "本部管理者",
    email: "admin@example.jp",
    role: "本部管理者",
    school: "全校",
    status: "有効",
  },
  {
    id: "user-002",
    name: "○○校 管理者",
    email: "school@example.jp",
    role: "校舎管理者",
    school: "○○校",
    status: "有効",
  },
  {
    id: "user-003",
    name: "数学担当",
    email: "teacher@example.jp",
    role: "講師",
    school: "○○校",
    status: "有効",
  },
];

const roles: Role[] = [
  "本部管理者",
  "校舎管理者",
  "講師",
  "生徒",
];

export default function UsersPage() {
  const [users, setUsers] =
    useState<User[]>(initialUsers);

  const [search, setSearch] =
    useState("");

  const [roleFilter, setRoleFilter] =
    useState<"すべて" | Role>("すべて");

  const [showForm, setShowForm] =
    useState(false);

  const [name, setName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [role, setRole] =
    useState<Role>("講師");

  const [school, setSchool] =
    useState("○○校");

  const [message, setMessage] =
    useState("");

  const filteredUsers = useMemo(() => {
    const keyword =
      search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesKeyword =
        keyword === "" ||
        user.name
          .toLowerCase()
          .includes(keyword) ||
        user.email
          .toLowerCase()
          .includes(keyword);

      const matchesRole =
        roleFilter === "すべて" ||
        user.role === roleFilter;

      return (
        matchesKeyword &&
        matchesRole
      );
    });
  }, [users, search, roleFilter]);

  function addUser() {
    if (!name.trim()) {
      setMessage(
        "氏名を入力してください。"
      );
      return;
    }

    if (!email.trim()) {
      setMessage(
        "メールアドレスを入力してください。"
      );
      return;
    }

    const newUser: User = {
      id: `user-${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      role,
      school:
        role === "本部管理者"
          ? "全校"
          : school,
      status: "有効",
    };

    setUsers((current) => [
      ...current,
      newUser,
    ]);

    setName("");
    setEmail("");
    setRole("講師");
    setSchool("○○校");
    setShowForm(false);

    setMessage(
      "ユーザーを追加しました。"
    );
  }

  function toggleStatus(
    userId: string
  ) {
    setUsers((current) =>
      current.map((user) =>
        user.id === userId
          ? {
              ...user,
              status:
                user.status === "有効"
                  ? "停止"
                  : "有効",
            }
          : user
      )
    );
  }

  function resetPassword(
    user: User
  ) {
    setMessage(
      `${user.name}のパスワード再設定を実行します。`
    );
  }

  return (
    <main className="page">
      <SchoolHeader
        title="講師・権限管理"
      />

      <section className="content">
        <div className="pageHeader">
          <div>
            <h1>
              講師・権限管理
            </h1>

            <p>
              ユーザー・権限・利用状態を管理します。
            </p>
          </div>

          <button
            type="button"
            className="primaryButton"
            onClick={() =>
              setShowForm(true)
            }
          >
            ＋ ユーザー追加
          </button>
        </div>

        {message && (
          <div className="selectionPanel">
            {message}
          </div>
        )}

        {showForm && (
          <section className="formCard">
            <h2>
              ユーザー追加
            </h2>

            <label>
              氏名

              <input
                value={name}
                onChange={(event) =>
                  setName(
                    event.target.value
                  )
                }
                placeholder="山田 太郎"
              />
            </label>

            <label>
              メールアドレス

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value
                  )
                }
                placeholder="example@example.jp"
              />
            </label>

            <label>
              権限

              <select
                value={role}
                onChange={(event) =>
                  setRole(
                    event.target.value as Role
                  )
                }
              >
                {roles.map(
                  (item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {item}
                    </option>
                  )
                )}
              </select>
            </label>

            {role !== "本部管理者" && (
              <label>
                所属校舎

                <select
                  value={school}
                  onChange={(event) =>
                    setSchool(
                      event.target.value
                    )
                  }
                >
                  <option>
                    ○○校
                  </option>
                  <option>
                    △△校
                  </option>
                </select>
              </label>
            )}

            <div className="actionBar">
              <button
                type="button"
                className="secondaryButton"
                onClick={() =>
                  setShowForm(false)
                }
              >
                キャンセル
              </button>

              <button
                type="button"
                className="primaryButton"
                onClick={addUser}
              >
                ユーザーを追加
              </button>
            </div>
          </section>
        )}

        <section
          className="stepCard"
          style={{
            marginTop: 20,
          }}
        >
          <div className="filters">
            <input
              type="search"
              placeholder="氏名・メールアドレスで検索"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
            />

            <select
              value={roleFilter}
              onChange={(event) =>
                setRoleFilter(
                  event.target.value as
                    | "すべて"
                    | Role
                )
              }
            >
              <option>
                すべて
              </option>

              {roles.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="listCard">
            {filteredUsers.length ===
            0 ? (
              <div className="emptyState">
                ユーザーがありません。
              </div>
            ) : (
              filteredUsers.map(
                (user) => (
                  <div
                    key={user.id}
                    className="listRow"
                  >
                    <strong>
                      {user.name}
                    </strong>

                    <span>
                      {user.email}
                    </span>

                    <span>
                      {user.role}
                    </span>

                    <span>
                      {user.school}
                    </span>

                    <span>
                      {user.status}
                    </span>

                    <button
                      type="button"
                      className="textButton"
                      onClick={() =>
                        toggleStatus(
                          user.id
                        )
                      }
                    >
                      {user.status ===
                      "有効"
                        ? "停止"
                        : "再開"}
                    </button>

                    <button
                      type="button"
                      className="textButton"
                      onClick={() =>
                        resetPassword(
                          user
                        )
                      }
                    >
                      パスワード再設定
                    </button>
                  </div>
                )
              )
            )}
          </div>
        </section>

        <section
          className="stepCard"
          style={{
            marginTop: 20,
          }}
        >
          <h2>
            権限の基本範囲
          </h2>

          <div className="listCard">
            <div className="listRow">
              <strong>
                本部管理者
              </strong>

              <span>
                全校舎・全データ
              </span>

              <span>
                全機能
              </span>
            </div>

            <div className="listRow">
              <strong>
                校舎管理者
              </strong>

              <span>
                所属校舎
              </span>

              <span>
                校舎管理・採点・成績
              </span>
            </div>

            <div className="listRow">
              <strong>
                講師
              </strong>

              <span>
                担当範囲
              </span>

              <span>
                採点・答案・成績
              </span>
            </div>

            <div className="listRow">
              <strong>
                生徒
              </strong>

              <span>
                自分自身
              </span>

              <span>
                成績・答案閲覧
              </span>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
