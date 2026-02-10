import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Task Workspace - Quartz',
  description: 'Chat-first AI task management with dedicated sub-agents',
};

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen overflow-hidden">
      {children}
    </div>
  );
}
