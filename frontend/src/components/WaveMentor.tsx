import { useId } from "react";
import { SigningArms, signEnvelope } from "./SigningArms";

const ease = (n: number) => { const t = Math.max(0, Math.min(1, n)); return t*t*(3-2*t); };
/** One articulated gesture; time is in seconds, so playback and scrubbing share the same pose. */
export function WaveMentor({ time, signing = false, closeup = false, guides = false }: { time: number; signing?: boolean; closeup?: boolean; guides?: boolean }) {
  const id = useId().replace(/:/g, "");
  const lift = signing ? signEnvelope(time) : ease((time-.5)/1.15) * (1-ease((time-4.65)/1.2));
  const wave = Math.sin((time-1.65)*Math.PI*2*1.35) * 13 * ease((time-1.65)/.3) * (1-ease((time-4.15)/.5));
  const shoulder = -42*lift;
  const elbow = -12-116*lift;
  const blinkPulse = (center: number) => { const d = Math.abs(time-center)/.17; return d<1 ? Math.pow(Math.cos(d*Math.PI/2),2) : 0; };
  const blink = 1-.94*Math.max(blinkPulse(1.05),blinkPulse(6.9));
  const breath = signing ? Math.sin(time*Math.PI/4) : 0;
  const attention = signing ? ease((time-4.35)/.85)*(1-ease((time-6)/.85)) : 0;
  const bodyAngle = signing ? -.8*lift+.55*breath : -1.2*lift;
  const headAngle = signing ? -1.8*lift+2.6*attention+.4*breath : 2*lift;
  return <svg viewBox={closeup && signing ? "160 350 190 265" : signing ? "35 65 440 615" : "0 0 600 680"} className="wave-mentor" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}jacket`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#46647c"/><stop offset="1" stopColor="#20364b"/></linearGradient>
      <linearGradient id={`${id}skin`} x1="0" y1="0" x2="1" y2=".6"><stop stopColor="#efc4a5"/><stop offset="1" stopColor="#d99e80"/></linearGradient>
      <linearGradient id={`${id}hair`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#49382f"/><stop offset=".5" stopColor="#2a2728"/><stop offset="1" stopColor="#1d2631"/></linearGradient>
      <radialGradient id={`${id}cheek`}><stop stopColor="#c97d72" stopOpacity=".37"/><stop offset="1" stopColor="#c97d72" stopOpacity="0"/></radialGradient>
    </defs>
    <ellipse cx="275" cy="641" rx="157" ry="12" fill="currentColor" opacity=".08"/>
    <g transform={`translate(${signing ? breath*1.3 : 0} ${signing ? -breath*1.2 : 0}) rotate(${bodyAngle} 270 615)`}>
      {/* Back hair and resting arm sit behind the jacket. */}
      <path d="M166 215Q145 117 225 103Q312 73 350 153Q365 187 353 259L362 345Q332 369 301 348L180 351Q147 347 156 320Z" fill={`url(#${id}hair)`}/>
      {!signing && <>
      <path d="M182 369Q144 375 135 417L119 542Q116 561 136 565Q154 569 162 551L196 429Z" fill="#304c64"/>
      <path d="M124 548L121 573Q120 594 134 603Q142 611 147 604L153 582L150 551Z" fill={`url(#${id}skin)`}/>
      {/* Shoulder → elbow → wrist: all pivots stay connected through the gesture. */}
      <g transform={`translate(337 377) rotate(${shoulder})`}>
        <path d="M-22 0Q-14-22 5-18Q24-14 27 12L23 86Q20 107 0 108Q-22 105-23 85Z" fill="#304b62"/>
        <g transform={`translate(0 88) rotate(${elbow})`}>
          <path d="M-22-7Q0-24 22-7L19 91Q17 108 0 110Q-17 107-19 91Z" fill={`url(#${id}jacket)`}/>
          <path d="M-18 87L18 87 17 106Q0 112-17 106Z" fill="#f4ead8"/>
          <path d="M-10 10L-9 78" fill="none" stroke="#8ca2b2" strokeOpacity=".25" strokeWidth="2" strokeLinecap="round"/>
          <g transform={`translate(0 104) rotate(${wave})`}>
            <path d="M-15-4L-17 20-21 56Q-22 64-16 64Q-11 64-11 57L-10 38-9 74Q-9 82-3 82Q2 82 2 74L2 42 6 82Q7 89 12 88Q17 87 16 80L12 40 20 68Q22 76 27 73Q31 71 28 64L20 29 33 42Q40 47 44 41Q47 36 40 31L27 17Q21 8 16-4Z" fill={`url(#${id}skin)`} stroke="#be896f" strokeWidth="1.2" strokeLinejoin="round"/>
            <path d="M-8 25Q4 17 17 25M18 26Q10 32 14 42" fill="none" stroke="#be896f" strokeWidth="1.5" strokeLinecap="round" opacity=".55"/>
          </g>
          <circle cx="10" cy="78" r="2.5" fill="#d3b47d"/>
        </g>
      </g>
      </>}
      <path d="M185 359Q224 342 268 346Q307 343 337 359L365 621Q277 650 157 624L165 418Z" fill={`url(#${id}jacket)`}/>
      <path d="M226 322L220 363Q257 392 296 362L289 316Z" fill={`url(#${id}skin)`}/>
      <path d="M227 322Q256 342 291 320L292 341Q257 361 225 342Z" fill="#ba8068" opacity=".25"/>
      <path d="M220 359Q255 391 298 359L302 627Q263 635 216 627Z" fill="#f4ead8"/>
      <path d="M222 361L255 386 237 410 214 373M297 361L255 386 276 411 305 373" fill="#fff9ed"/>
      <path d="M204 354L228 414 215 478 214 627 169 444 192 420 175 400ZM312 352L284 415 300 478 303 628 350 443 328 420 346 400Z" fill="#536f84"/>
      <path d="M204 354L228 414 215 478M312 352L284 415 300 478" fill="none" stroke="#9cb1bf" strokeOpacity=".35" strokeWidth="1.5"/>
      <path d="M256 399V620" stroke="#d9d1c1" strokeWidth="1.5"/>
      <circle cx="263" cy="442" r="2.5" fill="#97a4a7"/><circle cx="263" cy="488" r="2.5" fill="#97a4a7"/>
      <path d="M317 421L321 431 331 435 321 439 317 449 313 439 303 435 313 431Z" fill="#dfbf80"/>
      <path d="M181 549L207 551M309 551L335 548" stroke="#8aa1b3" strokeOpacity=".4" strokeWidth="2"/>
      <g transform={`translate(0 ${signing ? attention*1.5 : 0}) rotate(${headAngle} 258 302)`}>
        <ellipse cx="180" cy="242" rx="14" ry="23" fill="#daa384"/><ellipse cx="329" cy="242" rx="13" ry="23" fill="#c68c74"/>
        <path d="M180 190Q189 133 251 132Q316 132 330 190L323 265Q313 316 259 337Q205 324 188 277Z" fill={`url(#${id}skin)`}/>
        <ellipse cx="208" cy="270" rx="23" ry="15" fill={`url(#${id}cheek)`}/><ellipse cx="303" cy="269" rx="22" ry="15" fill={`url(#${id}cheek)`}/>
        <path transform={signing ? `translate(0 ${-1.4*lift-1.4*attention})` : undefined} d="M198 219Q214 209 231 216M281 216Q301 207 315 219" stroke="#594239" strokeWidth="5" strokeLinecap="round" fill="none"/>
        <g transform={`translate(0 239) scale(1 ${blink}) translate(0 -239)`}>
          <path d="M196 239Q213 225 234 239Q216 251 196 239M279 239Q298 224 318 239Q300 252 279 239" fill="#fffaf1"/>
          <ellipse cx="216" cy="239" rx="7" ry="8" fill="#5d7771"/><ellipse cx="299" cy="239" rx="7" ry="8" fill="#5d7771"/>
          <ellipse cx="216" cy="240" rx="3.7" ry="5.3" fill="#263335"/><ellipse cx="299" cy="240" rx="3.7" ry="5.3" fill="#263335"/>
          <circle cx="218" cy="236" r="2" fill="#fff"/><circle cx="301" cy="236" r="2" fill="#fff"/>
          <path d="M196 239Q213 225 234 239M279 239Q298 224 318 239" stroke="#4b3531" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        </g>
        <path d="M255 236L248 267Q256 272 264 267" fill="none" stroke="#bd856c" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M235 289Q246 284 257 288Q270 284 281 289Q259 311 235 289" fill="#b56d63"/>
        <path d="M237 290Q257 298 279 290" fill="none" stroke="#734a46" strokeWidth="1.6"/>
        <path d="M248 301Q258 304 268 300" stroke="#e4ab98" fill="none" strokeWidth="2" strokeLinecap="round"/>
        <path d="M175 239Q151 181 176 144Q205 96 252 112Q316 91 340 156Q351 191 332 233L321 201Q278 207 234 164Q217 199 188 204L188 247Z" fill={`url(#${id}hair)`}/>
        <path d="M181 185Q198 139 241 130M250 126Q300 119 324 165" fill="none" stroke="#9b7d61" strokeOpacity=".3" strokeWidth="3" strokeLinecap="round"/>
        <ellipse cx="183" cy="270" rx="7" ry="10" fill="none" stroke="#d9bc81" strokeWidth="3"/><ellipse cx="327" cy="269" rx="6" ry="10" fill="none" stroke="#d9bc81" strokeWidth="3"/>
      </g>
      {signing && <SigningArms time={time} skin={`url(#${id}skin)`} jacket={`url(#${id}jacket)`} guides={guides}/>}
    </g>
  </svg>;
}
