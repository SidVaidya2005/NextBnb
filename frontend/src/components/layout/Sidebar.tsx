import { NavLink } from 'react-router-dom';

const sections = [
  {
    title: 'Browse',
    items: [
      { to: '/listings', label: 'All listings' },
      { to: '/listings/new', label: 'Add listing' },
    ],
  },
  {
    title: 'Account',
    items: [
      { to: '/profile', label: 'Profile' },
      { to: '/bookings', label: 'My bookings' },
      { to: '/wishlist', label: 'Wishlist' },
    ],
  },
];

export function Sidebar() {
  return (
    <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-slate-50 lg:block">
      <nav className="sticky top-16 flex flex-col gap-6 p-6">
        {sections.map((section) => (
          <div key={section.title} className="flex flex-col gap-1">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {section.title}
            </h4>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-md px-2 py-1 text-sm ${
                    isActive
                      ? 'bg-slate-200 text-slate-900'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
