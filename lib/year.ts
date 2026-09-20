"use client";

import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";

import {
  db,
} from "@/lib/firebase";

export type YearUpdatePreview = {
  studentNumber: string;
  name: string;

  currentGrade: string;
  nextGrade: string;

  currentClass: string;
  nextClass: string;

  status:
    | "在籍"
    | "卒業";
};

export type YearUpdateResult = {
  updated: number;
  graduated: number;
  skipped: number;
};

/* =========================================================
   学年進級表
   ========================================================= */

const GRADE_MAP: Record<
  string,
  string
> = {
  "小学1年":
    "小学2年",

  "小学2年":
    "小学3年",

  "小学3年":
    "小学4年",

  "小学4年":
    "小学5年",

  "小学5年":
    "小学6年",

  "小学6年":
    "中学1年",

  "中学1年":
    "中学2年",

  "中学2年":
    "中学3年",

  "中学3年":
    "卒業",

  "高校1年":
    "高校2年",

  "高校2年":
    "高校3年",

  "高校3年":
    "卒業",
};

/* =========================================================
   次年度学年取得
   ========================================================= */

export function getNextGrade(
  grade: string
): string {
  return (
    GRADE_MAP[grade] ??
    grade
  );
}

/* =========================================================
   年度更新プレビュー
   ========================================================= */

export async function getYearUpdatePreview(): Promise<
  YearUpdatePreview[]
> {
  const studentsQuery =
    query(
      collection(
        db,
        "students"
      ),
      where(
        "status",
        "==",
        "在籍"
      )
    );

  const snapshot =
    await getDocs(
      studentsQuery
    );

  return snapshot.docs.map(
    (item) => {
      const data =
        item.data();

      const currentGrade =
        String(
          data.grade ?? ""
        );

      const nextGrade =
        getNextGrade(
          currentGrade
        );

      const currentClass =
        String(
          data.className ?? ""
        );

      return {
        studentNumber:
          item.id,

        name:
          String(
            data.name ?? ""
          ),

        currentGrade,

        nextGrade,

        currentClass,

        nextClass:
          nextGrade === "卒業"
            ? "—"
            : "",

        status:
          nextGrade === "卒業"
            ? "卒業"
            : "在籍",
      };
    }
  );
}

/* =========================================================
   年度更新
   ========================================================= */

export async function executeYearUpdate(
  updatedBy: string
): Promise<YearUpdateResult> {
  if (
    !updatedBy.trim()
  ) {
    throw new Error(
      "年度更新を実行したユーザーを特定できません。"
    );
  }

  const studentsQuery =
    query(
      collection(
        db,
        "students"
      ),
      where(
        "status",
        "==",
        "在籍"
      )
    );

  const snapshot =
    await getDocs(
      studentsQuery
    );

  let updated = 0;
  let graduated = 0;
  let skipped = 0;

  /*
   * Firestore batchは500件上限なので、
   * 400件ずつ処理。
   */
  const BATCH_SIZE = 400;

  for (
    let start = 0;
    start < snapshot.docs.length;
    start += BATCH_SIZE
  ) {
    const batch =
      writeBatch(db);

    const chunk =
      snapshot.docs.slice(
        start,
        start + BATCH_SIZE
      );

    for (
      const studentDoc of chunk
    ) {
      const data =
        studentDoc.data();

      const currentGrade =
        String(
          data.grade ?? ""
        );

      const nextGrade =
        getNextGrade(
          currentGrade
        );

      /*
       * 対応していない学年は
       * 勝手に変更しない。
       */
      if (
        !GRADE_MAP[
          currentGrade
        ]
      ) {
        skipped++;
        continue;
      }

      const reference =
        doc(
          db,
          "students",
          studentDoc.id
        );

      if (
        nextGrade === "卒業"
      ) {
        batch.update(
          reference,
          {
            status:
              "卒業",

            previousGrade:
              currentGrade,

            grade:
              "卒業",

            previousClassName:
              data.className ??
              "",

            className:
              "",

            updatedBy,

            updatedAt:
              serverTimestamp(),
          }
        );

        graduated++;
      } else {
        batch.update(
          reference,
          {
            previousGrade:
              currentGrade,

            grade:
              nextGrade,

            /*
             * 新年度クラスは
             * 別途CSV等で設定する。
             */
            classId: "",
            className: "",

            updatedBy,

            updatedAt:
              serverTimestamp(),
          }
        );

        updated++;
      }
    }

    await batch.commit();
  }

  /*
   * 年度更新履歴。
   */
  await writeYearUpdateLog({
    updatedBy,

    updated,

    graduated,

    skipped,

    total:
      snapshot.docs.length,
  });

  return {
    updated,

    graduated,

    skipped,
  };
}

/* =========================================================
   新年度クラス反映
   ========================================================= */

export async function updateStudentNewClass(
  studentNumber: string,
  classId: string,
  className: string,
  updatedBy: string
) {
  if (
    !/^\d{6}$/.test(
      studentNumber
    )
  ) {
    throw new Error(
      "生徒番号が不正です。"
    );
  }

  if (
    !classId.trim()
  ) {
    throw new Error(
      "クラスIDがありません。"
    );
  }

  if (
    !className.trim()
  ) {
    throw new Error(
      "クラス名がありません。"
    );
  }

  if (
    !updatedBy.trim()
  ) {
    throw new Error(
      "更新者がありません。"
    );
  }

  await writeBatch(
    db
  )
    .update(
      doc(
        db,
        "students",
        studentNumber
      ),
      {
        classId,

        className,

        updatedBy,

        updatedAt:
          serverTimestamp(),
      }
    );

  /*
   * 上記はBatchを生成しているため、
   * 実際のcommitを行う。
   */
  const batch =
    writeBatch(db);

  batch.update(
    doc(
      db,
      "students",
      studentNumber
    ),
    {
      classId,

      className,

      updatedBy,

      updatedAt:
        serverTimestamp(),
    }
  );

  await batch.commit();
}

/* =========================================================
   年度更新履歴
   ========================================================= */

async function writeYearUpdateLog(
  input: {
    updatedBy: string;

    updated: number;

    graduated: number;

    skipped: number;

    total: number;
  }
) {
  const reference =
    doc(
      collection(
        db,
        "yearUpdateLogs"
      )
    );

  const batch =
    writeBatch(db);

  batch.set(
    reference,
    {
      updatedBy:
        input.updatedBy,

      updated:
        input.updated,

      graduated:
        input.graduated,

      skipped:
        input.skipped,

      total:
        input.total,

      createdAt:
        serverTimestamp(),
    }
  );

  await batch.commit();
}
