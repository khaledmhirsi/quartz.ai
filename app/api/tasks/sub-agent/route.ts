import { NextRequest, NextResponse } from 'next/server';

import fs from 'fs';
import yaml from 'js-yaml';
import OpenAI from 'openai';
import path from 'path';

import {
  AGENT_ROLE_CONFIG,
  AgentCapability,
  createSubAgent,
  DocumentContext,
  generateSystemPrompt,
  SubAgent,
  SubAgentMessage,
} from '@/lib/types/sub-agent';

// Load OpenAI configuration
function getOpenAIClient(): OpenAI {
  const configPath = path.join(process.env.HOME || '/home/user', '.genspark_llm.yaml');
  let config: { openai?: { api_key?: string; base_url?: string } } | null = null;

  try {
    if (fs.existsSync(configPath)) {
      const fileContents = fs.readFileSync(configPath, 'utf8');
      config = yaml.load(fileContents) as typeof config;
    }
  } catch (error) {
    console.error('Error reading config file:', error);
  }

  return new OpenAI({
    apiKey: config?.openai?.api_key || process.env.OPENAI_API_KEY,
    baseURL: config?.openai?.base_url || process.env.OPENAI_BASE_URL,
  });
}

// Tool handlers for agent capabilities
const toolHandlers: Partial<Record<AgentCapability, (args: Record<string, unknown>, context: SubAgent) => Promise<string>>> = {
  summarize_documents: async (args, context) => {
    const docs = context.context.documents;
    if (docs.length === 0) return 'No documents uploaded yet. Please upload a document first.';
    
    const summaries = docs.map(d => `**${d.name}**: ${d.summary || 'Processing...'}`).join('\n\n');
    return `Here are the summaries of your uploaded documents:\n\n${summaries}`;
  },

  break_into_steps: async (args) => {
    const goal = args.goal as string || 'the task';
    return `I'll break down "${goal}" into actionable steps. Here's a suggested approach:

1. **Define the outcome** - What does success look like?
2. **Gather resources** - What do you need to get started?
3. **First action** - What's the smallest step you can take right now?
4. **Build momentum** - Complete 2-3 quick wins
5. **Review and adjust** - Check progress and refine

Would you like me to customize these steps for your specific task?`;
  },

  draft_email: async (args) => {
    const recipient = args.recipient as string || '[Recipient]';
    const purpose = args.purpose as string || 'general outreach';
    
    return `Here's a draft email for ${purpose}:

---
**To:** ${recipient}
**Subject:** [Suggested subject line]

Hi [Name],

[Opening - reference connection or context]

[Main message - be specific and clear about your ask]

[Value proposition - what's in it for them?]

[Clear call to action]

Best regards,
[Your name]

---

Would you like me to:
[SUGGESTION] Make it more formal
[SUGGESTION] Make it shorter
[SUGGESTION] Add specific details`;
  },

  generate_outline: async (args) => {
    const topic = args.topic as string || 'the topic';
    return `Here's an outline for "${topic}":

## I. Introduction
   - Hook/Opening statement
   - Context and relevance
   - Thesis/Main point

## II. Main Body
   ### A. First Key Point
   - Supporting evidence
   - Example or case study
   
   ### B. Second Key Point
   - Supporting evidence
   - Example or case study
   
   ### C. Third Key Point
   - Supporting evidence
   - Example or case study

## III. Conclusion
   - Summary of key points
   - Call to action or final thought
   - Future implications

Would you like me to expand any section?`;
  },

  quiz_user: async (args, context) => {
    const topic = context.context.taskTitle;
    return `Let's test your understanding of "${topic}"! 

**Question 1:** What is the main concept or goal of this task?

**Question 2:** What are the key steps or components involved?

**Question 3:** What challenges might you face, and how would you address them?

Take your time to answer, and I'll provide feedback!`;
  },

  explain_concept: async (args) => {
    const concept = args.concept as string || 'this concept';
    return `Let me explain "${concept}" in simple terms:

**The Basics:**
Think of it like... [analogy]

**How it works:**
1. First... 
2. Then...
3. Finally...

**Why it matters:**
This is important because...

**Real-world example:**
Imagine...

Would you like me to go deeper on any part?`;
  },

  suggest_next_move: async (args, context) => {
    const progress = args.progress as string || 'current state';
    return `Based on your progress, here are my top suggestions:

🎯 **Immediate (Next 15 min):**
- [Quick action you can take right now]

📈 **Short-term (Today):**
- [Important task to complete today]

🔮 **Looking ahead:**
- [What to prepare for next]

Which one would you like to tackle first?`;
  }
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      action,
      taskId,
      taskTitle,
      taskDescription,
      message,
      conversationHistory = [],
      documents = [],
      options = {}
    } = body;

    const client = getOpenAIClient();

    // Handle different actions
    switch (action) {
      case 'create': {
        // Create a new sub-agent for a task
        const agent = createSubAgent(taskId, taskTitle, taskDescription, {
          ...options,
          documents: documents.map((d: DocumentContext) => ({
            ...d,
            uploadedAt: new Date(d.uploadedAt)
          }))
        });

        // Generate initial greeting
        const greeting = await generateAgentGreeting(client, agent);

        return NextResponse.json({
          success: true,
          agent: {
            id: agent.id,
            name: agent.name,
            role: agent.role,
            avatar: agent.avatar,
            personality: agent.personality,
            capabilities: agent.capabilities
          },
          greeting
        });
      }

      case 'chat': {
        // Chat with existing sub-agent
        if (!taskId || !message) {
          return NextResponse.json(
            { error: 'taskId and message are required' },
            { status: 400 }
          );
        }

        // Recreate agent context
        const agent = createSubAgent(taskId, taskTitle, taskDescription, {
          ...options,
          documents: documents.map((d: DocumentContext) => ({
            ...d,
            uploadedAt: new Date(d.uploadedAt)
          }))
        });

        // Update context with conversation history
        agent.context.interactionHistory = conversationHistory;

        // Detect if user is asking for a specific capability
        const detectedTool = detectToolRequest(message, agent.capabilities);

        // Build messages for OpenAI
        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          { role: 'system', content: agent.systemPrompt },
          // Add conversation history (last 20 messages)
          ...conversationHistory.slice(-20).map((msg: SubAgentMessage) => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content
          })),
          { role: 'user', content: message }
        ];

        // If a tool was detected, add context
        if (detectedTool) {
          const toolContext = `\n\n[The user seems to be asking you to use your "${detectedTool}" capability. Please help them with this.]`;
          messages[0].content += toolContext;
        }

        const completion = await client.chat.completions.create({
          model: 'gpt-5',
          messages,
          temperature: 0.7,
          max_tokens: 1500,
        });

        const responseContent = completion.choices[0]?.message?.content || 
          "I'm here to help! Could you tell me more about what you need?";

        // Extract suggestions from response
        const suggestions = extractSuggestions(responseContent, agent);

        return NextResponse.json({
          success: true,
          response: {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: responseContent,
            timestamp: new Date().toISOString(),
            suggestions,
            toolUsed: detectedTool
          }
        });
      }

      case 'tool': {
        // Execute a specific tool
        const { tool, args = {} } = body;
        
        if (!taskId || !tool) {
          return NextResponse.json(
            { error: 'taskId and tool are required' },
            { status: 400 }
          );
        }

        const agent = createSubAgent(taskId, taskTitle, taskDescription, options);
        const handler = toolHandlers[tool as AgentCapability];

        if (handler) {
          const result = await handler(args, agent);
          return NextResponse.json({
            success: true,
            result: {
              tool,
              content: result,
              timestamp: new Date().toISOString()
            }
          });
        } else {
          return NextResponse.json(
            { error: `Tool "${tool}" not found or not implemented` },
            { status: 400 }
          );
        }
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: create, chat, or tool' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Sub-agent API error:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: String(error) },
      { status: 500 }
    );
  }
}

