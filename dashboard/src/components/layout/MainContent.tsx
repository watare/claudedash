import type { ReactNode } from 'react';

interface MainContentProps {
  children: ReactNode;
}

export function MainContent({ children }: MainContentProps) {
  return (
    <main className="flex-1 overflow-auto p-6 bg-[#0B0E11]">
      {children}
    </main>
  );
}
