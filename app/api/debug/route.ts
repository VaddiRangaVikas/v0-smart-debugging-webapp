import { NextRequest, NextResponse } from 'next/server';
import type { DebugRequest, DebugResult, DiffLine, CodeHealthScore, ProgrammingLanguage } from '@/lib/types';

// Google Gemini API configuration (FREE tier: 15 RPM, 1500 RPD)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// Call Google Gemini API with retry logic
async function callGeminiAPI(prompt: string, maxTokens: number = 4096): Promise<string> {
  // Check if API key is configured
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured. Please add your Google Gemini API key.');
  }
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: maxTokens,
            topP: 0.95,
            topK: 40,
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Gemini API error:', response.status, errorData);
        
        if (response.status === 400) {
          throw new Error('Invalid request to Gemini API');
        }
        if (response.status === 403) {
          throw new Error('Invalid Gemini API key');
        }
        if (response.status === 429) {
          // Rate limited, wait and retry
          if (attempt < maxRetries - 1) {
            const waitTime = (attempt + 1) * 5000; // Longer wait for rate limits
            console.log(`Rate limited, waiting ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
          throw new Error('Rate limited - please wait a moment and try again');
        }
        if (response.status >= 500) {
          // Server error, retry
          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 2000));
            continue;
          }
        }
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!content) {
        console.error('Empty response from Gemini:', JSON.stringify(data));
        throw new Error('Empty response from AI');
      }
      
      return content;
    } catch (error) {
      lastError = error as Error;
      if ((error as Error).name === 'AbortError') {
        throw new Error('Request timeout - please try with smaller code');
      }
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1000));
        continue;
      }
    }
  }

  throw lastError || new Error('Failed after retries');
}

function detectLanguage(code: string): ProgrammingLanguage {
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
  
  const totalIssues = errorCount + warningCount + optimizationCount;
  
  if (totalIssues === 0) {
    return {
      score: 100,
      correct: 100,
      errors: 0,
      warnings: 0,
      optimizations: 0,
    };
  }

  const correctPortion = score;
  const issuesPortion = 100 - score;
  
  const errorPercent = totalIssues > 0 ? Math.round((errorCount / totalIssues) * issuesPortion) : 0;
  const warningPercent = totalIssues > 0 ? Math.round((warningCount / totalIssues) * issuesPortion) : 0;
  const optimizationPercent = totalIssues > 0 ? Math.round((optimizationCount / totalIssues) * issuesPortion) : 0;
  
  const total = correctPortion + errorPercent + warningPercent + optimizationPercent;
  const adjustment = 100 - total;
  
  return {
    score,
    correct: correctPortion + adjustment,
    errors: errorPercent,
    warnings: warningPercent,
    optimizations: optimizationPercent,
  };
}

function cleanCorrectedCode(code: string): string {
  if (!code) return '';
  
  let cleaned = code.trim();
  
  const codeBlockRegex = /^```[\w]*\n?([\s\S]*?)\n?```$/;
  const match = cleaned.match(codeBlockRegex);
  if (match) {
    cleaned = match[1].trim();
  }
  
  if (cleaned.startsWith('```')) {
    const lines = cleaned.split('\n');
    if (lines[0].match(/^```\w*$/)) {
      lines.shift();
    }
    if (lines[lines.length - 1] === '```') {
      lines.pop();
    }
    cleaned = lines.join('\n');
  }
  
  return cleaned.trim();
}

function validateYoutubeLinks(links: string[]): string[] {
  if (!Array.isArray(links)) return [];
  
  const validLinks: string[] = [];
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/;
  
  for (const link of links) {
    if (typeof link !== 'string') continue;
    if (link.includes('IMPORTANT:') || link.includes('VIDEO_ID') || link.includes('Provide')) continue;
    
    const match = link.match(youtubeRegex);
    if (match) {
      const videoId = match[4];
      validLinks.push(`https://www.youtube.com/watch?v=${videoId}`);
    }
  }
  
  return validLinks.slice(0, 5);
}

function validateDocLinks(links: string[], language: ProgrammingLanguage): string[] {
  if (!Array.isArray(links)) return [];
  
  const validLinks: string[] = [];
  const docDomains: Record<string, string[]> = {
    python: ['docs.python.org', 'realpython.com', 'python.org'],
    javascript: ['developer.mozilla.org', 'javascript.info', 'nodejs.org'],
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
  
  return validLinks.slice(0, 4);
}

function generateDiff(original: string, corrected: string): DiffLine[] {
  const cleanOriginal = original.trim();
  const cleanCorrected = cleanCorrectedCode(corrected);
  
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
  
  let origIndex = 0;
  let corrIndex = 0;
  
  while (origIndex < originalLines.length || corrIndex < correctedLines.length) {
    const origLine = originalLines[origIndex] || '';
    const corrLine = correctedLines[corrIndex] || '';
    
    if (origIndex >= originalLines.length) {
      diff.push({ type: 'added', content: corrLine, lineNumber: corrIndex + 1 });
      corrIndex++;
    } else if (corrIndex >= correctedLines.length) {
      diff.push({ type: 'removed', content: origLine, lineNumber: origIndex + 1 });
      origIndex++;
    } else if (origLine.trim() === corrLine.trim()) {
      diff.push({ type: 'unchanged', content: corrLine, lineNumber: corrIndex + 1 });
      origIndex++;
      corrIndex++;
    } else {
      const foundInCorrected = correctedLines.slice(corrIndex + 1, corrIndex + 5).findIndex(l => l.trim() === origLine.trim());
      const foundInOriginal = originalLines.slice(origIndex + 1, origIndex + 5).findIndex(l => l.trim() === corrLine.trim());
      
      if (foundInCorrected >= 0 && (foundInOriginal < 0 || foundInCorrected <= foundInOriginal)) {
        diff.push({ type: 'added', content: corrLine, lineNumber: corrIndex + 1 });
        corrIndex++;
      } else if (foundInOriginal >= 0) {
        diff.push({ type: 'removed', content: origLine, lineNumber: origIndex + 1 });
        origIndex++;
      } else {
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

    if (!code || code.trim().length === 0) {
      return NextResponse.json(
        { error: 'Please provide code to debug.' },
        { status: 400 }
      );
    }

    const detectedLang = language === 'auto' ? detectLanguage(code) : language;

    const prompt = `You are an expert AI debugging assistant. Analyze the following ${detectedLang} code and provide comprehensive debugging assistance.

CODE TO DEBUG:
\`\`\`${detectedLang}
${code}
\`\`\`

USER LEVEL: ${userLevel}
EXPLANATION LANGUAGE: ${explanationLanguage}
LEARNING MODE: ${learningMode}

Respond ONLY with valid JSON (no markdown, no code blocks), following this exact structure:
{
  "intent": "What the code is trying to accomplish",
  "actualBehavior": "What the code actually does",
  "error": "Description of what went wrong (or 'No errors found' if code is correct)",
  "explanation": "Detailed explanation based on user level",
  "rootCause": "The fundamental reason for the error",
  "learning": {
    "whyItHappened": "Why this error occurred",
    "whenItHappens": "Common scenarios where this error occurs",
    "howToAvoid": "Best practices to prevent this error",
    "concept": "The underlying programming concept"
  },
  "mentalModel": "An analogy or mental model to understand this better",
  "teacherMode": "Step-by-step teaching explanation",
  "thinkMode": "Socratic questions to guide understanding",
  "conceptBuilder": "Focus on the core concept behind the error",
  "debugTrace": "Step-by-step execution flow with variable values",
  "interviewMode": "How to explain this in a technical interview",
  "challengeMode": "Hints for the user to solve it themselves",
  "generalization": "How this error pattern applies to other scenarios",
  "resources": {
    "youtubeLinks": ["https://www.youtube.com/watch?v=example1"],
    "documentationLinks": ["https://docs.example.com/relevant-topic"]
  },
  "errors": [
    {"type": "syntax", "line": 1, "message": "error description"}
  ],
  "correctedCode": "The fixed version of the code"
}`;

    // Calculate dynamic token limit based on code size
    const codeLength = code.length;
    const baseTokens = 4096;
    const additionalTokens = Math.min(Math.floor(codeLength / 200) * 500, 4000);
    const maxTokens = baseTokens + additionalTokens;

    // Use Google Gemini API (FREE tier)
    const responseText = await callGeminiAPI(prompt, maxTokens);

    if (!responseText) {
      return NextResponse.json(
        { error: 'AI service returned empty response. Please try again.' },
        { status: 500 }
      );
    }

    // Parse the JSON response
    let parsedResult;
    try {
      let cleanedResponse = responseText;
      
      // Remove markdown code blocks if present
      if (cleanedResponse.includes('```json')) {
        cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (cleanedResponse.includes('```')) {
        cleanedResponse = cleanedResponse.replace(/```\w*\n?/g, '').replace(/```\n?/g, '');
      }
      
      cleanedResponse = cleanedResponse.trim();
      
      parsedResult = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('Raw response:', responseText.substring(0, 500));
      
      // Create a basic result from the raw response
      parsedResult = {
        intent: 'Unable to parse structured response',
        actualBehavior: 'The AI provided analysis but in an unexpected format',
        error: 'Response parsing failed - showing raw analysis',
        explanation: responseText.substring(0, 2000),
        rootCause: 'Please try again for structured analysis',
        learning: {
          whyItHappened: 'N/A',
          whenItHappens: 'N/A',
          howToAvoid: 'N/A',
          concept: 'N/A',
        },
        mentalModel: 'N/A',
        teacherMode: 'N/A',
        thinkMode: 'N/A',
        conceptBuilder: 'N/A',
        debugTrace: 'N/A',
        interviewMode: 'N/A',
        challengeMode: 'N/A',
        generalization: 'N/A',
        resources: { youtubeLinks: [], documentationLinks: [] },
        errors: [],
        correctedCode: code,
      };
    }

    // Clean up corrected code
    const correctedCode = cleanCorrectedCode(parsedResult.correctedCode || code);
    
    // Generate diff
    const diff = generateDiff(code, correctedCode);
    
    // Calculate code health
    const errors = Array.isArray(parsedResult.errors) ? parsedResult.errors : [];
    const codeHealth = calculateCodeHealth(errors);

    const debugResult: DebugResult = {
      originalCode: code,
      correctedCode,
      language: detectedLang,
      intent: parsedResult.intent || 'Unable to determine intent',
      actualBehavior: parsedResult.actualBehavior || 'Unable to determine behavior',
      error: parsedResult.error || 'No specific error identified',
      explanation: parsedResult.explanation || 'No explanation available',
      rootCause: parsedResult.rootCause || 'Unable to determine root cause',
      learning: parsedResult.learning || {
        whyItHappened: 'N/A',
        whenItHappens: 'N/A',
        howToAvoid: 'N/A',
        concept: 'N/A',
      },
      mentalModel: parsedResult.mentalModel || 'N/A',
      teacherMode: parsedResult.teacherMode || 'N/A',
      thinkMode: parsedResult.thinkMode || 'N/A',
      conceptBuilder: parsedResult.conceptBuilder || 'N/A',
      debugTrace: parsedResult.debugTrace || 'N/A',
      interviewMode: parsedResult.interviewMode || 'N/A',
      challengeMode: parsedResult.challengeMode || 'N/A',
      generalization: parsedResult.generalization || 'N/A',
      diff,
      errors,
      codeHealth,
      resources: {
        youtubeLinks: validateYoutubeLinks(parsedResult.resources?.youtubeLinks || []),
        documentationLinks: validateDocLinks(parsedResult.resources?.documentationLinks || [], detectedLang),
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(debugResult);
  } catch (error) {
  console.error('Debug API error:', error);
  
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  
  // Handle missing API key
  if (errorMessage.includes('GEMINI_API_KEY') || errorMessage.includes('not configured')) {
  return NextResponse.json(
  { error: 'API key not configured. Please add your GEMINI_API_KEY in the environment variables.' },
  { status: 500 }
  );
  }
  
  if (errorMessage.includes('Invalid') && errorMessage.includes('API')) {
  return NextResponse.json(
  { error: 'Invalid API key. Please check your GEMINI_API_KEY is correct.' },
  { status: 401 }
  );
  }
    
    if (errorMessage.includes('Rate limited')) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment and try again.' },
        { status: 429 }
      );
    }
    
    if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
      return NextResponse.json(
        { error: 'The code analysis is taking too long. Please try with smaller code.' },
        { status: 504 }
      );
    }
    
    if (errorMessage.includes('parse') || errorMessage.includes('JSON')) {
      return NextResponse.json(
        { error: 'Failed to process AI response. Please try again.' },
        { status: 500 }
      );
    }
    
    if (errorMessage.includes('rate') || errorMessage.includes('Rate limited')) {
      return NextResponse.json(
        { error: 'AI service is busy. Please wait a moment and try again.' },
        { status: 429 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to debug code. Please try again.' },
      { status: 500 }
    );
  }
}
