import { Bird, Target } from "lucide-react";

// lucide has no wolf — this is a small line-style wolf head that matches the
// lucide aesthetic (24 viewBox, 2px stroke, round joins) so it sits cleanly
// next to Bird and Target.
export function WolfIcon({ size = 18, strokeWidth = 2, className, style, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
      {...rest}
    >
      <path d="M4 4.5 L8.5 9 L15.5 9 L20 4.5 L18 13 L12 19.5 L6 13 Z" />
      <circle cx="9.4" cy="12" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="14.6" cy="12" r="0.7" fill="currentColor" stroke="none" />
      <path d="M11 15 L12 16 L13 15" />
    </svg>
  );
}

const MAP = { wolf: WolfIcon, roundrobin: Bird, bbb: Target };

export default function GameIcon({ type, size = 18, ...props }) {
  const Icon = MAP[type] || Bird;
  return <Icon size={size} {...props} />;
}
