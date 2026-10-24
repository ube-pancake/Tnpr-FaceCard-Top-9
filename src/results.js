// Web app URL from deploying docs/google-apps-script.gs (ends in /exec). Leave empty to turn collection off.
export const RESULTS_URL = 'https://script.google.com/macros/s/AKfycby-i4MlkJqsYTB0NIm6IVFQA17vPan0csLWhWLRpkrdVlYjdsNeCglPr6shFva8J33udg/exec'

// Sends one finished ranking to the Google Sheet. Only the live site sends, so local test runs
// don't count. Failures are ignored; the result screen never waits on this.
export const sendResult = ({ team, ranking, skipped = [] }) => {
  if (!RESULTS_URL || !import.meta.env.PROD) return
  const body = JSON.stringify({ team, time: new Date().toISOString(), ranking, skipped })
  // text/plain + no-cors avoids a CORS preflight, which Apps Script doesn't answer.
  fetch(RESULTS_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body }).catch(() => {})
}
