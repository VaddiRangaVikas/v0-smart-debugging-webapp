import { NextRequest, NextResponse } from 'next/server';
import type { DebugRequest, DebugResult, DiffLine, CodeHealthScore, ProgrammingLanguage } from '@/lib/types';

const OPENROUTER_API_KEY = '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';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Function to repair truncated JSON responses
function repairTruncatedJSON(jsonString: string): Record<string, unknown> {
  let str = jsonString.trim();
  
  // First, try to find and fix common truncation patterns
  // Pattern 1: Truncated in the middle of "correctedCode" string value
  const correctedCodeMatch = str.match(/"correctedCode"\s*:\s*"/);
  if (correctedCodeMatch) {
    const startIdx = correctedCodeMatch.index! + correctedCodeMatch[0].length;
    // Find if the correctedCode value is properly closed
    let inEscape = false;
    let foundEnd = false;
    for (let i = startIdx; i < str.length; i++) {
      if (inEscape) {
        inEscape = false;
        continue;
      }
      if (str[i] === '\\') {
        inEscape = true;
        continue;
      }
      if (str[i] === '"') {
        foundEnd = true;
        break;
      }
    }
    if (!foundEnd) {
      // correctedCode is truncated, close it and the object
      str = str + '"}}';
    }
  }

  // Helper function to count brackets
  const countBrackets = (s: string) => {
    let braces = 0, brackets = 0, inString = false, prev = '';
    for (const c of s) {
      if (c === '"' && prev !== '\\') inString = !inString;
      if (!inString) {
        if (c === '{') braces++;
        if (c === '}') braces--;
        if (c === '[') brackets++;
        if (c === ']') brackets--;
      }
      prev = c;
    }
    return { braces, brackets, inString };
  };

  // Check current state
  let state = countBrackets(str);
  
  // If we're in an unclosed string, close it
  if (state.inString) {
    str = str + '"';
    state = countBrackets(str);
  }
  
  // Remove trailing incomplete content
  str = str.replace(/,\s*$/, '');
  str = str.replace(/,\s*"[^"]*"?\s*:?\s*$/, ''); // Remove incomplete key-value
  str = str.replace(/:\s*$/, '": ""'); // Fix trailing colon
  
  // Recount after cleanup
  state = countBrackets(str);
  
  // Close unclosed structures
  str += ']'.repeat(Math.max(0, state.brackets));
  str += '}'.repeat(Math.max(0, state.braces));
  
  try {
    return JSON.parse(str);
  } catch {
    // More aggressive repair: find last valid JSON position
    for (let i = str.length; i > 100; i -= 20) {
      let testStr = str.slice(0, i);
      
      // Clean up potential truncation points
      testStr = testStr.replace(/,\s*"[^"]*"?\s*:?\s*"?[^"{}[\]]*$/, '');
      testStr = testStr.replace(/,\s*$/, '');
      
      const testState = countBrackets(testStr);
      
      if (testState.inString) {
        testStr += '"';
      }
      
      const finalState = countBrackets(testStr);
      testStr += ']'.repeat(Math.max(0, finalState.brackets));
      testStr += '}'.repeat(Math.max(0, finalState.braces));
      
      try {
        return JSON.parse(testStr);
      } catch {
        continue;
      }
    }
    
    throw new Error('Unable to repair JSON');
  }
}

async function callOpenRouterWithRetry(body: object, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://v0.dev',
        'X-Title': 'AI Debug Assistant',
      },
      body: JSON.stringify(body),
    });
    
    if (response.ok) return response;
    
    if (response.status === 429 && i < retries - 1) {
      await new Promise(resolve => setTimeout(resolve, (i + 1) * 2000));
      continue;
    }
    
    return response;
  }
  throw new Error('Max retries exceeded');
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

