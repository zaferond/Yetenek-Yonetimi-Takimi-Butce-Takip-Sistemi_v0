import ExcelJS from "exceljs";

export const amountFormat = '#,##0.00;[Red](#,##0.00);"—"';
export const headerFill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF665078" },
};

export function createWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Yetenek Yönetimi";
  workbook.created = new Date();
  return workbook;
}

export function decimal(units) {
  if (units === null || units === undefined) return "";
  const value = BigInt(units),
    absolute = value < 0n ? -value : value;
  return `${value < 0n ? "-" : ""}${absolute / 1000000n},${String(absolute % 1000000n).padStart(6, "0")}`;
}

// Preserve all six decimals. Values beyond Excel's 15 significant digits stay text.
export function amountCell(units) {
  const value = BigInt(units);
  const digits = (value < 0n ? -value : value).toString().replace(/0+$/, "");
  return digits.length <= 15
    ? Number(decimal(units).replace(",", "."))
    : decimal(units);
}

export function styleHeader(row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = headerFill;
  row.height = 32;
  row.alignment = { vertical: "middle", wrapText: true };
}

export function sheet(workbook, name, headers, rows) {
  const ws = workbook.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 1 }],
    pageSetup: {
      orientation: "landscape",
      paperSize: 8,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });
  ws.columns = headers.map((header) => ({
    header,
    width: Math.min(42, Math.max(16, header.length + 3)),
  }));
  rows.forEach((row) => ws.addRow(row));
  ws.eachRow((row) => {
    row.font = { name: "Calibri", size: 11 };
    row.alignment = { vertical: "top", wrapText: true };
    let lines = 1;
    row.eachCell((cell, column) => {
      if (typeof cell.value === "string")
        lines = Math.max(
          lines,
          cell.value
            .split("\n")
            .reduce(
              (n, part) =>
                n +
                Math.max(
                  1,
                  Math.ceil(
                    part.length / Math.max(8, ws.getColumn(column).width - 3),
                  ),
                ),
              0,
            ),
        );
    });
    row.height = Math.min(409, lines * 16 + 8);
  });
  styleHeader(ws.getRow(1));
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, ws.rowCount), column: headers.length },
  };
  return ws;
}
