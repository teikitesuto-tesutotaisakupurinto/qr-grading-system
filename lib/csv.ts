"use client";

export type CsvRow = Record<
  string,
  string
>;

/* =========================================================
   CSV生成
   ========================================================= */

export function createCsv(
  headers: string[],
  rows: string[][]
): string {
  const output: string[] = [];

  output.push(
    headers
      .map(escapeCsvValue)
      .join(",")
  );

  for (const row of rows) {
    const normalized =
      headers.map(
        (_, index) =>
          row[index] ?? ""
      );

    output.push(
      normalized
        .map(escapeCsvValue)
        .join(",")
    );
  }

  /*
   * Excelで日本語CSVを開いたときの
   * 文字化けを防ぐためBOMを付ける。
   */
  return (
    "\uFEFF" +
    output.join("\r\n")
  );
}

/* =========================================================
   CSVダウンロード
   ========================================================= */

export function downloadCsv(
  fileName: string,
  csv: string
) {
  const blob =
    new Blob(
      [csv],
      {
        type:
          "text/csv;charset=utf-8;",
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const anchor =
    document.createElement(
      "a"
    );

  anchor.href = url;
  anchor.download =
    fileName;

  document.body.appendChild(
    anchor
  );

  anchor.click();

  anchor.remove();

  URL.revokeObjectURL(
    url
  );
}

/* =========================================================
   CSV解析
   ========================================================= */

export function parseCsv(
  input: string
): CsvRow[] {
  const text =
    input
      .replace(
        /^\uFEFF/,
        ""
      )
      .replace(
        /\r\n/g,
        "\n"
      )
      .replace(
        /\r/g,
        "\n"
      );

  const rows =
    parseCsvRows(text);

  if (
    rows.length === 0
  ) {
    return [];
  }

  const headers =
    rows[0].map(
      (header) =>
        header.trim()
    );

  if (
    headers.length === 0 ||
    headers.every(
      (header) =>
        !header
    )
  ) {
    return [];
  }

  const result: CsvRow[] =
    [];

  for (
    let index = 1;
    index < rows.length;
    index++
  ) {
    const values =
      rows[index];

    /*
     * 完全な空行は無視。
     */
    if (
      values.every(
        (value) =>
          value.trim() === ""
      )
    ) {
      continue;
    }

    const row: CsvRow =
      {};

    headers.forEach(
      (
        header,
        headerIndex
      ) => {
        if (!header) {
          return;
        }

        row[header] =
          values[
            headerIndex
          ] ?? "";
      }
    );

    result.push(row);
  }

  return result;
}

/* =========================================================
   CSV行パーサー
   ========================================================= */

function parseCsvRows(
  text: string
): string[][] {
  const rows: string[][] =
    [];

  let row: string[] =
    [];

  let value = "";

  let quoted = false;

  for (
    let index = 0;
    index < text.length;
    index++
  ) {
    const char =
      text[index];

    /*
     * ダブルクォート内。
     */
    if (quoted) {
      if (
        char === '"'
      ) {
        /*
         * "" はエスケープされた
         * ダブルクォート。
         */
        if (
          text[index + 1] ===
          '"'
        ) {
          value += '"';
          index++;
        } else {
          quoted = false;
        }
      } else {
        value += char;
      }

      continue;
    }

    /*
     * クォート開始。
     */
    if (
      char === '"' &&
      value === ""
    ) {
      quoted = true;
      continue;
    }

    /*
     * 列区切り。
     */
    if (
      char === ","
    ) {
      row.push(value);
      value = "";
      continue;
    }

    /*
     * 行区切り。
     */
    if (
      char === "\n"
    ) {
      row.push(value);

      rows.push(row);

      row = [];
      value = "";

      continue;
    }

    value += char;
  }

  /*
   * 最終セル。
   */
  row.push(value);

  /*
   * 最終行。
   */
  if (
    row.length > 0
  ) {
    rows.push(row);
  }

  return rows;
}

/* =========================================================
   CSVエスケープ
   ========================================================= */

function escapeCsvValue(
  value: string
): string {
  const normalized =
    String(value ?? "");

  if (
    normalized.includes(
      ","
    ) ||
    normalized.includes(
      '"'
    ) ||
    normalized.includes(
      "\n"
    ) ||
    normalized.includes(
      "\r"
    )
  ) {
    return (
      '"' +
      normalized.replace(
        /"/g,
        '""'
      ) +
      '"'
    );
  }

  return normalized;
}

/* =========================================================
   CSVヘッダー検証
   ========================================================= */

export function validateCsvHeaders(
  rows: CsvRow[],
  requiredHeaders: string[]
): {
  valid: boolean;
  missing: string[];
} {
  if (
    rows.length === 0
  ) {
    return {
      valid: false,
      missing:
        requiredHeaders,
    };
  }

  const available =
    new Set(
      Object.keys(
        rows[0]
      )
    );

  const missing =
    requiredHeaders.filter(
      (header) =>
        !available.has(
          header
        )
    );

  return {
    valid:
      missing.length === 0,

    missing,
  };
}

/* =========================================================
   CSV必須項目チェック
   ========================================================= */

export function validateRequiredValues(
  rows: CsvRow[],
  requiredHeaders: string[]
): Array<{
  row: number;
  field: string;
}> {
  const errors: Array<{
    row: number;
    field: string;
  }> = [];

  rows.forEach(
    (row, index) => {
      for (
        const field of
          requiredHeaders
      ) {
        if (
          !row[field] ||
          row[field].trim() ===
            ""
        ) {
          errors.push({
            row:
              index + 2,
            field,
          });
        }
      }
    }
  );

  return errors;
}

/* =========================================================
   数値CSV値
   ========================================================= */

export function parseCsvNumber(
  value: string,
  fieldName: string
): number {
  const normalized =
    value
      .trim()
      .replace(
        /,/g,
        ""
      );

  const number =
    Number(
      normalized
    );

  if (
    !Number.isFinite(
      number
    )
  ) {
    throw new Error(
      `${fieldName}の値が数値ではありません。`
    );
  }

  return number;
}
