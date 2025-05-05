/**
 * CanvasPal route
 *
 * This module defines the API route for handling chat requests in the CanvasPal application.
 * It integrates with an LLM (Large Language Model) to process user queries, generate plans,
 * execute steps using Canvas tools, and provide summaries.
 *
 * Key Features:
 * - Planning is optional: If the LLM returns plain text instead of JSON for a plan, it is returned immediately.
 * - Execution steps accept natural-language replies: If the LLM does not emit JSON for a step, its raw prose is wrapped as {"result": "...", done: true}.
 * - Eliminates errors related to unreadable execution step JSON.
 */

import { NextRequest, NextResponse } from 'next/server';
import { execSync }     from 'child_process';

export const runtime = 'nodejs';

/**
 * List of available tools for CanvasPal to interact with Canvas data.
 */
const TOOL_LIST = `
AVAILABLE TOOLS
• get_courses()
• get_all_courses()
• get_assignments(course_id)
• get_assignment_details(course_id, assignment_id)
• get_announcements(course_id)
• get_submission(course_id, assignment_id)
• get_course_files(course_id)
• get_people_in_course(course_id)
• get_todo_list()
• get_unsubmitted_assignments(course_id)
• get_assignments_with_grades(course_id)
• get_course_grade(course_id)
• get_course_modules(course_id)
• get_module_description(module_id)
• get_syllabus(course_id)
`.trim();

/**
 * Prompt template for generating a step-by-step plan using Canvas tools.
 */
const PROMPT_PLAN = `
You are CanvasPal. Latest user request:
"{{userQuery}}"

Create a concise step-by-step plan using Canvas tools.
Return **only** valid JSON:

{
  "steps":[
    { "tool":"get_courses","params":{} },
    …
  ]
}

Rules:
1️⃣ Each step must be a tool call object (no narrative).
2️⃣ Follow discovery order: get_courses → get_assignments → final tool.
3️⃣ Skip steps if IDs already known; no duplicates.
4️⃣ Do not add extra keys or comments.

${TOOL_LIST}
`.trim();

/**
 * Prompt template for summarizing the results for the user.
 */
const PROMPT_SUMMARY = `
You are CanvasPal. Summarise the results for the student based on their latest request and the execution log.

Latest Request: "{{userQuery}}"
Executed Steps & Outputs:
{{stepsLog}}

— Formatting guidelines (Markdown; choose dynamically) —

1. Sections & Headers  
   • Use second-level headings (##) when you start a new section.  
   • Separate major sections with a horizontal rule (---).

2. Lists & Bullets  
   • Use hyphens (-) or bullets (•) for short lists of 1–2 items.  
   • Indent sub-points by two spaces.

3. Tables for structured data  
   • **Whenever you have 3 or more items in a list, render them as a Markdown table**.  
   • Use appropriate column headers (e.g., “Student Name”) and one item per row.  
   • For course rosters, list each student in its own row under a “Student Name” column.

4. Emphasis & Callouts  
   • **Bold** key terms.  
   • _Italic_ for side notes.  
   • Use blockquotes (>) for tips or warnings.

5. Brevity & Clarity  
   • Keep bullets and paragraphs to 1–2 lines.

6. Tone  
   • Friendly and conversational.  
   • End with a short “Next Steps” bullet list or friendly closing.

IMPORTANT: You have direct programmatic access to the full tool outputs.  
**Always include the complete data returned by the tools** (e.g., the full student list from get_people_in_course).  
Do NOT mention privacy reasons or redirect the user to Canvas’s interface.

Please do not write footnotes

Do not write citations or references to external sources. Eg. [^1^], [^1] or [1].

Now write the summary obeying these rules.
`;

/**
 * Message type representing a single message in the conversation history.
 */
type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

/**
 * Generic type for tool parameters.
 */
type Params = Record<string, unknown>;

/**
 * Tool call interface representing a single step in the plan.
 */
interface ToolCall { tool: string; params?: Params }

/**
 * Plan JSON interface representing the structure of the plan.
 */
interface PlanJson  { steps: ToolCall[] }

/**
 * Step log interface representing the execution log of each step.
 */
interface StepLog   { step: ToolCall; output: string }

/**
 * Maximum number of messages to keep in history.
 */
