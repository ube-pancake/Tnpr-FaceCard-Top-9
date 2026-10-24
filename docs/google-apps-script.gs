// Prince of Tennis best face: results collector.
// Paste this into Extensions → Apps Script of your private Google Sheet and deploy it as a web app
// (Execute as: Me, Who has access: Anyone). Each finished sort adds a row to "Results", and the
// "Ranking" tab is rebuilt with the overall leaderboard. Only you can open the sheet.

const RESULTS_SHEET = 'Results'
const RANKING_SHEET = 'Ranking'
const MAX_RANK = 9
const SKIPPED_COLUMN = MAX_RANK + 3 // column L, right after #9
const SKIPPED_HEADER = 'Skipped (Neither)'

function doPost(e) {
  const lock = LockService.getScriptLock()
  lock.waitLock(20000)
  try {
    const data = JSON.parse(e.postData.contents)
    const ranking = Array.isArray(data.ranking) ? data.ranking.slice(0, MAX_RANK) : []
    if (!ranking.length) return reply('empty')

    const results = sheet(RESULTS_SHEET, ['Time', 'Team', ...Array.from({ length: MAX_RANK }, (_, i) => `#${i + 1}`), SKIPPED_HEADER])
    // Sheets made before "Neither" existed have no header for the skipped column yet.
    if (!results.getRange(1, SKIPPED_COLUMN).getValue()) results.getRange(1, SKIPPED_COLUMN).setValue(SKIPPED_HEADER).setFontWeight('bold')
    const names = ranking.map((entry) => text(entry.name, 80))
    while (names.length < MAX_RANK) names.push('')
    const skipped = Array.isArray(data.skipped) ? data.skipped.slice(0, 200).map((name) => text(name, 80)) : []
    const time = new Date(data.time)
    results.appendRow([isNaN(time) ? new Date() : time, text(data.team, 40), ...names, text(skipped.join(', '), 5000)])

    rebuildRanking()
    return reply('ok')
  } finally {
    lock.releaseLock()
  }
}

// Points: #1 gets 9, #2 gets 8 … #9 gets 1. Ties broken by number of #1 finishes.
// "Neither picks" counts how often a character was skipped with the Neither button.
function rebuildRanking() {
  const results = sheet(RESULTS_SHEET)
  const rowCount = results.getLastRow() - 1
  const rows = rowCount > 0 ? results.getRange(2, 3, rowCount, MAX_RANK).getValues() : []
  const skippedCells = rowCount > 0 ? results.getRange(2, SKIPPED_COLUMN, rowCount, 1).getValues() : []
  const stats = {}
  const entryFor = (name) => stats[name] || (stats[name] = { points: 0, firsts: 0, top3: 0, appearances: 0, rankSum: 0, skips: 0 })
  rows.forEach((row) => row.forEach((name, i) => {
    if (!name) return
    const entry = entryFor(name)
    entry.points += MAX_RANK - i
    entry.appearances += 1
    entry.rankSum += i + 1
    if (i === 0) entry.firsts += 1
    if (i < 3) entry.top3 += 1
  }))
  skippedCells.forEach(([cell]) => String(cell || '').split(',').map((name) => name.trim()).filter(Boolean).forEach((name) => { entryFor(name).skips += 1 }))

  const columns = ['Rank', 'Character', 'Points', '#1 finishes', 'Top 3 finishes', 'Top 9 finishes', 'Average rank', 'Neither picks']
  const table = Object.keys(stats)
    .map((name) => [name, stats[name]])
    .sort((a, b) => b[1].points - a[1].points || b[1].firsts - a[1].firsts || a[1].skips - b[1].skips)
    .map(([name, s], i) => [i + 1, name, s.points, s.firsts, s.top3, s.appearances, s.appearances ? Math.round((s.rankSum / s.appearances) * 10) / 10 : '', s.skips])

  const ranking = sheet(RANKING_SHEET)
  ranking.clear()
  ranking.appendRow(columns)
  ranking.getRange(1, 1, 1, columns.length).setFontWeight('bold')
  if (table.length) ranking.getRange(2, 1, table.length, columns.length).setValues(table)
  ranking.setFrozenRows(1)
  ranking.getRange('A1').setNote(`Updated ${new Date().toLocaleString()} from ${rows.length} results`)
}

function sheet(name, header) {
  const book = SpreadsheetApp.getActiveSpreadsheet()
  let tab = book.getSheetByName(name)
  if (!tab) {
    tab = book.insertSheet(name)
    if (header) {
      tab.appendRow(header)
      tab.getRange(1, 1, 1, header.length).setFontWeight('bold')
      tab.setFrozenRows(1)
    }
  }
  return tab
}

// The web app is open to anyone, so store every value as plain text: a leading ' stops Sheets
// from running something like "=IMPORTXML(...)" as a formula.
function text(value, maxLength) {
  const cleaned = String(value == null ? '' : value).replace(/[\r\n\t]+/g, ' ').trim().slice(0, maxLength)
  return /^[=+\-@]/.test(cleaned) ? `'${cleaned}` : cleaned
}

function reply(message) {
  return ContentService.createTextOutput(message)
}
