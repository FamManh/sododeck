import { Link } from 'react-router';

export function Wordmark() {
  return (
    <Link to="/" className="flex items-center gap-2 text-title-sm font-semibold text-ink">
      <img src="/favicon.svg" alt="" className="size-6" />
      Sododeck
    </Link>
  );
}
