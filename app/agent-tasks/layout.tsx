import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Agent Tasks | Quartz',
  description: 'Chat-first task management with AI agents',
};

export default function AgentTasksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
