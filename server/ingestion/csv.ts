// Minimal CSV parser shared by both ingestion sources. Handles the plain,
// unquoted comma-separated shape both source files actually use — neither
// the auction-value nor the bye-week CSV has embedded commas or quoted
// fields, so a full RFC 4180 parser (or a csv-parse dependency) would buy
// nothing here (CLAUDE.md: do not introduce unnecessary dependencies).

export function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.split(',').map((cell) => cell.trim()))
}
