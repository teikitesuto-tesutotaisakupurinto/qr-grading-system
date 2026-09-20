"use client";

export type Student = {
  id: string;
  name: string;
  schoolId: string;
  schoolName: string;
  grade: string;
  className: string;
  status:
    | "在籍"
    | "休学"
    | "卒業"
    | "退塾"
    | string;
};

type StudentTableProps = {
  students: Student[];

  selectionMode?: boolean;

  selectedIds?: string[];

  onToggle?: (
    studentId: string
  ) => void;

  onToggleAll?: () => void;
};

export default function StudentTable({
  students,
  selectionMode = false,
  selectedIds = [],
  onToggle,
  onToggleAll,
}: StudentTableProps) {
  const visibleIds =
    students.map(
      (student) => student.id
    );

  const selectedVisibleCount =
    visibleIds.filter(
      (id) =>
        selectedIds.includes(id)
    ).length;

  const allSelected =
    visibleIds.length > 0 &&
    selectedVisibleCount ===
      visibleIds.length;

  return (
    <div className="studentTable">
      <div className="studentRow headerRow">
        {selectionMode && (
          <div
            style={{
              display: "flex",
              alignItems:
                "center",
              justifyContent:
                "center",
            }}
          >
            <input
              type="checkbox"
              checked={
                allSelected
              }
              onChange={() =>
                onToggleAll?.()
              }
              aria-label="表示中の生徒を全選択"
            />
          </div>
        )}

        <div>
          生徒番号
        </div>

        <div>
          氏名
        </div>

        <div>
          校舎
        </div>

        <div>
          学年
        </div>

        <div>
          クラス
        </div>

        <div>
          在籍状況
        </div>
      </div>

      {students.length === 0 ? (
        <div className="emptyState">
          生徒がありません。
        </div>
      ) : (
        students.map(
          (student) => {
            const selected =
              selectedIds.includes(
                student.id
              );

            return (
              <div
                key={student.id}
                className="studentRow"
                style={{
                  background:
                    selected
                      ? "#f3f3f3"
                      : "#fff",
                }}
              >
                {selectionMode && (
                  <div
                    style={{
                      display:
                        "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "center",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={
                        selected
                      }
                      onChange={() =>
                        onToggle?.(
                          student.id
                        )
                      }
                      aria-label={`${student.name}を選択`}
                    />
                  </div>
                )}

                <div>
                  <strong>
                    {student.id}
                  </strong>
                </div>

                <div>
                  {student.name}
                </div>

                <div>
                  {student.schoolName}
                </div>

                <div>
                  {student.grade}
                </div>

                <div>
                  {student.className}
                </div>

                <div>
                  <span
                    style={{
                      display:
                        "inline-flex",
                      alignItems:
                        "center",
                      minHeight:
                        28,
                      padding:
                        "0 8px",
                      border:
                        "1px solid #ddd",
                      borderRadius:
                        5,
                      fontSize:
                        12,
                    }}
                  >
                    {student.status}
                  </span>
                </div>
              </div>
            );
          }
        )
      )}
    </div>
  );
}
