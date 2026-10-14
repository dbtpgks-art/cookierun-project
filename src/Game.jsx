import { useEffect, useRef, useState } from 'react'
import './Game.css'

// --- 논리적 캔버스 크기 ---
const W = 900
const H = 450
const GROUND_Y = 385

// --- 플레이어 ---
const PLAYER_X = 110
const PLAYER_W = 46
const STAND_H = 66
const SLIDE_H = 34

// --- 물리 ---
const GRAVITY = 2400
const JUMP_VY = -880

// --- 난이도/수치 ---
const BASE_SPEED = 340
const MAX_SPEED = 760
const SPEED_UP = 9 // 초당 속도 증가
const DRAIN_RATE = 3.0 // 초당 체력 감소
const HIT_DAMAGE = 18 // 장애물 충돌 피해
const HEAL_AMOUNT = 22 // 아이템 회복량

// --- 유틸 ---
function rand(min, max) {
  return min + Math.random() * (max - min)
}
function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function makeState() {
  return {
    screen: 'start', // start | playing | over
    health: 100,
    score: 0,
    speed: BASE_SPEED,
    time: 0,
    player: { y: GROUND_Y - STAND_H, vy: 0, onGround: true, sliding: false },
    obstacles: [],
    items: [],
    clouds: Array.from({ length: 5 }, (_, i) => ({
      x: rand(0, W),
      y: rand(40, 180),
      w: rand(60, 130),
      v: rand(18, 40),
    })),
    spawnTimer: 1.2,
    itemTimer: rand(3, 5),
    flash: 0,
  }
}

function spawnObstacle(s) {
  const type = Math.random() < 0.5 ? 'ground' : 'air'
  const w = rand(36, 52)
  if (type === 'ground') {
    const h = rand(42, 60)
    s.obstacles.push({ type, x: W + 40, y: GROUND_Y - h, w, h })
  } else {
    const h = rand(34, 44)
    s.obstacles.push({ type, x: W + 40, y: GROUND_Y - 92 - (h - 34), w, h })
  }
}

function spawnItem(s) {
  const ground = Math.random() < 0.6
  const size = 34
  const y = ground ? GROUND_Y - size : GROUND_Y - rand(110, 150)
  s.items.push({ x: W + 40, y, w: size, h: size, r: size / 2 })
}

