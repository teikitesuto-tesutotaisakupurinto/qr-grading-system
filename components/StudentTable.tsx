"use client";

export type Student = {
  id: string;
  name: string;
  school: string;
  grade: string;
  className: string;
  status: "在籍" | "卒業" | "退塾";
};

type StudentTableProps = {
  students: Student[];
  selectionMode?: boolean;
  selectedIds?: string[];
  onToggle?: (studentId: string) => void;
  onToggleAll?: () => void;
};

export default function StudentTable({
  students,
  selectionMode = false,
  selectedIds = [],
  onToggle,
  onToggleAll,
}: StudentTableProps) {
  const allSelected =
    students.length > 0 &&
    students.every((student) =>
      selectedIds.includes(student.id)
    );

  return (
    <div className="studentTable">
      <div className="studentRow headerRow">
        {selectionMode && (
          <div>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={onToggleAll}
              aria-label="すべて選択"
            />
          </div>
        )}

        <div>生徒番号</div>
        <div>氏名</div>
        <div>校舎</div>
        <div>学年</div>
        <div>クラス</div>
        <div>在籍状況</div>
      </div>

      {students.map((student) => {
        const checked = selectedIds.includes(
          student.id
        );

        return (
          <div
            className="studentRow"
            key={student.id}
          >
            {selectionMode && (
              <div>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    onToggle?.(student.id)
                  }
                  aria-label={`${student.name}を選択`}
                />
              </div>
            )}

            <div>{student.id}</div>
            <div>{student.name}</div>
            <div>{student.school}</div>
            <div>{student.grade}</div>
            <div>{student.className}</div>
            <div>{student.status}</div>
          </div>
        );
      })}

      {students.length === 0 && (
        <div className="emptyState">
          生徒データがありません。
        </div>
      )}
    </div>
  );
}
