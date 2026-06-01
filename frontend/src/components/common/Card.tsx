import type { HTMLAttributes, ReactNode } from "react";

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/* Soft Airbnb-style card: white fill, 14px radius, hairline border. */
export function Card({ className = "", children, ...rest }: Props) {
  return (
    <div
      className={`bg-surface-canvas rounded-md border border-hairline ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
