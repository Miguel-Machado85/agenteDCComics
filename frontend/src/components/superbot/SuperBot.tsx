/*
 * SuperBot: personaje propio del proyecto (no es un personaje ni un logo de DC).
 * Cabeza de robot con visor y ojos sonrientes; el retrato completo lleva su pin de "#1 FAN".
 */

const OJO = '#3d9bff'

function Cabeza() {
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      <line x1="100" y1="32" x2="100" y2="12" stroke="#000" strokeWidth="6" />
      <circle cx="100" cy="10" r="8" fill={OJO} stroke="#000" strokeWidth="5" />
      <rect x="16" y="68" width="18" height="38" rx="6" fill="#c9d0db" stroke="#000" strokeWidth="5" />
      <rect x="166" y="68" width="18" height="38" rx="6" fill="#c9d0db" stroke="#000" strokeWidth="5" />
      <rect x="30" y="30" width="140" height="110" rx="30" fill="#eef1f5" stroke="#000" strokeWidth="6" />
      <rect x="46" y="56" width="108" height="50" rx="25" fill="#000" />
      <path d="M68 88q11-15 22 0M110 88q11-15 22 0" fill="none" stroke={OJO} strokeWidth="7" />
      <path d="M86 120q14 10 28 0" fill="none" stroke="#000" strokeWidth="5" />
    </g>
  )
}

/** Solo la cabeza: para la cabecera y las burbujas del chat. */
export function SuperBotCara({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="10 0 180 146" className={className} aria-hidden="true" focusable="false">
      <Cabeza />
    </svg>
  )
}

/** Retrato completo con el pin de "#1 FAN": para la portada. */
export function SuperBotRetrato({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 240" className={className} role="img" aria-label="SuperBot con su pin de fan número uno">
      <g strokeLinecap="round" strokeLinejoin="round">
        <rect x="84" y="138" width="32" height="18" fill="#c9d0db" stroke="#000" strokeWidth="5" />
        <path d="M44 236v-50a30 30 0 0 1 30-30h52a30 30 0 0 1 30 30v50" fill="#eef1f5" stroke="#000" strokeWidth="6" />
        <path d="M74 236v-34M126 236v-34" stroke="#c9d0db" strokeWidth="5" />
      </g>
      <Cabeza />
      <g className="animate-insignia origin-[146px_190px]">
        <path d="M128 206l-8 30 14-7 10 11 4-30z" fill="#0052e7" stroke="#000" strokeWidth="4" strokeLinejoin="round" />
        <circle cx="146" cy="190" r="30" fill="#0074e8" stroke="#000" strokeWidth="5" />
        <circle cx="146" cy="190" r="22" fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="3 4" />
        <text
          x="146"
          y="194"
          textAnchor="middle"
          fill="#fff"
          fontFamily="'Sofia Sans Extra Condensed', 'Arial Narrow', sans-serif"
          fontWeight="800"
          fontSize="26"
        >
          #1
        </text>
        <text
          x="146"
          y="208"
          textAnchor="middle"
          fill="#fff"
          fontFamily="'Sofia Sans Extra Condensed', 'Arial Narrow', sans-serif"
          fontWeight="800"
          fontSize="11"
          letterSpacing="1.5"
        >
          FAN
        </text>
      </g>
    </svg>
  )
}
