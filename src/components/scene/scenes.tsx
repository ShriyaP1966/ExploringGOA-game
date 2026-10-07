import { far, HZ, lit } from './frame'
import { useSceneIds } from './ids'
import { FairyLights, Foam, Lamp, Palm, SandWaves, Sea, Window } from './parts'
import type { SkyLook } from './sky'

export type SceneProps = { look: SkyLook }

// --- Small props shared by the beaches ---------------------------------------------------------

function Umbrella({ x, y, a, b, look }: { x: number; y: number; a: string; b: string; look: SkyLook }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="2" rx="34" ry="6" fill={lit(look, '#c9a06a')} opacity="0.5" />
      <line x1="0" y1="0" x2="4" y2="-58" stroke={lit(look, '#6b4b2a')} strokeWidth="3" />
      <path d="M-38 -48 Q4 -92 46 -66 Z" fill={lit(look, a)} />
      <path d="M-12 -70 Q4 -90 18 -80 L6 -60Z" fill={lit(look, b)} />
      <path d="M26 -78 Q40 -74 46 -66 L18 -60Z" fill={lit(look, b)} />
      <rect x="-30" y="-8" width="46" height="7" rx="3" fill={lit(look, '#f5f0e6')} />
      <rect x="-30" y="-1" width="3" height="6" fill={lit(look, '#8a6b4a')} />
      <rect x="13" y="-1" width="3" height="6" fill={lit(look, '#8a6b4a')} />
    </g>
  )
}

/** A beach shack (or hut): stilts, bamboo walls, thatched roof, a sign. */
function Shack({ x, y, w = 120, wall = '#c99a62', roof = '#b8843f', sign, look }: { x: number; y: number; w?: number; wall?: string; roof?: string; sign?: string; look: SkyLook }) {
  const hgt = w * 0.5
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={4} y={-12} width={4} height={12} fill={lit(look, '#5c3f22')} />
      <rect x={w - 8} y={-12} width={4} height={12} fill={lit(look, '#5c3f22')} />
      <rect x={-4} y={-16} width={w + 8} height={5} fill={lit(look, '#7a5432')} />
      <rect x={0} y={-16 - hgt} width={w} height={hgt} fill={lit(look, wall)} />
      {Array.from({ length: Math.floor(w / 12) }, (_, i) => (
        <line key={i} x1={6 + i * 12} y1={-16 - hgt} x2={6 + i * 12} y2={-16} stroke={lit(look, '#a87d4c')} strokeWidth="2" opacity="0.6" />
      ))}
      <Window x={w * 0.18} y={-12 - hgt * 0.8} w={w * 0.24} h={hgt * 0.4} look={look} />
      <Window x={w * 0.58} y={-12 - hgt * 0.8} w={w * 0.24} h={hgt * 0.4} look={look} />
      <path d={`M${-18} ${-12 - hgt} L${w / 2} ${-30 - hgt * 1.7} L${w + 18} ${-12 - hgt}Z`} fill={lit(look, roof)} />
      <path d={`M${-18} ${-12 - hgt} L${w + 18} ${-12 - hgt}`} stroke={lit(look, '#8d6430')} strokeWidth="4" strokeDasharray="6 4" />
      {sign && <rect x={w * 0.25} y={-22 - hgt * 1.25} width={w * 0.5} height={12} rx={3} fill={lit(look, sign)} />}
    </g>
  )
}

// --- Baga Beach: the lively one ----------------------------------------------------------------

