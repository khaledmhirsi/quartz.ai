// Task utility functions for smart sorting and prioritization

import {
  AgentMessage,
  DeadlineType,
  EnergyLevel,
  generateAgentName,
  getAgentIcon,
  ImportanceLevel,
  Task,
  TaskDocument,
  TaskHistoryEntry,
  TaskInterviewData,
  TaskRenameSuggestion,
  TaskSpecificAgent,
  VAGUE_TITLE_PATTERNS,
} from '../types/task';

/**
 * Calculate priority score based on task interview data
 * Higher score = higher priority
 */
export function calculatePriorityScore(task: Partial<Task>): number {
  let score = 0;

  // Deadline Type Score (0-40)
  const deadlineScores: Record<DeadlineType, number> = {
    urgent: 40,
    flexible: 20,
    none: 5,
  };
  score += deadlineScores[task.deadlineType || 'none'];

  // Importance Level Score (0-35)
  const importanceScores: Record<ImportanceLevel, number> = {
    critical: 35,
    high: 25,
    medium: 15,
    low: 5,
  };
  score += importanceScores[task.importanceLevel || 'medium'];

  // Due Date Proximity Score (0-25)
  if (task.dueDate) {
    const now = new Date();
    const dueDate = new Date(task.dueDate);
    const daysUntilDue = Math.ceil(
      (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilDue < 0) {
      score += 25; // Overdue
    } else if (daysUntilDue === 0) {
      score += 23; // Due today
    } else if (daysUntilDue === 1) {
      score += 20; // Due tomorrow
    } else if (daysUntilDue <= 3) {
      score += 15; // Due within 3 days
    } else if (daysUntilDue <= 7) {
      score += 10; // Due within a week
    } else {
      score += 5; // Due later
    }
  }

  return Math.min(score, 100);
}

/**
 * Sort tasks by priority score (descending)
 */
export function sortTasksByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => b.priorityScore - a.priorityScore);
}

/**
 * Filter tasks suitable for Golden Time session
 */
