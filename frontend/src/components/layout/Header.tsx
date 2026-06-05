import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { googleLoginUrl } from "../../api/auth";
import { Hamburger, UserCircle } from "../common/Icon";

/* White 80px global nav. Wordmark left, account cluster right.
 * 1px bottom hairline. */
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

        <div className="flex items-center gap-xs">
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
            <a
              href={googleLoginUrl()}
              className="flex items-center gap-2 rounded border px-3 py-1.5 hover:shadow-card-soft transition-shadow bg-surface-canvas"
              style={{ borderColor: "#dadce0" }}
            >
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                ></path>
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.33 38.02 46.98 31.86 46.98 24.55z"
                ></path>
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                ></path>
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                ></path>
                <path fill="none" d="M0 0h48v48H0z"></path>
              </svg>
              <span
                className="t-body-sm font-medium"
                style={{
                  color: "#3c4043",
                  fontFamily: "Roboto, arial, sans-serif",
                }}
              >
                Sign in
              </span>
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
