import React from 'react';

/** Up to three stars, filled for the ones earned. */
export function Stars({ count, small = false }: { count: number; small?: boolean }) {
  const size = small ? 12 : 22;
  return (
    <span className={`ch-stars${small ? ' is-small' : ''}`} role="img" aria-label={`${count} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={i < count ? 'is-on' : ''}>
          <path d="M12 2.8l2.75 5.9 6.45.75-4.78 4.4 1.28 6.37L12 17.04 6.3 20.22l1.28-6.37L2.8 9.45l6.45-.75z" />
        </svg>
      ))}
    </span>
  );
}