export function BagaScene({ look }: SceneProps) {
  const shore = 'M0 352 C 220 336, 460 372, 700 350 S 900 342, 960 350'
  const day = 1 - look.lamps
  return (
    <g>
      <path d={`M600 ${HZ} C 700 ${HZ - 30}, 820 ${HZ - 52}, 960 ${HZ - 40} L960 ${HZ}Z`} fill={far(look, '#4f8a5f')} />
      <Sea look={look} shore={360} />
      {day > 0.05 && (
        <g opacity={day}>
          <line x1="300" y1="138" x2="430" y2={HZ + 26} stroke="#ffffff" strokeWidth="1" opacity="0.7" />
          <path d="M270 128 Q300 92 332 128 Z" fill="#f2665c" />
          <path d="M290 112 Q300 100 312 112 L306 128 L296 128Z" fill="#ffd36b" />
          <path d="M296 130 l4 14 l4 -14" stroke="#1e2d33" strokeWidth="2" fill="none" />
          <path d={`M412 ${HZ + 28} l40 0 l-6 7 l-30 0Z`} fill="#f5f0e6" />
        </g>
      )}
      <path d={`${shore} L960 480 L0 480Z`} fill={lit(look, '#d9b47c')} />
      <path d={`M0 362 C 220 346, 460 382, 700 360 S 900 352, 960 360 L960 480 L0 480Z`} fill={lit(look, '#efcf98')} />
      <Foam d={shore} />
      <Palm x={640} y={372} height={150} lean={-0.3} look={look} delay={1.2} />
      <Shack x={560} y={392} w={130} sign="#2f9fe0" look={look} />
      <Shack x={730} y={386} w={150} wall="#d4a46b" sign="#f2665c" look={look} />
      <FairyLights from={[540, 312]} to={[710, 306]} look={look} />
      <FairyLights from={[700, 300]} to={[900, 296]} look={look} />
      <Umbrella x={200} y={410} a="#f2665c" b="#ffffff" look={look} />
      <Umbrella x={330} y={404} a="#2f9fe0" b="#ffd36b" look={look} />
      <Umbrella x={450} y={414} a="#ffd36b" b="#f28c28" look={look} />
      <SandWaves look={look} top={432} />
      <Palm x={60} y={470} height={240} lean={0.45} look={look} />
      <Palm x={920} y={476} height={210} lean={-0.5} look={look} delay={0.8} />
    </g>
  )
}

// --- Anjuna: red cliffs and the flea market ----------------------------------------------------

function Stall({ x, y, canopy, look }: { x: number; y: number; canopy: string; look: SkyLook }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="0" y="-60" width="4" height="60" fill={lit(look, '#6b4b2a')} />
      <rect x="86" y="-60" width="4" height="60" fill={lit(look, '#6b4b2a')} />
      <path d="M-10 -58 L45 -86 L100 -58Z" fill={lit(look, canopy)} />
      <path d="M-10 -58 q11 10 22 0 q11 10 22 0 q11 10 22 0 q11 10 22 0 q11 10 22 0" fill={lit(look, canopy)} />
      {['#ffd36b', '#2f9fe0', '#f2665c', '#7ac77a'].map((c, i) => (
        <path key={c} d={`M${12 + i * 20} -48 l8 0 l-2 26 l-4 0Z`} fill={lit(look, c)} />
      ))}
      <rect x="-2" y="-18" width="94" height="8" rx="2" fill={lit(look, '#8a5a35')} />
      {['#f28c28', '#b84a8f', '#2f8f5b', '#ffd36b', '#4f86c6'].map((c, i) => (
        <rect key={c} x={4 + i * 17} y="-26" width="12" height="8" rx="2" fill={lit(look, c)} />
      ))}
      <Lamp x={45} y={-56} r={3.5} look={look} glow={30} />
    </g>
  )
}

