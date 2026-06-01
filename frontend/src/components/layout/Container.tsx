import type { ReactNode } from "react";

type Width = "wide" | "narrow";

const MAX: Record<Width, string> = {
  wide: "max-w-[1280px]",
  narrow: "max-w-[1080px]",
};

/* Airbnb editorial widths — 1280px on browse/marketing pages, 1080px on
 * listing detail to keep the photo banner + reservation rail readable. */
export function Container({
  children,
  width = "wide",
}: {
  children: ReactNode;
  width?: Width;
}) {
  return <div className={`mx-auto w-full ${MAX[width]} px-lg`}>{children}</div>;
}
