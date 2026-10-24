import { useEffect, useMemo, useRef, useState } from 'react'
import { activeSchools, players, schoolMap } from './data.js'
import { TOP_COUNT, choose, chooseNeither, currentPair, progress, startSort } from './sorter.js'
import { frameFor, layoutFor, toStyle } from './framing.js'
import FrameEditor from './FrameEditor.jsx'
import { sendResult } from './results.js'

const playerMap = Object.fromEntries(players.map((player) => [player.id, player]))
const SAVE_KEY = 'favorite-faces-top9'
const ALL = 'all'

const playersFor = (team) => players.filter((player) => team === ALL || player.schoolId === team)
const idsFor = (team) => playersFor(team).map((player) => player.id)
const teamLabel = (team) => (team === ALL ? 'All teams' : schoolMap[team].name)

const loadSaved = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY))
    const validTeam = saved?.team === ALL || activeSchools.some((school) => school.id === saved?.team)
    if (validTeam && saved.history?.length && saved.history.every((state) => state.lostTo && state.round.every((id) => playerMap[id]))) return saved
  } catch {
    // ignore unreadable save data
  }
  return null
}

const sourcesFor = (player) => [player.image, player.image.replace(/\.webp$/i, '.png'), player.image.replace(/\.webp$/i, '.jpg')]

// aspect is the box's width / height: 4:5 cards by default, 1 for the square result grid.
function Portrait({ player, aspect = 0.8, frame, className = '' }) {
  const [index, setIndex] = useState(0)
  const [size, setSize] = useState(null)
  const sources = sourcesFor(player)
  const school = schoolMap[player.schoolId]
  const framing = frame || frameFor(player.id)
  const layout = size ? toStyle(layoutFor(framing, size.w, size.h, aspect)) : null

  return (
    <div
      className={`portrait ${className}`}
      style={{ '--team': school.color, '--accent': school.accent, '--pad': `${100 / aspect}%`, aspectRatio: aspect }}
      role="img"
      aria-label={player.name}
    >
      <span className="monogram">{initialsOf(player)}</span>
      {index < sources.length && (
        <>
          {framing.fit && layout && <img className="backdrop" src={sources[index]} alt="" />}
          <img
            key={sources[index]}
            src={sources[index]}
            alt=""
            className={layout ? 'loaded' : ''}
            style={layout || undefined}
            onLoad={(event) => setSize({ w: event.target.naturalWidth, h: event.target.naturalHeight })}
            onError={() => setIndex((current) => current + 1)}
          />
        </>
      )}
    </div>
  )
}

function Intro({ onStart, resumeTeam, onResume, onEditFraming }) {
  const [team, setTeam] = useState(ALL)
  const pool = playersFor(team)
  const preview = useMemo(() => [...playersFor(team)].sort(() => Math.random() - 0.5).slice(0, 9), [team])
  const topCount = Math.min(TOP_COUNT, pool.length)
  const options = [{ id: ALL, name: 'All teams', color: null }, ...activeSchools]

  return (
    <main className="screen intro">
      <nav className="teams" aria-label="Choose a team">
        <p className="teams-title">Sort by team</p>
        {options.map((option) => (
          <button
            key={option.id}
            className={`team${team === option.id ? ' active' : ''}`}
            aria-pressed={team === option.id}
            onClick={() => setTeam(option.id)}
          >
            <i style={{ background: option.color || 'linear-gradient(135deg, var(--violet), var(--pink))' }} />
            <span>{option.name}</span>
            <small>{playersFor(option.id).length}</small>
          </button>
        ))}
      </nav>
      <section className="intro-main">
        <p className="eyebrow">Prince of Tennis best face{team !== ALL && ` · ${teamLabel(team)}`}</p>
        <h1><span className="accent">Top {topCount}</span> Faces</h1>
        <p className="sub">Pick the face you like better.</p>
        <div className="grid3 preview">
          {preview.map((player) => <Portrait key={player.id} player={player} />)}
        </div>
        <p className="count">Your Top {topCount} from {pool.length} characters{team !== ALL && ` in ${teamLabel(team)}`}.</p>
        <button className="primary" onClick={() => onStart(team)}>Start →</button>
        {onResume && <button className="link" onClick={onResume}>Resume where I left off ({teamLabel(resumeTeam)})</button>}
        {import.meta.env.DEV && <button className="link" onClick={onEditFraming}>Adjust photo framing (local only)</button>}
      </section>
    </main>
  )
}

