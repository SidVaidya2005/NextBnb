import { type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { HeartFilled, HeartOutline } from "../common/Icon";
import { useWishlist } from "../../hooks/useWishlist";
import type { Listing } from "../../types/Listing";

interface Props {
  listing: Listing;
  size?: number;
  className?: string;
}

/* Circular heart save toggle. Default outline-white over photos; saved flips
 * to Rausch-filled. Backed by the shared wishlist cache via useWishlist —
 * signed-out clicks redirect to /login. */
export function HeartButton({ listing, size = 22, className = "" }: Props) {
  const navigate = useNavigate();
  const { isAuthenticated, isSaved, toggle } = useWishlist();
  const saved = isSaved(listing._id);

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    toggle(listing);
  }

  return (
    <button
      type="button"
      aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
      aria-pressed={saved}
      onClick={handleClick}
      className={`press inline-flex items-center justify-center ${className}`}
    >
      {saved ? (
        <HeartFilled size={size} className="text-rausch" />
      ) : (
        <HeartOutline
          size={size}
          className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
        />
      )}
    </button>
  );
}
