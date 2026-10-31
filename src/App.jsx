import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { activeSchools, players, schoolMap } from './data.js'
import { TOP_COUNT, canSkip, choose, chooseNeither, currentPair, fillRanking, progress, startSort } from './sorter.js'
import { frameFor, layoutFor, toStyle } from './framing.js'
import FrameEditor from './FrameEditor.jsx'
import { fetchPlayCount, sendResult } from './results.js'
import { Accented, LangContext, useT } from './i18n.jsx'

const playerMap = Object.fromEntries(players.map((player) => [player.id, player]))
const SAVE_KEY = 'favorite-faces-top9'
const LANG_KEY = 'favorite-faces-lang'
const THEME_KEY = 'favorite-faces-theme'
const TEAM_TIP_KEY = 'favorite-faces-team-tip'
const WAVEBOX_URL = 'https://wavebox.me/wave/6vf81qelg8m318zr/'
const GITHUB_URL = 'https://github.com/ube-pancake'
// Where the QR code on saved images points. Fixed, so images saved while testing locally point to the live site too.
const SITE_URL = 'https://ube-pancake.github.io/Tnpr-FaceCard-Top-9/'
const ALL_TEAMS = activeSchools.map((school) => school.id)

// A sort covers a list of team ids, in picker order. Saves from before mixing teams have a single
// `team` that's an id or 'all'.
const normalizeTeams = (value) => {
  const list = value === 'all' ? ALL_TEAMS : Array.isArray(value) ? value : [value]
  return ALL_TEAMS.filter((id) => list.includes(id))
}
const isAllTeams = (teams) => teams.length === ALL_TEAMS.length
const playersFor = (teams) => players.filter((player) => teams.includes(player.schoolId))
const idsFor = (teams) => playersFor(teams).map((player) => player.id)
// English label for the Google Sheet, whatever the page language.
const sheetLabel = (teams) => (isAllTeams(teams) ? 'All teams' : teams.map((id) => schoolMap[id].name).join(' + '))

const readPref = (key) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
const writePref = (key, value) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    // storage unavailable
  }
}

const loadSaved = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY))
    const teams = normalizeTeams(saved?.teams ?? saved?.team)
    if (!teams.length || !saved.history?.length) return null
    // A save from before characters were added, removed or renamed can't be resumed safely.
    const ids = idsFor(teams)
    const known = (id) => playerMap[id]
    const matches = (state) =>
      state.lostTo &&
      Object.keys(state.lostTo).length === ids.length &&
      ids.every((id) => state.lostTo[id]) &&
      [state.round, state.next, state.ranked, state.skipped || []].every((list) => Array.isArray(list) && list.every(known))
    if (saved.history.every(matches)) return { teams, history: saved.history }
  } catch {
    // ignore unreadable save data
  }
  return null
}

const sourcesFor = (player) => (player.image ? [player.image] : [])

// Size of every photo that has finished loading once. A card needs the size to place the photo, so
// knowing it up front lets an already-downloaded photo show on the card's very first frame.
const photoSizes = {}
const rememberSize = (src, img) => {
  photoSizes[src] = { w: img.naturalWidth, h: img.naturalHeight }
  return photoSizes[src]
}

// aspect is the box's width / height: 4:5 cards by default, 1 for the square result grid.
function Portrait({ player, aspect = 0.8, frame, className = '' }) {
  const sources = sourcesFor(player)
  const [index, setIndex] = useState(0)
  const [size, setSize] = useState(() => photoSizes[sources[0]] || null)
  const school = schoolMap[player.schoolId]
  const framing = frame || frameFor(player.id)
  const layout = size ? toStyle(layoutFor(framing, size.w, size.h, aspect)) : null
  // Initials on the team color only when there is no photo to show. A photo that is still loading
  // gets a plain tile, so slow phones don't flash colored letters before every pair.
  const failed = index >= sources.length

  return (
    <div
      className={`portrait${failed ? ' no-photo' : ''} ${className}`}
      style={{ '--team': school.color, '--accent': school.accent, '--pad': `${100 / aspect}%`, aspectRatio: aspect }}
      role="img"
      aria-label={player.name}
    >
      {failed ? (
        <span className="monogram">{initialsOf(player)}</span>
      ) : (
        <>
          {framing.fit && layout && <img className="backdrop" src={sources[index]} alt="" />}
          <img
            key={sources[index]}
            src={sources[index]}
            alt=""
            className={layout ? 'loaded' : ''}
            style={layout || undefined}
            onLoad={(event) => setSize(rememberSize(sources[index], event.target))}
            onError={() => setIndex((current) => current + 1)}
          />
        </>
      )}
    </div>
  )
}