const MAX_HISTORY = 10;

/**
 * Delay between steps in milliseconds.
 */
const STEP_DELAY  = 40;  // ms pause for UI

/**
 * Groq API endpoint for chat completions.
 */
const GROQ_API_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Model ID for Llama 4 Scout on Groq.
 * Note: Verify this ID is available for your API key. Fallbacks might include 'llama3-70b-8192' or 'llama-3.1-8b-instant'.
 */
const GROQ_MODEL_ID = 'meta-llama/llama-4-scout-17b-16e-instruct';

/**
 * Function to strip out context comments from the message content.
 * This is used to clean up the message before sending it to the LLM.
 */
const stripCtx = (s: string) =>
    s.replace(/<!--CONTEXT[\s\S]*?CONTEXT-->/g, '');

/**
 * Function to extract the first JSON object from a string.
 * @param txt
 */
function firstJson(txt: string): string | null {
    let depth = 0, start = -1;
    for (let i = 0; i < txt.length; i++) {
        if (txt[i] === '{') { if (depth === 0) start = i; depth++; }
        else if (txt[i] === '}' && --depth === 0) {
            return txt.slice(start, i + 1);
        }
    }
    return null;
}

/**
 * Calls the LLM with a given prompt and conversation history.
 * @param prompt - The prompt to send to the LLM.
 * @param history - The conversation history.
 * @returns The LLM's response as a string.
 */
async function callLLM(prompt: string, history: Msg[]): Promise<string> {
    const apiKey = process.env.LLM_API_KEY; // Using the same env variable name as requested
    if (!apiKey) {
        throw new Error('API key for LLM provider is not configured.');
    }

    const res = await fetch(GROQ_API_ENDPOINT, {
        method : 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization' : `Bearer ${apiKey}`, // Use the key here
        },
        body: JSON.stringify({
            model : GROQ_MODEL_ID,
            stream: false,
            messages: [{ role:'system', content:prompt }, ...history],
            // Optional: Add other parameters like temperature, max_tokens if needed
            // temperature: 0.7,
            // max_tokens: 1024,
        }),
    });

    const text = await res.text();
    if (!res.ok) {
        console.error("Groq API Error Response:", text);
        throw new Error(`Groq API error ${res.status}: ${text}`);
    }

    try {
        const j = JSON.parse(text);
        if (!j.choices || j.choices.length === 0 || !j.choices[0].message || !j.choices[0].message.content) {
            console.error("Unexpected Groq API response structure:", j);
            throw new Error('Invalid response structure from Groq API');
        }
        return j.choices[0].message.content;
    } catch (e) {
        console.error("Failed to parse Groq API response:", text);
        throw new Error(`Failed to parse response from Groq API: ${e instanceof Error ? e.message : String(e)}`);
    }
}

/**
 * Streams the LLM's response in chunks.
 * @param prompt
 * @param history
 */
async function* streamLLM(prompt: string, history: Msg[]): AsyncGenerator<string> {
    const apiKey = process.env.LLM_API_KEY; // Using the same env variable name as requested
    if (!apiKey) {
        throw new Error('API key for LLM provider is not configured.');
    }

    const res = await fetch(GROQ_API_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type':  'application/json',
            'Accept':        'text/event-stream', // Important for streaming
            'Authorization': `Bearer ${apiKey}`, // Use the key here
        },
        body: JSON.stringify({
            model:  GROQ_MODEL_ID,
            stream: true, // Enable streaming
            messages: [{ role:'system', content:prompt }, ...history],
            // Optional: Add other parameters like temperature, max_tokens if needed
            // temperature: 0.7,
            // max_tokens: 1024,
        }),
    });

    if (!res.ok || !res.body) {
        const errorText = await res.text().catch(() => 'Could not read error response body');
        console.error("Groq API Stream Error Response:", errorText);
        throw new Error(`Groq API stream error ${res.status}: ${errorText}`);
    }

    const reader = res.body.getReader();
    const dec    = new TextDecoder();
    let buf = '';

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });

        // Process buffer line by line
        const lines = buf.split(/\r?\n/);
        buf = lines.pop()!; // Keep the potentially partial last line in the buffer

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const payload = line.slice(6).trim(); // Groq uses 'data: ' (with space)
                if (payload === '[DONE]') {
                    return; // Stream finished
                }
                try {
                    const j = JSON.parse(payload);
                    const delta = j.choices?.[0]?.delta?.content;
                    if (delta) {
                        yield delta; // Yield the content chunk
                    }
                } catch (e) {
                    console.warn(`Skipping malformed JSON chunk in stream: ${payload}`, e);
                    // Malformed JSON? Let's ignore that chunk and continue.
                }
            }
        }
    }
    // Process any remaining buffer content after the loop finishes
    if (buf.startsWith('data: ')) {
        const payload = buf.slice(6).trim();
        if (payload !== '[DONE]') {
            try {
                const j = JSON.parse(payload);
                const delta = j.choices?.[0]?.delta?.content;
                if (delta) {
                    yield delta;
                }
            } catch (e) {
                console.warn(`Skipping malformed JSON chunk at stream end: ${payload}`, e);
            }
        }
    }
}

