import { useEffect, useMemo, useRef, useState } from 'react'
import { players, schoolMap } from './data.js'
import { TOP_COUNT, choose, currentPair, progress, startSort } from './sorter.js'

const ids = players.map((player) => player.id)
const playerMap = Object.fromEntries(players.map((player) => [player.id, player]))
const SAVE_KEY = 'favorite-faces-top9'

const loadSaved = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY))
    if (saved?.history?.length && saved.history.every((state) => state.lostTo)) return saved
  } catch {
    // ignore unreadable save data
  }
  return null
}

function Portrait({ player, className = '' }) {
  const [index, setIndex] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const sources = [player.image, player.image.replace(/\.webp$/i, '.png'), player.image.replace(/\.webp$/i, '.jpg')]
  const school = schoolMap[player.schoolId]
  const initials = initialsOf(player)

  return (
    <div className={`portrait ${className}`} style={{ '--team': school.color, '--accent': school.accent }} role="img" aria-label={player.name}>
      <span className="monogram">{initials}</span>
      {index < sources.length && (
        <img
          key={sources[index]}
          src={sources[index]}
          alt=""
          className={loaded ? 'loaded' : ''}
          onLoad={() => setLoaded(true)}
          onError={() => setIndex((current) => current + 1)}
        />
      )}
    </div>
  )
}

function Intro({ onStart, onResume }) {
  const preview = useMemo(() => [...players].sort(() => Math.random() - 0.5).slice(0, 9), [])
  return (
    <main className="screen intro">
      <p className="eyebrow">TeniPuri Top9</p>
      <h1>Favorite faces <span className="accent">Top 9</span></h1>
      <p className="sub">Compare photos and pick the face you like best.</p>
      <div className="grid3 preview">
        {preview.map((player) => <Portrait key={player.id} player={player} />)}
      </div>
      <p className="count">Your Top 9 from {players.length} characters.</p>
      <button className="primary" onClick={onStart}>Start →</button>
      {onResume && <button className="link" onClick={onResume}>Resume where I left off</button>}
    </main>
  )
}

function Matchup({ state, history, onPick, onBack }) {
  const pair = currentPair(state)
  const percent = progress(state, players.length)

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'ArrowLeft') onPick(0)
      if (event.key === 'ArrowRight') onPick(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onPick])

  return (
    <main className="screen">
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
      <button className="link" onClick={onBack} disabled={history.length < 2}>← Back</button>
    </main>
  )
}

// Rank index shown in each grid cell, left to right: 4 5 6 / 2 1 3 / 7 8 9, so #1 sits in the middle.
const GRID_ORDER = [3, 4, 5, 1, 0, 2, 6, 7, 8]

const initialsOf = (player) => player.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('')

const loadPortrait = (player) => new Promise((resolve) => {
  const sources = [player.image, player.image.replace(/\.webp$/i, '.png'), player.image.replace(/\.webp$/i, '.jpg')]
  const tryLoad = (n) => {
    if (n >= sources.length) return resolve(null)
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => tryLoad(n + 1)
    img.src = sources[n]
  }
  tryLoad(0)
})

function Result({ ranked, onRestart }) {
  const canvasRef = useRef(null)
  const [notice, setNotice] = useState('')
  const cells = GRID_ORDER.filter((rank) => rank < ranked.length).map((rank) => ({ rank, player: playerMap[ranked[rank]] }))

  const saveImage = async () => {
    const size = 360
    const gap = 24
    const pad = 48
    const label = 84
    const top = 190
    const canvas = canvasRef.current
    canvas.width = pad * 2 + size * 3 + gap * 2
    canvas.height = top + (size + label + gap) * 3 + 40
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
    ctx.fillText('TeniPuri Top9', canvas.width / 2, 72)
    ctx.font = '800 60px sans-serif'
    ctx.fillText('My favorite faces TOP 9', canvas.width / 2, 145)

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
        ctx.roundRect(x - 8, y - 8, size + 16, size + 16, 28)
        ctx.fill()
        ctx.restore()
      }

      ctx.save()
      ctx.beginPath()
      ctx.roundRect(x, y, size, size, 22)
      ctx.clip()
      if (img) {
        const scale = Math.max(size / img.width, size / img.height)
        ctx.drawImage(img, x + (size - img.width * scale) / 2, y, img.width * scale, img.height * scale)
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
      ctx.roundRect(x + 16, y + 16, pillW, 44, 22)
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

    const link = document.createElement('a')
    link.download = 'my-top-9.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
    setNotice('Image saved')
  }

  return (
    <main className="screen">
      <p className="eyebrow">Your result</p>
      <h1>My favorite faces <span className="accent">Top 9</span></h1>
      <div className="grid3 result">
        {cells.map(({ rank, player }) => (
          <figure key={player.id} className={rank === 0 ? 'first' : ''}>
            <div className="frame">
              <Portrait player={player} />
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
        <button className="primary" onClick={saveImage}>Save image</button>
        <button className="secondary" onClick={onRestart}>Start over</button>
      </div>
      <p className="notice" role="status">{notice}</p>
      <section className="ranking">
        <h2>TOP 9</h2>
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
      <canvas ref={canvasRef} hidden />
    </main>
  )
}

export default function App() {
  const [history, setHistory] = useState(null)
  const [saved] = useState(loadSaved)
  const state = history?.[history.length - 1]

  useEffect(() => {
    try {
      if (!history) return
      if (state.done) localStorage.removeItem(SAVE_KEY)
      else localStorage.setItem(SAVE_KEY, JSON.stringify({ history }))
    } catch {
      // storage unavailable
    }
  }, [history, state])

  const pick = (side) => setHistory((current) => {
    const latest = current[current.length - 1]
    return latest.done ? current : [...current, choose(latest, ids, side)]
  })

  if (!history) return <Intro onStart={() => setHistory([startSort(ids)])} onResume={saved ? () => setHistory(saved.history) : null} />
  if (state.done) return <Result ranked={state.ranked.slice(0, TOP_COUNT)} onRestart={() => setHistory(null)} />
  return <Matchup state={state} history={history} onPick={pick} onBack={() => setHistory((current) => current.slice(0, -1))} />
}