export function AnjunaScene({ look }: SceneProps) {
  const shore = 'M0 356 C 160 344, 330 368, 520 352'
  return (
    <g>
      <path d={`M380 ${HZ} L420 ${HZ - 18} L470 ${HZ - 14} L500 ${HZ}Z`} fill={far(look, '#8c4b35', 0.55)} />
      <Sea look={look} shore={370} />
      <path d={`M0 356 C 160 344, 330 368, 520 352 L620 360 L620 480 L0 480Z`} fill={lit(look, '#e6c08a')} />
      <Foam d={shore} />
      {/* The red laterite cliffs, in strata, with a green top. */}
      <path d={`M520 380 L540 ${HZ - 10} L600 200 L700 170 L960 150 L960 480 L520 480Z`} fill={lit(look, '#a5512f')} />
      <path d={`M560 300 L620 230 L720 214 L960 196 L960 230 L740 248 L630 266Z`} fill={lit(look, '#8c4126')} opacity="0.8" />
      <path d={`M548 352 L600 318 L760 300 L960 286 L960 312 L770 326 L610 344Z`} fill={lit(look, '#7e3a22')} opacity="0.7" />
      <path d="M596 202 Q640 178 700 170 L960 150 L960 166 L700 186 Q646 194 602 214Z" fill={lit(look, '#3f8a4f')} />
      {[[540, 372, 26], [580, 384, 18], [500, 380, 14]].map(([x, y, r]) => (
        <ellipse key={x} cx={x} cy={y} rx={r} ry={r * 0.6} fill={lit(look, '#5a3a2e')} />
      ))}
      <Palm x={760} y={160} height={120} lean={-0.2} look={look} delay={0.4} />
      <Palm x={880} y={152} height={140} lean={0.15} look={look} delay={1.4} />
      <path d={`M0 404 C 200 390, 460 410, 960 396 L960 480 L0 480Z`} fill={lit(look, '#d9ab72')} />
      <FairyLights from={[60, 330]} to={[540, 330]} sag={26} count={14} look={look} />
      <Stall x={70} y={418} canopy="#f2665c" look={look} />
      <Stall x={210} y={412} canopy="#2f9fe0" look={look} />
      <Stall x={350} y={420} canopy="#b84a8f" look={look} />
      <Stall x={490} y={414} canopy="#f28c28" look={look} />
      <SandWaves look={look} top={440} />
      <Palm x={30} y={478} height={230} lean={0.35} look={look} delay={0.9} />
    </g>
  )
}

// --- Vagator & Chapora Fort --------------------------------------------------------------------

export function VagatorScene({ look }: SceneProps) {
  const ids = useSceneIds()
  const shore = 'M520 400 C 640 384, 800 396, 960 384'
  const walls = lit(look, '#b38455')
  const wallDark = lit(look, '#8f6640')
  const merlons = Array.from({ length: 12 }, (_, i) => `M${146 + i * 24} 120 h12 v-12 h-12Z`).join(' ')
  return (
    <g>
      <Sea look={look} shore={420} />
      {/* Chapora hill, the fort on top (lowered so its towers stay in view). */}
      <g transform="translate(0 24)">
        <path d={`M0 ${HZ + 40} L0 230 C 60 190, 120 170, 200 168 L420 168 C 480 180, 540 230, 600 ${HZ + 20} L640 420 L0 420Z`} fill={lit(look, '#9c5a3c')} />
        <path d="M0 236 C 60 196, 120 178, 200 176 L420 176 C 470 186, 520 222, 560 262 L540 268 C 500 232, 460 200, 410 192 L200 192 C 120 194, 60 214, 0 252Z" fill={lit(look, '#4f8f4f')} />
        <path d="M140 168 L140 120 L430 120 L430 168Z" fill={walls} />
        <path d={merlons} fill={walls} />
        <path d="M140 140 L430 140" stroke={wallDark} strokeWidth="3" strokeDasharray="20 10" />
        <rect x="260" y="138" width="34" height="30" rx="17" fill={wallDark} />
        <path d="M420 168 L420 104 Q446 92 472 104 L472 168Z" fill={walls} />
        {Array.from({ length: 3 }, (_, i) => (
          <rect key={i} x={424 + i * 16} y={94} width="10" height="10" fill={walls} />
        ))}
        <Lamp x={160} y={112} look={look} />
        <Lamp x={446} y={98} look={look} />
        <Lamp x={300} y={112} look={look} />
      </g>
      {/* Ozran beach and its black rocks. */}
      <path d={`${shore} L960 480 L520 480Z`} fill={lit(look, '#e8c891')} />
      <Foam d={shore} />
      {[[600, 410, 34], [650, 420, 22], [880, 402, 28], [915, 412, 18], [560, 428, 20]].map(([x, y, r]) => (
        <path key={x} d={`M${x - r} ${y} Q${x - r * 0.6} ${y - r * 0.9} ${x} ${y - r * 0.8} Q${x + r * 0.7} ${y - r * 0.7} ${x + r} ${y}Z`} fill={lit(look, '#3b3640')} />
      ))}
      <g opacity={look.lamps}>
        <circle cx="760" cy="432" r="60" fill={ids.url('lamp-glow')} />
        <path d="M748 440 L760 410 L772 440Z" fill="#ffb347" />
        <path d="M754 440 L760 422 L766 440Z" fill="#fff1c1" />
      </g>
      <path d="M744 442 l32 0" stroke={lit(look, '#5c3f22')} strokeWidth="5" />
      {/* Cliff-top foreground: red earth and grass. */}
      <path d={`M0 420 C 120 404, 300 430, 520 440 L520 480 L0 480Z`} fill={lit(look, '#b5683f')} />
      <path d={`M0 440 C 140 428, 300 448, 520 456 L520 480 L0 480Z`} fill={lit(look, '#5c9a4f')} />
      <Palm x={480} y={452} height={200} lean={0.4} look={look} delay={0.6} />
      <Palm x={60} y={468} height={170} lean={-0.2} look={look} />
    </g>
  )
}

