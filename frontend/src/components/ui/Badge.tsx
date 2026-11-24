import type { ProductStatus } from '../../types';

interface BadgeProps {
  status: ProductStatus;
}

export function Badge({ status }: BadgeProps) {
  const styles =
    status === 'Active'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
      : 'bg-amber-50 text-amber-700 ring-amber-600/20';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${styles}`}
    >
      {status}
    </span>
  );
}
