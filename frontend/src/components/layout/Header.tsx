import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Globe, Hamburger, UserCircle } from "../common/Icon";
import { ProductTabs } from "./ProductTabs";

/* White 80px global nav. Wordmark left, centered ProductTabs, right cluster
 * (host link, globe, account menu pill). 1px bottom hairline. */
export function Header() {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-surface-canvas border-b border-hairline">
      <div className="mx-auto flex h-20 w-full max-w-[1280px] items-center justify-between px-lg">
        <Link
          to="/"
          aria-label="NextBnb"
          className="flex items-center gap-1 text-rausch"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 32 32"
            width={32}
            height={32}
            fill="currentColor"
            aria-hidden
          >
            <path d="M16 1C8 1 1 8 1 16c0 4 1.5 7.6 4 10.4 1 1.1 2.5 1.6 4 1.6 1.7 0 3.4-.8 4.5-2.2L16 22.5l2.5 3.3c1.1 1.4 2.8 2.2 4.5 2.2 1.5 0 3-.5 4-1.6C29.5 23.6 31 20 31 16c0-8-7-15-15-15zm0 22.5l-3.5-4.6c-1.2-1.6-3-2.5-5-2.5-1 0-2 .3-2.7 1C3.6 15.7 3 11 6.8 7.2 9.5 4.5 13.5 4 16 6.5c2.5-2.5 6.5-2 9.2.7C29 11 28.4 15.7 27.2 17.4c-.7-.7-1.7-1-2.7-1-2 0-3.8.9-5 2.5L16 23.5z" />
          </svg>
          <span className="text-[22px] font-bold tracking-tight hidden md:inline">
            NextBnb
          </span>
        </Link>

        <div className="hidden md:block">
          <ProductTabs />
        </div>

        <div className="flex items-center gap-xs">
          <Link
            to="/listings/new"
            className="hidden rounded-full px-md py-sm t-button-sm text-ink hover:bg-surface-soft md:inline-block"
          >
            NextBnb your home
          </Link>
          <button
            type="button"
            aria-label="Choose a language"
            className="hidden rounded-full p-md text-ink hover:bg-surface-soft md:inline-flex"
          >
            <Globe size={16} />
          </button>
          {isAuthenticated ? (
            <div className="flex items-center gap-sm rounded-full border border-hairline px-md py-1.5 hover:shadow-card-soft">
              <Hamburger size={16} className="text-ink" />
              <Link to="/profile" className="flex items-center gap-2">
                <UserCircle size={32} className="text-ink-muted" />
                <span className="t-body-sm hidden lg:inline">
                  {user?.name ?? "Profile"}
                </span>
              </Link>
              <button
                type="button"
                onClick={logout}
                className="t-body-sm text-ink-muted hover:text-ink"
              >
                Log out
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-sm rounded-full border border-hairline px-md py-1.5 hover:shadow-card-soft"
            >
              <Hamburger size={16} className="text-ink" />
              <UserCircle size={32} className="text-ink-muted" />
              <button type="button" className="t-body-sm pr-2 text-ink">
                Log in
              </button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
