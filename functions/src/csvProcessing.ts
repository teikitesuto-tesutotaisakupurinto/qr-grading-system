import {
  FieldValue,
  getFirestore,
} from "firebase-admin/firestore";

const db = getFirestore();

export type CsvImportType =
  | "students"
  | "scores"
  | "retests";

type CsvImportInput = {
  importId: string;
  type: CsvImportType;
  requestedBy: string;
};

type CsvImportDocument = {
  type: CsvImportType;
  filePath: string;
  status:
    | "uploaded"
    | "processing"
    | "completed"
    | "failed";
  totalRows: number;
  processedRows: number;
  successRows: number;
  errorRows: number;
  createdAt?: FirebaseFirestore.Timestamp;
  updatedAt?: FirebaseFirestore.Timestamp;
};

type CsvRow = Record<
  string,
  string
>;

const BATCH_SIZE = 400;

export async function processCsvImport(
  input: CsvImportInput
) {
  const importRef = db
    .collection("csvImports")
    .doc(input.importId);

  const importSnapshot =
    await importRef.get();

  if (!importSnapshot.exists) {
    throw new Error(
      "CSVインポート情報が存在しません。"
    );
  }

  const importData =
    importSnapshot.data() as CsvImportDocument;

  if (
    importData.type !== input.type
  ) {
    throw new Error(
      "CSV種別が一致しません。"
    );
  }

  if (
    importData.status ===
      "completed"
  ) {
    return {
      importId:
        input.importId,
      status: "completed",
      processed:
        importData.processedRows,
    };
  }

  await importRef.update({
    status: "processing",
    updatedAt:
      FieldValue.serverTimestamp(),
    processedBy:
      input.requestedBy,
  });

  try {
    const rows =
      await loadCsvRows(
        importData.filePath
      );

    await importRef.update({
      totalRows:
        rows.length,
      updatedAt:
        FieldValue.serverTimestamp(),
    });

    let processedRows = 0;
    let successRows = 0;
    let errorRows = 0;

    for (
      let start = 0;
      start < rows.length;
      start += BATCH_SIZE
    ) {
      const chunk =
        rows.slice(
          start,
          start + BATCH_SIZE
        );

      const result =
        await processChunk(
          input.type,
          chunk,
          start
        );

      processedRows +=
        result.processed;

      successRows +=
        result.success;

      errorRows +=
        result.errors;

      await importRef.update({
        processedRows,
        successRows,
        errorRows,
        updatedAt:
          FieldValue.serverTimestamp(),
      });
    }

    const status =
      errorRows > 0
        ? "completed_with_errors"
        : "completed";

    await importRef.update({
      status,
      processedRows,
      successRows,
      errorRows,
      completedAt:
        FieldValue.serverTimestamp(),
      updatedAt:
        FieldValue.serverTimestamp(),
    });

    return {
      importId:
        input.importId,
      status,
      processed:
        processedRows,
      success:
        successRows,
      errors:
        errorRows,
    };
  } catch (error) {
    await importRef.update({
      status: "failed",
      errorMessage:
        error instanceof Error
          ? error.message
          : "CSV処理に失敗しました。",
      updatedAt:
        FieldValue.serverTimestamp(),
    });

    throw error;
  }
}

async function loadCsvRows(
  filePath: string
): Promise<CsvRow[]> {
  /*
   * CSV本体はStorageに保存されている前提。
   */
  const {
    getStorage,
  } = await import(
    "firebase-admin/storage"
  );

  const bucket =
    getStorage().bucket();

  const file =
    bucket.file(filePath);

  const [
    buffer,
  ] = await file.download();

  const text =
    buffer
      .toString("utf8")
      .replace(/^\uFEFF/, "");

  return parseCsv(text);
}

function parseCsv(
  text: string
): CsvRow[] {
  const lines =
    text
      .split(/\r?\n/)
      .filter(
        (line) =>
          line.trim().length > 0
      );

  if (lines.length < 2) {
    return [];
  }

  const headers =
    parseCsvLine(
      lines[0]
    );

  return lines
    .slice(1)
    .map((line) => {
      const values =
        parseCsvLine(line);

      const row: CsvRow =
        {};

      headers.forEach(
        (header, index) => {
          row[header] =
            values[index] ??
            "";
        }
      );

      return row;
    });
}

function parseCsvLine(
  line: string
): string[] {
  const result: string[] = [];

  let current = "";
  let quoted = false;

  for (
    let index = 0;
    index < line.length;
    index++
  ) {
    const char =
      line[index];

    if (char === '"') {
      if (
        quoted &&
        line[index + 1] ===
          '"'
      ) {
        current += '"';
        index++;
      } else {
        quoted =
          !quoted;
      }

      continue;
    }

    if (
      char === "," &&
      !quoted
    ) {
      result.push(
        current.trim()
      );

      current = "";

      continue;
    }

    current += char;
  }

  result.push(
    current.trim()
  );

  return result;
}

async function processChunk(
  type: CsvImportType,
  rows: CsvRow[],
  offset: number
) {
  const batch =
    db.batch();

  const errors: Array<{
    rowNumber: number;
    message: string;
  }> = [];

  let success = 0;

  for (
    let index = 0;
    index < rows.length;
    index++
  ) {
    const row =
      rows[index];

    const rowNumber =
      offset + index + 2;

    try {
      if (
        type === "students"
      ) {
        addStudentOperation(
          batch,
          row
        );
      }

      if (
        type === "scores"
      ) {
        addScoreOperation(
          batch,
          row
        );
      }

      if (
        type === "retests"
      ) {
        addRetestOperation(
          batch,
          row
        );
      }

      success++;
    } catch (error) {
      errors.push({
        rowNumber,
        message:
          error instanceof Error
            ? error.message
            : "不正なデータです。",
      });
    }
  }

  if (success > 0) {
    await batch.commit();
  }

  if (errors.length > 0) {
    await saveImportErrors(
      errors
    );
  }

  return {
    processed:
      rows.length,
    success,
    errors:
      errors.length,
  };
}

