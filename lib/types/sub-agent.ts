// Sub-Agent Types for Chat-First Task Execution System

export type AgentRole = 
  | 'research'      // Research, data gathering, source finding
  | 'writing'       // Content creation, drafts, editing
  | 'email'         // Email drafting, outreach, follow-ups
  | 'lecture'       // Teaching, explanations, Q&A
  | 'coding'        // Code generation, debugging, architecture
  | 'planning'      // Task breakdown, scheduling, organization
  | 'design'        // Design feedback, UI/UX suggestions
  | 'analysis'      // Data analysis, document parsing
  | 'general';      // General purpose assistant

export type AgentCapability = 
  | 'summarize_documents'
  | 'extract_questions'
  | 'answer_from_docs'
  | 'generate_outline'
  | 'draft_email'
  | 'generate_code'
  | 'create_slides'
  | 'break_into_steps'
  | 'track_progress'
  | 'suggest_next_move'
  | 'quiz_user'
  | 'explain_concept'
  | 'format_content'
  | 'research_web';

export interface SubAgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  attachments?: AgentAttachment[];
  toolUsed?: string;
  suggestions?: string[];
  isThinking?: boolean;
}

export interface AgentAttachment {
  id: string;
  type: 'document' | 'image' | 'code' | 'link' | 'email_draft';
  name: string;
  content?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

export interface SubAgentContext {
  taskId: string;
  taskTitle: string;
  taskDescription?: string;
  deadline?: Date;
  deadlineType: 'urgent' | 'flexible' | 'none';
  priority: 'critical' | 'high' | 'medium' | 'low';
  energyRequired: 'high' | 'medium' | 'low';
  documents: DocumentContext[];
  interactionHistory: SubAgentMessage[];
  sessionState: Record<string, unknown>;
  createdAt: Date;
  lastActiveAt: Date;
}

export interface DocumentContext {
  id: string;
  name: string;
  type: string;
  summary?: string;
  extractedContent?: string;
  keyInsights?: string[];
  questions?: string[];
  uploadedAt: Date;
}

export interface SubAgent {
  id: string;
  taskId: string;
  name: string;
  role: AgentRole;
  avatar: string;
  personality: string;
  capabilities: AgentCapability[];
  systemPrompt: string;
  context: SubAgentContext;
  isActive: boolean;
  createdAt: Date;
  lastActiveAt: Date;
}

export interface AgentToolResult {
  tool: string;
  success: boolean;
  result?: unknown;
  error?: string;
  displayContent?: string;
}

// Agent role configurations with personalities and capabilities
export const AGENT_ROLE_CONFIG: Record<AgentRole, {
  name: string;
  avatar: string;
  personality: string;
  capabilities: AgentCapability[];
  keywords: string[];
}> = {
  research: {
    name: 'ResearchBot',
    avatar: '🔍',
    personality: 'Curious, thorough, and analytical. I love diving deep into topics and finding reliable sources.',
    capabilities: ['summarize_documents', 'extract_questions', 'answer_from_docs', 'research_web', 'generate_outline'],
    keywords: ['research', 'find', 'search', 'investigate', 'study', 'analyze', 'sources', 'papers', 'articles']
  },
  writing: {
    name: 'DraftBot',
    avatar: '✍️',
    personality: 'Creative, articulate, and detail-oriented. I help you express ideas clearly and compellingly.',
    capabilities: ['generate_outline', 'format_content', 'summarize_documents', 'suggest_next_move', 'break_into_steps'],
    keywords: ['write', 'draft', 'content', 'article', 'blog', 'copy', 'edit', 'proofread', 'document']
  },
  email: {
    name: 'OutreachAgent',
    avatar: '📧',
    personality: 'Professional, persuasive, and efficient. I craft messages that get responses.',
    capabilities: ['draft_email', 'format_content', 'suggest_next_move', 'track_progress'],
    keywords: ['email', 'message', 'outreach', 'contact', 'send', 'reply', 'follow-up', 'newsletter']
  },
  lecture: {
    name: 'LectureHelper',
    avatar: '🎓',
    personality: 'Patient, encouraging, and educational. I make complex topics accessible and memorable.',
    capabilities: ['summarize_documents', 'create_slides', 'explain_concept', 'quiz_user', 'answer_from_docs', 'generate_outline'],
    keywords: ['lecture', 'teach', 'learn', 'study', 'class', 'course', 'presentation', 'explain', 'understand', 'exam']
  },
  coding: {
    name: 'CodeBot',
    avatar: '💻',
    personality: 'Logical, precise, and helpful. I write clean code and explain technical concepts clearly.',
    capabilities: ['generate_code', 'explain_concept', 'break_into_steps', 'suggest_next_move', 'format_content'],
    keywords: ['code', 'program', 'develop', 'build', 'fix', 'debug', 'implement', 'api', 'function', 'script']
  },
  planning: {
    name: 'PlanBot',
    avatar: '📋',
    personality: 'Organized, strategic, and motivating. I help you break big goals into achievable steps.',
    capabilities: ['break_into_steps', 'track_progress', 'suggest_next_move', 'generate_outline'],
    keywords: ['plan', 'schedule', 'organize', 'timeline', 'deadline', 'project', 'manage', 'goal', 'milestone']
  },
  design: {
    name: 'DesignBot',
    avatar: '🎨',
    personality: 'Creative, aesthetic-focused, and user-centric. I help make things look and feel great.',
    capabilities: ['suggest_next_move', 'generate_outline', 'break_into_steps', 'format_content'],
    keywords: ['design', 'ui', 'ux', 'visual', 'layout', 'style', 'color', 'brand', 'interface', 'mockup']
  },
  analysis: {
    name: 'AnalyzeBot',
    avatar: '📊',
    personality: 'Data-driven, insightful, and methodical. I find patterns and extract meaning from information.',
    capabilities: ['summarize_documents', 'extract_questions', 'answer_from_docs', 'generate_outline', 'explain_concept'],
    keywords: ['analyze', 'data', 'report', 'metrics', 'chart', 'statistics', 'insights', 'trends', 'review']
  },
  general: {
    name: 'TaskBot',
    avatar: '🤖',
    personality: 'Versatile, helpful, and proactive. I adapt to whatever you need and guide you to completion.',
    capabilities: ['summarize_documents', 'break_into_steps', 'track_progress', 'suggest_next_move', 'answer_from_docs'],
    keywords: []
  }
};

// Determine agent role based on task title and description
export function detectAgentRole(title: string, description?: string): AgentRole {
  const text = `${title} ${description || ''}`.toLowerCase();
  
  // Check each role's keywords
  for (const [role, config] of Object.entries(AGENT_ROLE_CONFIG)) {
    if (role === 'general') continue;
    if (config.keywords.some(keyword => text.includes(keyword))) {
      return role as AgentRole;
    }
  }
  
  return 'general';
}

// Generate dynamic agent name based on task
export function generateAgentName(title: string, role: AgentRole): string {
  const config = AGENT_ROLE_CONFIG[role];
  
  // Try to create a custom name from the task title
  const words = title.split(' ').filter(w => w.length > 3);
  if (words.length > 0 && role !== 'general') {
    const keyword = words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase();
    return `${keyword}Agent`;
  }
  
  return config.name;
}

// Generate system prompt for a sub-agent
export function generateSystemPrompt(agent: SubAgent): string {
  const { name, role, personality, context } = agent;
  const config = AGENT_ROLE_CONFIG[role];
  
  const documentContext = context.documents.length > 0
    ? `\n\nDOCUMENTS AVAILABLE:\n${context.documents.map(d => 
        `- ${d.name}: ${d.summary || 'No summary yet'}`
      ).join('\n')}`
    : '';

  const deadlineInfo = context.deadline 
    ? `\nDEADLINE: ${context.deadline.toLocaleDateString()} (${context.deadlineType})`
    : '';

  return `You are ${name}, a specialized AI assistant for the task: "${context.taskTitle}"

PERSONALITY: ${personality}

YOUR ROLE: ${role.toUpperCase()} SPECIALIST
${context.taskDescription ? `\nTASK DESCRIPTION: ${context.taskDescription}` : ''}
PRIORITY: ${context.priority}
ENERGY REQUIRED: ${context.energyRequired}${deadlineInfo}
${documentContext}

YOUR CAPABILITIES:
${config.capabilities.map(c => `- ${formatCapability(c)}`).join('\n')}

INTERACTION GUIDELINES:
1. Be conversational and friendly, but focused on the task
2. Proactively suggest next steps after each interaction
3. Ask clarifying questions when needed
4. Track progress and celebrate small wins
5. If documents are uploaded, reference them in your responses
6. Break down complex requests into manageable steps
7. Offer 2-3 actionable suggestions at the end of each response
8. Remember context from earlier in the conversation
9. Be encouraging and motivating
10. If you can't do something, suggest an alternative approach

RESPONSE FORMAT:
- Keep responses focused and actionable
- Use bullet points for lists
- Highlight important information
- End with "What would you like to do next?" or a specific suggestion
- Include [SUGGESTION] tags for quick action buttons

Remember: You are the user's dedicated specialist for this specific task. Make them feel supported and capable!`;
}

function formatCapability(cap: AgentCapability): string {
  const labels: Record<AgentCapability, string> = {
    summarize_documents: 'Summarize uploaded documents',
    extract_questions: 'Extract key questions from content',
    answer_from_docs: 'Answer questions based on uploaded files',
    generate_outline: 'Create outlines and structures',
    draft_email: 'Draft professional emails',
    generate_code: 'Write and explain code',
    create_slides: 'Generate presentation outlines',
    break_into_steps: 'Break tasks into actionable steps',
    track_progress: 'Track and report on progress',
    suggest_next_move: 'Suggest optimal next actions',
    quiz_user: 'Create quizzes to test understanding',
    explain_concept: 'Explain complex concepts simply',
    format_content: 'Format and structure content',
    research_web: 'Research and find information'
  };
  return labels[cap] || cap;
}

// Create a new sub-agent for a task
export function createSubAgent(
  taskId: string,
  taskTitle: string,
  taskDescription?: string,
  options?: {
    deadline?: Date;
    deadlineType?: 'urgent' | 'flexible' | 'none';
    priority?: 'critical' | 'high' | 'medium' | 'low';
    energyRequired?: 'high' | 'medium' | 'low';
    documents?: DocumentContext[];
  }
): SubAgent {
  const role = detectAgentRole(taskTitle, taskDescription);
  const config = AGENT_ROLE_CONFIG[role];
  const name = generateAgentName(taskTitle, role);
  
  const context: SubAgentContext = {
    taskId,
    taskTitle,
    taskDescription,
    deadline: options?.deadline,
    deadlineType: options?.deadlineType || 'none',
    priority: options?.priority || 'medium',
    energyRequired: options?.energyRequired || 'medium',
    documents: options?.documents || [],
    interactionHistory: [],
    sessionState: {},
    createdAt: new Date(),
    lastActiveAt: new Date()
  };

  const agent: SubAgent = {
    id: `agent-${taskId}`,
    taskId,
    name,
    role,
    avatar: config.avatar,
    personality: config.personality,
    capabilities: config.capabilities,
    systemPrompt: '', // Will be generated
    context,
    isActive: true,
    createdAt: new Date(),
    lastActiveAt: new Date()
  };

  // Generate system prompt with full context
  agent.systemPrompt = generateSystemPrompt(agent);

  return agent;
}

// Agent memory for quick switching (stores up to 5 recent agents)
export interface AgentMemory {
  recentAgents: SubAgent[];
  activeAgentId: string | null;
  lastSwitchedAt: Date | null;
}

export function createAgentMemory(): AgentMemory {
  return {
    recentAgents: [],
    activeAgentId: null,
    lastSwitchedAt: null
  };
}

export function addToAgentMemory(memory: AgentMemory, agent: SubAgent): AgentMemory {
  // Remove if already exists
  const filtered = memory.recentAgents.filter(a => a.id !== agent.id);
  
  // Add to front
  const updated = [agent, ...filtered].slice(0, 5);
  
  return {
    ...memory,
    recentAgents: updated,
    activeAgentId: agent.id,
    lastSwitchedAt: new Date()
  };
}