function TeamCheckbox({ checked, mixed, color, label, count, onChange }) {
  return (
    <label className={`team${checked ? ' active' : ''}`}>
      <input type="checkbox" checked={checked} onChange={onChange} ref={(input) => { if (input) input.indeterminate = Boolean(mixed) }} />
      <i className={`check${mixed ? ' mixed' : ''}`} style={{ '--team': color }} aria-hidden="true" />
      <span>{label}</span>
      <small>{count}</small>
    </label>
  )
}

function Intro({ onStart, resumeTeams, onResume, onEditFraming }) {
  const { t, teamName, teamsLabel } = useT()
  const [teams, setTeams] = useState(ALL_TEAMS)
  const pool = playersFor(teams)
  const preview = useMemo(() => [...playersFor(teams)].sort(() => Math.random() - 0.5).slice(0, 9), [teams.join()])
  const topCount = Math.min(TOP_COUNT, pool.length)
  const all = isAllTeams(teams)
  const toggle = (id) => setTeams((current) => normalizeTeams(current.includes(id) ? current.filter((team) => team !== id) : [...current, id]))
  const [warnSmall, setWarnSmall] = useState(false)
  const start = () => (pool.length < TOP_COUNT ? setWarnSmall(true) : onStart(teams))
  // Shown until it's dismissed once on this device.
  const [showTip, setShowTip] = useState(() => readPref(TEAM_TIP_KEY) !== 'seen')
  const closeTip = () => {
    writePref(TEAM_TIP_KEY, 'seen')
    setShowTip(false)
  }

  return (
    <main className="screen intro">
      {showTip && (
        <div className="team-tip" role="note">
          <p>{t.teamTip}</p>
          <button onClick={closeTip}>{t.teamTipClose}</button>
        </div>
      )}
      <nav className="teams" aria-label={t.chooseTeam}>
        <p className="teams-title">{t.sortByTeam}</p>
        <TeamCheckbox
          checked={all}
          mixed={!all && teams.length > 0}
          color="var(--violet)"
          label={t.allTeams}
          count={players.length}
          onChange={() => setTeams(all ? [] : ALL_TEAMS)}
        />
        {activeSchools.map((school) => (
          <TeamCheckbox
            key={school.id}
            checked={teams.includes(school.id)}
            color={school.color}
            label={teamName(school.id)}
            count={playersFor([school.id]).length}
            onChange={() => toggle(school.id)}
          />
        ))}
        <button className="clear" onClick={() => setTeams([])} disabled={!teams.length}>{t.clearSelection}</button>
      </nav>
      <section className="intro-main">
        <p className="eyebrow">{t.brand}{teams.length > 0 && !all && ` · ${teamsLabel(teams)}`}</p>
        <h1><Accented parts={t.title(topCount || TOP_COUNT)} /></h1>
        <p className="sub">{t.sub}</p>
        <button className="primary start-top" onClick={start} disabled={!pool.length}>{t.start}</button>
        <div className="grid3 preview">
          {preview.map((player) => <Portrait key={player.id} player={player} />)}
          {!preview.length && <p className="pick-hint">{t.pickTeam}</p>}
        </div>
        <p className="count">{pool.length ? t.count(topCount, pool.length, !all && teamsLabel(teams)) : t.pickTeam}</p>
        {onResume && <button className="link" onClick={onResume}>{t.resume(teamsLabel(resumeTeams))}</button>}
        {import.meta.env.DEV && <button className="link" onClick={onEditFraming}>Adjust photo framing (local only)</button>}
      </section>
      {warnSmall && <SmallPoolWarning count={pool.length} onStart={() => onStart(teams)} onClose={() => setWarnSmall(false)} />}
    </main>
  )
}

