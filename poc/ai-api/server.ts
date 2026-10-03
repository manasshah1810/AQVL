import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { SYSTEM_PROMPT, FEW_SHOT_EXAMPLES } from './prompt';

// Lightweight .env loader to avoid dependencies
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
        value = value.replace(/\\n/gm, '\n');
      }
      value = value.replace(/(^['"]|['"]$)/g, '').trim();
      process.env[key] = value;
    }
  });
}

const PORT = process.env.PORT || 3000;
const PROVIDER_API_KEY = process.env.PROVIDER_API_KEY;
// Using OpenAI-compatible endpoint as the default provider format
const PROVIDER_URL = process.env.PROVIDER_URL || 'https://api.openai.com/v1/chat/completions';
const MODEL = process.env.MODEL || 'gpt-4o-mini';

import { validateAQVL } from './validate';

type Message = { role: string; content: string };

export async function callLLM(messages: Message[]): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(PROVIDER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PROVIDER_API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: messages,
        temperature: 0.2
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Provider API error: ${response.status} ${errorText}`);
    }

    const data: any = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('Provider returned empty content');
    }

    // Strip markdown fences just in case
    let aqvl = content.trim();
    if (aqvl.startsWith('```aqvl')) {
      aqvl = aqvl.replace(/^```aqvl\n/, '').replace(/\n```$/, '');
    } else if (aqvl.startsWith('```')) {
      aqvl = aqvl.replace(/^```.*\n/, '').replace(/\n```$/, '');
    }

    return aqvl;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Exported for test stubbing
export let generateModelOutput = callLLM;
export function setModelOutputFn(fn: typeof callLLM) {
  generateModelOutput = fn;
}

export async function generateAndValidateAQVL(topic: string) {
  const messages: Message[] = [
    { role: 'system', content: SYSTEM_PROMPT }
  ];

  for (const ex of FEW_SHOT_EXAMPLES) {
    messages.push({ role: 'user', content: ex.topic });
    messages.push({ role: 'assistant', content: ex.aqvl });
  }

  messages.push({ role: 'user', content: topic });

  let attempts = 0;
  let lastAqvl = '';
  let lastErrors: string[] = [];

  while (attempts < 3) {
    attempts++;
    
    const aqvl = await generateModelOutput(messages);
    lastAqvl = aqvl;
    
    const validationResult = validateAQVL(aqvl);
    if (validationResult.valid) {
      return {
        aqvl,
        valid: true,
        attempts,
        errors: []
      };
    }
    
    lastErrors = validationResult.errors;

    // Add failure feedback to the messages for the next retry
    messages.push({ role: 'assistant', content: aqvl });
    messages.push({
      role: 'user',
      content: `Previous AQVL failed validation.\n\nCompiler/validation errors:\n${validationResult.errors.map((e: string) => '- ' + e).join('\n')}\n\nGenerate corrected AQVL that satisfies the AQVL language contract.\nReturn only AQVL source code, with no Markdown fences or explanation.`
    });
  }

  return {
    aqvl: lastAqvl,
    valid: false,
    attempts,
    errors: lastErrors
  };
}

export const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST' || req.url !== '/generate') {
    res.statusCode = 404;
    return res.end(JSON.stringify({ error: 'Not Found. Use POST /generate' }));
  }

  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      let payload;
      try {
        payload = JSON.parse(body);
      } catch (e) {
        console.error('Failed to parse body:', body);
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'Malformed JSON payload' }));
      }
      
      if (!payload.topic || typeof payload.topic !== 'string') {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'Missing or invalid "topic" in request body' }));
      }

      if (!PROVIDER_API_KEY && generateModelOutput === callLLM) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: 'PROVIDER_API_KEY is not configured on the server' }));
      }

      const result = await generateAndValidateAQVL(payload.topic);
      
      res.statusCode = 200;
      res.end(JSON.stringify(result));
      
    } catch (err: any) {
      if (err.name === 'AbortError') {
        res.statusCode = 504;
        return res.end(JSON.stringify({ error: 'Provider API request timed out (30s)' }));
      }
      
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
    }
  });
});

// Start the server if it's run directly (not imported by a test)
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`AI API PoC server running on http://localhost:${PORT}`);
  });
}