// --- Fontainhas, Panaji: the Latin quarter and its church --------------------------------------

function House({ x, y, w, h, colour, look, balcony = false }: { x: number; y: number; w: number; h: number; colour: string; look: SkyLook; balcony?: boolean }) {
  const cols = Math.max(1, Math.floor(w / 46))
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="0" y={-h} width={w} height={h} fill={lit(look, colour)} />
      <rect x="0" y={-h} width={w} height="6" fill={lit(look, '#f5f0e6')} />
      <path d={`M-8 ${-h} L${w / 2} ${-h - 26} L${w + 8} ${-h}Z`} fill={lit(look, '#b5482f')} />
      {[0, 1].map((row) =>
        Array.from({ length: cols }, (_, i) => {
          const cx = (w / cols) * (i + 0.5)
          const wy = -h + 18 + row * (h / 2)
          return (
            <g key={`${row}-${i}`}>
              <rect x={cx - 11} y={wy - 3} width="22" height="34" rx="11" fill={lit(look, '#f5f0e6')} />
              <Window x={cx - 8} y={wy} w={16} h={28} look={look} day="#3c5a6e" />
            </g>
          )
        }),
      )}
      {balcony && <rect x={w * 0.1} y={-h / 2 + 14} width={w * 0.8} height="4" fill={lit(look, '#2f3b40')} />}
      <rect x={w / 2 - 10} y="-34" width="20" height="34" rx="10" fill={lit(look, '#6b3f26')} />
    </g>
  )
}