// Generate initial greeting from agent
async function generateAgentGreeting(client: OpenAI, agent: SubAgent): Promise<SubAgentMessage> {
  const config = AGENT_ROLE_CONFIG[agent.role];
  
  const prompt = `You are ${agent.name}, greeting a user for the first time about their task: "${agent.context.taskTitle}".

Your personality: ${agent.personality}

Generate a warm, helpful greeting that:
1. Introduces yourself by name
2. Shows you understand their task
3. Offers 2-3 specific ways you can help
4. Asks an engaging question to get started

Keep it concise (3-4 sentences max) and end with a question.`;

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-5',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 300,
    });

    const content = completion.choices[0]?.message?.content || 
      `Hi! I'm ${agent.name} ${config.avatar}, your dedicated assistant for "${agent.context.taskTitle}". I'm here to help you succeed! What would you like to work on first?`;

    return {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content,
      timestamp: new Date(),
      suggestions: generateInitialSuggestions(agent)
    };
  } catch {
    return {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: `Hi! I'm ${agent.name} ${config.avatar}, your dedicated assistant for "${agent.context.taskTitle}". I'm here to help you succeed! What would you like to work on first?`,
      timestamp: new Date(),
      suggestions: generateInitialSuggestions(agent)
    };
  }
}

// Generate initial suggestions based on agent capabilities
function generateInitialSuggestions(agent: SubAgent): string[] {
  const suggestions: string[] = [];
  
  if (agent.capabilities.includes('break_into_steps')) {
    suggestions.push('Break this into steps');
  }
  if (agent.capabilities.includes('summarize_documents') && agent.context.documents.length > 0) {
    suggestions.push('Summarize my documents');
  }
  if (agent.capabilities.includes('generate_outline')) {
    suggestions.push('Create an outline');
  }
  if (agent.capabilities.includes('suggest_next_move')) {
    suggestions.push('What should I do first?');
  }
  if (agent.capabilities.includes('draft_email')) {
    suggestions.push('Draft an email');
  }
  
  return suggestions.slice(0, 3);
}

