import "./landing-glow.css";

/** Soft studio light behind the hero portrait: blurred colour fields with film
 * grain, drifting slowly. Photographic rather than graphic — no hard shapes. */
export function LandingGlow() {
  return (
    <div className="landing-glow" aria-hidden="true">
      <span className="lg-halo" />
      <span className="lg-field lg-field--a" />
      <span className="lg-field lg-field--b" />
      <span className="lg-field lg-field--c" />
      <span className="lg-floor" />
      <span className="lg-grain" />
    </div>
  );
}