export function FontainhasScene({ look }: SceneProps) {
  const ids = useSceneIds()
  const white = lit(look, '#fbf8f0')
  const shade = lit(look, '#dcd6c8')
  return (
    <g>
      {/* The far bank of the Mandovi, and the river. */}
      <path d={`M0 ${HZ} C 160 ${HZ - 26}, 300 ${HZ - 14}, 480 ${HZ - 30} S 800 ${HZ - 12}, 960 ${HZ - 24} L960 ${HZ}Z`} fill={far(look, '#5d8f6a')} />
      <Sea look={look} shore={HZ + 30} />
      <path d={`M700 ${HZ + 16} l44 0 l-6 6 l-32 0Z`} fill={lit(look, '#f5f0e6')} />
      {/* The hill, and the church of Our Lady of the Immaculate Conception (scaled to stay in view). */}
      <path d={`M260 ${HZ + 30} C 360 ${HZ - 10}, 600 ${HZ - 10}, 700 ${HZ + 30}Z`} fill={lit(look, '#7aa66a')} />
      <g transform="translate(480 300) scale(0.8) translate(-480 -300)">
        <rect x="400" y="140" width="160" height="150" fill={white} />
        <path d="M400 140 L400 120 Q480 66 560 120 L560 140Z" fill={white} />
        <rect x="372" y="110" width="40" height="180" fill={white} />
        <rect x="548" y="110" width="40" height="180" fill={white} />
        <path d="M372 110 Q392 84 412 110Z" fill={white} />
        <path d="M548 110 Q568 84 588 110Z" fill={white} />
        <rect x="389" y="68" width="6" height="22" fill={lit(look, '#c8a24a')} />
        <rect x="383" y="74" width="18" height="5" fill={lit(look, '#c8a24a')} />
        <rect x="565" y="68" width="6" height="22" fill={lit(look, '#c8a24a')} />
        <rect x="559" y="74" width="18" height="5" fill={lit(look, '#c8a24a')} />
        <rect x="477" y="54" width="6" height="26" fill={lit(look, '#c8a24a')} />
        <rect x="470" y="62" width="20" height="5" fill={lit(look, '#c8a24a')} />
        <circle cx="480" cy="114" r="14" fill={lit(look, '#c8a24a')} />
        <Window x={470} y={150} w={20} h={34} look={look} day="#3c4a55" />
        <Window x={380} y={140} w={24} h={30} look={look} day="#3c4a55" />
        <Window x={556} y={140} w={24} h={30} look={look} day="#3c4a55" />
        <rect x="462" y="226" width="36" height="64" rx="18" fill={lit(look, '#6b3f26')} />
        <path d="M400 200 L560 200" stroke={shade} strokeWidth="4" />
        {look.lamps > 0 && <ellipse cx="480" cy="210" rx="140" ry="120" fill={ids.url('lamp-glow')} opacity={look.lamps * 0.35} />}
      </g>
      {/* The hillside below the church, down to the square. */}
      <path d={`M230 420 L230 322 C 340 302, 620 302, 730 322 L730 420Z`} fill={lit(look, '#86b06f')} />
      <path d={`M230 392 C 360 380, 600 380, 730 392 L730 420 L230 420Z`} fill={lit(look, '#d8bb8c')} />
      <path d="M230 392 C 360 380, 600 380, 730 392" stroke={lit(look, '#f5f0e6')} strokeWidth="4" fill="none" />
      {/* The famous zigzag stairs. */}
      <g fill={white} stroke={shade} strokeWidth="2">
        <path d="M430 300 L530 300 L530 312 L430 312Z" />
        <path d="M530 312 L600 340 L600 352 L530 324Z" />
        <path d="M600 352 L360 352 L360 364 L600 364Z" />
        <path d="M360 364 L300 392 L300 404 L360 376Z" />
        <path d="M300 404 L660 404 L660 416 L300 416Z" />
      </g>
      <path d="M260 304 L700 304" stroke={lit(look, '#f5f0e6')} strokeWidth="3" opacity="0.6" />
      {/* Houses of the Latin quarter. */}
      <House x={0} y={420} w={150} h={150} colour="#f2c14e" balcony look={look} />
      <House x={150} y={420} w={110} h={120} colour="#4f86c6" look={look} />
      <House x={700} y={420} w={120} h={130} colour="#c8553d" balcony look={look} />
      <House x={820} y={420} w={140} h={160} colour="#5aa17f" look={look} />
      {/* Bougainvillea spilling over the walls. */}
      {[[250, 300], [268, 316], [236, 318], [712, 290], [730, 304], [700, 310]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={14} fill={lit(look, '#d9488f')} opacity="0.9" />
      ))}
      {/* The street. */}
      <path d={`M0 420 L960 420 L960 480 L0 480Z`} fill={lit(look, '#c9a27a')} />
      <g stroke={lit(look, '#b08a62')} strokeWidth="2" opacity="0.7">
        {Array.from({ length: 16 }, (_, i) => (
          <line key={i} x1={i * 64} y1={440 + (i % 2) * 14} x2={i * 64 + 40} y2={440 + (i % 2) * 14} />
        ))}
      </g>
      {[300, 660].map((x) => (
        <g key={x}>
          <rect x={x - 2} y="352" width="4" height="70" fill={lit(look, '#2f3b40')} />
          <rect x={x - 8} y="344" width="16" height="12" rx="3" fill={lit(look, '#2f3b40')} />
          <Lamp x={x} y={350} r={4} look={look} glow={34} />
        </g>
      ))}
      <Palm x={620} y={424} height={150} lean={0.25} look={look} delay={0.5} />
    </g>
  )
}