// Detect if message is requesting a specific tool
function detectToolRequest(message: string, capabilities: AgentCapability[]): AgentCapability | null {
  const lower = message.toLowerCase();
  
  const toolKeywords: Record<AgentCapability, string[]> = {
    summarize_documents: ['summarize', 'summary', 'tldr', 'overview of the doc'],
    extract_questions: ['questions from', 'extract questions', 'what questions'],
    answer_from_docs: ['according to the doc', 'from the file', 'what does the doc say'],
    generate_outline: ['outline', 'structure', 'skeleton'],
    draft_email: ['draft email', 'write email', 'email to', 'compose email'],
    generate_code: ['write code', 'code for', 'implement', 'function for'],
    create_slides: ['slides', 'presentation', 'powerpoint'],
    break_into_steps: ['break down', 'steps', 'how do i start', 'action items'],
    track_progress: ['progress', 'how far', 'status update'],
    suggest_next_move: ['what next', 'next step', 'what should i do', 'suggest'],
    quiz_user: ['quiz me', 'test me', 'check my understanding'],
    explain_concept: ['explain', 'what is', 'how does', 'teach me'],
    format_content: ['format', 'clean up', 'organize this'],
    research_web: ['research', 'find info', 'look up']
  };

  for (const cap of capabilities) {
    const keywords = toolKeywords[cap];
    if (keywords?.some(kw => lower.includes(kw))) {
      return cap;
    }
  }

  return null;
}

// Extract suggestions from agent response
function extractSuggestions(response: string, agent: SubAgent): string[] {
  const suggestions: string[] = [];
  
  // Look for [SUGGESTION] tags
  const suggestionRegex = /\[SUGGESTION\]\s*([^\n\[]+)/g;
  let match;
  while ((match = suggestionRegex.exec(response)) !== null) {
    suggestions.push(match[1].trim());
  }

  // If no explicit suggestions, generate based on context
  if (suggestions.length === 0) {
    if (agent.capabilities.includes('suggest_next_move')) {
      suggestions.push('What should I do next?');
    }
    if (response.toLowerCase().includes('step') || response.toLowerCase().includes('break')) {
      suggestions.push('Show me the next step');
    }
    if (agent.context.documents.length > 0) {
      suggestions.push('Tell me more from the docs');
    }
    suggestions.push('Continue');
  }

  return suggestions.slice(0, 3);
}
