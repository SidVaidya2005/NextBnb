import type { HTMLAttributes, ReactNode } from "react";

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  elevated?: boolean;
}

/* Soft Airbnb-style card: white fill, 14px radius. Border is optional
 * (the homepage property cards have no border — the photo is the card).
 * `elevated` opts into the single shadow tier used on dropdowns and search. */
export function Card({ className = "", children, elevated, ...rest }: Props) {
  const elevation = elevated ? "shadow-card-soft" : "border border-hairline";
  return (
    <div
      className={`bg-surface-canvas rounded-md ${elevation} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
