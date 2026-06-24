import type { ReactNode } from 'react';

interface TableProps {
  children: ReactNode;
  className?: string;
}

export function Table({ children, className = '' }: TableProps) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full divide-y divide-gray-200 text-left">
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-gray-50">
      <tr>{children}</tr>
    </thead>
  );
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-gray-200 bg-white">{children}</tbody>;
}

export function TableHeader({ children }: { children: ReactNode }) {
  return (
    <th
      scope="col"
      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
    >
      {children}
    </th>
  );
}

export function TableCell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <td className={`px-4 py-3 whitespace-nowrap text-sm text-gray-700 ${className}`}>
      {children}
    </td>
  );
}
