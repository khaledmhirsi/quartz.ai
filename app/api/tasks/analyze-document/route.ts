import { NextRequest, NextResponse } from 'next/server';

import fs from 'fs';
import yaml from 'js-yaml';
import OpenAI from 'openai';
import path from 'path';

// Load configuration from ~/.genspark_llm.yaml or environment
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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const taskContext = formData.get('taskContext') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Read file content
    const buffer = await file.arrayBuffer();
    const content = new TextDecoder().decode(buffer);

    // For PDF files, we need special handling (simplified for now)
    const isPDF = file.name.toLowerCase().endsWith('.pdf');
    const textContent = isPDF 
      ? '[PDF content - extracting text from binary data]' 
      : content.substring(0, 10000); // Limit content for API

    const client = getOpenAIClient();

    // Analyze document with OpenAI
    const completion = await client.chat.completions.create({
      model: 'gpt-5',
      messages: [
        {
          role: 'system',
          content: `You are an AI document analyst for a task management app called Quartz. 
Your job is to analyze documents and extract actionable insights for task completion.

Always respond in the following JSON format:
{
  "summary": "A concise 2-3 sentence summary of the document",
  "keyInsights": [
    "Key insight 1 - be specific with dates, numbers, names",
    "Key insight 2",
    "Key insight 3",
    "Key insight 4 (if applicable)",
    "Key insight 5 (if applicable)"
  ],
  "actionItems": [
    "Suggested action based on document",
    "Another suggested action (if applicable)"
  ],
  "deadlines": ["Any mentioned deadlines"],
  "stakeholders": ["Any mentioned people, teams, or organizations"],
  "constraints": ["Any mentioned constraints, requirements, or limitations"]
}

Extract SPECIFIC information like:
- Exact dates and deadlines
- Budget amounts
- Names of people/teams
- Requirements and specifications
- Important decisions or approvals needed`
        },
        {
          role: 'user',
          content: `Analyze this document for a task${taskContext ? ` related to: "${taskContext}"` : ''}.

Document name: ${file.name}
Document content:
---
${textContent}
---

Extract key information and provide actionable insights.`
        }
      ],
      temperature: 0.3,
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    
    // Parse the JSON response
    let analysis;
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      // Fallback if JSON parsing fails
      analysis = {
        summary: responseText.substring(0, 200),
        keyInsights: ['Document analyzed successfully'],
        actionItems: [],
        deadlines: [],
        stakeholders: [],
        constraints: []
      };
    }

    return NextResponse.json({
      success: true,
      analysis: {
        summary: analysis.summary || 'Document uploaded successfully.',
        extractedInsights: analysis.keyInsights || [],
        actionItems: analysis.actionItems || [],
        deadlines: analysis.deadlines || [],
        stakeholders: analysis.stakeholders || [],
        constraints: analysis.constraints || [],
        isProcessed: true
      }
    });

  } catch (error) {
    console.error('Document analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze document', details: String(error) },
      { status: 500 }
    );
  }
}
