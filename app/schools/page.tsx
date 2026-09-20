"use client";

import { useMemo, useState } from "react";

import SchoolHeader from "@/components/SchoolHeader";

type School = {
  id: string;
  name: string;
  address: string;
  active: boolean;
};

type ClassRoom = {
  id: string;
  schoolId: string;
  schoolName: string;
  grade: string;
  name: string;
  active: boolean;
};

const initialSchools: School[] = [
  {
    id: "school-001",
    name: "○○校",
    address: "",
    active: true,
  },
  {
    id: "school-002",
    name: "△△校",
    address: "",
    active: true,
  },
];

const initialClasses: ClassRoom[] = [
  {
    id: "class-001",
    schoolId: "school-001",
    schoolName: "○○校",
    grade: "中学2年",
    name: "2TZ",
    active: true,
  },
  {
    id: "class-002",
    schoolId: "school-001",
    schoolName: "○○校",
    grade: "中学2年",
    name: "2TS",
    active: true,
  },
  {
    id: "class-003",
    schoolId: "school-002",
    schoolName: "△△校",
    grade: "中学2年",
    name: "2TZ",
    active: true,
  },
];

const grades = [
  "小学1年",
  "小学2年",
  "小学3年",
  "小学4年",
  "小学5年",
  "小学6年",
  "中学1年",
  "中学2年",
  "中学3年",
  "高校1年",
  "高校2年",
  "高校3年",
];

