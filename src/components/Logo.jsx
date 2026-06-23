// Renders the official Golf P'la Fresquinha badge artwork (public/logo.png).
// `withText` is accepted for backward compatibility with existing call sites
// but has no effect — the real logo always has the lettering baked in, and at
// the small sizes it's used (e.g. the navbar) the text was always illegible
// anyway, matching the old hand-drawn version's behavior at that scale.
export default function Logo({ size = 72 }) {
  return (
    <img
      src="/logo.png"
      alt="Golf P'la Fresquinha"
      width={size}
      height={size}
      style={{ display: "block", width: size, height: size }}
    />
  );
}
