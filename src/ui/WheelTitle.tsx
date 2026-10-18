import { useRef } from 'react';

/**
 * The wheel's title and subtitle. When the wheel changes, the new title is lettered in from
 * the left, as a scribe would gild it; the first title on screen is simply there.
 */
export function WheelTitle({ title, subtitle, className }: { title: string; subtitle?: string | undefined; className: string }) {
  const first = useRef(title);
  const changed = useRef(false);
  if (title !== first.current) changed.current = true;
  const inscribe = changed.current;
  return (
    <div key={title}>
      <h1 id="wheel-title" className={`${className} ${inscribe ? 'inscribe' : ''}`}>
        {title}
      </h1>
      {subtitle && (
        <p className={`mt-2 line-clamp-2 text-base text-ash sm:text-lg ${inscribe ? 'inscribe-after' : ''}`} title={subtitle}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
