export type CsvRow = Record<
  string,
  string
>;

export function parseCsv(
  text: string
): CsvRow[] {
  const normalized =
    text.replace(/^\uFEFF/, "");

  const lines =
    normalized
      .split(/\r?\n/)
      .filter(
        (line) => line.trim().length > 0
      );

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(
    lines[0]
  );

  return lines
    .slice(1)
    .map((line) => {
      const values =
        parseCsvLine(line);

      return headers.reduce(
        (row, header, index) => {
          row[header] =
            values[index] ?? "";

          return row;
        },
        {} as CsvRow
      );
    });
}

function parseCsvLine(
  line: string
): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (
        quoted &&
        line[i + 1] === '"'
      ) {
        current += '"';
        i++;
      } else {
        quoted = !quoted;
      }

      continue;
    }

    if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());

  return values;
}

export function createCsv(
  headers: string[],
  rows: string[][]
): string {
  const escape = (value: string) =>
    `"${value.replace(/"/g, '""')}"`;

  return (
    "\uFEFF" +
    [
      headers.map(escape).join(","),
      ...rows.map((row) =>
        row.map(escape).join(",")
      ),
    ].join("\n")
  );
}

export function downloadCsv(
  filename: string,
  csv: string
) {
  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8",
  });

  const url =
    URL.createObjectURL(blob);

  const anchor =
    document.createElement("a");

  anchor.href = url;
  anchor.download = filename;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}
