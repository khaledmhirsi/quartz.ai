import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tasks | Quartz',
  description: 'Smart task management with AI assistance',
};

export default function TasksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
