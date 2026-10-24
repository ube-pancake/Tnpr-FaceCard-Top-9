import { useEffect, useState } from 'react'
import { activeSchools, players } from './data.js'
import { DEFAULT_FRAME, frameFor, frames } from './framing.js'

// Local-only tool: click the face on each photo so every crop centers on it.
// Saving writes src/framing.json through the dev server (see vite.config.js).
export default function FrameEditor({ Portrait, onClose }) {
  const [selectedId, setSelectedId] = useState(players[0].id)
  const [frame, setFrame] = useState(() => frameFor(players[0].id))
  const [status, setStatus] = useState('')
  const [version, setVersion] = useState(0)
  const index = players.findIndex((player) => player.id === selectedId)
  const player = players[index]

  const select = (id) => {
    setSelectedId(id)
    setFrame(frameFor(id))
    setStatus('')
  }
  const step = (offset) => select(players[(index + offset + players.length) % players.length].id)

  const save = async (next) => {
    const isDefault = Object.keys(DEFAULT_FRAME).every((key) => next[key] === DEFAULT_FRAME[key])
    if (isDefault) delete frames[selectedId]
    else frames[selectedId] = { x: round(next.x), y: round(next.y), zoom: round(next.zoom), ...(next.fit && { fit: true }) }
    setVersion((value) => value + 1)
    try {
      const response = await fetch('/__framing', { method: 'POST', body: JSON.stringify(frames) })
      setStatus(response.ok ? 'Saved' : 'Could not save')
    } catch {
      setStatus('Could not save')
    }
  }
  const update = (changes) => {
    const next = { ...frame, ...changes }
    setFrame(next)
    save(next)
  }

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'ArrowRight') step(1)
      if (event.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const pickFace = (event) => {
    const box = event.currentTarget.getBoundingClientRect()
    update({ x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height })
  }

  return (
    <main className="screen framer">
      <div className="topbar">
        <button className="home" onClick={onClose}>⌂ Home</button>
        <span>Photo framing · local only · {status}</span>
      </div>
      <h2>{player.name} <small>{index + 1} / {players.length}</small></h2>
      <p className="sub">Click the face. Every card and the saved image will center on that spot. Use ← → to move between photos.</p>

      <div className="framer-work">
        <div className="framer-source" onClick={pickFace}>
          {player.image ? <img src={player.image} alt="" /> : <p className="sub">No photo yet</p>}
          <i className="marker" style={{ left: `${frame.x * 100}%`, top: `${frame.y * 100}%` }} />
        </div>
        <div className="framer-previews">
          <figure><Portrait key={`${player.id}-card`} player={player} frame={frame} /><figcaption>Matchup card</figcaption></figure>
          <figure><Portrait key={`${player.id}-square`} player={player} frame={frame} aspect={1} /><figcaption>Result + saved image</figcaption></figure>
        </div>
      </div>

      <div className="framer-controls">
        <label>Zoom <input type="range" min="1" max="3" step="0.05" value={frame.zoom} disabled={frame.fit} onChange={(event) => update({ zoom: Number(event.target.value) })} /> {frame.zoom.toFixed(2)}×</label>
        <label><input type="checkbox" checked={frame.fit} onChange={(event) => update({ fit: event.target.checked })} /> Show whole photo (blurred background)</label>
        <button className="secondary" onClick={() => update(DEFAULT_FRAME)}>Reset</button>
        <button className="secondary" onClick={() => step(-1)}>← Prev</button>
        <button className="secondary" onClick={() => step(1)}>Next →</button>
      </div>

      {activeSchools.map((school) => (
        <section key={school.id} className="framer-team">
          <h3>{school.name}</h3>
          <div className="framer-grid" data-version={version}>
            {players.filter((item) => item.schoolId === school.id).map((item) => (
              <button key={item.id} className={item.id === selectedId ? 'active' : ''} onClick={() => select(item.id)} title={item.name}>
                <Portrait key={`${item.id}-${version}`} player={item} frame={item.id === selectedId ? frame : undefined} />
                {frames[item.id] && <b>✓</b>}
              </button>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}

const round = (value) => Math.round(value * 1000) / 1000
