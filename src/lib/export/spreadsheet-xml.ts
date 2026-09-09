type SpreadsheetCell = string | number | null | undefined;

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Gera XML Spreadsheet 2003, aberto nativamente pelo Excel/LibreOffice,
 * sem depender de bibliotecas vulneráveis de leitura de XLSX.
 */
export function downloadExcelSpreadsheet(
  rows: SpreadsheetCell[][],
  filename: string,
  sheetName = "Relatório"
) {
  const table = rows
    .map(
      (row) =>
        `<Row>${row
          .map((cell) => {
            const isNumber = typeof cell === "number" && Number.isFinite(cell);
            const type = isNumber ? "Number" : "String";
            const value = cell == null ? "" : String(cell);
            return `<Cell><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>`;
          })
          .join("")}</Row>`
    )
    .join("");

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${escapeXml(sheetName.slice(0, 31))}">
  <Table>${table}</Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".xml") ? filename : `${filename}.xml`;
  anchor.click();
  URL.revokeObjectURL(url);
}
