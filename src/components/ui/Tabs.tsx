import { useState, type ReactNode } from 'react';

interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
}

export function Tabs({ tabs, defaultTab }: TabsProps) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id);

  return (
    <div>
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                active === tab.id
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="py-6">
        {tabs.map((tab) => (
          <div key={tab.id} hidden={active !== tab.id}>
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
}