/**
 * Handles POST requests to the chat API route.
 * @param req - The incoming request.
 * @returns A server-sent event stream response.
 */
export async function POST(req: NextRequest) {
    const { messages }: { messages: Msg[] } = await req.json();
    const latest = messages.at(-1)?.content.trim() || '';

    // Parse system context
    let systemCtx: Record<string, unknown> = {};
    try {
        const raw = messages.find(m => m.role === 'system')?.content;
        if (raw) systemCtx = JSON.parse(raw);
    } catch {}

    /**
     * Runs a tool via a Python bridge.
     * @param tool - The name of the tool to run.
     * @param params - The parameters for the tool.
     * @returns The result of the tool execution.
     */
    function runTool(tool: string, params: Params = {}): unknown {
        if (tool === 'get_courses' && Array.isArray(systemCtx.courses)) {
            return systemCtx.courses;
        }
        const raw = execSync('python3 tool_caller.py', {
            input    : JSON.stringify({ tool, params }),
            encoding : 'utf8',
            maxBuffer: 10 * 1024 * 1024,
        });
        try { return JSON.parse(raw); } catch { return raw; }
    }

    // Prepare history
    const history = messages
        .slice(-MAX_HISTORY)
        .map(m => ({ role: m.role, content: stripCtx(m.content) }));

    /**
     * Creates a ReadableStream to stream the response back to the client.
     * @returns A ReadableStream of Uint8Array.
     */
    const stream = new ReadableStream<Uint8Array>({
        async start(ctrl) {
            const enc  = new TextEncoder();
            const send = (type: string, data: object) =>
                ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`));

            try {
                // 1) Plan
                send('status', { message: 'Planning…' });
                const planRaw = await callLLM(
                    PROMPT_PLAN.replace(/{{userQuery}}/g, latest),
                    history
                );
                const pj = firstJson(planRaw);
                if (!pj) {
                    send('summary', { summary: stripCtx(planRaw), complete_all: true });
                    ctrl.close(); return;
                }
                const { steps } = JSON.parse(pj) as PlanJson;
                send('plan', { plan: steps });

                // 2) Execute
                const log: StepLog[] = [];
                for (let i = 0; i < steps.length; i++) {
                    send('status', { message: `Step ${i+1}/${steps.length}` });
                    const out = runTool(steps[i].tool, steps[i].params ?? {});
                    log.push({ step: steps[i], output: JSON.stringify(out) });
                    send('step', { index: i, step: steps[i], output: out });
                    await new Promise(r => setTimeout(r, STEP_DELAY));
                }

                // 3) Stream Summary
                send('status', { message: 'Finalising…' });
                const summaryPrompt = PROMPT_SUMMARY
                    .replace(/{{userQuery}}/g, latest)
                    .replace(/{{stepsLog}}/g, JSON.stringify(log, null, 2));

                let full = '';
                for await (const delta of streamLLM(summaryPrompt, history)) {
                    full += delta;
                    send('summary_chunk', { delta });
                }
                send('summary', { summary: full, complete_all: true });
                ctrl.close();

            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                send('summary', { summary: `⚠️ ${msg}`, error:true, complete_all:true });
                ctrl.close();
            }
        }
    });

    return new NextResponse(stream, {
        headers: {
            'Content-Type' : 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection      : 'keep-alive',
        },
    });
}
