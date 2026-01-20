/**
 * NeuroFAQ Logo Component
 * 軟體品牌 Logo
 */

interface LogoProps {
  width?: number | string;
  height?: number | string;
  className?: string;
}

export default function Logo({ width = 1200, height = 300, className }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 1200 300"
      className={className}
    >
      {/* Transparent background */}
      <rect width="100%" height="100%" fill="none" />

      {/* NeuroFAQ (no space) */}
      <text
        x="0"
        y="200"
        fontSize="200"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="700"
        letterSpacing="-4"
      >
        <tspan fill="#1F3A5F">Neuro</tspan>
        <tspan fill="#2FA4E7">FAQ</tspan>
      </text>
    </svg>
  );
}
