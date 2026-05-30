import { Globe } from "../common/Icon";

const columns: { heading: string; links: string[] }[] = [
  {
    heading: "Support",
    links: [
      "Help Center",
      "Cancellation options",
      "Report neighborhood concern",
    ],
  },
  {
    heading: "Hosting",
    links: ["NextBnb your home", "Hosting resources", "Hosting responsibly"],
  },
  {
    heading: "Contact Me",
    links: ["Github", "Email", "Contact No."],
  },
];

export function Footer() {
  return (
    <footer className="bg-surface-canvas border-t border-hairline">
      <div className="mx-auto w-full max-w-[1280px] px-lg pt-xxl pb-lg">
        <div className="grid grid-cols-1 gap-xl pb-xl sm:grid-cols-3">
          {columns.map((col) => (
            <div key={col.heading}>
              <div className="t-title-sm mb-md">{col.heading}</div>
              <ul className="flex flex-col gap-md">
                {col.links.map((link) => (
                  <li key={link}>
                    <a href="#" className="t-body-sm text-ink hover:underline">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-md border-t border-hairline pt-lg sm:flex-row sm:items-center sm:justify-between">
          <div className="t-caption-sm text-ink-muted">
            © {new Date().getFullYear()} NextBnb, Inc.
          </div>
          <div className="flex items-center gap-lg text-ink">
            <button
              type="button"
              className="inline-flex items-center gap-2 t-caption hover:underline"
            >
              <Globe size={16} />
              English (IN)
            </button>
            <button type="button" className="t-caption hover:underline">
              ₹ INR
            </button>
            <div className="flex items-center gap-md">
              <a href="#" aria-label="Facebook" className="hover:opacity-80">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  width={18}
                  height={18}
                  fill="currentColor"
                >
                  <path d="M22 12a10 10 0 1 0-11.5 9.9v-7H8v-2.9h2.5V9.7c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z" />
                </svg>
              </a>
              <a href="#" aria-label="X" className="hover:opacity-80">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  width={16}
                  height={16}
                  fill="currentColor"
                >
                  <path d="M18.244 2H21l-6.522 7.452L22 22h-6.93l-4.59-6.05L4.8 22H2l7.018-8.018L2 2h7.07l4.18 5.52L18.244 2zm-1.21 18h1.9L7.05 4H5.06l11.974 16z" />
                </svg>
              </a>
              <a href="#" aria-label="Instagram" className="hover:opacity-80">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  width={18}
                  height={18}
                  fill="currentColor"
                >
                  <path d="M12 2.2c3.2 0 3.6 0 4.85.07 1.17.05 1.8.25 2.23.41.55.21.95.47 1.37.89.42.42.68.82.89 1.37.16.42.36 1.06.41 2.23.06 1.25.07 1.65.07 4.85s0 3.6-.07 4.85c-.05 1.17-.25 1.8-.41 2.23a3.7 3.7 0 0 1-.89 1.37 3.7 3.7 0 0 1-1.37.89c-.42.16-1.06.36-2.23.41-1.25.06-1.65.07-4.85.07s-3.6 0-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.37-.89 3.7 3.7 0 0 1-.89-1.37c-.16-.42-.36-1.06-.41-2.23C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.85c.05-1.17.25-1.8.41-2.23.21-.55.47-.95.89-1.37.42-.42.82-.68 1.37-.89.42-.16 1.06-.36 2.23-.41C8.4 2.2 8.8 2.2 12 2.2zm0 1.8c-3.15 0-3.52 0-4.76.07-1.07.05-1.65.23-2.04.38-.51.2-.88.44-1.27.83-.39.39-.63.76-.83 1.27-.15.39-.33.97-.38 2.04C2.65 8.48 2.65 8.85 2.65 12s0 3.52.07 4.76c.05 1.07.23 1.65.38 2.04.2.51.44.88.83 1.27.39.39.76.63 1.27.83.39.15.97.33 2.04.38 1.24.07 1.61.07 4.76.07s3.52 0 4.76-.07c1.07-.05 1.65-.23 2.04-.38.51-.2.88-.44 1.27-.83.39-.39.63-.76.83-1.27.15-.39.33-.97.38-2.04.07-1.24.07-1.61.07-4.76s0-3.52-.07-4.76c-.05-1.07-.23-1.65-.38-2.04a3.34 3.34 0 0 0-.83-1.27 3.34 3.34 0 0 0-1.27-.83c-.39-.15-.97-.33-2.04-.38C15.52 4 15.15 4 12 4zm0 3.06a4.94 4.94 0 1 1 0 9.88 4.94 4.94 0 0 1 0-9.88zm0 8.14a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zm5.13-8.34a1.15 1.15 0 1 1 0-2.3 1.15 1.15 0 0 1 0 2.3z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
