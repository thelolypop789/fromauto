// Backdrop of the readiness card: a sky that moves from night to full daylight as readiness grows, with clouds,
// mountains, hills and trees. Colours come from the card's lv-0..3 class (see .pp-rx in prep.css).
const STARS: [number, number, number][] = [
  [3, 12, 3], [8, 34, 2], [14, 9, 2], [20, 26, 3], [26, 6, 2], [33, 30, 2], [41, 14, 3], [46, 36, 2],
  [60, 9, 2], [65, 28, 3], [75, 7, 2], [82, 24, 2], [89, 12, 3], [96, 32, 2],
];
const TREES: [number, number, number][] = [
  [30, 128, 1], [70, 124, .8], [190, 118, 1.1], [240, 122, .8], [420, 128, 1], [470, 124, .9],
  [650, 118, 1.1], [700, 122, .8], [880, 116, 1], [930, 120, .8], [1060, 112, 1.1], [1110, 116, .9],
];

export default function ReadinessScene() {
  return (
    <div className="pp-rx-scene" aria-hidden="true">
      {STARS.map(([x, y, s], k) => (
        <i key={k} className="pp-rx-star" style={{ left: `${x}%`, top: `${y}%`, width: s, height: s, animationDelay: `${(k % 5) * .45}s` }} />
      ))}
      <div className="pp-rx-sun"><i /></div>
      <div className="pp-rx-moon" />
      <div className="pp-rx-cloud c1"><i /><i /><i /></div>
      <div className="pp-rx-cloud c2"><i /><i /><i /></div>
      <div className="pp-rx-cloud c3"><i /><i /><i /></div>
      <svg className="pp-rx-land" viewBox="0 0 1140 170" preserveAspectRatio="xMidYMax slice">
        <path className="far" d="M0 40 L90 -20 L150 16 L250 -52 L340 6 L420 -30 L520 26 L600 -20 L700 20 L800 -42 L900 12 L980 -24 L1060 6 L1140 -30 L1140 170 L0 170 Z" />
        <path className="snow" d="M250 -52 L272 -37 L262 -34 L250 -42 L238 -33 L229 -38 Z M800 -42 L822 -27 L812 -24 L800 -32 L788 -23 L779 -28 Z" />
        <path className="near" d="M0 76 L120 26 L210 62 L330 14 L450 66 L560 30 L690 68 L810 26 L930 64 L1040 36 L1140 60 L1140 170 L0 170 Z" />
        <path className="hill" d="M0 116 C 160 88, 320 96, 480 110 S 820 86, 1140 102 L1140 170 L0 170 Z" />
        {TREES.map(([x, y, s], k) => (
          <g key={k} transform={`translate(${x} ${y}) scale(${s})`} className={k % 2 ? "tree b" : "tree"}>
            <rect className="trunk" x="-2.5" y="-6" width="5" height="12" />
            <circle cx="0" cy="-16" r="13" /><circle cx="-7" cy="-10" r="8" /><circle cx="7" cy="-10" r="8" />
          </g>
        ))}
      </svg>
    </div>
  );
}