// Not a lock: a short list still works, it just can't fill the 3×3 result grid.
function SmallPoolWarning({ count, onStart, onClose }) {
  const { t } = useT()
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={t.smallPoolTitle} onClick={(event) => event.stopPropagation()}>
        <h2>{t.smallPoolTitle}</h2>
        <p>{t.smallPoolText(count)}</p>
        <button className="primary" onClick={onStart} autoFocus>{t.smallPoolStart}</button>
        <button className="secondary" onClick={onClose}>{t.smallPoolBack}</button>
      </div>
    </div>
  )
}

const TAP_GUARD_MS = 400

function Matchup({ state, history, count, teams, onPick, onNeither, canNeither, onBack, onHome }) {
  const { t, nameOf, altNameOf, teamName, teamsLabel } = useT()
  const pair = currentPair(state)
  // The estimate of picks left can rise when a new round starts or "Neither" brings earlier losers
  // back, so show the best value reached anywhere in the saved history. Working it out from the
  // history (not from memory) keeps it after a reload or Resume, and Back still lowers it.
  const percent = Math.max(...history.map((step) => progress(step, count)))

  // The next pair appears where the last tap landed, so a double tap (or one registered twice by a
  // slow phone) would pick a face nobody saw. Ignore taps until the new pair has been on screen briefly.
  const shownAt = useRef(0)
  useEffect(() => {
    shownAt.current = performance.now()
  }, [pair.join()])
  const tap = (action) => () => {
    if (performance.now() - shownAt.current < TAP_GUARD_MS) return
    action()
  }

  useEffect(() => {
    const onKey = (event) => {
      // Held-down keys and shortcuts like Alt+← (browser back) shouldn't count as picks.
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return
      if (document.querySelector('[aria-modal="true"]')) return
      if (event.key === 'ArrowLeft') onPick(0)
      if (event.key === 'ArrowRight') onPick(1)
      if (event.key === 'ArrowDown' || event.key === 'n' || event.key === 'N') onNeither()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onPick, onNeither])

  return (
    <main className="screen">
      <div className="topbar">
        <button className="home" onClick={onHome}>{t.home}</button>
        <span>{teamsLabel(teams)}</span>
      </div>
      <div className="progress"><span>{percent}%</span><div className="bar"><i style={{ width: `${percent}%` }} /></div></div>
      <h2>{t.question}</h2>
      <div className="duel">
        {pair.map((id, side) => {
          const player = playerMap[id]
          return (
            <button key={id} className="card" onClick={tap(() => onPick(side))}>
              <Portrait player={player} />
              <span className="name">{nameOf(player)}</span>
              <span className="meta">{altNameOf(player)}</span>
              <span className="meta">{teamName(player.schoolId)}</span>
            </button>
          )
        })}
      </div>
      <div className="choices">
        <button className="choice back" onClick={onBack} disabled={history.length < 2}>{t.back}</button>
        <button className="choice neither" onClick={tap(onNeither)} disabled={!canNeither}>
          <span className="choice-hint">{t.neitherHint}</span> {t.neither}
        </button>
      </div>
      {!canNeither && <p className="skip-off">{t.skipOff(Math.min(TOP_COUNT, count))}</p>}
      <p className="keys">{t.keys}</p>
    </main>
  )
}

// Rank index shown in each grid cell, left to right: 4 5 6 / 2 1 3 / 7 8 9, so #1 sits in the middle.
const GRID_ORDER = [3, 4, 5, 1, 0, 2, 6, 7, 8]

const initialsOf = (player) => {
  const parts = player.name.replace(/\./g, '').split(/\s+/)
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase()
}

const loadPortrait = (player) => new Promise((resolve) => {
  const sources = sourcesFor(player)
  const tryLoad = (n) => {
    if (n >= sources.length) return resolve(null)
    const img = new Image()
    img.onload = () => {
      rememberSize(sources[n], img)
      resolve(img)
    }
    img.onerror = () => tryLoad(n + 1)
    img.src = sources[n]
  }
  tryLoad(0)
})

// Some in-app browsers (e.g. Messenger on Android) report a fine pointer, so check every touch signal.
const isTouchDevice = () =>
  window.matchMedia('(pointer: coarse), (any-pointer: coarse)').matches || navigator.maxTouchPoints > 0

// Browsers built into apps silently drop downloads and often fake the share sheet.
const isInAppBrowser = () => /FBAN|FBAV|FB_IAB|FBIOS|FB4A|Messenger|Instagram|Line\/|Twitter|MicroMessenger|KAKAOTALK|TikTok|musical_ly/i.test(navigator.userAgent)

// ctx.roundRect is missing on iOS 15 and older, so draw rounded corners by hand there.
const roundRect = (ctx, x, y, w, h, r) => {
  if (ctx.roundRect) return ctx.roundRect(x, y, w, h, r)
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// Draws a scannable QR code (with its white quiet zone) into a size×size square.
const drawQrCode = (ctx, text, x, y, size) => {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' })
  const quiet = 2
  const cell = size / (modules.size + quiet * 2)
  ctx.fillStyle = '#fff'
  ctx.fillRect(x, y, size, size)
  ctx.fillStyle = '#16161d'
  for (let row = 0; row < modules.size; row += 1) {
    for (let col = 0; col < modules.size; col += 1) {
      // Overlap by a hair so cells don't show seams when the image is scaled.
      if (modules.get(row, col)) ctx.fillRect(x + (col + quiet) * cell, y + (row + quiet) * cell, cell + 0.5, cell + 0.5)
    }
  }
}

// Shrinks the font until the text fits, so long names don't spill into the next cell.
const fitText = (ctx, text, x, y, maxWidth, weight, size) => {
  let fontSize = size
  ctx.font = `${weight} ${fontSize}px sans-serif`
  while (fontSize > 14 && ctx.measureText(text).width > maxWidth) {
    fontSize -= 1
    ctx.font = `${weight} ${fontSize}px sans-serif`
  }
  ctx.fillText(text, x, y)
}

// `picked` is how many of `ranked` came from real picks; the rest were brought back to fill the list.
function Result({ ranked, picked, teams, onRestart }) {
  const { lang, t, nameOf, altNameOf, teamName, teamsLabel } = useT()
  const [notice, setNotice] = useState('')
  // Smaller teams can't fill the 3×3 layout, so they're shown in plain rank order.
  const order = ranked.length >= GRID_ORDER.length ? GRID_ORDER : ranked.map((_, rank) => rank)
  const cells = order.map((rank) => ({ rank, player: playerMap[ranked[rank]] }))
  const rows = Math.ceil(cells.length / 3)
  const subtitle = isAllTeams(teams) ? t.brand : `${t.brand} · ${teamsLabel(teams)}`

  // The saved image is always light, whatever the page theme, so it looks the same when shared.
  const renderImage = async () => {
    const size = 360
    const gap = 24
    const pad = 48
    const label = 84
    const top = 190
    const canvas = document.createElement('canvas')
    canvas.width = pad * 2 + size * 3 + gap * 2
    const credits = 210
    canvas.height = top + (size + label + gap) * rows + credits
    const ctx = canvas.getContext('2d')
    const gradient = (x, y, w, h) => {
      const fill = ctx.createLinearGradient(x, y, x + w, y + h)
      fill.addColorStop(0, '#7a6cf0')
      fill.addColorStop(1, '#f0389b')
      return fill
    }
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#16161d'
    ctx.font = '700 34px sans-serif'
    ctx.fillText(subtitle, canvas.width / 2, 72)
    ctx.font = '800 60px sans-serif'
    ctx.fillText(t.imageTitle(ranked.length), canvas.width / 2, 145)

    const images = await Promise.all(cells.map(({ player }) => loadPortrait(player)))
    cells.forEach(({ rank, player }, i) => {
      const x = pad + (i % 3) * (size + gap)
      const y = top + Math.floor(i / 3) * (size + label + gap)
      const school = schoolMap[player.schoolId]
      const img = images[i]
      const first = rank === 0

      if (first) {
        ctx.save()
        ctx.shadowColor = 'rgba(240, 56, 155, .55)'
        ctx.shadowBlur = 36
        ctx.fillStyle = gradient(x, y, size, size)
        ctx.beginPath()
        roundRect(ctx, x - 8, y - 8, size + 16, size + 16, 28)
        ctx.fill()
        ctx.restore()
      }

      ctx.save()
      ctx.beginPath()
      roundRect(ctx, x, y, size, size, 22)
      ctx.clip()
      if (img) {
        const frame = frameFor(player.id)
        const draw = (box) => ctx.drawImage(img, x + box.left * size, y + box.top * size, box.width * size, box.height * size)
        if (frame.fit) {
          ctx.filter = 'blur(18px) brightness(.85)'
          draw(layoutFor({ ...frame, fit: false, zoom: 1.15 }, img.width, img.height, 1))
          ctx.filter = 'none'
        }
        draw(layoutFor(frame, img.width, img.height, 1))
      } else {
        ctx.fillStyle = school.color
        ctx.fillRect(x, y, size, size)
        ctx.fillStyle = school.accent
        ctx.font = '800 120px sans-serif'
        ctx.fillText(initialsOf(player), x + size / 2, y + size / 2 + 40)
      }
      ctx.restore()

      const rankLabel = t.rank(rank + 1)
      const pillW = first ? 96 : 76
      ctx.fillStyle = first ? gradient(x + 16, y + 16, pillW, 44) : 'rgba(255,255,255,.95)'
      ctx.beginPath()
      roundRect(ctx, x + 16, y + 16, pillW, 44, 22)
      ctx.fill()
      ctx.fillStyle = first ? '#fff' : '#16161d'
      fitText(ctx, rankLabel, x + 16 + pillW / 2, y + 47, pillW - 12, 800, 26)

      ctx.fillStyle = '#16161d'
      fitText(ctx, nameOf(player), x + size / 2, y + size + 40, size, 800, first ? 30 : 26)
      ctx.fillStyle = '#8a8a96'
      fitText(ctx, teamName(player.schoolId), x + size / 2, y + size + 70, size, 500, 20)
    })

    // Credits strip: "sorter made by ube" and a QR code back to the sorter, so shared images bring people here.
    const stripTop = top + (size + label + gap) * rows + 10
    const qrSize = 160
    const qrX = canvas.width - pad - qrSize
    const qrY = stripTop + 20
    ctx.fillStyle = '#ececf1'
    ctx.fillRect(pad, stripTop, canvas.width - pad * 2, 2)
    drawQrCode(ctx, SITE_URL, qrX, qrY, qrSize)
    ctx.textAlign = 'left'
    const textWidth = qrX - pad - 24
    ctx.fillStyle = '#16161d'
    fitText(ctx, t.imageCredit, pad, qrY + 52, textWidth, 800, 34)
    ctx.fillStyle = '#8a8a96'
    fitText(ctx, t.imageScan, pad, qrY + 98, textWidth, 500, 24)
    ctx.fillStyle = '#5a4ee0'
    fitText(ctx, SITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, ''), pad, qrY + 138, textWidth, 700, 22)
    ctx.textAlign = 'center'

    return canvas
  }

  // Build the image as soon as the result shows. Phones only allow saving or sharing straight
  // from a tap, so the tap must not wait on loading photos. Rebuilt when the language changes.
  const fileName = `my-top-${ranked.length}${isAllTeams(teams) ? '' : `-${teams.join('-')}`}.png`
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState(false)
  useEffect(() => {
    let url = null
    let cancelled = false
    setImage(null)
    renderImage()
      .then((canvas) => new Promise((resolve) => canvas.toBlob(resolve, 'image/png')))
      .then((blob) => {
        if (cancelled) return
        // toBlob gives null when the phone runs out of memory.
        if (!blob) throw new Error('no image')
        url = URL.createObjectURL(blob)
        // A data URL for the press-and-hold view: some in-app browsers can't save blob: images.
        const reader = new FileReader()
        reader.onload = () => {
          if (!cancelled) setImage({ url, dataUrl: reader.result, file: new File([blob], fileName, { type: 'image/png' }) })
        }
        reader.readAsDataURL(blob)
      })
      .catch(() => {
        if (!cancelled) setNotice(t.imageFailed)
      })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [lang])

  // "Save image" always opens a preview first; saving happens from buttons inside it.
  const openPreview = () => {
    if (!image) return
    setNotice('')
    setPreview(true)
  }
  const closePreview = () => setPreview(false)
  useEffect(() => {
    if (!preview) return undefined
    const onKey = (event) => { if (event.key === 'Escape') closePreview() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [preview])

  // The hint and buttons take a different height on every screen (touch screens add the
  // press-and-hold hint), so measure them and give the image exactly the height that is left.
  const panelRef = useRef(null)
  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!panel) return undefined
    const fit = () => {
      const overlay = getComputedStyle(panel.parentElement)
      const room = panel.parentElement.clientHeight - parseFloat(overlay.paddingTop) - parseFloat(overlay.paddingBottom)
      const others = panel.scrollHeight - panel.querySelector('.save-image img').offsetHeight
      panel.style.setProperty('--image-room', `${Math.floor(room - others)}px`)
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [preview, notice, lang])

  // In-app browsers (Messenger, Instagram…) drop downloads and fake sharing, so there the
  // preview only offers press-and-hold. Phones with a share sheet get "Save / Share".
  const inApp = isInAppBrowser()
  const canShare = !inApp && isTouchDevice() && Boolean(image && navigator.canShare?.({ files: [image.file] }))
  const shareImage = async () => {
    try {
      await navigator.share({ files: [image.file], title: t.imageTitle(ranked.length) })
    } catch (error) {
      if (error.name !== 'AbortError') setNotice(t.pressHoldShort)
    }
  }
  const downloadImage = () => {
    const link = document.createElement('a')
    link.download = fileName
    link.href = image.url
    document.body.appendChild(link)
    link.click()
    link.remove()
    setNotice(isTouchDevice() ? t.pressHoldShort : t.downloadStarted)
  }

  return (
    <main className="screen">
      <p className="eyebrow">{t.yourResult}{!isAllTeams(teams) && ` · ${teamsLabel(teams)}`}</p>
      <h1><Accented parts={t.resultTitle(ranked.length)} /></h1>
      {picked < ranked.length && <p className="filled-note">{t.filledNote(picked, ranked.length)}</p>}
      <div className="grid3 result">
        {cells.map(({ rank, player }) => (
          <figure key={player.id} className={rank === 0 ? 'first' : ''}>
            <div className="frame">
              <Portrait player={player} aspect={1} />
              <b className="rank">{t.rank(rank + 1)}</b>
            </div>
            <figcaption>
              <span className="name">{nameOf(player)}</span>
              <span className="meta">{teamName(player.schoolId)}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="actions">
        <button className="primary" onClick={openPreview} disabled={!image}>{image ? t.save : t.preparing}</button>
        <button className="secondary" onClick={onRestart}>{t.startOver}</button>
      </div>
      <p className="notice" role="status">{notice}</p>
      <section className="ranking">
        <h2>{`TOP ${ranked.length}`}</h2>
        <ol>
          {ranked.map((id, i) => {
            const player = playerMap[id]
            return (
              <li key={id}>
                <b>{t.rank(i + 1)}</b>
                <span>
                  <span className="name">{nameOf(player)}<small>{altNameOf(player)}</small></span>
                  <span className="meta">{teamName(player.schoolId)}</span>
                </span>
              </li>
            )
          })}
        </ol>
      </section>
      {preview && image && (
        <div className="save-preview" role="dialog" aria-modal="true" aria-label={t.saveDialog} onClick={closePreview}>
          <div className="save-panel" ref={panelRef} onClick={(event) => event.stopPropagation()}>
            <h2>{t.previewTitle}</h2>
            <div className="save-image">
              <img src={image.dataUrl} alt={t.imageTitle(ranked.length)} />
            </div>
            {isTouchDevice() && <p className="hint">{t.pressHold}</p>}
            {inApp && <p className="hint tip">{t.inAppTip}</p>}
            <div className="save-actions">
              {canShare && <button className="primary" onClick={shareImage}>{t.share}</button>}
              {!canShare && !inApp && <button className="primary" onClick={downloadImage}>{t.download}</button>}
              <button className="secondary" onClick={closePreview}>{t.close}</button>
            </div>
            <p className="notice" role="status">{notice}</p>
          </div>
        </div>
      )}
    </main>
  )
}

function Empty({ teams, onUndo, onRestart }) {
  const { t, teamsLabel } = useT()
  return (
    <main className="screen">
      <p className="eyebrow">{t.yourResult}{!isAllTeams(teams) && ` · ${teamsLabel(teams)}`}</p>
      <h1>{t.noFaces}</h1>
      <p className="sub">{t.noFacesSub}</p>
      <div className="actions">
        <button className="primary" onClick={onUndo}>{t.undo}</button>
        <button className="secondary" onClick={onRestart}>{t.startOver}</button>
      </div>
    </main>
  )
}

// First screen on every visit: asks for photos of the characters still missing one.
function Welcome({ onContinue }) {
  const { t } = useT()
  return (
    <main className="screen welcome">
      <p className="eyebrow">{t.brand}</p>
      <h1>{t.welcomeTitle}</h1>
      <p className="sub">{t.welcomeText(<a href={WAVEBOX_URL} target="_blank" rel="noopener noreferrer">Wavebox</a>)}</p>
      <div className="actions">
        <button className="primary" onClick={onContinue} autoFocus>{t.welcomeContinue}</button>
      </div>
    </main>
  )
}

function About({ onClose }) {
  const { t } = useT()
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={t.aboutTitle} onClick={(event) => event.stopPropagation()}>
        <h2>{t.aboutTitle}</h2>
        <p>{t.madeBy} <b>ube</b></p>
        <p><a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">github.com/ube-pancake</a></p>
        <button className="secondary" onClick={onClose}>{t.close}</button>
      </div>
    </div>
  )
}

function Updates({ onClose }) {
  const { lang, t } = useT()
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const dateFormat = new Intl.DateTimeFormat(lang === 'ja' ? 'ja-JP' : 'en-US', { year: 'numeric', month: lang === 'ja' ? 'long' : 'short', day: 'numeric', timeZone: 'UTC' })
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal updates" role="dialog" aria-modal="true" aria-label={t.updatesTitle} onClick={(event) => event.stopPropagation()}>
        <h2>{t.updatesTitle}</h2>
        {t.updatesList.map(({ date, items }) => (
          <section key={date}>
            <h3>{dateFormat.format(new Date(date))}</h3>
            <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        ))}
        <button className="secondary" onClick={onClose}>{t.close}</button>
      </div>
    </div>
  )
}

// Updates, About, Contact, language and theme, shown at the top of every screen.
function Preferences({ theme, onToggleTheme, onToggleLang, onAbout, onUpdates }) {
  const { t } = useT()
  const dark = theme === 'dark'
  return (
    <div className="prefs">
      <button className="pref" onClick={onUpdates}>{t.updates}</button>
      <button className="pref" onClick={onAbout}>{t.about}</button>
      <a className="pref" href={WAVEBOX_URL} target="_blank" rel="noopener noreferrer">{t.contact}</a>
      <button className="pref" onClick={onToggleLang} aria-label={t.otherLanguageLabel}>{t.otherLanguage}</button>
      <button className="pref" onClick={onToggleTheme} aria-pressed={dark} aria-label={dark ? t.lightMode : t.darkMode}>
        {dark ? '☀' : '☾'} <span>{dark ? t.lightMode : t.darkMode}</span>
      </button>
    </div>
  )
}

function Footer() {
  const { t } = useT()
  const [playCount, setPlayCount] = useState(null)
  useEffect(() => {
    let cancelled = false
    fetchPlayCount().then((count) => { if (!cancelled) setPlayCount(count) })
    return () => { cancelled = true }
  }, [])
  return (
    <footer className="footer">
      {playCount && <p className="play-count">{t.playCount(playCount)}</p>}
      <p>{t.footer}</p>
      <p>🎾 <a href={WAVEBOX_URL} target="_blank" rel="noopener noreferrer">wavebox</a> 🎾</p>
    </footer>
  )
}

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')

// The device's light/dark setting, kept up to date if it changes while the page is open.
const useSystemTheme = () => {
  const [system, setSystem] = useState(darkQuery.matches ? 'dark' : 'light')
  useEffect(() => {
    const onChange = (event) => setSystem(event.matches ? 'dark' : 'light')
    darkQuery.addEventListener?.('change', onChange)
    return () => darkQuery.removeEventListener?.('change', onChange)
  }, [])
  return system
}

export default function App() {
  const [session, setSession] = useState(null)
  const [saved, setSaved] = useState(loadSaved)
  const [editingFraming, setEditingFraming] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [showUpdates, setShowUpdates] = useState(false)
  const [welcomed, setWelcomed] = useState(false)
  const [lang, setLang] = useState(() => (readPref(LANG_KEY) === 'ja' ? 'ja' : 'en'))
  // A theme chosen with the toggle wins; until then the page follows the device.
  const [chosenTheme, setChosenTheme] = useState(() => {
    const stored = readPref(THEME_KEY)
    return stored === 'dark' || stored === 'light' ? stored : null
  })
  const systemTheme = useSystemTheme()
  const theme = chosenTheme || systemTheme
  const history = session?.history
  const state = history?.[history.length - 1]
  const ids = useMemo(() => (session ? idsFor(session.teams) : []), [session?.teams.join()])

  useEffect(() => {
    document.documentElement.lang = lang
    writePref(LANG_KEY, lang)
  }, [lang])
  useEffect(() => {
    if (chosenTheme) document.documentElement.dataset.theme = chosenTheme
    else delete document.documentElement.dataset.theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#101016' : '#ffffff')
  }, [chosenTheme, theme])
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    writePref(THEME_KEY, next)
    setChosenTheme(next)
  }

  useEffect(() => {
    try {
      if (!session) return
      if (state.done) localStorage.removeItem(SAVE_KEY)
      else localStorage.setItem(SAVE_KEY, JSON.stringify(session))
    } catch {
      // storage unavailable
    }
  }, [session, state])

  // Download the whole team's photos up front so fast pickers never see a card still loading.
  useEffect(() => {
    if (session) playersFor(session.teams).forEach((player) => loadPortrait(player))
  }, [session?.teams.join()])

  // Count each finished sort once in the overall ranking (always in English, whatever the page language).
  const sentRef = useRef(null)
  useEffect(() => {
    // An empty result can still be undone, so only finished rankings with someone in them count.
    if (!state?.done || !state.ranked.length || sentRef.current === state) return
    sentRef.current = state
    sendResult({
      team: sheetLabel(session.teams),
      ranking: state.ranked.slice(0, TOP_COUNT).map((id, i) => {
        const player = playerMap[id]
        return { rank: i + 1, name: player.name, nameJa: player.nameJa, school: schoolMap[player.schoolId].name }
      }),
      skipped: (state.skipped || []).map((id) => playerMap[id].name),
    })
  }, [session, state])

  const updateHistory = (update) => setSession((current) => ({ ...current, history: update(current.history) }))
  const pick = (side) => updateHistory((current) => {
    const latest = current[current.length - 1]
    return latest.done ? current : [...current, choose(latest, ids, side)]
  })
  const pickNeither = () => updateHistory((current) => {
    const latest = current[current.length - 1]
    return latest.done || !canSkip(latest, ids) ? current : [...current, chooseNeither(latest, ids)]
  })
  const restart = () => {
    setSaved(loadSaved())
    setSession(null)
  }

  let screen
  if (editingFraming) {
    screen = <FrameEditor Portrait={Portrait} onClose={() => setEditingFraming(false)} />
  } else if (!welcomed) {
    screen = <Welcome onContinue={() => setWelcomed(true)} />
  } else if (!session) {
    screen = (
      <Intro
        onStart={(teams) => setSession({ teams, history: [startSort(idsFor(teams))] })}
        resumeTeams={saved?.teams}
        onResume={saved ? () => setSession(saved) : null}
        onEditFraming={() => setEditingFraming(true)}
      />
    )
  } else if (state.done && !state.ranked.length) {
    screen = <Empty teams={session.teams} onUndo={() => updateHistory((current) => current.slice(0, -1))} onRestart={restart} />
  } else if (state.done) {
    screen = <Result ranked={fillRanking(state, ids)} picked={Math.min(state.ranked.length, TOP_COUNT)} teams={session.teams} onRestart={restart} />
  } else {
    screen = (
      <Matchup
        state={state}
        history={history}
        count={ids.length}
        teams={session.teams}
        onPick={pick}
        onNeither={pickNeither}
        canNeither={canSkip(state, ids)}
        onBack={() => updateHistory((current) => current.slice(0, -1))}
        onHome={restart}
      />
    )
  }

  return (
    <LangContext.Provider value={lang}>
      <Preferences
        theme={theme}
        onToggleTheme={toggleTheme}
        onToggleLang={() => setLang(lang === 'ja' ? 'en' : 'ja')}
        onAbout={() => setShowAbout(true)}
        onUpdates={() => setShowUpdates(true)}
      />
      {screen}
      <Footer />
      {showAbout && <About onClose={() => setShowAbout(false)} />}
      {showUpdates && <Updates onClose={() => setShowUpdates(false)} />}
    </LangContext.Provider>
  )
}
