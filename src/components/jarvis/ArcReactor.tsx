/**
 * Réacteur arc animé, cœur visuel de l'interface.
 *
 * `thinking` = Jarvis prépare une réponse : le réacteur « respire » et le
 * sous-titre change.
 */
import { cn } from "@/lib/utils";

// Nombre d'éléments de chaque anneau (du plus externe au plus interne).
const ticks = Array.from({ length: 96 }, (_, i) => i);
const micro = Array.from({ length: 140 }, (_, i) => i);
const outerMesh = Array.from({ length: 48 }, (_, i) => {
  const angle = (i / 48) * Math.PI * 2;
  const radius = 162 + Math.sin(i * 2.17) * 13;
  return { x: 200 + Math.cos(angle) * radius, y: 200 + Math.sin(angle) * radius };
});
const middleMesh = Array.from({ length: 36 }, (_, i) => {
  const angle = (i / 36) * Math.PI * 2;
  const radius = 148 + Math.cos(i * 1.73) * 11;
  return { x: 200 + Math.cos(angle) * radius, y: 200 + Math.sin(angle) * radius };
});
const edgeMesh = Array.from({ length: 72 }, (_, i) => {
  const angle = (i / 72) * Math.PI * 2;
  const radius = 192 + Math.sin(i * 1.31) * 4;
  return { x: 200 + Math.cos(angle) * radius, y: 200 + Math.sin(angle) * radius };
});

// Points stables pour dessiner un réseau sphérique, façon cartographie holographique.
const networkNodes = Array.from({ length: 58 }, (_, i) => {
  const angle = i * 2.399963;
  const radius = 132 * Math.sqrt((i + 0.5) / 58);
  const x = 200 + Math.cos(angle) * radius;
  const y = 200 + Math.sin(angle) * radius;
  const z = Math.sqrt(Math.max(0, 1 - (radius / 142) ** 2));
  return { x, y, z };
});
const networkLinks = networkNodes.flatMap((node, i) =>
  networkNodes
    .slice(i + 1)
    .map((other, offset) => ({
      id: `${i}-${i + offset + 1}`,
      x1: node.x,
      y1: node.y,
      x2: other.x,
      y2: other.y,
      depth: Math.min(node.z, other.z),
      distance: Math.hypot(node.x - other.x, node.y - other.y),
    }))
    .filter((link) => link.distance < 43),
);

/** Accès sûr aux voisins d'une couronne circulaire non vide. */
function circularAt<T>(items: T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new RangeError("Point de couronne introuvable");
  return item;
}

/** Convertit un angle en degrés en coordonnées x / y sur un cercle. */
const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const;
};