// --- Palolem: the hidden crescent bay ----------------------------------------------------------

function Boat({ x, y, colour, look }: { x: number; y: number; colour: string; look: SkyLook }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-60 -14 Q0 6 70 -14 L58 2 Q0 14 -50 2Z" fill={lit(look, colour)} />
      <path d="M-60 -14 Q0 6 70 -14" stroke={lit(look, '#f5f0e6')} strokeWidth="3" fill="none" />
      <path d="M-30 -10 L-30 -40 M30 -10 L30 -40" stroke={lit(look, '#6b4b2a')} strokeWidth="3" />
      <path d="M-50 -40 L50 -40" stroke={lit(look, '#6b4b2a')} strokeWidth="3" />
      <path d="M-58 -2 Q0 20 66 -2" stroke={lit(look, '#5c3f22')} strokeWidth="4" fill="none" opacity="0.6" />
    </g>
  )
}

export function PalolemScene({ look }: SceneProps) {
  const shore = 'M0 420 Q 360 340, 700 336 T 960 330'
  return (
    <g>
      {/* An island on the left; the far headland on the right. */}
      <path d={`M60 ${HZ} C 90 ${HZ - 40}, 200 ${HZ - 54}, 260 ${HZ}Z`} fill={far(look, '#3f7f50', 0.35)} />
      {[[110, HZ - 30], [150, HZ - 42], [200, HZ - 36]].map(([x, y]) => (
        <Palm key={x} x={x} y={y} height={34} lean={0.2} look={{ ...look, tint: far(look, '#3f7f50', 0.35), tintOpacity: 1 }} />
      ))}
      <path d={`M780 ${HZ} C 840 ${HZ - 36}, 900 ${HZ - 44}, 960 ${HZ - 50} L960 ${HZ}Z`} fill={far(look, '#3f7f50', 0.4)} />
      <Sea look={look} shore={480} />
      {/* Kayaks on the water. */}
      <path d={`M300 ${HZ + 40} q24 6 48 0 q-24 -5 -48 0Z`} fill={lit(look, '#f28c28')} />
      <path d={`M430 ${HZ + 56} q24 6 48 0 q-24 -5 -48 0Z`} fill={lit(look, '#f2665c')} />
      {/* The crescent of sand curving away to the right, under a wall of palms. */}
      <path d={`${shore} L960 480 L0 480Z`} fill={lit(look, '#f2d39f')} />
      <Foam d={shore} />
      {Array.from({ length: 9 }, (_, i) => (
        <Palm key={i} x={560 + i * 48} y={330 - i * 2} height={100 + (i % 3) * 16} lean={i % 2 ? 0.25 : -0.15} look={look} delay={i * 0.3} />
      ))}
      <Shack x={600} y={372} w={70} wall="#f7a6b8" roof="#b8843f" look={look} />
      <Shack x={700} y={366} w={70} wall="#9fe0d0" roof="#a8763a" look={look} />
      <Shack x={800} y={362} w={70} wall="#a6cdf7" roof="#b8843f" look={look} />
      <FairyLights from={[600, 300]} to={[870, 290]} sag={20} count={10} look={look} />
      <Boat x={220} y={430} colour="#2f9fe0" look={look} />
      <Boat x={420} y={446} colour="#f2665c" look={look} />
      <SandWaves look={look} top={448} />
      <Palm x={930} y={478} height={250} lean={-0.45} look={look} delay={1.1} />
    </g>
  )
}
