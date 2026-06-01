import type { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";

/* Airbnb shell: white tri-nav, full-bleed main, white footer.
 * No SubNav row — categories live on the home page itself. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-surface-canvas">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
