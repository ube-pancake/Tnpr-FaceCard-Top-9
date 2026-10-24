// Prince of Tennis best face: results collector.
// Paste this into Extensions → Apps Script of your private Google Sheet and deploy it as a web app
// (Execute as: Me, Who has access: Anyone). Each finished sort adds a row to "Results", and the
// "Ranking" tab is rebuilt with the overall leaderboard. Only you can open the sheet.

const RESULTS_SHEET = 'Results'
const RANKING_SHEET = 'Ranking'
const MAX_RANK = 9

function doPost(e) {
  const lock = LockService.getScriptLock()
  lock.waitLock(20000)
  try {
    const data = JSON.parse(e.postData.contents)
    const ranking = Array.isArray(data.ranking) ? data.ranking.slice(0, MAX_RANK) : []
    if (!ranking.length) return reply('empty')

    const results = sheet(RESULTS_SHEET, ['Time', 'Team', ...Array.from({ length: MAX_RANK }, (_, i) => `#${i + 1}`)])
    const names = ranking.map((entry) => String(entry.name || '').slice(0, 80))
    while (names.length < MAX_RANK) names.push('')
    results.appendRow([new Date(data.time || Date.now()), String(data.team || '').slice(0, 40), ...names])

    rebuildRanking()
    return reply('ok')
  } finally {
    lock.releaseLock()
  }
}

// Points: #1 gets 9, #2 gets 8 … #9 gets 1. Ties broken by number of #1 finishes.
function rebuildRanking() {
  const results = sheet(RESULTS_SHEET)
  const rows = results.getLastRow() > 1 ? results.getRange(2, 3, results.getLastRow() - 1, MAX_RANK).getValues() : []
  const stats = {}
  rows.forEach((row) => row.forEach((name, i) => {
    if (!name) return
    const entry = stats[name] || (stats[name] = { points: 0, firsts: 0, top3: 0, appearances: 0, rankSum: 0 })
    entry.points += MAX_RANK - i
    entry.appearances += 1
    entry.rankSum += i + 1
    if (i === 0) entry.firsts += 1
    if (i < 3) entry.top3 += 1
  }))

  const table = Object.keys(stats)
    .map((name) => [name, stats[name]])
    .sort((a, b) => b[1].points - a[1].points || b[1].firsts - a[1].firsts)
    .map(([name, s], i) => [i + 1, name, s.points, s.firsts, s.top3, s.appearances, Math.round((s.rankSum / s.appearances) * 10) / 10])

  const ranking = sheet(RANKING_SHEET)
  ranking.clear()
  ranking.appendRow(['Rank', 'Character', 'Points', '#1 finishes', 'Top 3 finishes', 'Top 9 finishes', 'Average rank'])
  ranking.getRange(1, 1, 1, 7).setFontWeight('bold')
  if (table.length) ranking.getRange(2, 1, table.length, 7).setValues(table)
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

function reply(text) {
  return ContentService.createTextOutput(text)
}
