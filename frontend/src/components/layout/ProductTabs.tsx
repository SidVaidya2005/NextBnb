import { useState } from "react";
import { ExperiencesIcon, HomesIcon, ServicesIcon } from "../common/Icon";

type TabKey = "homes" | "experiences" | "services";

const TABS: { key: TabKey; label: string; Icon: typeof HomesIcon }[] = [
  { key: "homes", label: "Homes", Icon: HomesIcon },
  { key: "experiences", label: "Experiences", Icon: ExperiencesIcon },
  { key: "services", label: "Services", Icon: ServicesIcon },
];

export function ProductTabs() {
  const [active, setActive] = useState<TabKey>("homes");
  return (
    <nav className="flex items-end gap-xl" aria-label="Product categories">
      {TABS.map(({ key, label, Icon }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => setActive(key)}
            className="relative flex flex-col items-center gap-1 pb-2"
          >
            <div className="relative">
              <Icon
                size={32}
                className={isActive ? "text-ink" : "text-ink-muted"}
              />
            </div>
            <span
              className={`t-caption ${isActive ? "text-ink" : "text-ink-muted"}`}
            >
              {label}
            </span>
            <span
              className={`absolute -bottom-px left-0 right-0 h-[2px] rounded-full ${
                isActive ? "bg-ink" : "bg-transparent"
              }`}
            />
          </button>
        );
      })}
    </nav>
  );
}