export function filterTasksForGoldenTime(
  tasks: Task[],
  availableMinutes: number,
  currentEnergyLevel: EnergyLevel
): Task[] {
  const energyMatch: Record<EnergyLevel, EnergyLevel[]> = {
    high: ['high', 'medium', 'low'],
    medium: ['medium', 'low'],
    low: ['low'],
  };

  return tasks
    .filter((task) => {
      // Must not be completed
      if (task.status === 'done') return false;

      // Must fit within available time
      if (task.estimatedMinutes && task.estimatedMinutes > availableMinutes) {
        return false;
      }

      // Must match energy level
      if (
        task.energyRequired &&
        !energyMatch[currentEnergyLevel].includes(task.energyRequired)
      ) {
        return false;
      }

      return true;
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

/**
 * Get the best task suggestion for Golden Time
 */
export function getBestTaskForGoldenTime(
  tasks: Task[],
  availableMinutes: number,
  currentEnergyLevel: EnergyLevel = 'medium'
): Task | null {
  const eligibleTasks = filterTasksForGoldenTime(
    tasks,
    availableMinutes,
    currentEnergyLevel
  );
  return eligibleTasks.length > 0 ? eligibleTasks[0] : null;
}

/**
 * Check if a task title is vague and needs AI renaming
 */
export function isVagueTitle(title: string): boolean {
  const trimmed = title.trim().toLowerCase();
  
  // Check against vague patterns
  for (const pattern of VAGUE_TITLE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }
  
  // Check if title is too short (less than 5 chars after trimming)
  if (trimmed.length < 5) {
    return true;
  }
  
  return false;
}

/**
 * Generate AI rename suggestion for vague titles
 * In production, this would call an AI API
 */
export function generateRenameSuggestion(
  title: string,
  description?: string,
  context?: { deadline?: string; category?: string }
): TaskRenameSuggestion {
  const trimmed = title.trim().toLowerCase();
  let suggestedTitle = title;
  let reason = '';
  let confidence = 0.5;

  // Smart suggestions based on patterns
  if (/^meeting$/i.test(trimmed)) {
    suggestedTitle = description 
      ? `Meeting: ${description.split(' ').slice(0, 5).join(' ')}...`
      : 'Team sync meeting - add agenda';
    reason = 'Added context to generic meeting title';
    confidence = 0.7;
  } else if (/^(do|doing)\s+(stuff|things?)$/i.test(trimmed)) {
    suggestedTitle = description 
      ? description.split(' ').slice(0, 8).join(' ')
      : 'Task - please add specific details';
    reason = 'Replaced vague title with description content';
    confidence = 0.6;
  } else if (/^(email|message)s?$/i.test(trimmed)) {
    suggestedTitle = description
      ? `Email: ${description.split(' ').slice(0, 5).join(' ')}...`
      : 'Send email - add recipient and subject';
    reason = 'Added specificity to email task';
    confidence = 0.7;
  } else if (/^(fix|update|change)$/i.test(trimmed)) {
    suggestedTitle = description
      ? `${title.charAt(0).toUpperCase() + title.slice(1)}: ${description.split(' ').slice(0, 5).join(' ')}...`
      : `${title.charAt(0).toUpperCase() + title.slice(1)} - specify what needs ${trimmed}`;
    reason = 'Added details to action verb';
    confidence = 0.65;
  } else if (/^(check|review)$/i.test(trimmed)) {
    suggestedTitle = description
      ? `Review: ${description.split(' ').slice(0, 5).join(' ')}...`
      : 'Review - specify what to review';
    reason = 'Added context to review task';
    confidence = 0.7;
  } else if (trimmed.length < 5) {
    suggestedTitle = description
      ? description.split(' ').slice(0, 8).join(' ')
      : 'Task needs a descriptive title';
    reason = 'Title too short, needs more detail';
    confidence = 0.8;
  }

  // Add deadline context if urgent
  if (context?.deadline === 'urgent' && !suggestedTitle.toLowerCase().includes('urgent')) {
    suggestedTitle = `[URGENT] ${suggestedTitle}`;
    confidence += 0.1;
  }

  return {
    originalTitle: title,
    suggestedTitle,
    reason,
    confidence: Math.min(confidence, 1),
  };
}

/**
 * Create a task-specific agent for a task
 */
export function createTaskSpecificAgent(task: Task): TaskSpecificAgent {
  const agentName = generateAgentName(task.title);
  const icon = getAgentIcon(agentName);
  
  return {
    id: `agent-${task.id}`,
    taskId: task.id,
    name: agentName,
    type: 'task-specific',
    avatar: icon,
    context: {
      taskTitle: task.title,
      taskDescription: task.description,
      deadline: task.dueDate,
      priority: task.importanceLevel,
      energyLevel: task.energyRequired,
      documents: task.documents || [],
      previousMessages: task.agentMessages || [],
    },
    capabilities: [
      'Generate subtasks',
      'Write drafts',
      'Summarize documents',
      'Suggest next steps',
      'Answer task-specific questions',
    ],
    createdAt: new Date(),
  };
}

/**
 * Create a history entry for a task
 */
export function createHistoryEntry(
  action: TaskHistoryEntry['action'],
  description: string,
  previousValue?: string,
  newValue?: string
): TaskHistoryEntry {
  return {
    id: `history-${Date.now()}`,
    timestamp: new Date(),
    action,
    description,
    previousValue,
    newValue,
  };
}

/**
 * Simulate AI document processing
 * In production, this would call an AI API
 */
export function processDocument(doc: TaskDocument): TaskDocument {
  // Simulate AI processing
  const summaries: Record<string, string> = {
    pdf: 'This PDF document contains important project specifications and requirements.',
    docx: 'This Word document outlines the project timeline and milestones.',
    txt: 'This text file contains notes and references for the task.',
    md: 'This markdown file contains documentation and instructions.',
  };

  const insights: Record<string, string[]> = {
    pdf: [
      'Key deadline mentioned: End of quarter',
      'Budget allocation: $50,000',
      'Stakeholders: Marketing, Engineering, Product',
    ],
    docx: [
      'Phase 1 due in 2 weeks',
      'Requires approval from management',
      'Dependencies on external vendor',
    ],
    txt: [
      'Reference links included',
      'Contact information provided',
      'Action items listed',
    ],
    md: [
      'Setup instructions included',
      'Configuration steps documented',
      'Troubleshooting guide available',
    ],
  };

  return {
    ...doc,
    summary: summaries[doc.type] || 'Document uploaded successfully.',
    extractedInsights: insights[doc.type] || ['Document processed'],
    isProcessed: true,
  };
}

/**
 * Generate agent response based on context
 * In production, this would call an AI API
 */
export function generateAgentResponse(
  task: Task,
  userMessage: string,
  agent: TaskSpecificAgent
): AgentMessage {
  const responses: Record<string, string[]> = {
    default: [
      `I've analyzed "${task.title}" and I'm ready to help. What specific aspect would you like to work on?`,
      `Based on the task context, I suggest we start with ${task.nextStep || 'defining the first step'}. Would you like me to help with that?`,
      `I see this task has ${task.documents?.length || 0} documents attached. Would you like me to summarize them for you?`,
    ],
    subtasks: [
      `Here's a suggested breakdown for "${task.title}":\n\n1. Research and gather requirements\n2. Create initial draft/outline\n3. Review and iterate\n4. Finalize and deliver\n\nWould you like me to add these as subtasks?`,
    ],
    draft: [
      `I'll help you draft content for "${task.title}". Based on the description, here's a starting point:\n\n---\n\n**Introduction**\n[Context about the task]\n\n**Main Points**\n• Key point 1\n• Key point 2\n• Key point 3\n\n**Next Steps**\n[Recommended actions]\n\n---\n\nWould you like me to expand on any section?`,
    ],
    help: [
      `For "${task.title}", I recommend:\n\n1. **First Step**: ${task.nextStep || 'Review the requirements'}\n2. **Estimated Time**: ${task.estimatedMinutes || 30} minutes\n3. **Energy Level**: ${task.energyRequired} focus needed\n\nWant me to help you get started?`,
    ],
  };

  const lowerMessage = userMessage.toLowerCase();
  let responseType = 'default';
  
  if (lowerMessage.includes('subtask') || lowerMessage.includes('break down')) {
    responseType = 'subtasks';
  } else if (lowerMessage.includes('draft') || lowerMessage.includes('write')) {
    responseType = 'draft';
  } else if (lowerMessage.includes('help') || lowerMessage.includes('start') || lowerMessage.includes('suggest')) {
    responseType = 'help';
  }

  const responseList = responses[responseType];
  const content = responseList[Math.floor(Math.random() * responseList.length)];

  return {
    id: `msg-${Date.now()}`,
    role: 'assistant',
    content,
    timestamp: new Date(),
    suggestions: [
      'Break this into subtasks',
      'Help me write a draft',
      'What should I focus on first?',
    ],
  };
}

/**
 * Create a new task from interview data
 */
export function createTaskFromInterview(
  data: TaskInterviewData,
  columnId: string = 'todo',
  ownerId: string = 'anonymous'
): Omit<Task, 'id'> {
  const now = new Date();

  const partialTask: Partial<Task> = {
    deadlineType: data.deadlineType,
    importanceLevel: data.importanceLevel,
    dueDate: data.dueDate,
  };

  // Check if title needs AI suggestion
  const needsRename = isVagueTitle(data.title);
  let suggestedTitle: string | undefined;
  
  if (needsRename) {
    const suggestion = generateRenameSuggestion(data.title, data.description, {
      deadline: data.deadlineType,
    });
    suggestedTitle = suggestion.suggestedTitle;
  }

  return {
    title: data.title,
    originalTitle: needsRename ? data.title : undefined,
    suggestedTitle: needsRename ? suggestedTitle : undefined,
    titleAccepted: false,
    description: data.description,
    deadlineType: data.deadlineType,
    importanceLevel: data.importanceLevel,
    energyRequired: data.energyRequired,
    nextStep: data.nextStep,
    status: 'planned',
    category: 'internal',
    dueDate: data.dueDate,
    createdAt: now,
    updatedAt: now,
    estimatedMinutes: data.estimatedMinutes,
    priorityScore: calculatePriorityScore(partialTask),
    subSteps: [],
    agentMessages: [],
    documents: [],
    history: [createHistoryEntry('created', 'Task created')],
    commentsCount: 0,
    ownerId,
    tags: [],
    columnId,
    position: 0,
  };
}

/**
 * Format time duration
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Get relative time string
 */
export function getRelativeTimeString(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const absDays = Math.abs(diffDays);
    if (absDays === 1) return 'Yesterday';
    if (absDays < 7) return `${absDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) return `In ${diffDays} days`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Generate sample tasks for demo
 */
export function generateSampleTasks(ownerId: string = 'demo-user'): Task[] {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  return [
    {
      id: '1',
      title: 'Approve SMB documents',
      description:
        'We need to approve the SMB documents before we even get started on this project.',
      deadlineType: 'urgent',
      importanceLevel: 'critical',
      energyRequired: 'medium',
      nextStep: 'Review the contract terms',
      status: 'done',
      category: 'internal',
      dueDate: tomorrow,
      createdAt: now,
      updatedAt: now,
      estimatedMinutes: 30,
      priorityScore: 85,
      subSteps: [
        { id: '1-1', title: 'Review contract terms', completed: true },
        { id: '1-2', title: 'Check compliance', completed: true },
        { id: '1-3', title: 'Get approval signature', completed: true },
      ],
      agentMessages: [],
      documents: [],
      history: [createHistoryEntry('created', 'Task created')],
      commentsCount: 0,
      ownerId,
      tags: ['contract', 'legal'],
      columnId: 'done',
      position: 0,
    },
    {
      id: '2',
      title: 'Check on email open rate and follow-up with their CEO',
      description: 'Review email campaign metrics and schedule follow-up call.',
      deadlineType: 'urgent',
      importanceLevel: 'high',
      energyRequired: 'low',
      nextStep: 'Check analytics dashboard',
      status: 'in_progress',
      category: 'needs_action',
      dueDate: now,
      createdAt: now,
      updatedAt: now,
      estimatedMinutes: 20,
      priorityScore: 78,
      subSteps: [
        { id: '2-1', title: 'Check analytics dashboard', completed: true },
        { id: '2-2', title: 'Prepare follow-up email', completed: false },
        { id: '2-3', title: 'Schedule call with CEO', completed: false },
      ],
      agentMessages: [],
      documents: [
        {
          id: 'doc-1',
          name: 'Campaign Report Q4.pdf',
          type: 'pdf',
          size: 245000,
          url: '/docs/campaign-report.pdf',
          uploadedAt: now,
          summary: 'Q4 email campaign performance report showing 24% open rate.',
          extractedInsights: [
            'Open rate: 24%',
            'Click-through rate: 8%',
            'Best performing subject line: "Quick question"',
          ],
          isProcessed: true,
        },
      ],
      history: [
        createHistoryEntry('created', 'Task created'),
        createHistoryEntry('document_added', 'Added Campaign Report Q4.pdf'),
      ],
      commentsCount: 3,
      ownerId,
      tags: ['email', 'follow-up'],
      columnId: 'in-progress',
      position: 0,
    },
    {
      id: '3',
      title: 'Champion has departed and needs action',
      description: 'Our main contact has left the company. Need to establish new relationship.',
      deadlineType: 'flexible',
      importanceLevel: 'medium',
      energyRequired: 'high',
      nextStep: 'Identify new point of contact',
      status: 'planned',
      category: 'customer',
      dueDate: nextWeek,
      createdAt: now,
      updatedAt: now,
      estimatedMinutes: 45,
      priorityScore: 55,
      subSteps: [
        { id: '3-1', title: 'Identify new point of contact', completed: false },
        { id: '3-2', title: 'Schedule intro meeting', completed: false },
        { id: '3-3', title: 'Transfer context and history', completed: false },
      ],
      agentMessages: [],
      documents: [],
      history: [createHistoryEntry('created', 'Task created')],
      commentsCount: 0,
      ownerId,
      tags: ['relationship', 'customer'],
      columnId: 'todo',
      position: 0,
    },
    {
      id: '4',
      title: 'Review project proposal',
      description: 'Review the Q2 project proposal document.',
      deadlineType: 'urgent',
      importanceLevel: 'high',
      energyRequired: 'medium',
      nextStep: 'Read through proposal',
      status: 'planned',
      category: 'internal',
      dueDate: now,
      createdAt: now,
      updatedAt: now,
      estimatedMinutes: 25,
      priorityScore: 82,
      subSteps: [],
      agentMessages: [],
      documents: [],
      history: [createHistoryEntry('created', 'Task created')],
      commentsCount: 0,
      ownerId,
      tags: ['proposal', 'review'],
      columnId: 'todo',
      position: 1,
    },
    {
      id: '5',
      title: 'Team meeting at 3 PM',
      description: 'Weekly team sync to discuss progress and blockers.',
      deadlineType: 'urgent',
      importanceLevel: 'medium',
      energyRequired: 'low',
      nextStep: 'Prepare agenda',
      status: 'planned',
      category: 'internal',
      dueDate: now,
      createdAt: now,
      updatedAt: now,
      estimatedMinutes: 60,
      priorityScore: 70,
      subSteps: [],
      agentMessages: [],
      documents: [],
      history: [createHistoryEntry('created', 'Task created')],
      commentsCount: 0,
      ownerId,
      tags: ['meeting', 'team'],
      columnId: 'todo',
      position: 2,
    },
    {
      id: '6',
      title: 'Update documentation',
      description: 'Update the API documentation with new endpoints.',
      deadlineType: 'flexible',
      importanceLevel: 'medium',
      energyRequired: 'medium',
      nextStep: 'Review current docs',
      status: 'planned',
      category: 'internal',
      dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
      estimatedMinutes: 90,
      priorityScore: 45,
      subSteps: [],
      agentMessages: [],
      documents: [],
      history: [createHistoryEntry('created', 'Task created')],
      commentsCount: 0,
      ownerId,
      tags: ['docs', 'api'],
      columnId: 'todo',
      position: 3,
    },
    {
      id: '7',
      title: 'Prepare presentation',
      description: 'Create slides for the client presentation next week.',
      deadlineType: 'flexible',
      importanceLevel: 'high',
      energyRequired: 'high',
      nextStep: 'Outline key points',
      status: 'planned',
      category: 'customer',
      dueDate: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
      estimatedMinutes: 120,
      priorityScore: 60,
      subSteps: [],
      agentMessages: [],
      documents: [],
      history: [createHistoryEntry('created', 'Task created')],
      commentsCount: 0,
      ownerId,
      tags: ['presentation', 'client'],
      columnId: 'todo',
      position: 4,
    },
  ];
}
