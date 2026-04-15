export const escapeCsvValue = (value: unknown): string => {
  const text = String(value ?? "")
  if (/[;"\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export const buildCsv = (headers: string[], rows: string[][]): string => {
  const lines = [headers.map(escapeCsvValue).join(";")]

  for (const row of rows) {
    lines.push(row.map(escapeCsvValue).join(";"))
  }

  return `${lines.join("\n")}\n`
}

export const downloadCsvFile = (fileName: string, content: string) => {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}
