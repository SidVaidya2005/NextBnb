import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function svg(size: number, viewBox: string, rest: SVGProps<SVGSVGElement>) {
  return {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox,
    width: size,
    height: size,
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...rest,
  };
}

export function MagnifyingGlass({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...svg(size, "0 0 32 32", rest)} strokeWidth={3}>
      <circle cx={14} cy={14} r={10} />
      <path d="M21 21l7 7" />
    </svg>
  );
}

export function Globe({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...svg(size, "0 0 32 32", rest)} strokeWidth={2}>
      <circle cx={16} cy={16} r={13} />
      <path d="M3 16h26M16 3c4 4 6 8 6 13s-2 9-6 13c-4-4-6-8-6-13s2-9 6-13z" />
    </svg>
  );
}

export function Hamburger({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...svg(size, "0 0 32 32", rest)} strokeWidth={2}>
      <path d="M4 10h24M4 16h24M4 22h24" />
    </svg>
  );
}

export function UserCircle({ size = 24, ...rest }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="currentColor"
      {...rest}
    >
      <path d="M16 0a16 16 0 1 0 0 32 16 16 0 0 0 0-32zm0 8a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 21.6a13.6 13.6 0 0 1-9.4-3.8c.5-3.5 5.4-5.4 9.4-5.4s8.9 1.9 9.4 5.4A13.6 13.6 0 0 1 16 29.6z" />
    </svg>
  );
}

export function HeartOutline({ size = 20, ...rest }: IconProps) {
  return (
    <svg {...svg(size, "0 0 32 32", rest)} strokeWidth={2}>
      <path d="M16 28s-11-6.5-11-15a6 6 0 0 1 11-3 6 6 0 0 1 11 3c0 8.5-11 15-11 15z" />
    </svg>
  );
}

export function HeartFilled({ size = 20, ...rest }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="currentColor"
      stroke="white"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <path d="M16 28s-11-6.5-11-15a6 6 0 0 1 11-3 6 6 0 0 1 11 3c0 8.5-11 15-11 15z" />
    </svg>
  );
}

export function Star({ size = 12, ...rest }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="currentColor"
      {...rest}
    >
      <path d="M16 1.7l4.7 9.5 10.5 1.5-7.6 7.4 1.8 10.4L16 25.6 6.6 30.5l1.8-10.4L0.8 12.7l10.5-1.5z" />
    </svg>
  );
}

export function LaurelLeft({ size = 64, ...rest }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 64"
      width={size / 2}
      height={size}
      fill="currentColor"
      {...rest}
    >
      <path d="M28 2c-6 8-10 18-10 30s4 22 10 30c-1-8-4-15-9-21 5-2 9-6 11-12-4 1-8 3-11 6 0-4 1-9 3-13-3 1-6 3-8 6 1-9 5-17 14-26z" />
    </svg>
  );
}

export function LaurelRight({ size = 64, ...rest }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 64"
      width={size / 2}
      height={size}
      fill="currentColor"
      {...rest}
    >
      <path d="M4 2c6 8 10 18 10 30s-4 22-10 30c1-8 4-15 9-21-5-2-9-6-11-12 4 1 8 3 11 6 0-4-1-9-3-13 3 1 6 3 8 6-1-9-5-17-14-26z" />
    </svg>
  );
}

/* --- Three product-tab icons. Hand-illustrated tone, single-color stroke + soft fills. --- */

export function HomesIcon({ size = 32, ...rest }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <path
        d="M5 14l11-9 11 9v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V14z"
        fill="#f7f7f7"
      />
      <path d="M13 29v-7h6v7" />
      <path d="M2 16l14-12 14 12" strokeWidth={1.8} />
    </svg>
  );
}

export function ExperiencesIcon({ size = 32, ...rest }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <circle cx={16} cy={12} r={5} fill="#fff0f3" />
      <path d="M6 28c2-6 6-9 10-9s8 3 10 9" fill="#fff0f3" />
      <path d="M11 8c2-3 8-3 10 0M14 22l2 6 2-6" />
    </svg>
  );
}

export function ServicesIcon({ size = 32, ...rest }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <path
        d="M6 11h20l-2 16a2 2 0 0 1-2 1.7H10a2 2 0 0 1-2-1.7L6 11z"
        fill="#fff0f3"
      />
      <path d="M11 11V8a5 5 0 0 1 10 0v3" />
      <path d="M11 17l3 3 6-7" />
    </svg>
  );
}