function drawBackground(ctx, s) {
  // 하늘 그라데이션
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y)
  sky.addColorStop(0, '#8ed8ff')
  sky.addColorStop(1, '#dff4ff')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, GROUND_Y)

  // 태양
  ctx.fillStyle = '#ffe08a'
  ctx.beginPath()
  ctx.arc(780, 74, 40, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff2c4'
  ctx.beginPath()
  ctx.arc(780, 74, 30, 0, Math.PI * 2)
  ctx.fill()

  // 구름
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  for (const c of s.clouds) {
    ctx.beginPath()
    ctx.ellipse(c.x, c.y, c.w / 2, c.w / 4, 0, 0, Math.PI * 2)
    ctx.ellipse(c.x + c.w * 0.25, c.y - c.w * 0.15, c.w / 3, c.w / 5, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // 멀리 언덕
  ctx.fillStyle = '#a9e08a'
  ctx.beginPath()
  ctx.moveTo(0, GROUND_Y)
  for (let x = 0; x <= W; x += 60) {
    const lift = 40 + Math.sin(x * 0.02) * 24 + Math.cos(x * 0.045) * 14
    ctx.quadraticCurveTo(x + 30, GROUND_Y - lift, x + 60, GROUND_Y)
  }
  ctx.lineTo(W, GROUND_Y)
  ctx.closePath()
  ctx.fill()
}

function drawGround(ctx, s) {
  ctx.fillStyle = '#7ac74f'
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y)
  ctx.fillStyle = '#5da03a'
  ctx.fillRect(0, GROUND_Y, W, 6)

  // 달리는 느낌의 줄무늬
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  const gap = 90
  let offset = (s.time * s.speed) % gap
  for (let x = -offset; x < W + gap; x += gap) {
    ctx.fillRect(x, GROUND_Y + 26, 26, 6)
  }
}

function drawPlayer(ctx, s) {
  const p = s.player
  const sliding = p.sliding
  const h = sliding ? SLIDE_H : STAND_H
  const x = PLAYER_X
  const y = p.y
  const cx = x + PLAYER_W / 2

  // 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.beginPath()
  ctx.ellipse(cx, GROUND_Y + 4, PLAYER_W * 0.62, 7, 0, 0, Math.PI * 2)
  ctx.fill()

  // 몸통 (쿠키)
  const bodyR = Math.max(20, h * 0.42)
  const bodyY = sliding ? y + bodyR : y + h - bodyR - 4
  ctx.fillStyle = '#b5651d'
  ctx.beginPath()
  ctx.arc(cx, bodyY, bodyR, 0, Math.PI * 2)
  ctx.fill()

  // 팔
  ctx.fillStyle = '#9c5213'
  ctx.beginPath()
  ctx.arc(cx - bodyR - 4, bodyY - 2, 9, 0, Math.PI * 2)
  ctx.arc(cx + bodyR + 4, bodyY - 2, 9, 0, Math.PI * 2)
  ctx.fill()

  // 다리
  if (!sliding) {
    ctx.fillStyle = '#9c5213'
    const step = Math.sin(s.time * 14) * 6
    ctx.fillRect(x + 8, y + h - 14, 12, 14)
    ctx.fillRect(x + PLAYER_W - 20, y + h - 14 + step, 12, 14 - step)
  }

  // 얼굴 (눈 + 미소)
  const eyeY = bodyY - 6
  ctx.fillStyle = '#3a2310'
  ctx.beginPath()
  ctx.arc(cx - 10, eyeY, 3.6, 0, Math.PI * 2)
  ctx.arc(cx + 10, eyeY, 3.6, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#3a2310'
  ctx.lineWidth = 2.4
  ctx.beginPath()
  ctx.arc(cx, eyeY + 8, 9, 0.2, Math.PI - 0.2)
  ctx.stroke()

  // 슬라이딩 상태 표시(작은 별) 없이 그대로
}

function drawObstacle(ctx, o) {
  if (o.type === 'ground') {
    ctx.fillStyle = '#6b4226'
    ctx.beginPath()
    ctx.moveTo(o.x + o.w / 2, o.y)
    ctx.lineTo(o.x + o.w, o.y + o.h)
    ctx.lineTo(o.x, o.y + o.h)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#5a341d'
    ctx.fillRect(o.x, o.y + o.h * 0.55, o.w, o.h * 0.45)
  } else {
    // 공중 장애물(머리 위 바)
    ctx.fillStyle = '#6b4226'
    ctx.fillRect(o.x, o.y, o.w, o.h)
    ctx.fillStyle = '#8a5a33'
    ctx.fillRect(o.x, o.y, o.w, 8)
    // 아래쪽 뾰족
    ctx.fillStyle = '#5a341d'
    for (let i = 0; i < o.w; i += 12) {
      ctx.beginPath()
      ctx.moveTo(o.x + i, o.y + o.h)
      ctx.lineTo(o.x + i + 6, o.y + o.h + 10)
      ctx.lineTo(o.x + i + 12, o.y + o.h)
      ctx.closePath()
      ctx.fill()
    }
  }
}

function drawItem(ctx, it) {
  // 회복 쿠키
  ctx.fillStyle = '#e76f51'
  ctx.beginPath()
  ctx.arc(it.x + it.r, it.y + it.r, it.r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff3e0'
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * 2 * i) / 6
    const px = it.x + it.r + Math.cos(a) * it.r * 0.55
    const py = it.y + it.r + Math.sin(a) * it.r * 0.55
    ctx.beginPath()
    ctx.arc(px, py, 3, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = '#3a2310'
  ctx.font = 'bold 18px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('+', it.x + it.r, it.y + it.r + 1)
}

function drawHud(ctx, s) {
  // 체력바
  const bx = 20
  const by = 20
  const bw = 320
  const bh = 24
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  roundRect(ctx, bx - 3, by - 3, bw + 6, bh + 6, 14)
  ctx.fill()
  ctx.fillStyle = '#e9e9e9'
  roundRect(ctx, bx, by, bw, bh, 11)
  ctx.fill()

  const frac = Math.max(0, Math.min(1, s.health / 100))
  if (frac > 0.001) {
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0)
    if (frac > 0.5) {
      g.addColorStop(0, '#ff7a59')
      g.addColorStop(1, '#6fdc6f')
    } else {
      g.addColorStop(0, '#e23b3b')
      g.addColorStop(1, '#ff7a59')
    }
    ctx.fillStyle = g
    roundRect(ctx, bx, by, bw * frac, bh, 11)
    ctx.fill()
  }

  ctx.fillStyle = '#fff'
  ctx.font = 'bold 15px sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('HP', bx + 12, by + bh / 2 + 1)

  // 점수
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  roundRect(ctx, W - 200, 14, 180, 36, 18)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 20px sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(`${Math.floor(s.score)}`, W - 32, 33)
  ctx.font = 'bold 12px sans-serif'
  ctx.fillText('SCORE', W - 32, 22)
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export default function Game() {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const [screen, setScreen] = useState('start')
  const [finalScore, setFinalScore] = useState(0)
  const [bestScore, setBestScore] = useState(() => {
    const v = Number(localStorage.getItem('cookierun-best') || 0)
    return v
  })

  if (stateRef.current === null) {
    stateRef.current = makeState()
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr
    canvas.height = H * dpr

    let raf = 0
    let last = performance.now()

    const state = stateRef.current

    const startGame = () => {
      Object.assign(state, makeState())
      state.screen = 'playing'
      setScreen('playing')
    }

    const endGame = () => {
      state.screen = 'over'
      setFinalScore(Math.floor(state.score))
      const best = Number(localStorage.getItem('cookierun-best') || 0)
      if (Math.floor(state.score) > best) {
        localStorage.setItem('cookierun-best', String(Math.floor(state.score)))
        setBestScore(Math.floor(state.score))
      }
      setScreen('over')
    }

    const jump = () => {
      if (state.screen !== 'playing') return
      if (state.player.onGround) {
        state.player.vy = JUMP_VY
        state.player.onGround = false
      }
    }
    const setSlide = (v) => {
      state.player.sliding = v
    }

    const onKeyDown = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault()
        jump()
      }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault()
        setSlide(true)
      }
    }
    const onKeyUp = (e) => {
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        setSlide(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    // 화면 터치/클릭 = 점프
    const onPointerDown = (e) => {
      if (e.target === canvas || e.target.closest('.game-canvas')) {
        jump()
      }
    }
    canvas.addEventListener('pointerdown', onPointerDown)

    const update = (dt) => {
      state.time += dt
      state.speed = Math.min(MAX_SPEED, BASE_SPEED + state.time * SPEED_UP)

      // 체력 감소
      state.health -= DRAIN_RATE * dt
      if (state.health <= 0) {
        state.health = 0
        endGame()
        return
      }

      // 점수
      state.score += (state.speed * dt) / 12

      // 플레이어 물리
      const p = state.player
      p.vy += GRAVITY * dt
      p.y += p.vy * dt
      const h = p.sliding ? SLIDE_H : STAND_H
      if (p.y >= GROUND_Y - h) {
        p.y = GROUND_Y - h
        p.vy = 0
        p.onGround = true
      } else {
        p.onGround = false
      }

      // 구름 이동
      for (const c of state.clouds) {
        c.x -= c.v * dt
        if (c.x < -c.w) {
          c.x = W + c.w
          c.y = rand(40, 180)
        }
      }

      // 장애물 스폰
      state.spawnTimer -= dt
      if (state.spawnTimer <= 0) {
        spawnObstacle(state)
        const base = Math.max(0.55, 1.5 - state.time * 0.02)
        state.spawnTimer = rand(base, base + 0.7)
      }

      // 아이템 스폰
      state.itemTimer -= dt
      if (state.itemTimer <= 0) {
        spawnItem(state)
        state.itemTimer = rand(3.2, 5.5)
      }

      // 장애물 이동
      for (const o of state.obstacles) {
        o.x -= state.speed * dt
      }
      state.obstacles = state.obstacles.filter((o) => o.x + o.w > -20)

      // 아이템 이동
      for (const it of state.items) {
        it.x -= state.speed * dt
      }
      state.items = state.items.filter((it) => it.x + it.w > -20)

      // 충돌
      const pr = {
        x: PLAYER_X,
        y: p.y,
        w: PLAYER_W,
        h: p.sliding ? SLIDE_H : STAND_H,
      }
      for (let i = state.obstacles.length - 1; i >= 0; i--) {
        const o = state.obstacles[i]
        const or = { x: o.x, y: o.y, w: o.w, h: o.h }
        if (overlap(pr, or)) {
          state.health -= HIT_DAMAGE
          state.flash = 0.15
          state.obstacles.splice(i, 1)
          if (state.health <= 0) {
            state.health = 0
            endGame()
            return
          }
        }
      }
      for (let i = state.items.length - 1; i >= 0; i--) {
        const it = state.items[i]
        const ir = { x: it.x, y: it.y, w: it.w, h: it.h }
        if (overlap(pr, ir)) {
          state.health = Math.min(100, state.health + HEAL_AMOUNT)
          state.items.splice(i, 1)
        }
      }

      if (state.flash > 0) state.flash -= dt
    }

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      drawBackground(ctx, state)
      drawGround(ctx, state)

      for (const it of state.items) drawItem(ctx, it)
      for (const o of state.obstacles) drawObstacle(ctx, o)
      drawPlayer(ctx, state)

      if (state.flash > 0) {
        ctx.fillStyle = `rgba(255,60,60,${state.flash * 2.5})`
        ctx.fillRect(0, 0, W, H)
      }

      drawHud(ctx, state)
    }

    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (state.screen === 'playing') {
        update(dt)
      }
      draw()
      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)

    // 전역 함수 노출(버튼용)
    window.__cookieStart = startGame
    window.__cookieJump = jump
    window.__cookieSlide = setSlide

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      canvas.removeEventListener('pointerdown', onPointerDown)
      delete window.__cookieStart
      delete window.__cookieJump
      delete window.__cookieSlide
    }
  }, [])

  return (
    <div className="game-wrap">
      <div className="game-canvas">
        <canvas ref={canvasRef} />
      </div>

      {screen === 'start' && (
        <div className="overlay">
          <h1>쿠키런</h1>
          <p>무한 달리기! 점프와 슬라이드로 장애물을 피하세요.</p>
          <p className="hint">
            점프: <b>스페이스 / ↑ / 클릭</b> &nbsp;·&nbsp; 슬라이드: <b>↓ (누르고 있기)</b>
          </p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (window.__cookieStart) window.__cookieStart()
            }}
          >
            시작하기
          </button>
          {bestScore > 0 && <p className="best">최고 점수: {bestScore}</p>}
        </div>
      )}

      {screen === 'over' && (
        <div className="overlay">
          <h1 className="over-title">게임 오버</h1>
          <p className="final">점수: {finalScore}</p>
          {finalScore >= bestScore && finalScore > 0 ? (
            <p className="new-best">🎉 신기록!</p>
          ) : (
            <p className="best">최고 점수: {bestScore}</p>
          )}
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (window.__cookieStart) window.__cookieStart()
            }}
          >
            다시 시작
          </button>
        </div>
      )}

      {screen === 'playing' && (
        <div className="controls">
          <button
            type="button"
            className="ctl ctl-jump"
            onPointerDown={() => window.__cookieJump && window.__cookieJump()}
          >
            점프
          </button>
          <button
            type="button"
            className="ctl ctl-slide"
            onPointerDown={() => window.__cookieSlide && window.__cookieSlide(true)}
            onPointerUp={() => window.__cookieSlide && window.__cookieSlide(false)}
            onPointerLeave={() => window.__cookieSlide && window.__cookieSlide(false)}
          >
            슬라이드
          </button>
        </div>
      )}
    </div>
  )
}