function addStudentOperation(
  batch: FirebaseFirestore.WriteBatch,
  row: CsvRow
) {
  const id =
    row["生徒番号"];

  const name =
    row["氏名"];

  const school =
    row["校舎"];

  const grade =
    row["学年"];

  const className =
    row["クラス"];

  const status =
    row["在籍状況"] ||
    "在籍";

  if (!name) {
    throw new Error(
      "氏名がありません。"
    );
  }

  if (!school) {
    throw new Error(
      "校舎がありません。"
    );
  }

  if (!grade) {
    throw new Error(
      "学年がありません。"
    );
  }

  if (!className) {
    throw new Error(
      "クラスがありません。"
    );
  }

  const studentNumber =
    id ||
    generateStudentNumber();

  if (
    !/^\d{6}$/.test(
      studentNumber
    )
  ) {
    throw new Error(
      "生徒番号は6桁数字で指定してください。"
    );
  }

  const reference =
    db
      .collection(
        "students"
      )
      .doc(
        studentNumber
      );

  batch.set(
    reference,
    {
      id:
        studentNumber,

      name,

      schoolId:
        school,

      schoolName:
        school,

      grade,

      className,

      status,

      updatedAt:
        FieldValue.serverTimestamp(),
    },
    {
      merge: true,
    }
  );
}

function addScoreOperation(
  batch: FirebaseFirestore.WriteBatch,
  row: CsvRow
) {
  const studentNumber =
    row["生徒番号"];

  const testId =
    row["テストID"];

  const subjectId =
    row["教科"];

  const score =
    Number(
      row["得点"]
    );

  const maxScore =
    Number(
      row["満点"]
    );

  if (
    !/^\d{6}$/.test(
      studentNumber
    )
  ) {
    throw new Error(
      "生徒番号が不正です。"
    );
  }

  if (!testId) {
    throw new Error(
      "テストIDがありません。"
    );
  }

  if (!subjectId) {
    throw new Error(
      "教科がありません。"
    );
  }

  if (
    !Number.isFinite(
      score
    ) ||
    !Number.isFinite(
      maxScore
    )
  ) {
    throw new Error(
      "得点または満点が不正です。"
    );
  }

  if (
    score < 0 ||
    maxScore < 0 ||
    score > maxScore
  ) {
    throw new Error(
      "得点範囲が不正です。"
    );
  }

  const reference =
    db
      .collection("scores")
      .doc(
        `${testId}_${subjectId}_${studentNumber}`
      );

  batch.set(
    reference,
    {
      studentNumber,
      testId,
      subjectId,

      score,
      maxScore,

      percentage:
        maxScore === 0
          ? 0
          : (score /
              maxScore) *
            100,

      updatedAt:
        FieldValue.serverTimestamp(),
    },
    {
      merge: true,
    }
  );
}

function addRetestOperation(
  batch: FirebaseFirestore.WriteBatch,
  row: CsvRow
) {
  const studentNumber =
    row["生徒番号"];

  const testId =
    row["テストID"];

  const subjectId =
    row["教科"];

  const score =
    Number(
      row["追試点数"]
    );

  const maxScore =
    Number(
      row["満点"]
    );

  if (
    !/^\d{6}$/.test(
      studentNumber
    )
  ) {
    throw new Error(
      "生徒番号が不正です。"
    );
  }

  if (!testId) {
    throw new Error(
      "テストIDがありません。"
    );
  }

  if (!subjectId) {
    throw new Error(
      "教科がありません。"
    );
  }

  if (
    !Number.isFinite(
      score
    ) ||
    !Number.isFinite(
      maxScore
    )
  ) {
    throw new Error(
      "追試点数または満点が不正です。"
    );
  }

  if (
    score < 0 ||
    maxScore < 0 ||
    score > maxScore
  ) {
    throw new Error(
      "追試点数の範囲が不正です。"
    );
  }

  const reference =
    db
      .collection(
        "retests"
      )
      .doc(
        `${testId}_${subjectId}_${studentNumber}`
      );

  batch.set(
    reference,
    {
      studentNumber,
      testId,
      subjectId,

      score,
      maxScore,

      percentage:
        maxScore === 0
          ? 0
          : (score /
              maxScore) *
            100,

      status:
        "confirmed",

      updatedAt:
        FieldValue.serverTimestamp(),
    },
    {
      merge: true,
    }
  );
}

function generateStudentNumber(): string {
  return String(
    Math.floor(
      100000 +
        Math.random() *
          900000
    )
  );
}

async function saveImportErrors(
  errors: Array<{
    rowNumber: number;
    message: string;
  }>
) {
  const importErrors =
    db.collection(
      "csvImportErrors"
    );

  for (
    let start = 0;
    start < errors.length;
    start += BATCH_SIZE
  ) {
    const batch =
      db.batch();

    const chunk =
      errors.slice(
        start,
        start + BATCH_SIZE
      );

    for (
      const error of chunk
    ) {
      const reference =
        importErrors.doc();

      batch.set(
        reference,
        {
          ...error,

          createdAt:
            FieldValue.serverTimestamp(),
        }
      );
    }

    await batch.commit();
  }
}
