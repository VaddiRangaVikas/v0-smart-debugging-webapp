import { NextRequest, NextResponse } from 'next/server';
import type { DebugRequest, DebugResult, DiffLine, CodeHealthScore, ProgrammingLanguage } from '@/lib/types';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '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';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Timeout helper for fetch requests
function fetchWithTimeout(url: string, options: RequestInit, timeout = 60000): Promise<Response> {
  return Promise.race([
    fetch(url, options),
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout - the code analysis is taking too long. Please try with smaller code.')), timeout)
    ),
  ]);
}

async function callOpenRouterWithRetry(body: object, retries = 5): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetchWithTimeout(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://smart-debugger.vercel.app',
          'X-Title': 'AI Debug Assistant',
        },
        body: JSON.stringify(body),
      }, 90000); // 90 second timeout
      
      if (response.ok) return response;
      
      // Handle rate limiting with exponential backoff
      if (response.status === 429 && i < retries - 1) {
        const waitTime = Math.min((i + 1) * 3000, 15000); // 3s, 6s, 9s, 12s, 15s max
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      // Handle server errors with retry
      if (response.status >= 500 && i < retries - 1) {
        const waitTime = (i + 1) * 2000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      if (i < retries - 1) {
        const waitTime = (i + 1) * 2000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

function detectLanguage(code: string): ProgrammingLanguage {
  // Enhanced patterns with weights for better detection
  const patterns: Record<ProgrammingLanguage, { pattern: RegExp; weight: number }[]> = {
    python: [
      { pattern: /\bdef\s+\w+\s*\(/, weight: 3 },
      { pattern: /\bprint\s*\([^)]*\)/, weight: 2 },
      { pattern: /^import\s+\w+/m, weight: 2 },
      { pattern: /^from\s+\w+\s+import/m, weight: 3 },
      { pattern: /:\s*$/m, weight: 1 },
      { pattern: /\bself\./, weight: 3 },
      { pattern: /\bif\s+__name__\s*==\s*['"]__main__['"]/, weight: 5 },
      { pattern: /\bclass\s+\w+.*:/, weight: 2 },
      { pattern: /\belif\s+/, weight: 3 },
      { pattern: /\bTrue\b|\bFalse\b|\bNone\b/, weight: 2 },
    ],
    javascript: [
      { pattern: /\bconst\s+\w+\s*=/, weight: 2 },
      { pattern: /\blet\s+\w+\s*=/, weight: 2 },
      { pattern: /\bfunction\s+\w+\s*\(/, weight: 2 },
      { pattern: /=>\s*[{(]/, weight: 3 },
      { pattern: /console\.log\s*\(/, weight: 3 },
      { pattern: /\bvar\s+\w+\s*=/, weight: 1 },
      { pattern: /\brequire\s*\(['"]/, weight: 2 },
      { pattern: /\bmodule\.exports/, weight: 3 },
      { pattern: /===|!==/, weight: 1 },
      { pattern: /\.then\s*\(/, weight: 2 },
    ],
    typescript: [
      { pattern: /:\s*(string|number|boolean|any|void)\b/, weight: 4 },
      { pattern: /\binterface\s+\w+\s*{/, weight: 4 },
      { pattern: /\btype\s+\w+\s*=/, weight: 4 },
      { pattern: /<\w+>/, weight: 2 },
      { pattern: /\bas\s+\w+/, weight: 3 },
      { pattern: /\benum\s+\w+/, weight: 4 },
      { pattern: /:\s*\w+\[\]/, weight: 3 },
      { pattern: /\bReadonly</, weight: 5 },
      { pattern: /\bPartial</, weight: 5 },
    ],
    java: [
      { pattern: /\bpublic\s+class\s+\w+/, weight: 5 },
      { pattern: /\bSystem\.out\.print/, weight: 5 },
      { pattern: /\bpublic\s+static\s+void\s+main/, weight: 6 },
      { pattern: /\bimport\s+java\./, weight: 4 },
      { pattern: /\bprivate\s+(int|String|boolean|double|float)/, weight: 4 },
      { pattern: /\bextends\s+\w+/, weight: 2 },
      { pattern: /\bimplements\s+\w+/, weight: 3 },
      { pattern: /\bnew\s+\w+\s*\(/, weight: 1 },
      { pattern: /@Override/, weight: 4 },
      { pattern: /\bArrayList</, weight: 4 },
      { pattern: /\.length\b/, weight: 1 },
      { pattern: /\bvoid\s+\w+\s*\(/, weight: 2 },
    ],
    c: [
      { pattern: /#include\s*<stdio\.h>/, weight: 5 },
      { pattern: /#include\s*<stdlib\.h>/, weight: 4 },
      { pattern: /\bint\s+main\s*\(/, weight: 3 },
      { pattern: /\bprintf\s*\(/, weight: 4 },
      { pattern: /\bscanf\s*\(/, weight: 4 },
      { pattern: /\bmalloc\s*\(/, weight: 4 },
      { pattern: /\bfree\s*\(/, weight: 3 },
      { pattern: /\bstruct\s+\w+\s*{/, weight: 2 },
    ],
    cpp: [
      { pattern: /#include\s*<iostream>/, weight: 5 },
      { pattern: /\bcout\s*<</, weight: 5 },
      { pattern: /\bcin\s*>>/, weight: 5 },
      { pattern: /\busing\s+namespace\s+std/, weight: 5 },
      { pattern: /\bstd::/, weight: 4 },
      { pattern: /#include\s*<vector>/, weight: 4 },
      { pattern: /#include\s*<string>/, weight: 3 },
      { pattern: /\bclass\s+\w+\s*{/, weight: 2 },
    ],
    csharp: [
      { pattern: /\busing\s+System/, weight: 5 },
      { pattern: /\bnamespace\s+\w+/, weight: 4 },
      { pattern: /\bConsole\.Write/, weight: 5 },
      { pattern: /\bpublic\s+class\s+\w+/, weight: 3 },
      { pattern: /\bstring\[\]\s+args/, weight: 4 },
      { pattern: /\bvar\s+\w+\s*=/, weight: 1 },
    ],
    go: [
      { pattern: /\bpackage\s+\w+/, weight: 5 },
      { pattern: /\bfunc\s+\w+/, weight: 3 },
      { pattern: /\bfmt\.Print/, weight: 5 },
      { pattern: /\bimport\s+"/, weight: 3 },
      { pattern: /:=/, weight: 4 },
      { pattern: /\bgo\s+\w+/, weight: 4 },
      { pattern: /\bdefer\s+/, weight: 4 },
    ],
    rust: [
      { pattern: /\bfn\s+\w+/, weight: 3 },
      { pattern: /\blet\s+mut\s+/, weight: 5 },
      { pattern: /\bprintln!\s*\(/, weight: 5 },
      { pattern: /\bimpl\s+\w+/, weight: 4 },
      { pattern: /\b->\s*\w+/, weight: 3 },
      { pattern: /\buse\s+std::/, weight: 4 },
      { pattern: /\bOption</, weight: 4 },
      { pattern: /\bResult</, weight: 4 },
    ],
    php: [
      { pattern: /<\?php/, weight: 6 },
      { pattern: /\$\w+\s*=/, weight: 3 },
      { pattern: /\becho\s+/, weight: 3 },
      { pattern: /\bfunction\s+\w+\s*\(/, weight: 1 },
      { pattern: /->/, weight: 1 },
      { pattern: /\$this->/, weight: 3 },
    ],
    ruby: [
      { pattern: /\bdef\s+\w+/, weight: 2 },
      { pattern: /\bputs\s+/, weight: 4 },
      { pattern: /\bend\s*$/m, weight: 2 },
      { pattern: /\brequire\s+['"]/, weight: 3 },
      { pattern: /\battr_accessor/, weight: 5 },
      { pattern: /\bdo\s*\|/, weight: 3 },
    ],
    swift: [
      { pattern: /\bvar\s+\w+\s*:/, weight: 3 },
      { pattern: /\bfunc\s+\w+/, weight: 2 },
      { pattern: /\bprint\s*\(/, weight: 1 },
      { pattern: /\blet\s+\w+\s*:/, weight: 3 },
      { pattern: /\bguard\s+let/, weight: 5 },
      { pattern: /\bif\s+let/, weight: 4 },
    ],
    kotlin: [
      { pattern: /\bfun\s+\w+/, weight: 3 },
      { pattern: /\bval\s+\w+/, weight: 3 },
      { pattern: /\bvar\s+\w+/, weight: 2 },
      { pattern: /\bprintln\s*\(/, weight: 2 },
      { pattern: /\bdata\s+class/, weight: 5 },
      { pattern: /\bobject\s+\w+/, weight: 4 },
    ],
    sql: [
      { pattern: /\bSELECT\s+/i, weight: 3 },
      { pattern: /\bFROM\s+/i, weight: 2 },
      { pattern: /\bWHERE\s+/i, weight: 2 },
      { pattern: /\bINSERT\s+INTO/i, weight: 3 },
      { pattern: /\bCREATE\s+TABLE/i, weight: 4 },
      { pattern: /\bJOIN\s+/i, weight: 3 },
    ],
    auto: [],
  };

  let maxScore = 0;
  let detectedLang: ProgrammingLanguage = 'auto';

  for (const [lang, patternList] of Object.entries(patterns)) {
    if (lang === 'auto') continue;
    let score = 0;
    for (const { pattern, weight } of patternList) {
      if (pattern.test(code)) {
        score += weight;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      detectedLang = lang as ProgrammingLanguage;
    }
  }

  return detectedLang === 'auto' ? 'javascript' : detectedLang;
}

function calculateCodeHealth(errors: { type: string }[]): CodeHealthScore {
  let score = 100;
  let errorCount = 0;
  let warningCount = 0;
  let optimizationCount = 0;

  for (const error of errors) {
    switch (error.type) {
      case 'syntax':
        score -= 30;
        errorCount++;
        break;
      case 'runtime':
        score -= 25;
        errorCount++;
        break;
      case 'logical':
        score -= 20;
        errorCount++;
        break;
      case 'warning':
        score -= 10;
        warningCount++;
        break;
      case 'bad_practice':
        score -= 5;
        optimizationCount++;
        break;
    }
  }

  score = Math.max(0, Math.min(100, score));
  
  // Calculate percentages that add up to exactly 100%
  const totalIssues = errorCount + warningCount + optimizationCount;
  
  if (totalIssues === 0) {
    // No issues - 100% correct
    return {
      score: 100,
      correct: 100,
      errors: 0,
      warnings: 0,
      optimizations: 0,
    };
  }

  // Calculate the "correct" portion based on score
  const correctPortion = score;
  const issuesPortion = 100 - score;
  
  // Distribute the issues portion among error types proportionally
  const errorPercent = totalIssues > 0 ? Math.round((errorCount / totalIssues) * issuesPortion) : 0;
  const warningPercent = totalIssues > 0 ? Math.round((warningCount / totalIssues) * issuesPortion) : 0;
  const optimizationPercent = totalIssues > 0 ? Math.round((optimizationCount / totalIssues) * issuesPortion) : 0;
  
  // Adjust for rounding errors to ensure total is exactly 100%
  const total = correctPortion + errorPercent + warningPercent + optimizationPercent;
  const adjustment = 100 - total;
  
  return {
    score,
    correct: correctPortion + adjustment, // Add any rounding adjustment to correct
    errors: errorPercent,
    warnings: warningPercent,
    optimizations: optimizationPercent,
  };
}

function cleanCorrectedCode(code: string): string {
  if (!code) return '';
  
  let cleaned = code.trim();
  
  // Remove markdown code fences with language identifiers
  const codeBlockRegex = /^```[\w]*\n?([\s\S]*?)\n?```$/;
  const match = cleaned.match(codeBlockRegex);
  if (match) {
    cleaned = match[1].trim();
  }
  
  // Also handle cases where only opening fence exists
  if (cleaned.startsWith('```')) {
    const lines = cleaned.split('\n');
    // Remove first line if it's a code fence
    if (lines[0].match(/^```\w*$/)) {
      lines.shift();
    }
    // Remove last line if it's a closing fence
    if (lines[lines.length - 1] === '```') {
      lines.pop();
    }
    cleaned = lines.join('\n');
  }
  
  return cleaned.trim();
}

// Validate and clean YouTube links
function validateYoutubeLinks(links: string[]): string[] {
  if (!Array.isArray(links)) return [];
  
  const validLinks: string[] = [];
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/;
  
  for (const link of links) {
    if (typeof link !== 'string') continue;
    
    // Skip placeholder text
    if (link.includes('IMPORTANT:') || link.includes('VIDEO_ID') || link.includes('Provide')) continue;
    
    const match = link.match(youtubeRegex);
    if (match) {
      // Normalize to standard YouTube URL format
      const videoId = match[4];
      validLinks.push(`https://www.youtube.com/watch?v=${videoId}`);
    }
  }
  
  return validLinks.slice(0, 5); // Max 5 links
}

// Validate documentation links
function validateDocLinks(links: string[], language: ProgrammingLanguage): string[] {
  if (!Array.isArray(links)) return [];
  
  const validLinks: string[] = [];
  const docDomains: Record<string, string[]> = {
    python: ['docs.python.org', 'realpython.com', 'python.org'],
    javascript: ['developer.mozilla.org', 'javascript.info', 'nodejs.org', 'ecma-international.org'],
    typescript: ['typescriptlang.org', 'developer.mozilla.org'],
    java: ['docs.oracle.com', 'dev.java', 'openjdk.org'],
    c: ['en.cppreference.com', 'devdocs.io', 'gnu.org'],
    cpp: ['en.cppreference.com', 'isocpp.org', 'cplusplus.com'],
    csharp: ['docs.microsoft.com', 'learn.microsoft.com'],
    go: ['go.dev', 'golang.org', 'pkg.go.dev'],
    rust: ['doc.rust-lang.org', 'rust-lang.org', 'docs.rs'],
    php: ['php.net', 'phpdoc.org'],
    ruby: ['ruby-doc.org', 'ruby-lang.org'],
    swift: ['developer.apple.com', 'swift.org'],
    kotlin: ['kotlinlang.org', 'developer.android.com'],
    sql: ['w3schools.com', 'postgresql.org', 'mysql.com', 'sqlite.org'],
  };
  
  for (const link of links) {
    if (typeof link !== 'string') continue;
    if (link.includes('Provide') || link.includes('REAL')) continue;
    
    try {
      const url = new URL(link.startsWith('http') ? link : `https://${link}`);
      // Check if it's a valid documentation domain
      const isValidDomain = docDomains[language]?.some(domain => url.hostname.includes(domain)) ||
                           url.hostname.includes('developer.') ||
                           url.hostname.includes('docs.') ||
                           url.hostname.includes('devdocs.io') ||
                           url.hostname.includes('stackoverflow.com');
      if (isValidDomain) {
        validLinks.push(url.href);
      }
    } catch {
      // Invalid URL, skip
    }
  }
  
  return validLinks.slice(0, 4); // Max 4 links
}

function generateDiff(original: string, corrected: string): DiffLine[] {
  // Clean both codes for comparison
  const cleanOriginal = original.trim();
  const cleanCorrected = cleanCorrectedCode(corrected);
  
  // If codes are essentially the same, return all as unchanged
  if (cleanOriginal === cleanCorrected) {
    return cleanOriginal.split('\n').map((line, i) => ({
      type: 'unchanged' as const,
      content: line,
      lineNumber: i + 1,
    }));
  }
  
  const originalLines = cleanOriginal.split('\n');
  const correctedLines = cleanCorrected.split('\n');
  const diff: DiffLine[] = [];
  
  // Use a simple LCS-based diff approach for better accuracy
  const maxLen = Math.max(originalLines.length, correctedLines.length);
  let origIndex = 0;
  let corrIndex = 0;
  
  while (origIndex < originalLines.length || corrIndex < correctedLines.length) {
    const origLine = originalLines[origIndex] || '';
    const corrLine = correctedLines[corrIndex] || '';
    
    if (origIndex >= originalLines.length) {
      // Only corrected lines left - these are additions
      diff.push({ type: 'added', content: corrLine, lineNumber: corrIndex + 1 });
      corrIndex++;
    } else if (corrIndex >= correctedLines.length) {
      // Only original lines left - these are removals
      diff.push({ type: 'removed', content: origLine, lineNumber: origIndex + 1 });
      origIndex++;
    } else if (origLine.trim() === corrLine.trim()) {
      // Lines match (ignoring whitespace)
      diff.push({ type: 'unchanged', content: corrLine, lineNumber: corrIndex + 1 });
      origIndex++;
      corrIndex++;
    } else {
      // Lines differ - check if it's a modification or insertion/deletion
      // Look ahead to see if the original line appears later in corrected
      const foundInCorrected = correctedLines.slice(corrIndex + 1, corrIndex + 5).findIndex(l => l.trim() === origLine.trim());
      const foundInOriginal = originalLines.slice(origIndex + 1, origIndex + 5).findIndex(l => l.trim() === corrLine.trim());
      
      if (foundInCorrected >= 0 && (foundInOriginal < 0 || foundInCorrected <= foundInOriginal)) {
        // Original line appears later - current corrected line is an addition
        diff.push({ type: 'added', content: corrLine, lineNumber: corrIndex + 1 });
        corrIndex++;
      } else if (foundInOriginal >= 0) {
        // Corrected line appears later - current original line is a removal
        diff.push({ type: 'removed', content: origLine, lineNumber: origIndex + 1 });
        origIndex++;
      } else {
        // Both lines are different - it's a modification
        diff.push({ type: 'removed', content: origLine, lineNumber: origIndex + 1 });
        diff.push({ type: 'added', content: corrLine, lineNumber: corrIndex + 1 });
        origIndex++;
        corrIndex++;
      }
    }
  }
  
  return diff;
}

export async function POST(request: NextRequest) {
  try {
    const body: DebugRequest = await request.json();
    const { code, language, explanationLanguage, userLevel, learningMode } = body;

    const detectedLang = language === 'auto' ? detectLanguage(code) : language;

    const prompt = `You are an expert AI debugging assistant with deep knowledge of ${detectedLang}. Carefully analyze the following code line by line and provide comprehensive debugging assistance.

IMPORTANT INSTRUCTIONS:
1. Analyze EVERY line of code thoroughly, even if the code is large
2. Look for ALL types of errors: syntax errors, runtime errors, logical errors, type errors, edge cases, bad practices
3. For large code, systematically check each function/block
4. Be thorough - don't miss any issues

CODE TO DEBUG (${code.split('\n').length} lines):
\`\`\`${detectedLang}
${code}
\`\`\`

USER LEVEL: ${userLevel}
EXPLANATION LANGUAGE: ${explanationLanguage}
LEARNING MODE: ${learningMode}

Please provide your response in the following JSON format (respond ONLY with valid JSON, no markdown):
{
  "intent": "What the code is trying to accomplish (be specific about the algorithm/functionality)",
  "actualBehavior": "What the code actually does (describe the current behavior in detail)",
  "error": "Description of what went wrong (or 'No errors found - code is correct' if no issues). Be specific about the error type and location",
  "explanation": "Detailed explanation based on user level (${userLevel}) - ${userLevel === 'beginner' ? 'Use simple language, no jargon, explain like talking to a student' : userLevel === 'intermediate' ? 'Use technical terms with clear explanations' : 'Deep technical explanation with compiler-level reasoning, memory management details, and performance implications'}",
  "rootCause": "The fundamental reason for the error - explain WHY the code fails, not just WHAT is wrong",
  "learning": {
    "whyItHappened": "Detailed explanation of why this specific error occurred in this context",
    "whenItHappens": "Common scenarios and patterns where this type of error occurs",
    "howToAvoid": "Best practices and coding patterns to prevent this error in the future",
    "concept": "The underlying programming concept (e.g., variable scope, memory management, async/await, etc.)"
  },
  "mentalModel": "A clear analogy or mental model to understand this concept (use real-world examples)",
  "teacherMode": "Step-by-step teaching explanation with examples - explain as if teaching a class",
  "thinkMode": "Socratic questions to guide the user to understand the error themselves (3-5 thought-provoking questions)",
  "conceptBuilder": "Focus on the core programming concept behind the error - explain the theory",
  "debugTrace": "Step-by-step execution trace showing variable values at each step (format: Line X: variable = value)",
  "interviewMode": "How to explain this error and its fix in a technical interview (include what interviewer expects to hear)",
  "challengeMode": "Progressive hints for the user to solve it themselves (Hint 1: vague, Hint 2: more specific, Hint 3: almost gives it away)",
  "generalization": "How this error pattern applies to other programming scenarios and languages",
  "resources": {
    "youtubeLinks": [
      "IMPORTANT: Provide 2-4 REAL, WORKING YouTube video URLs that teach the specific concept related to this error. Use videos from popular programming channels like: freeCodeCamp, Traversy Media, The Coding Train, Programming with Mosh, CS Dojo, Corey Schafer (Python), Web Dev Simplified, Fireship, etc. Format: https://www.youtube.com/watch?v=VIDEO_ID or https://youtu.be/VIDEO_ID. Only include links you are confident are real videos about ${detectedLang} programming concepts."
    ],
    "documentationLinks": [
      "Provide 2-3 REAL official documentation links for ${detectedLang} related to this specific error/concept"
    ]
  },
  "errors": [
    {"type": "syntax|runtime|logical|warning|bad_practice", "line": 1, "message": "detailed error description with fix suggestion"}
  ],
  "correctedCode": "The complete fixed version of the code with ALL errors corrected. Preserve the original structure and add helpful comments where you made changes."
}

${explanationLanguage !== 'english' ? `
CRITICAL LANGUAGE INSTRUCTION: You MUST write ALL explanations, descriptions, and text content in ${explanationLanguage.toUpperCase()} language. This includes:
- "intent" field - write in ${explanationLanguage}
- "actualBehavior" field - write in ${explanationLanguage}
- "error" field - write in ${explanationLanguage}
- "explanation" field - write in ${explanationLanguage}
- "rootCause" field - write in ${explanationLanguage}
- All "learning" fields - write in ${explanationLanguage}
- "mentalModel" field - write in ${explanationLanguage}
- "teacherMode" field - write in ${explanationLanguage}
- "thinkMode" field - write in ${explanationLanguage}
- "conceptBuilder" field - write in ${explanationLanguage}
- "debugTrace" field - write in ${explanationLanguage}
- "interviewMode" field - write in ${explanationLanguage}
- "challengeMode" field - write in ${explanationLanguage}
- "generalization" field - write in ${explanationLanguage}

ONLY keep the following in English:
- Code snippets and correctedCode
- Programming keywords and function names
- Variable names in examples

The user selected ${explanationLanguage} as their preferred language. Please respect this choice.
` : ''}

Respond with ONLY the JSON object, no additional text or markdown formatting.`;

    // Calculate dynamic token limit based on code size
    const codeLength = code.length;
    const baseTokens = 8192;
    const additionalTokens = Math.min(Math.floor(codeLength / 100) * 500, 8000);
    const maxTokens = baseTokens + additionalTokens;

    const requestBody = {
      model: 'google/gemini-2.0-flash-001',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
    };

    const response = await callOpenRouterWithRetry(requestBody);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', errorText);
      
      if (response.status === 429) {
        return NextResponse.json(
          { error: 'API rate limit exceeded. Please wait a moment and try again.' },
          { status: 429 }
        );
      }
      
      if (response.status === 401) {
        return NextResponse.json(
          { error: 'Invalid API key. Please check your OpenRouter API key.' },
          { status: 401 }
        );
      }
      
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const textContent = data.choices?.[0]?.message?.content || '';
    
    // Clean the response - remove markdown code blocks if present
    let cleanedContent = textContent.trim();
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.slice(7);
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.slice(3);
    }
    if (cleanedContent.endsWith('```')) {
      cleanedContent = cleanedContent.slice(0, -3);
    }
    cleanedContent = cleanedContent.trim();

    let parsedResult;
    try {
      parsedResult = JSON.parse(cleanedContent);
    } catch {
      console.error('Failed to parse OpenRouter response:', cleanedContent);
      throw new Error('Failed to parse AI response');
    }

    const codeHealth = calculateCodeHealth(parsedResult.errors || []);
    
    // Clean the corrected code to remove markdown formatting
    const cleanedCorrectedCode = cleanCorrectedCode(parsedResult.correctedCode || code);
    const diffView = generateDiff(code, cleanedCorrectedCode);

    const result: DebugResult = {
      intent: parsedResult.intent || 'Unable to determine intent',
      actualBehavior: parsedResult.actualBehavior || 'Unable to determine behavior',
      error: parsedResult.error || 'No errors found',
      explanation: parsedResult.explanation || 'No explanation available',
      rootCause: parsedResult.rootCause || 'Unable to determine root cause',
      learning: {
        whyItHappened: parsedResult.learning?.whyItHappened || '',
        whenItHappens: parsedResult.learning?.whenItHappens || '',
        howToAvoid: parsedResult.learning?.howToAvoid || '',
        concept: parsedResult.learning?.concept || '',
      },
      mentalModel: parsedResult.mentalModel || '',
      teacherMode: parsedResult.teacherMode,
      thinkMode: parsedResult.thinkMode,
      conceptBuilder: parsedResult.conceptBuilder,
      debugTrace: parsedResult.debugTrace,
      interviewMode: parsedResult.interviewMode,
      challengeMode: parsedResult.challengeMode,
      generalization: parsedResult.generalization || '',
      resources: {
        youtubeLinks: validateYoutubeLinks(parsedResult.resources?.youtubeLinks || []),
        documentationLinks: validateDocLinks(parsedResult.resources?.documentationLinks || [], detectedLang),
      },
      codeHealth,
      correctedCode: cleanedCorrectedCode,
      diffView,
      detectedLanguage: detectedLang,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Debug API error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Provide more specific error messages
    if (errorMessage.includes('timeout')) {
      return NextResponse.json(
        { error: 'The code analysis is taking too long. Please try with smaller code or try again.' },
        { status: 504 }
      );
    }
    
    if (errorMessage.includes('parse') || errorMessage.includes('JSON')) {
      return NextResponse.json(
        { error: 'Failed to process AI response. Please try again - the AI may have produced an invalid response.' },
        { status: 500 }
      );
    }
    
    if (errorMessage.includes('Max retries')) {
      return NextResponse.json(
        { error: 'The AI service is currently busy. Please wait a moment and try again.' },
        { status: 503 }
      );
    }
    
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return NextResponse.json(
        { error: 'Network error occurred. Please check your connection and try again.' },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to debug code. Please try again. If the problem persists, try with smaller code.' },
      { status: 500 }
    );
  }
}
