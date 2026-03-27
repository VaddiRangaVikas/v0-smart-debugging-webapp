import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_API_KEY = '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';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    // Handle text-based files directly
    if (
      fileType === 'text/plain' ||
      fileName.endsWith('.py') ||
      fileName.endsWith('.java') ||
      fileName.endsWith('.c') ||
      fileName.endsWith('.cpp') ||
      fileName.endsWith('.js') ||
      fileName.endsWith('.ts') ||
      fileName.endsWith('.go') ||
      fileName.endsWith('.rs') ||
      fileName.endsWith('.php') ||
      fileName.endsWith('.rb') ||
      fileName.endsWith('.swift') ||
      fileName.endsWith('.kt') ||
      fileName.endsWith('.sql') ||
      fileName.endsWith('.cs')
    ) {
      const text = await file.text();
      return NextResponse.json({ code: text, method: 'direct' });
    }

    // Handle images with OpenRouter vision model
    if (fileType.startsWith('image/')) {
      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString('base64');
      const dataUrl = `data:${fileType};base64,${base64}`;

      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://v0.dev',
          'X-Title': 'AI Debug Assistant',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-001',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: dataUrl,
                  },
                },
                {
                  type: 'text',
                  text: `Extract all code from this image. Return ONLY the extracted code, nothing else. No explanations, no markdown formatting, no code blocks. If there are multiple code snippets, combine them in order. If there's no code visible, return an empty string. Preserve the exact formatting, indentation, and line breaks of the original code.`,
                },
              ],
            },
          ],
          temperature: 0.1,
          max_tokens: 4096,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenRouter Vision API error:', errorText);
        throw new Error(`Failed to extract code from image`);
      }

      const data = await response.json();
      let extractedCode = data.choices?.[0]?.message?.content || '';
      
      // Clean up any markdown code blocks that might have been added
      extractedCode = extractedCode.trim();
      if (extractedCode.startsWith('```')) {
        const lines = extractedCode.split('\n');
        lines.shift();
        if (lines[lines.length - 1] === '```') {
          lines.pop();
        }
        extractedCode = lines.join('\n');
      }

      return NextResponse.json({ code: extractedCode, method: 'ocr' });
    }

    // Handle PDFs - for now, return an error as OpenRouter doesn't support PDF directly
    if (fileType === 'application/pdf') {
      return NextResponse.json(
        { error: 'PDF extraction is not currently supported. Please upload an image or code file instead.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Unsupported file type. Please upload code files or images.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Extract API error:', error);
    return NextResponse.json(
      { error: 'Failed to extract code from file. Please try again.' },
      { status: 500 }
    );
  }
}