// Generate a suggested fix based on error message
function generateSuggestionFromError(errorMessage: string, originalLine: string): string {
  const msg = errorMessage.toLowerCase();
  let suggestion = originalLine;
  
  // Common error patterns and their fixes
  if (msg.includes('missing semicolon') || msg.includes('add semicolon')) {
    if (!originalLine.trim().endsWith(';') && !originalLine.trim().endsWith('{') && !originalLine.trim().endsWith('}')) {
      suggestion = originalLine.trimEnd() + ';';
    }
  }
  else if (msg.includes('%d') && msg.includes('%ld') || msg.includes('format specifier')) {
    // Format specifier issues
    suggestion = originalLine.replace(/%d/g, '%ld').replace(/%i/g, '%li');
  }
  else if (msg.includes('typo') || msg.includes('should be')) {
    // Try to extract the correct spelling from the error message
    const shouldBeMatch = errorMessage.match(/should be ['"`]?(\w+)['"`]?/i);
    if (shouldBeMatch) {
      const correctWord = shouldBeMatch[1];
      // Find the typo in the line and replace it
      const typoMatch = errorMessage.match(/['"`]?(\w+)['"`]? should be/i);
      if (typoMatch) {
        suggestion = originalLine.replace(new RegExp(typoMatch[1], 'g'), correctWord);
      }
    }
  }
  else if (msg.includes('undefined variable') || msg.includes('not declared')) {
    // Can't auto-fix undefined variables, keep original
    suggestion = originalLine;
  }
  else if (msg.includes('missing closing') || msg.includes('unclosed')) {
    if (msg.includes('parenthesis') || msg.includes(')')) {
      suggestion = originalLine + ')';
    } else if (msg.includes('brace') || msg.includes('}')) {
      suggestion = originalLine + '}';
    } else if (msg.includes('bracket') || msg.includes(']')) {
      suggestion = originalLine + ']';
    }
  }
  
  return suggestion;
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

    // Calculate code length for better handling
    const codeLines = code.split('\n');
    const codeLength = codeLines.length;
    const isLongCode = codeLength > 50;

    const prompt = `You are an expert AI debugging assistant. Analyze the following ${detectedLang} code COMPLETELY and provide comprehensive debugging assistance.

IMPORTANT INSTRUCTIONS:
- This code has ${codeLength} lines. You MUST analyze EVERY SINGLE LINE carefully.
- Do NOT skip any part of the code, regardless of its length.
- Examine each line for potential errors, warnings, or bad practices.
- For long code, take your time to analyze thoroughly - completeness is more important than speed.

CODE TO DEBUG (${codeLength} lines):
\`\`\`${detectedLang}
${code}
\`\`\`

USER LEVEL: ${userLevel}
EXPLANATION LANGUAGE: ${explanationLanguage}
LEARNING MODE: ${learningMode}

Please provide your response in the following JSON format (respond ONLY with valid JSON, no markdown).
IMPORTANT: The "errors" array and "correctedCode" MUST be provided FIRST as they are the most critical fields.

{
  "errors": [
    {"type": "syntax|runtime|logical|warning|bad_practice", "line": <exact line number 1-indexed>, "message": "detailed error description"}
  ],
  "correctedCode": "The COMPLETE fixed code with ALL corrections applied",
  "intent": "What the code is trying to accomplish",
  "actualBehavior": "What the code actually does",
  "error": "Brief description of main issue (or 'No errors found')",
  "explanation": "Explanation based on ${userLevel} level",
  "rootCause": "Fundamental reason for the error",
  "learning": {
    "whyItHappened": "Why this error occurred",
    "whenItHappens": "Common scenarios",
    "howToAvoid": "Prevention tips",
    "concept": "Core concept"
  },
  "mentalModel": "Analogy to understand better",
  "teacherMode": "Teaching explanation",
  "thinkMode": "Guiding questions",
  "conceptBuilder": "Core concept focus",
  "debugTrace": "Execution flow",
  "interviewMode": "Interview explanation",
  "challengeMode": "Hints to solve",
  "generalization": "Pattern applications",
  "resources": {
    "youtubeSearchQueries": ["Search terms for tutorials"],
    "documentationLinks": ["Doc links"]
  }
}

CRITICAL REQUIREMENTS:
1. OUTPUT "errors" ARRAY FIRST - List ALL errors with EXACT line numbers (1-indexed). Each error needs: type, line, message.
2. OUTPUT "correctedCode" SECOND - The COMPLETE fixed code. Do NOT truncate. Include ALL ${codeLength} lines.
3. Detect ALL types of errors: syntax errors, runtime errors, logical errors, type mismatches, missing semicolons, wrong operators, undefined variables, etc.
4. For each error, explain WHAT is wrong and HOW to fix it in the message field.
5. The correctedCode must compile/run without errors - verify all fixes are applied.

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

    const requestBody = {
      model: 'google/gemini-2.0-flash-001',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 16384,
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
      // Try to repair truncated JSON
      console.log('[v0] Attempting to repair truncated JSON response');
      try {
        parsedResult = repairTruncatedJSON(cleanedContent);
      } catch {
        console.error('Failed to parse or repair OpenRouter response:', cleanedContent.slice(0, 500) + '...');
        throw new Error('Failed to parse AI response');
      }
    }

    const codeHealth = calculateCodeHealth(parsedResult.errors || []);
    
    // Clean the corrected code to remove markdown formatting
    let correctedCodeRaw = parsedResult.correctedCode || '';
    let codeWasTruncated = false;
    
    // Check if correctedCode is truncated or empty
    const isTruncated = typeof correctedCodeRaw === 'string' && 
        (correctedCodeRaw.endsWith('...') || 
         correctedCodeRaw.endsWith('..') ||
         !correctedCodeRaw.trim() ||
         (correctedCodeRaw.length < code.length * 0.5 && code.length > 100));
    
    if (isTruncated) {
      console.log('[v0] Corrected code appears truncated, attempting to recover');
      codeWasTruncated = true;
      
      // Try to use partial corrected code if it has meaningful content
      if (correctedCodeRaw.trim() && correctedCodeRaw.length > 20) {
        // Remove trailing ... and try to complete the code
        correctedCodeRaw = correctedCodeRaw.replace(/\.{2,}$/, '');
        // Append remaining lines from original if partial
        const partialLines = correctedCodeRaw.split('\n').length;
        const originalLines = code.split('\n');
        if (partialLines < originalLines.length) {
          // Append missing lines from original
          const remainingLines = originalLines.slice(partialLines);
          correctedCodeRaw = correctedCodeRaw + '\n' + remainingLines.join('\n');
        }
      } else {
        // No useful corrected code, use original
        correctedCodeRaw = code;
      }
    }
    
    // If still no corrected code, use original
    if (!correctedCodeRaw.trim()) {
      correctedCodeRaw = code;
    }
    
    const cleanedCorrectedCode = cleanCorrectedCode(correctedCodeRaw);
    
    // Generate diff
    let diffView: DiffLine[];
    const errors = parsedResult.errors || [];
    
    if (cleanedCorrectedCode.trim() === code.trim() && errors.length > 0) {
      // No actual code changes but we have errors - show error lines as removed
      // and try to generate suggested fixes as added lines
      const errorLinesMap = new Map<number, {type?: string; message?: string}>();
      errors.forEach((e: {line?: number; type?: string; message?: string}) => {
        if (e.line) errorLinesMap.set(e.line, e);
      });
      
      const codeLines = code.split('\n');
      diffView = [];
      
      codeLines.forEach((line, index) => {
        const lineNum = index + 1;
        const errorInfo = errorLinesMap.get(lineNum);
        
        if (errorInfo) {
          // Add the error line as removed (red)
          diffView.push({
            type: 'removed' as const,
            content: line,
            lineNumber: lineNum,
          });
          // Add a suggested fix comment as added (cyan) if we can provide guidance
          const suggestion = generateSuggestionFromError(errorInfo.message || '', line);
          if (suggestion && suggestion !== line) {
            diffView.push({
              type: 'added' as const,
              content: suggestion,
              lineNumber: lineNum,
            });
          }
        } else {
          diffView.push({
            type: 'unchanged' as const,
            content: line,
            lineNumber: lineNum,
          });
        }
      });
    } else {
      diffView = generateDiff(code, cleanedCorrectedCode);
    }

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
        youtubeSearchQueries: parsedResult.resources?.youtubeSearchQueries || [],
        documentationLinks: parsedResult.resources?.documentationLinks || [],
      },
      codeHealth,
      correctedCode: cleanedCorrectedCode,
      diffView,
      detectedLanguage: detectedLang,
      errors: (parsedResult.errors || []).map((e: { type?: string; line?: number; message?: string }) => ({
        type: e.type || 'logical',
        line: e.line,
        message: e.message || 'Unknown error',
        severity: e.type === 'syntax' ? 3 : e.type === 'runtime' ? 2 : 1,
      })),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json(
      { error: 'Failed to debug code. Please try again.' },
      { status: 500 }
    );
  }
}
