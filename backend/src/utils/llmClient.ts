const PROVIDER = process.env.AI_PROVIDER || 'openai';
const API_KEY = process.env.AI_API_KEY || '';

interface LlmResponse {
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
  recommendation: string;
  summary: string;
}

async function callOpenAI(prompt: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 300,
    }),
  });
  const data = await res.json() as any;
  return data.choices?.[0]?.message?.content || '';
}

async function callGroq(prompt: string): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL || 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 300,
    }),
  });
  const data = await res.json() as any;
  return data.choices?.[0]?.message?.content || '';
}

export async function callLLM(prompt: string): Promise<string> {
  if (!API_KEY) return '';
  try {
    if (PROVIDER === 'groq') return callGroq(prompt);
    return callOpenAI(prompt);
  } catch (e: any) {
    console.error('[llm] API call failed:', e.message);
    return '';
  }
}

export async function analyzeSentiment(text: string): Promise<{ sentiment: LlmResponse['sentiment']; score: number }> {
  if (!API_KEY) return { sentiment: 'neutral', score: 50 };

  const prompt = [
    `Analyze the sentiment of this message from a prospective student.`,
    `Respond with only: POSITIVE, NEGATIVE, or NEUTRAL and a score 0-100.`,
    `Format: SENTIMENT|SCORE`,
    ``,
    `Message: "${text}"`,
  ].join('\n');

  const result = await callLLM(prompt);
  const parts = result.split('|');
  const sentiment = (parts[0] || 'NEUTRAL').toLowerCase().includes('positive')
    ? 'positive'
    : (parts[0] || 'NEUTRAL').toLowerCase().includes('negative')
      ? 'negative'
      : 'neutral';
  const score = Math.min(100, Math.max(0, parseInt(parts[1]) || 50));
  return { sentiment, score };
}

export async function generateRecommendation(
  inquiry: { fullName: string; status?: string; score: number; notes?: string; sentiment?: string },
  followups: { type: string; status: string; notes?: string }[],
): Promise<string> {
  if (!API_KEY) return '';

  const prompt = [
    `You are an admissions CRM assistant. Given the following lead info, suggest ONE specific next action:`,
    ``,
    `Name: ${inquiry.fullName}`,
    `Status: ${inquiry.status || 'Unknown'}`,
    `Lead Score: ${inquiry.score}/100`,
    `Sentiment: ${inquiry.sentiment || 'Unknown'}`,
    `Notes: ${inquiry.notes || 'None'}`,
    `Past follow-ups: ${JSON.stringify(followups.map(f => `${f.type} (${f.status})`))}`,
    ``,
    `Respond in 1-2 sentences with a clear, actionable recommendation.`,
  ].join('\n');

  return callLLM(prompt);
}

export async function summarizeNotes(notes: string): Promise<string> {
  if (!API_KEY || !notes) return notes;

  const prompt = [
    `Summarize the following notes about a prospective student concisely:`,
    ``,
    notes,
  ].join('\n');

  return callLLM(prompt) || notes;
}
