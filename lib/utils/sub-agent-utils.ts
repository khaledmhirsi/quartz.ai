// Sub-Agent Utility Functions

import {
  AGENT_ROLE_CONFIGS,
  AgentCapability,
  AgentDraft,
  AgentInteraction,
  AgentRole,
  AgentSubtask,
  buildSystemPrompt,
  detectAgentRole,
  generateSubAgentName,
  SubAgent,
  SubAgentDocument,
  SubAgentState,
  SubAgentTask,
} from '../types/sub-agent';

/**
 * Create a new Sub-Agent for a task
 */
export function createSubAgent(
  taskId: string,
  title: string,
  description?: string,
  taskContext?: Partial<SubAgent['taskContext']>
): SubAgent {
  const role = detectAgentRole(title, description);
  const config = AGENT_ROLE_CONFIGS[role];
  const agentName = generateSubAgentName(role, title);
  
  const fullContext: SubAgent['taskContext'] = {
    title,
    description,
    deadlineType: taskContext?.deadlineType || 'flexible',
    priority: taskContext?.priority || 'medium',
    energyLevel: taskContext?.energyLevel || 'medium',
    deadline: taskContext?.deadline,
    category: taskContext?.category,
  };

  const agent: SubAgent = {
    id: `agent-${taskId}`,
    taskId,
    name: agentName,
    role,
    personality: config.personalityTraits.join(', '),
    avatar: config.icon,
    taskContext: fullContext,
    capabilities: config.defaultCapabilities,
    toolset: config.defaultCapabilities.map(c => capabilityToTool(c)),
    documents: [],
    interactionHistory: [],
    state: createInitialState(),
    systemPrompt: buildSystemPrompt(role, agentName, title, fullContext, []),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Add welcome message
  agent.interactionHistory.push(createWelcomeMessage(agent));

  return agent;
}

/**
 * Create initial agent state
 */
function createInitialState(): SubAgentState {
  return {
    currentPhase: 'onboarding',
    progress: 0,
    subtasks: [],
    drafts: [],
    sessionNotes: [],
    lastActiveAt: new Date(),
  };
}

/**
 * Create welcome message for agent
 */
function createWelcomeMessage(agent: SubAgent): AgentInteraction {
  const config = AGENT_ROLE_CONFIGS[agent.role];
  
  const greetings: Record<AgentRole, string> = {
    research: `Hey! I'm ${agent.name}, your research partner for "${agent.taskContext.title}". I love diving deep into topics and finding insights. 🔍\n\nTo get started, tell me:\n- What specific questions are you trying to answer?\n- Any documents you'd like me to analyze?\n- What's your deadline looking like?`,
    writing: `Hi there! I'm ${agent.name}, and I'll help you craft something great for "${agent.taskContext.title}". ✍️\n\nLet's figure out:\n- Who's your audience?\n- What tone are you going for?\n- Do you have any existing drafts or outlines?`,
    coding: `Hey! I'm ${agent.name}, ready to code with you on "${agent.taskContext.title}". 💻\n\nQuick questions:\n- What language/framework are we working with?\n- Any existing code I should review?\n- What's the core problem we're solving?`,
    design: `Hello! I'm ${agent.name}, your design companion for "${agent.taskContext.title}". 🎨\n\nLet's explore:\n- What's the goal of this design?\n- Who will be using it?\n- Any inspiration or references you like?`,
    planning: `Hi! I'm ${agent.name}, and I'll help you turn "${agent.taskContext.title}" into an actionable plan. 📋\n\nFirst, tell me:\n- What does success look like?\n- Any hard deadlines I should know about?\n- What resources do you have available?`,
    email: `Hey! I'm ${agent.name}, your communication specialist for "${agent.taskContext.title}". 📧\n\nLet's nail this:\n- Who are you reaching out to?\n- What's the goal of this message?\n- Any context I should know about the recipient?`,
    lecture: `Hello! I'm ${agent.name}, here to help you master "${agent.taskContext.title}". 🎓\n\nLet's learn together:\n- Upload any materials you're studying\n- Tell me what concepts are tricky\n- I can quiz you when you're ready!`,
    analysis: `Hi! I'm ${agent.name}, ready to analyze "${agent.taskContext.title}" with you. 📊\n\nTo get started:\n- What data or documents should I look at?\n- What insights are you hoping to find?\n- Any specific metrics that matter?`,
    general: `Hey! I'm ${agent.name}, your dedicated assistant for "${agent.taskContext.title}". 🤖\n\nI'm here to help however you need:\n- Tell me more about what you're trying to accomplish\n- Share any files or context\n- What's the first thing you'd like to tackle?`,
  };

  return {
    id: `msg-welcome-${Date.now()}`,
    role: 'agent',
    content: greetings[agent.role],
    timestamp: new Date(),
    actionType: 'message',
    suggestions: getInitialSuggestions(agent.role),
  };
}

/**
 * Get initial suggestions based on role
 */
function getInitialSuggestions(role: AgentRole): string[] {
  const suggestions: Record<AgentRole, string[]> = {
    research: ['Help me research this topic', 'I have a document to analyze', 'What questions should I explore?'],
    writing: ['Help me outline this', 'I need to write a draft', 'Review my existing content'],
    coding: ['Let\'s plan the implementation', 'I have code to review', 'Help me debug an issue'],
    design: ['Describe the design I need', 'I want UI/UX feedback', 'Help me pick colors/layout'],
    planning: ['Break this into steps', 'Create a timeline', 'What should I prioritize?'],
    email: ['Draft an email for me', 'Help me follow up', 'Review my message'],
    lecture: ['Summarize my materials', 'Quiz me on this topic', 'Help me prepare to present'],
    analysis: ['Analyze this document', 'What patterns do you see?', 'Compare these options'],
    general: ['Help me get started', 'Break this into subtasks', 'What should I do first?'],
  };
  return suggestions[role];
}

/**
 * Convert capability to tool name
 */
function capabilityToTool(capability: AgentCapability): string {
  const toolMap: Record<AgentCapability, string> = {
    summarize_documents: 'Document Summarizer',
    extract_questions: 'Question Extractor',
    answer_questions: 'Q&A Assistant',
    draft_email: 'Email Composer',
    generate_outline: 'Outline Generator',
    generate_code: 'Code Generator',
    create_subtasks: 'Task Breakdown',
    track_progress: 'Progress Tracker',
    generate_lecture: 'Lecture Creator',
    analyze_data: 'Data Analyzer',
    research_topic: 'Research Tool',
    write_draft: 'Writing Assistant',
    review_content: 'Content Reviewer',
    schedule_planning: 'Schedule Planner',
  };
  return toolMap[capability];
}

/**
 * Create a new SubAgentTask
 */
export function createSubAgentTask(
  title: string,
  options: {
    description?: string;
    deadlineType?: 'urgent' | 'flexible' | 'none';
    priority?: 'critical' | 'high' | 'medium' | 'low';
    energyRequired?: 'high' | 'medium' | 'low';
    dueDate?: Date;
  } = {}
): SubAgentTask {
  const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const agent = createSubAgent(taskId, title, options.description, {
    title,
    description: options.description,
    deadlineType: options.deadlineType || 'flexible',
    priority: options.priority || 'medium',
    energyLevel: options.energyRequired || 'medium',
    deadline: options.dueDate,
  });

  return {
    id: taskId,
    title,
    description: options.description,
    deadlineType: options.deadlineType || 'flexible',
    priority: options.priority || 'medium',
    energyRequired: options.energyRequired || 'medium',
    dueDate: options.dueDate,
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'active',
    agent,
    lastMessage: agent.interactionHistory[0]?.content.substring(0, 100),
    unreadCount: 1,
  };
}

/**
 * Add a user message to agent
 */
export function addUserMessage(agent: SubAgent, content: string): AgentInteraction {
  const message: AgentInteraction = {
    id: `msg-${Date.now()}`,
    role: 'user',
    content,
    timestamp: new Date(),
    actionType: 'message',
  };
  
  agent.interactionHistory.push(message);
  agent.state.lastActiveAt = new Date();
  agent.updatedAt = new Date();
  
  return message;
}

/**
 * Add an agent response
 */
export function addAgentResponse(
  agent: SubAgent,
  content: string,
  options: {
    actionType?: AgentInteraction['actionType'];
    actionData?: Record<string, unknown>;
    suggestions?: string[];
  } = {}
): AgentInteraction {
  const message: AgentInteraction = {
    id: `msg-${Date.now()}`,
    role: 'agent',
    content,
    timestamp: new Date(),
    actionType: options.actionType || 'message',
    actionData: options.actionData,
    suggestions: options.suggestions || generateContextualSuggestions(agent),
  };
  
  agent.interactionHistory.push(message);
  agent.updatedAt = new Date();
  
  return message;
}

/**
 * Generate contextual suggestions based on conversation
 */
function generateContextualSuggestions(agent: SubAgent): string[] {
  const suggestions: string[] = [];
  const state = agent.state;
  
  // Based on current phase
  if (state.currentPhase === 'onboarding') {
    suggestions.push('Let\'s define the goal');
    if (agent.documents.length === 0) {
      suggestions.push('I have a file to upload');
    }
  } else if (state.currentPhase === 'working') {
    if (state.subtasks.some(s => s.status === 'pending')) {
      suggestions.push('What\'s the next subtask?');
    }
    suggestions.push('Show my progress');
  }
  
  // Role-specific
  if (agent.role === 'email' && agent.state.drafts.length > 0) {
    suggestions.push('Review my draft');
  }
  if (agent.role === 'lecture' && agent.documents.length > 0) {
    suggestions.push('Quiz me!');
  }
  
  // Default suggestions if none
  if (suggestions.length === 0) {
    suggestions.push('What should I do next?');
    suggestions.push('Help me with something');
  }
  
  return suggestions.slice(0, 3);
}

/**
 * Add document to agent
 */
export function addDocumentToAgent(
  agent: SubAgent,
  doc: SubAgentDocument
): void {
  agent.documents.push(doc);
  agent.updatedAt = new Date();
  
  // Update system prompt with new document context
  agent.systemPrompt = buildSystemPrompt(
    agent.role,
    agent.name,
    agent.taskContext.title,
    agent.taskContext,
    agent.documents
  );
}

/**
 * Create a subtask for agent
 */
export function createAgentSubtask(agent: SubAgent, title: string): AgentSubtask {
  const subtask: AgentSubtask = {
    id: `subtask-${Date.now()}`,
    title,
    status: 'pending',
    createdAt: new Date(),
  };
  
  agent.state.subtasks.push(subtask);
  agent.updatedAt = new Date();
  
  return subtask;
}

/**
 * Complete a subtask
 */
export function completeAgentSubtask(agent: SubAgent, subtaskId: string): void {
  const subtask = agent.state.subtasks.find(s => s.id === subtaskId);
  if (subtask) {
    subtask.status = 'completed';
    subtask.completedAt = new Date();
    
    // Update progress
    const total = agent.state.subtasks.length;
    const completed = agent.state.subtasks.filter(s => s.status === 'completed').length;
    agent.state.progress = Math.round((completed / total) * 100);
    
    agent.updatedAt = new Date();
  }
}

/**
 * Save a draft
 */
export function saveDraft(
  agent: SubAgent,
  type: AgentDraft['type'],
  title: string,
  content: string
): AgentDraft {
  const draft: AgentDraft = {
    id: `draft-${Date.now()}`,
    type,
    title,
    content,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  agent.state.drafts.push(draft);
  agent.updatedAt = new Date();
  
  return draft;
}

/**
 * Update agent phase
 */
export function updateAgentPhase(
  agent: SubAgent,
  phase: SubAgentState['currentPhase']
): void {
  agent.state.currentPhase = phase;
  if (phase === 'completed') {
    agent.state.progress = 100;
  }
  agent.updatedAt = new Date();
}

/**
 * Get conversation messages for API
 */
export function getConversationForAPI(
  agent: SubAgent,
  limit: number = 20
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return agent.interactionHistory
    .slice(-limit)
    .map(msg => ({
      role: msg.role === 'agent' ? 'assistant' as const : 'user' as const,
      content: msg.content,
    }));
}

/**
 * Serialize agent for storage
 */
export function serializeAgent(agent: SubAgent): string {
  return JSON.stringify(agent, (key, value) => {
    if (value instanceof Date) {
      return { __type: 'Date', value: value.toISOString() };
    }
    return value;
  });
}

/**
 * Deserialize agent from storage
 */
export function deserializeAgent(json: string): SubAgent {
  return JSON.parse(json, (key, value) => {
    if (value && typeof value === 'object' && value.__type === 'Date') {
      return new Date(value.value);
    }
    return value;
  });
}

/**
 * Get recent tasks sorted by last activity
 */
export function getRecentTasks(tasks: SubAgentTask[], limit: number = 5): SubAgentTask[] {
  return [...tasks]
    .filter(t => t.status === 'active')
    .sort((a, b) => {
      const aTime = a.agent.state.lastActiveAt.getTime();
      const bTime = b.agent.state.lastActiveAt.getTime();
      return bTime - aTime;
    })
    .slice(0, limit);
}

/**
 * Search tasks by title or description
 */
export function searchTasks(tasks: SubAgentTask[], query: string): SubAgentTask[] {
  const lowerQuery = query.toLowerCase();
  return tasks.filter(t => 
    t.title.toLowerCase().includes(lowerQuery) ||
    t.description?.toLowerCase().includes(lowerQuery) ||
    t.agent.name.toLowerCase().includes(lowerQuery)
  );
}
