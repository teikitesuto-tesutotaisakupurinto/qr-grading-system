"use client";

import {
  useMemo,
  useState,
} from "react";

type QuestionChange = {
  questionId: string;

  questionNumber: number;

  before: number;

  after: number;

  reason: string;
};

type ReviewItem = {
  id: string;

  questionId: string;

  questionNumber: number;

  studentNumber: string;

  beforeScore: number;

  afterScore: number;

  reason: string;

  status:
    | "未確認"
    | "確認済み";
};

const INITIAL_ITEMS: ReviewItem[] = [
  {
    id: "review-001",
    questionId: "q-001",
    questionNumber: 1,
    studentNumber: "非表示",
    beforeScore: 0,
    afterScore: 0,
    reason: "",
    status: "未確認",
  },

  {
    id: "review-002",
    questionId: "q-002",
    questionNumber: 2,
    studentNumber: "非表示",
    beforeScore: 3,
    afterScore: 2,
    reason: "部分点確認",
    status: "未確認",
  },
];

export default function GradingReviewPage() {
  const [
    items,
    setItems,
  ] =
    useState<ReviewItem[]>(
      INITIAL_ITEMS
    );

  const [
    selectedId,
    setSelectedId,
  ] =
    useState<string | null>(
      INITIAL_ITEMS[0]?.id ??
        null
    );

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    error,
    setError,
  ] =
    useState("");

  /* =======================================================
     Selected item
     ======================================================= */

  const selected =
    useMemo(
      () =>
        items.find(
          (
            item
          ) =>
            item.id ===
            selectedId
        ) ?? null,
      [
        items,
        selectedId,
      ]
    );

  /* =======================================================
     Statistics
     ======================================================= */

  const pendingCount =
    items.filter(
      (
        item
      ) =>
        item.status ===
        "未確認"
    ).length;

  const confirmedCount =
    items.filter(
      (
        item
      ) =>
        item.status ===
        "確認済み"
    ).length;

  /* =======================================================
     Score change
     ======================================================= */

  function updateAfterScore(
    value: string
  ) {
    if (
      !selected
    ) {
      return;
    }

    const score =
      Number(
        value
      );

    if (
      !Number.isFinite(
        score
      )
    ) {
      return;
    }

    setItems(
      (
        current
      ) =>
        current.map(
          (
            item
          ) =>
            item.id ===
            selected.id
              ? {
                  ...item,

                  afterScore:
                    score,

                  status:
                    "未確認",
                }
              : item
        )
    );

    setMessage("");
    setError("");
  }

  /* =======================================================
     Reason
     ======================================================= */

  function updateReason(
    value: string
  ) {
    if (
      !selected
    ) {
      return;
    }

    setItems(
      (
        current
      ) =>
        current.map(
          (
            item
          ) =>
            item.id ===
            selected.id
              ? {
                  ...item,

                  reason:
                    value,

                  status:
                    "未確認",
                }
              : item
        )
    );

    setMessage("");
    setError("");
  }

  /* =======================================================
     Confirm selected
     ======================================================= */

  function confirmSelected() {
    if (
      !selected
    ) {
      return;
    }

    setItems(
      (
        current
      ) =>
        current.map(
          (
            item
          ) =>
            item.id ===
            selected.id
              ? {
                  ...item,

                  status:
                    "確認済み",
                }
              : item
        )
    );

    setMessage(
      "確認済みにしました。"
    );

    setError("");
  }

  /* =======================================================
     Build changes
     =======================================================
     nullを含む配列を作らない。
     ======================================================= */

  function buildChanges(): QuestionChange[] {
    return items
      .map(
        (
          item
        ) => {
          if (
            item.beforeScore ===
            item.afterScore
          ) {
            return null;
          }

          return {
            questionId:
              item.questionId,

            questionNumber:
              item.questionNumber,

            before:
              item.beforeScore,

            after:
              item.afterScore,

            reason:
              item.reason,
          };
        }
      )
      .filter(
        (
          change
        ): change is QuestionChange =>
          change !==
          null
      );
  }

  /* =======================================================
     Save
     ======================================================= */

  async function saveChanges() {
    if (
      saving
    ) {
      return;
    }

    setSaving(
      true
    );

    setMessage("");
    setError("");

    try {
      const changes =
        buildChanges();

      /*
       * 変更がない場合。
       */
      if (
        changes.length ===
        0
      ) {
        setMessage(
          "変更はありません。"
        );

        return;
      }

      /*
       * ここで実際のFirestore保存処理に
       * 接続する。
       *
       * 現在のBuildエラーの原因だった
       * null混在は、この時点で完全に除去されている。
       */

      console.log(
        "grading changes:",
        changes
      );

      /*
       * 実際の保存が成功したものとして
       * UIを更新。
       */
      setItems(
        (
          current
        ) =>
          current.map(
            (
              item
            ) =>
              item.beforeScore !==
                item.afterScore
                ? {
                    ...item,

                    beforeScore:
                      item.afterScore,

                    status:
                      "確認済み",
                  }
                : item
          )
      );

      setMessage(
        `${changes.length}件の採点変更を保存しました。`
      );
    } catch (
      err
    ) {
      console.error(
        "grading review save error:",
        err
      );

      setError(
        "採点変更を保存できませんでした。"
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  /* =======================================================
     Render
     ======================================================= */

  return (
    <main
      className="main"
      style={{
        padding:
          24,
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
              24,
          }}
        >
          <h1>
            一次確認
          </h1>

          <p
            className="muted"
          >
            自動採点結果を確認し、必要な採点変更を確認します。
          </p>
        </header>

        {/* ==================================================
            Status
            ================================================== */}

        <div
          className="row"
          style={{
            gap:
              12,

            marginBottom:
              20,
          }}
        >
          <div
            className="card"
            style={{
              minWidth:
                160,
            }}
          >
            <div
              className="muted"
            >
              未確認
            </div>

            <strong
              style={{
                fontSize:
                  26,
              }}
            >
              {
                pendingCount
              }
            </strong>
          </div>

          <div
            className="card"
            style={{
              minWidth:
                160,
            }}
          >
            <div
              className="muted"
            >
              確認済み
            </div>

            <strong
              style={{
                fontSize:
                  26,
              }}
            >
              {
                confirmedCount
              }
            </strong>
          </div>
        </div>

        {message && (
          <div
            className="card"
            style={{
              marginBottom:
                16,

              borderColor:
                "#b8d9c0",

              background:
                "#f2faf4",

              color:
                "#25633a",
            }}
          >
            {
              message
            }
          </div>
        )}

        {error && (
          <div
            className="card"
            style={{
              marginBottom:
                16,

              borderColor:
                "#efb5b5",

              background:
                "#fff4f4",

              color:
                "#9b1c1c",
            }}
          >
            {
              error
            }
          </div>
        )}

        {/* ==================================================
            Review layout
            ================================================== */}

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "minmax(320px, 1fr) minmax(360px, 1fr)",

            gap:
              20,
          }}
        >
          {/* ================================================
              List
              ================================================ */}

          <section
            className="card"
          >
            <h2>
              採点確認
            </h2>

            <div
              style={{
                marginTop:
                  16,
              }}
            >
              {items.map(
                (
                  item
                ) => {
                  const active =
                    item.id ===
                    selectedId;

                  return (
                    <button
                      key={
                        item.id
                      }
                      type="button"
                      onClick={() =>
                        setSelectedId(
                          item.id
                        )
                      }
                      style={{
                        display:
                          "block",

                        width:
                          "100%",

                        padding:
                          14,

                        marginBottom:
                          8,

                        textAlign:
                          "left",

                        border:
                          active
                            ? "2px solid #111"
                            : "1px solid #ddd",

                        borderRadius:
                          8,

                        background:
                          active
                            ? "#f7f7f7"
                            : "#fff",

                        cursor:
                          "pointer",
                      }}
                    >
                      <div
                        style={{
                          display:
                            "flex",

                          justifyContent:
                            "space-between",
                        }}
                      >
                        <strong>
                          問題{" "}
                          {
                            item.questionNumber
                          }
                        </strong>

                        <span>
                          {
                            item.status
                          }
                        </span>
                      </div>

                      <div
                        style={{
                          marginTop:
                            7,

                          fontSize:
                            13,

                          color:
                            "#666",
                        }}
                      >
                        {
                          item.beforeScore
                        }
                        点 →{" "}
                        {
                          item.afterScore
                        }
                        点
                      </div>
                    </button>
                  );
                }
              )}
            </div>
          </section>

          {/* ================================================
              Detail
              ================================================ */}

          <section
            className="card"
          >
            <h2>
              問題詳細
            </h2>

            {!selected ? (
              <p className="muted">
                問題を選択してください。
              </p>
            ) : (
              <>
                <div
                  style={{
                    marginTop:
                      18,

                    padding:
                      16,

                    background:
                      "#f7f7f7",

                    borderRadius:
                      8,
                  }}
                >
                  <div className="muted">
                    生徒番号
                  </div>

                  <strong>
                    答案画面では非表示
                  </strong>
                </div>

                <div
                  style={{
                    display:
                      "grid",

                    gridTemplateColumns:
                      "1fr 1fr",

                    gap:
                      14,

                    marginTop:
                      18,
                  }}
                >
                  <div>
                    <label>
                      採点前
                    </label>

                    <input
                      className="input"
                      type="number"
                      value={
                        selected.beforeScore
                      }
                      disabled
                    />
                  </div>

                  <div>
                    <label>
                      確認後
                    </label>

                    <input
                      className="input"
                      type="number"
                      value={
                        selected.afterScore
                      }
                      onChange={(
                        event
                      ) =>
                        updateAfterScore(
                          event
                            .target
                            .value
                        )
                      }
                    />
                  </div>
                </div>

                <div
                  style={{
                    marginTop:
                      18,
                  }}
                >
                  <label>
                    変更理由
                  </label>

                  <textarea
                    className="input"
                    value={
                      selected.reason
                    }
                    onChange={(
                      event
                    ) =>
                      updateReason(
                        event
                          .target
                          .value
                      )
                    }
                    rows={5}
                    placeholder="採点変更の理由"
                  />
                </div>

                <div
                  className="row"
                  style={{
                    gap:
                      8,

                    marginTop:
                      18,
                  }}
                >
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={
                      confirmSelected
                    }
                  >
                    確認済みにする
                  </button>

                  <button
                    type="button"
                    className="btn"
                    disabled={
                      saving
                    }
                    onClick={
                      saveChanges
                    }
                  >
                    {saving
                      ? "保存中..."
                      : "採点変更を保存"}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
