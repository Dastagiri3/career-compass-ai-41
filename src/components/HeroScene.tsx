// Lightweight CSS-only animated "3D-feel" scene.
// Replaces a heavy three.js canvas to dramatically speed up initial load.
export function HeroScene() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="hero-blob hero-blob-1" />
      <div className="hero-blob hero-blob-2" />
      <div className="hero-blob hero-blob-3" />
      <div className="hero-blob hero-blob-4" />
      <div className="absolute inset-0 backdrop-blur-3xl" />
    </div>
  );
}
