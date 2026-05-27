import { useState } from 'react';
import { ExperiencesIcon, HomesIcon, ServicesIcon } from '../common/Icon';

type TabKey = 'homes' | 'experiences' | 'services';

const TABS: { key: TabKey; label: string; Icon: typeof HomesIcon; isNew?: boolean }[] = [
  { key: 'homes', label: 'Homes', Icon: HomesIcon },
  { key: 'experiences', label: 'Experiences', Icon: ExperiencesIcon, isNew: true },
  { key: 'services', label: 'Services', Icon: ServicesIcon, isNew: true },
];

function NewTag() {
  return (
    <span className="absolute -top-1 -right-3 inline-flex items-center rounded-full bg-ink px-[6px] py-[2px] t-uppercase-tag text-ink-on-primary">
      New
    </span>
  );
}

export function ProductTabs() {
  const [active, setActive] = useState<TabKey>('homes');
  return (
    <nav className="flex items-end gap-xl" aria-label="Product categories">
      {TABS.map(({ key, label, Icon, isNew }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => setActive(key)}
            className="relative flex flex-col items-center gap-1 pb-2"
          >
            <div className="relative">
              <Icon size={32} className={isActive ? 'text-ink' : 'text-ink-muted'} />
              {isNew && <NewTag />}
            </div>
            <span className={`t-caption ${isActive ? 'text-ink' : 'text-ink-muted'}`}>
              {label}
            </span>
            <span
              className={`absolute -bottom-px left-0 right-0 h-[2px] rounded-full ${
                isActive ? 'bg-ink' : 'bg-transparent'
              }`}
            />
          </button>
        );
      })}
    </nav>
  );
}