function Matchup({ state, history, count, team, onPick, onNeither, onBack, onHome }) {
  const pair = currentPair(state)
  // "Neither" can bring earlier losers back, which would make the estimate dip; only let it
  // go down when the player steps back.
  const best = useRef({ steps: 0, percent: 0 })
  const estimate = progress(state, count)
  const percent = history.length > best.current.steps ? Math.max(best.current.percent, estimate) : estimate
  best.current = { steps: history.length, percent }

  useEffect(() => {
    const onKey = (event) => {
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
        <button className="home" onClick={onHome}>⌂ Home</button>
        <span>{teamLabel(team)}</span>
      </div>
      <div className="progress"><span>{percent}%</span><div className="bar"><i style={{ width: `${percent}%` }} /></div></div>
      <h2>Which face do you like best?</h2>
      <div className="duel">
        {pair.map((id, side) => {
          const player = playerMap[id]
          return (
            <button key={id} className="card" onClick={() => onPick(side)}>
              <Portrait player={player} />
              <span className="name">{player.name}</span>
              <span className="meta">{player.nameJa}</span>
              <span className="meta">{schoolMap[player.schoolId].name}</span>
            </button>
          )
        })}
      </div>
      <div className="choices">
        <button className="choice back" onClick={onBack} disabled={history.length < 2}>← Back</button>
        <button className="choice neither" onClick={onNeither}>
          <span className="choice-hint">Like neither?</span> Skip both ✕
        </button>
      </div>
      <p className="keys">Keyboard: ← left · → right · ↓ neither</p>
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
    img.onload = () => resolve(img)
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

function Result({ ranked, team, onRestart }) {
  const [notice, setNotice] = useState('')
  // Smaller teams can't fill the 3×3 layout, so they're shown in plain rank order.
  const order = ranked.length >= GRID_ORDER.length ? GRID_ORDER : ranked.map((_, rank) => rank)
  const cells = order.map((rank) => ({ rank, player: playerMap[ranked[rank]] }))
  const rows = Math.ceil(cells.length / 3)
  const heading = `Top ${ranked.length}`
  const subtitle = team === ALL ? 'Prince of Tennis best face' : `Prince of Tennis best face · ${teamLabel(team)}`

  const renderImage = async () => {
    const size = 360
    const gap = 24
    const pad = 48
    const label = 84
    const top = 190
    const canvas = document.createElement('canvas')
    canvas.width = pad * 2 + size * 3 + gap * 2
    canvas.height = top + (size + label + gap) * rows + 40
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
    ctx.fillText(`My ${heading} Faces`, canvas.width / 2, 145)

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

      const pillW = first ? 96 : 76
      ctx.fillStyle = first ? gradient(x + 16, y + 16, pillW, 44) : 'rgba(255,255,255,.95)'
      ctx.beginPath()
      roundRect(ctx, x + 16, y + 16, pillW, 44, 22)
      ctx.fill()
      ctx.fillStyle = first ? '#fff' : '#16161d'
      ctx.font = '800 26px sans-serif'
      ctx.fillText(`#${rank + 1}`, x + 16 + pillW / 2, y + 47)

      ctx.fillStyle = '#16161d'
      ctx.font = `800 ${first ? 30 : 26}px sans-serif`
      ctx.fillText(player.name, x + size / 2, y + size + 40)
      ctx.fillStyle = '#8a8a96'
      ctx.font = '500 20px sans-serif'
      ctx.fillText(school.name, x + size / 2, y + size + 70)
    })

    return canvas
  }

  // Build the image as soon as the result shows. Phones only allow saving or sharing straight
  // from a tap, so the tap must not wait on loading photos.
  const fileName = `my-top-${ranked.length}${team === ALL ? '' : `-${team}`}.png`
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState(false)
  useEffect(() => {
    let url = null
    let cancelled = false
    renderImage()
      .then((canvas) => new Promise((resolve) => canvas.toBlob(resolve, 'image/png')))
      .then((blob) => {
        if (cancelled || !blob) return
        url = URL.createObjectURL(blob)
        // A data URL for the press-and-hold view: some in-app browsers can't save blob: images.
        const reader = new FileReader()
        reader.onload = () => {
          if (!cancelled) setImage({ url, dataUrl: reader.result, file: new File([blob], fileName, { type: 'image/png' }) })
        }
        reader.readAsDataURL(blob)
      })
      .catch(() => setNotice('Could not create the image'))
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [])

  const saveImage = async () => {
    if (!image) return
    if (isInAppBrowser()) {
      setPreview(true)
      return
    }
    const shareable = isTouchDevice() && navigator.canShare?.({ files: [image.file] })
    if (shareable) {
      try {
        await navigator.share({ files: [image.file], title: `My ${heading} Faces` })
        setNotice('')
        return
      } catch (error) {
        if (error.name === 'AbortError') return
      }
    }
    if (isTouchDevice()) {
      // Phones without a share sheet often ignore downloads: show the image to long-press.
      setPreview(true)
      return
    }
    const link = document.createElement('a')
    link.download = fileName
    link.href = image.url
    document.body.appendChild(link)
    link.click()
    link.remove()
    setNotice('Download started. Check your Downloads folder.')
  }

  return (
    <main className="screen">
      <p className="eyebrow">Your result{team !== ALL && ` · ${teamLabel(team)}`}</p>
      <h1>My <span className="accent">{heading}</span> Faces</h1>
      <div className="grid3 result">
        {cells.map(({ rank, player }) => (
          <figure key={player.id} className={rank === 0 ? 'first' : ''}>
            <div className="frame">
              <Portrait player={player} aspect={1} />
              <b className="rank">#{rank + 1}</b>
            </div>
            <figcaption>
              <span className="name">{player.name}</span>
              <span className="meta">{schoolMap[player.schoolId].name}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="actions">
        <button className="primary" onClick={saveImage} disabled={!image}>{image ? 'Save image' : 'Preparing image…'}</button>
        <button className="secondary" onClick={onRestart}>Start over</button>
      </div>
      <p className="notice" role="status">{notice}</p>
      <section className="ranking">
        <h2>{heading.toUpperCase()}</h2>
        <ol>
          {ranked.map((id, i) => {
            const player = playerMap[id]
            return (
              <li key={id}>
                <b>#{i + 1}</b>
                <span>
                  <span className="name">{player.name}<small>{player.nameJa}</small></span>
                  <span className="meta">{schoolMap[player.schoolId].name}</span>
                </span>
              </li>
            )
          })}
        </ol>
      </section>
      {preview && image && (
        <div className="save-preview" role="dialog" aria-label="Save your image" onClick={() => setPreview(false)}>
          <p>Press and hold the image, then choose <b>Save to Photos</b> or <b>Download image</b>.</p>
          {isInAppBrowser() && (
            <p className="tip">Not working? Open this page in Chrome or Safari: tap <b>⋯</b> and choose <b>Open in browser</b>.</p>
          )}
          <img src={image.dataUrl} alt={`My ${heading} Faces`} onClick={(event) => event.stopPropagation()} />
          <button className="secondary" onClick={() => setPreview(false)}>Close</button>
        </div>
      )}
    </main>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [saved, setSaved] = useState(loadSaved)
  const [editingFraming, setEditingFraming] = useState(false)
  const history = session?.history
  const state = history?.[history.length - 1]
  const ids = useMemo(() => (session ? idsFor(session.team) : []), [session?.team])

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
    if (session) playersFor(session.team).forEach((player) => loadPortrait(player))
  }, [session?.team])

  // Count each finished sort once in the overall ranking.
  const sentRef = useRef(null)
  useEffect(() => {
    // An empty result can still be undone, so only finished rankings with someone in them count.
    if (!state?.done || !state.ranked.length || sentRef.current === state) return
    sentRef.current = state
    sendResult({
      team: teamLabel(session.team),
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
    return latest.done ? current : [...current, chooseNeither(latest, ids)]
  })
  const restart = () => {
    setSaved(loadSaved())
    setSession(null)
  }

  if (editingFraming) return <FrameEditor Portrait={Portrait} onClose={() => setEditingFraming(false)} />
  if (!session) {
    return (
      <Intro
        onStart={(team) => setSession({ team, history: [startSort(idsFor(team))] })}
        resumeTeam={saved?.team}
        onResume={saved ? () => setSession(saved) : null}
        onEditFraming={() => setEditingFraming(true)}
      />
    )
  }
  if (state.done && !state.ranked.length) {
    return (
      <main className="screen">
        <p className="eyebrow">Your result{session.team !== ALL && ` · ${teamLabel(session.team)}`}</p>
        <h1>No faces picked</h1>
        <p className="sub">You chose "Neither" for everyone, so there's no Top 9 this time.</p>
        <div className="actions">
          <button className="primary" onClick={() => updateHistory((current) => current.slice(0, -1))}>← Undo last choice</button>
          <button className="secondary" onClick={restart}>Start over</button>
        </div>
      </main>
    )
  }
  if (state.done) return <Result ranked={state.ranked.slice(0, TOP_COUNT)} team={session.team} onRestart={restart} />
  return (
    <Matchup
      state={state}
      history={history}
      count={ids.length}
      team={session.team}
      onPick={pick}
      onNeither={pickNeither}
      onBack={() => updateHistory((current) => current.slice(0, -1))}
      onHome={restart}
    />
  )
}