export default function SchoolsPage() {
  const [schools, setSchools] =
    useState<School[]>(
      initialSchools
    );

  const [classes, setClasses] =
    useState<ClassRoom[]>(
      initialClasses
    );

  const [selectedSchoolId, setSelectedSchoolId] =
    useState(
      initialSchools[0].id
    );

  const [showSchoolForm, setShowSchoolForm] =
    useState(false);

  const [showClassForm, setShowClassForm] =
    useState(false);

  const [schoolName, setSchoolName] =
    useState("");

  const [schoolAddress, setSchoolAddress] =
    useState("");

  const [classGrade, setClassGrade] =
    useState("中学2年");

  const [className, setClassName] =
    useState("");

  const [message, setMessage] =
    useState("");

  const selectedSchool =
    schools.find(
      (school) =>
        school.id ===
        selectedSchoolId
    );

  const filteredClasses =
    useMemo(
      () =>
        classes.filter(
          (item) =>
            item.schoolId ===
            selectedSchoolId
        ),
      [
        classes,
        selectedSchoolId,
      ]
    );

  function addSchool() {
    if (!schoolName.trim()) {
      setMessage(
        "校舎名を入力してください。"
      );
      return;
    }

    const id =
      `school-${Date.now()}`;

    const school: School = {
      id,
      name: schoolName.trim(),
      address:
        schoolAddress.trim(),
      active: true,
    };

    setSchools((current) => [
      ...current,
      school,
    ]);

    setSelectedSchoolId(id);

    setSchoolName("");
    setSchoolAddress("");
    setShowSchoolForm(false);

    setMessage(
      "校舎を追加しました。"
    );
  }

  function addClass() {
    if (!selectedSchool) {
      return;
    }

    if (!className.trim()) {
      setMessage(
        "クラス名を入力してください。"
      );
      return;
    }

    const newClass: ClassRoom = {
      id:
        `class-${Date.now()}`,
      schoolId:
        selectedSchool.id,
      schoolName:
        selectedSchool.name,
      grade: classGrade,
      name: className.trim(),
      active: true,
    };

    setClasses((current) => [
      ...current,
      newClass,
    ]);

    setClassName("");
    setShowClassForm(false);

    setMessage(
      "クラスを追加しました。"
    );
  }

  function toggleSchool(
    schoolId: string
  ) {
    setSchools((current) =>
      current.map((school) =>
        school.id === schoolId
          ? {
              ...school,
              active:
                !school.active,
            }
          : school
      )
    );
  }

  function toggleClass(
    classId: string
  ) {
    setClasses((current) =>
      current.map((item) =>
        item.id === classId
          ? {
              ...item,
              active:
                !item.active,
            }
          : item
      )
    );
  }

  return (
    <main className="page">
      <SchoolHeader
        title="校舎・クラス管理"
      />

      <section className="content">
        <div className="pageHeader">
          <div>
            <h1>
              校舎・クラス管理
            </h1>

            <p>
              校舎、学年、クラスを管理します。
            </p>
          </div>
        </div>

        {message && (
          <div className="selectionPanel">
            {message}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "360px minmax(0, 1fr)",
            gap: 20,
          }}
        >
          <section className="stepCard">
            <div className="pageHeader">
              <h2>
                校舎
              </h2>

              <button
                type="button"
                className="secondaryButton"
                onClick={() =>
                  setShowSchoolForm(
                    true
                  )
                }
              >
                ＋ 校舎
              </button>
            </div>

            {showSchoolForm && (
              <div
                className="formCard"
                style={{
                  marginBottom: 16,
                }}
              >
                <label>
                  校舎名

                  <input
                    value={schoolName}
                    onChange={(event) =>
                      setSchoolName(
                        event.target
                          .value
                      )
                    }
                    placeholder="○○校"
                  />
                </label>

                <label>
                  所在地

                  <input
                    value={
                      schoolAddress
                    }
                    onChange={(event) =>
                      setSchoolAddress(
                        event.target
                          .value
                      )
                    }
                  />
                </label>

                <div className="actionBar">
                  <button
                    type="button"
                    className="secondaryButton"
                    onClick={() =>
                      setShowSchoolForm(
                        false
                      )
                    }
                  >
                    キャンセル
                  </button>

                  <button
                    type="button"
                    className="primaryButton"
                    onClick={addSchool}
                  >
                    校舎を追加
                  </button>
                </div>
              </div>
            )}

            <div className="listCard">
              {schools.map(
                (school) => (
                  <button
                    type="button"
                    key={school.id}
                    className="listRow"
                    style={{
                      width: "100%",
                      textAlign:
                        "left",
                      border: 0,
                      borderBottom:
                        "1px solid #eee",
                      background:
                        selectedSchoolId ===
                        school.id
                          ? "#f3f3f3"
                          : "#fff",
                      cursor:
                        "pointer",
                    }}
                    onClick={() =>
                      setSelectedSchoolId(
                        school.id
                      )
                    }
                  >
                    <strong>
                      {school.name}
                    </strong>

                    <span>
                      {school.active
                        ? "利用中"
                        : "停止中"}
                    </span>

                    <span>
                      <button
                        type="button"
                        className="textButton"
                        onClick={(
                          event
                        ) => {
                          event.stopPropagation();

                          toggleSchool(
                            school.id
                          );
                        }}
                      >
                        {school.active
                          ? "停止"
                          : "再開"}
                      </button>
                    </span>
                  </button>
                )
              )}
            </div>
          </section>

          <section className="stepCard">
            <div className="pageHeader">
              <div>
                <h2>
                  {selectedSchool
                    ?.name ??
                    "校舎"}
                  のクラス
                </h2>

                <p>
                  学年・クラス単位で管理します。
                </p>
              </div>

              <button
                type="button"
                className="secondaryButton"
                onClick={() =>
                  setShowClassForm(
                    true
                  )
                }
              >
                ＋ クラス
              </button>
            </div>

            {showClassForm && (
              <div
                className="formCard"
                style={{
                  marginBottom: 16,
                }}
              >
                <label>
                  学年

                  <select
                    value={
                      classGrade
                    }
                    onChange={(event) =>
                      setClassGrade(
                        event.target
                          .value
                      )
                    }
                  >
                    {grades.map(
                      (grade) => (
                        <option
                          key={grade}
                          value={grade}
                        >
                          {grade}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label>
                  クラス名

                  <input
                    value={
                      className
                    }
                    onChange={(event) =>
                      setClassName(
                        event.target
                          .value
                      )
                    }
                    placeholder="2TZ"
                  />
                </label>

                <div className="actionBar">
                  <button
                    type="button"
                    className="secondaryButton"
                    onClick={() =>
                      setShowClassForm(
                        false
                      )
                    }
                  >
                    キャンセル
                  </button>

                  <button
                    type="button"
                    className="primaryButton"
                    onClick={
                      addClass
                    }
                  >
                    クラスを追加
                  </button>
                </div>
              </div>
            )}

            <div className="listCard">
              {filteredClasses.length ===
              0 ? (
                <div className="emptyState">
                  クラスがありません。
                </div>
              ) : (
                filteredClasses.map(
                  (item) => (
                    <div
                      key={item.id}
                      className="listRow"
                    >
                      <strong>
                        {item.grade}
                      </strong>

                      <span>
                        {item.name}
                      </span>

                      <span>
                        {item.active
                          ? "利用中"
                          : "停止中"}
                      </span>

                      <button
                        type="button"
                        className="textButton"
                        onClick={() =>
                          toggleClass(
                            item.id
                          )
                        }
                      >
                        {item.active
                          ? "停止"
                          : "再開"}
                      </button>
                    </div>
                  )
                )
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
