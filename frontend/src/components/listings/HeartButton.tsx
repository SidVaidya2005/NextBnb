import { useState, type MouseEvent } from 'react';
import { HeartFilled, HeartOutline } from '../common/Icon';

interface Props {
  initialSaved?: boolean;
  size?: number;
  className?: string;
}

/* Circular heart save toggle. Default outline-white over photos; clicks flip
 * to Rausch-filled. Local state only — wiring to the wishlist API waits for
 * that service to come online. */
export function HeartButton({ initialSaved = false, size = 22, className = '' }: Props) {
  const [saved, setSaved] = useState(initialSaved);

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setSaved((s) => !s);
  }

  return (
    <button
      type="button"
      aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
      aria-pressed={saved}
      onClick={handleClick}
      className={`press inline-flex items-center justify-center ${className}`}
    >
      {saved ? (
        <HeartFilled size={size} className="text-rausch" />
      ) : (
        <HeartOutline size={size} className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
      )}
    </button>
  );
}