/** Chemin SVG d'un arc de cercle centré au milieu du dessin (200, 200). */
const arc = (r: number, start: number, end: number) => {
  const [x1, y1] = polar(200, 200, r, start);
  const [x2, y2] = polar(200, 200, r, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
};

/** Force la rotation autour du centre exact (nécessaire sur Safari). */
const spinStyle = {
  transformBox: "border-box",
  transformOrigin: "50% 50%",
} as const;

export function ArcReactor({ thinking = false }: { thinking?: boolean }) {
  return (
    <div
      className={cn(
        "hud-reactor relative mx-auto aspect-square w-full max-w-155",
        thinking && "hud-reactor-thinking hud-thinking",
      )}
    >
      {/* Sphère cartographique et noyau lumineux, inspirés de la référence. */}
      <div
        className={cn(
          "absolute inset-[17%] rounded-full blur-3xl hud-pulse",
          thinking ? "bg-violet-500/20" : "bg-sky-500/10",
        )}
      />
      <div
        className={cn(
          "absolute inset-[31%] rounded-full blur-2xl hud-pulse",
          thinking ? "bg-indigo-300/35" : "bg-cyan-300/20",
        )}
      />
      <svg
        viewBox="0 0 400 400"
        className={cn(
          "hud-globe absolute inset-[12%] h-[76%] w-[76%] overflow-visible",
          thinking && "hud-globe-thinking",
        )}
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="globe-fill" cx="38%" cy="34%" r="70%">
            <stop offset="0%" stopColor="oklch(0.78 0.14 215)" stopOpacity="0.2" />
            <stop offset="62%" stopColor="oklch(0.35 0.12 235)" stopOpacity="0.09" />
            <stop offset="100%" stopColor="oklch(0.2 0.08 250)" stopOpacity="0.02" />
          </radialGradient>
          <clipPath id="globe-clip">
            <circle cx="200" cy="200" r="142" />
          </clipPath>
          <filter id="node-glow" x="-300%" y="-300%" width="700%" height="700%">
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g className={cn("hud-globe-content", thinking && "hud-globe-content-thinking")}>
          <circle
            cx="200"
            cy="200"
            r="142"
            fill="url(#globe-fill)"
            stroke="oklch(0.78 0.14 215 / 55%)"
            strokeWidth="1.5"
          />
          <g clipPath="url(#globe-clip)" fill="none" stroke="oklch(0.68 0.16 195 / 30%)">
            <ellipse cx="200" cy="200" rx="138" ry="48" />
            <ellipse cx="200" cy="200" rx="138" ry="92" />
            <ellipse cx="200" cy="200" rx="62" ry="138" />
            <ellipse cx="200" cy="200" rx="108" ry="138" />
            {networkLinks.map(({ id, x1, y1, x2, y2, depth }) => (
              <line key={id} x1={x1} y1={y1} x2={x2} y2={y2} opacity={0.18 + depth * 0.48} />
            ))}
          </g>
          <g filter="url(#node-glow)">
            {networkNodes.map(({ x, y, z }, i) => (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={i % 9 === 0 ? 3.2 : 1.6}
                fill={i % 11 === 0 ? "oklch(0.74 0.14 52)" : "oklch(0.78 0.14 215)"}
                opacity={0.28 + z * 0.7}
              />
            ))}
          </g>
          <circle
            cx="200"
            cy="200"
            r="63"
            fill="oklch(0.68 0.16 195 / 13%)"
            stroke="oklch(0.78 0.14 215 / 65%)"
            strokeWidth="1.5"
          />
          <circle
            cx="200"
            cy="200"
            r="52"
            fill="url(#globe-fill)"
            stroke="oklch(0.83 0.11 200 / 55%)"
            strokeWidth="1"
          />
          <circle
            cx="200"
            cy="200"
            r="38"
            fill="oklch(0.78 0.14 215 / 22%)"
            className={cn("hud-core-light", thinking && "hud-core-light-thinking")}
          />
          <circle cx="200" cy="200" r="23" fill="oklch(0.88 0.1 200 / 45%)" />
        </g>
      </svg>

      {/* Anneau à l'extrémité : graduations légères et maillage de points reliés. */}
      <div className="spin-reverse absolute inset-0" style={spinStyle}>
        <svg viewBox="0 0 400 400" className="block h-full w-full overflow-visible">
          {micro.map((i) => {
            const deg = (i / micro.length) * 360;
            const [x1, y1] = polar(200, 200, 198, deg);
            const [x2, y2] = polar(200, 200, i % 5 === 0 ? 188 : 193, deg);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="currentColor"
                className={i % 5 === 0 ? "text-accent/70" : "text-primary/25"}
                strokeWidth={i % 5 === 0 ? 1.6 : 0.7}
              />
            );
          })}
          <g fill="none" className={thinking ? "hud-edge-thinking" : ""} strokeWidth="0.8">
            {edgeMesh.map((point, i) => {
              const next = circularAt(edgeMesh, (i + 1) % edgeMesh.length);
              const across = circularAt(edgeMesh, (i + 5) % edgeMesh.length);
              return (
                <g key={i}>
                  <line
                    x1={point.x}
                    y1={point.y}
                    x2={next.x}
                    y2={next.y}
                    className="stroke-primary/35"
                  />
                  {i % 2 === 0 ? (
                    <line
                      x1={point.x}
                      y1={point.y}
                      x2={across.x}
                      y2={across.y}
                      className="stroke-accent/40"
                    />
                  ) : null}
                </g>
              );
            })}
          </g>
          {edgeMesh.map((point, i) => (
            <circle
              key={`edge-${i}`}
              cx={point.x}
              cy={point.y}
              r={i % 9 === 0 ? 2.4 : 1.25}
              className={i % 12 === 0 ? "fill-[oklch(0.74_0.14_52)]" : "fill-primary/75"}
            />
          ))}
          <path
            d={arc(180, 12, 96)}
            fill="none"
            className="stroke-accent"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d={arc(180, 200, 268)}
            fill="none"
            className="stroke-primary"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Couronne externe en réseau, avec des mailles fines plutôt que des blocs. */}
      <div className="spin-slow absolute inset-[5%]" style={spinStyle}>
        <svg
          viewBox="0 0 400 400"
          className="block h-full w-full overflow-visible"
          aria-hidden="true"
        >
          <g fill="none" className="stroke-primary/25" strokeWidth="0.8">
            {outerMesh.map((point, i) => {
              const next = circularAt(outerMesh, (i + 1) % outerMesh.length);
              const skip = circularAt(outerMesh, (i + 4) % outerMesh.length);
              return (
                <g key={i}>
                  <line x1={point.x} y1={point.y} x2={next.x} y2={next.y} />
                  {i % 2 === 0 ? (
                    <line
                      x1={point.x}
                      y1={point.y}
                      x2={skip.x}
                      y2={skip.y}
                      className="stroke-accent/25"
                    />
                  ) : null}
                </g>
              );
            })}
          </g>
          {outerMesh.map((point, i) => (
            <circle
              key={i}
              cx={point.x}
              cy={point.y}
              r={i % 6 === 0 ? 2.2 : 1.1}
              className={i % 9 === 0 ? "fill-accent/80" : "fill-primary/65"}
            />
          ))}
        </svg>
      </div>

      {/* Deuxième couronne maillée, légèrement décalée pour créer de la profondeur. */}
      <div className="spin-fast absolute inset-[10%]" style={spinStyle}>
        <svg
          viewBox="0 0 400 400"
          className="block h-full w-full overflow-visible"
          aria-hidden="true"
        >
          <g fill="none" className="stroke-accent/35" strokeWidth="1">
            {middleMesh.map((point, i) => {
              const next = circularAt(middleMesh, (i + 1) % middleMesh.length);
              const across = circularAt(middleMesh, (i + 5) % middleMesh.length);
              return (
                <g key={i}>
                  <line x1={point.x} y1={point.y} x2={next.x} y2={next.y} />
                  {i % 3 === 0 ? (
                    <line
                      x1={point.x}
                      y1={point.y}
                      x2={across.x}
                      y2={across.y}
                      className="stroke-primary/35"
                    />
                  ) : null}
                </g>
              );
            })}
          </g>
          {middleMesh.map((point, i) => (
            <circle
              key={i}
              cx={point.x}
              cy={point.y}
              r={i % 6 === 0 ? 2.5 : 1.35}
              className={i % 10 === 0 ? "fill-[oklch(0.74_0.14_52)]" : "fill-primary/75"}
            />
          ))}
          <path
            d={arc(140, 150, 330)}
            fill="none"
            className="stroke-accent/70"
            strokeWidth="2"
            strokeDasharray="18 8"
          />
        </svg>
      </div>

      {/* anneau de ticks */}
      <div className="spin-reverse absolute inset-[18%]" style={spinStyle}>
        <svg viewBox="0 0 400 400" className="block h-full w-full overflow-visible">
          {ticks.map((i) => {
            const deg = (i / ticks.length) * 360;
            const [x1, y1] = polar(200, 200, 138, deg);
            const [x2, y2] = polar(200, 200, i % 8 === 0 ? 114 : 126, deg);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="currentColor"
                className={i % 8 === 0 ? "text-primary" : "text-primary/40"}
                strokeWidth={i % 8 === 0 ? 2.6 : 1.2}
              />
            );
          })}
        </svg>
      </div>

      {/* anneaux internes contra-rotatifs */}
      <div className="spin-slow absolute inset-[26%]" style={spinStyle}>
        <svg viewBox="0 0 400 400" className="block h-full w-full overflow-visible">
          <circle
            cx="200"
            cy="200"
            r="150"
            fill="none"
            className="stroke-accent/40"
            strokeWidth="6"
            strokeDasharray="60 40"
            strokeLinecap="round"
          />
          <circle
            cx="200"
            cy="200"
            r="120"
            fill="none"
            className="stroke-primary/50"
            strokeWidth="2"
            strokeDasharray="4 12"
          />
        </svg>
      </div>

      <div className="spin-fast absolute inset-[34%]" style={spinStyle}>
        <svg viewBox="0 0 400 400" className="block h-full w-full overflow-visible">
          <circle
            cx="200"
            cy="200"
            r="150"
            fill="none"
            className="stroke-primary/70"
            strokeWidth="8"
            strokeDasharray="140 300"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className="font-display text-sm font-black tracking-[0.22em] text-white hud-glow sm:text-base">
          J.A.R.V.I.S
        </p>
        <p
          className={cn(
            "absolute top-[57%] text-[9px] uppercase tracking-[0.3em]",
            thinking ? "hud-thinking-label" : "text-primary/90",
          )}
        >
          {thinking ? "Réflexion" : "Système en ligne"}
        </p>
      </div>
    </div>
  );
}
