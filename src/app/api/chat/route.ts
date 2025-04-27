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
import { execSync } from 'child_process';

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
`;

/**
 * Prompt template for generating a step-by-step plan using Canvas tools.
 */
const PROMPT_PLAN = `
You are CanvasPal. Review the conversation history provided. The latest user request is: "{{userQuery}}"

Create a concise step-by-step plan using Canvas tools based on the latest request and relevant context from the history.

DISCOVERY ORDER
1️⃣ Always call get_courses() if course information is needed and not already known from history or tool logs.
2️⃣ If a course is referenced by name, find its course_id using get_courses() results if not already known.
3️⃣ If an assignment is referenced, call get_assignments(course_id) to discover assignment_id if not already known.
4️⃣ Then call the final information tool.

Return JSON only: { "steps": [ ... ] }

${TOOL_LIST}
`;

/**
 * Examples of JSON tool calls for reference.
 */
const TOOL_CALL_EXAMPLES = `
TOOL CALL JSON EXAMPLES
{"tool":"get_courses","params":{}}
{"tool":"get_assignments","params":{"course_id":190476}}
{"tool":"get_assignment_details","params":{"course_id":190476,"assignment_id":1234567}}
`;

/**
 * Prompt template for executing a specific step in the plan.
 */
const PROMPT_EXECUTE = `
You are CanvasPal executing the plan.

CONVERSATION HISTORY & CONTEXT
• Latest Request: "{{userQuery}}"
• Overall Plan: {{planJson}}
• Current Step Index: {{currentStep}}
• Tool Log (History of tools used *in this current execution flow*): {{toolsLog}}
• Steps Completed (History of steps finished *in this current execution flow*): {{stepsLog}}

RULES
1. Focus ONLY on the step whose index == currentStep based on the Overall Plan.
2. Use the Tool Log and Steps Completed for intermediate data *within this execution flow*. Refer to the Conversation History for broader context if needed.
3. Follow discovery order strictly if IDs are needed and not present in logs.
4. Never invent IDs; discover them with the correct tool.
5. When the user asks for class data, don't say you can't access it – use the tools to get it. If the tools fail, then explain the issue.
6. When data is needed for the current step, first call a tool if appropriate.
7. After finishing the current step's reasoning or action:
   – If NOT the last step of the plan: {"result":"<output for this step>","done":false}
   – If it IS the last step of the plan: {"result":"<output for this step>","done":true}
8. Tool calls must match the JSON examples.

NOTE: If a user asks for information that can be accessed by a tool, use the tool to get it. If the tools fail, then explain the issue.
DO NOT: tell the user to go find it themselves when you have a tool to grab that information unless the tool has a fatal error.

Respond with one raw JSON object representing your action for step {{currentStep}}.

${TOOL_LIST}
${TOOL_CALL_EXAMPLES}
`;

/**
 * Prompt template for summarizing the results for the user.
 */
const PROMPT_SUMMARY = `
You are CanvasPal. Summarise the results for the student based on their latest request and the execution log.

Latest Request: "{{userQuery}}"
Executed Steps & Outputs (for this request):
{{stepsLog}}

Review the steps and outputs. Write a clear, friendly summary answering the latest request. Use bullet points if helpful. Be conversational, referring to the conversation history if relevant.
`;

/**
 * Message type representing a single message in the conversation history.
 */
type Msg = { role: 'user' | 'assistant' | 'system'; content: string };

/**
 * Generic type for tool parameters.
 */
type Params = Record<string, unknown>;

/**
 * Log entry type for tool usage.
 */
type ToolLogEntry  = { tool: string; params?: Params; result: unknown };

/**
 * Log entry type for completed steps.
 */
type StepLogEntry  = { step: string; output: string };

/**
 * Interface for the JSON plan returned by the LLM.
 */
interface PlanJson   { steps: string[] }

/**
 * Interface for the result of executing a step.
 */
interface ExecResult { tool?: string; params?: Params; result?: string; done?: boolean }

/**
 * Removes hidden context comments from a string.
 * @param s - The input string.
 * @returns The string with hidden context comments removed.
 */
function stripContext(s: string): string {
    return s.replace(/<!--CONTEXT[\s\S]*?CONTEXT-->/g, '');
}

/**
 * Extracts the first balanced JSON object from a string.
 * @param s - The input string.
 * @returns The first JSON object as a string, or null if none found.
 */
function firstObject(s: string): string | null {
    let depth = 0, start = -1;
    for (let i = 0; i < s.length; i++) {
        if (s[i] === '{') {
            if (depth === 0) start = i;
            depth++;
        } else if (s[i] === '}') {
            depth--;
            if (depth === 0 && start >= 0) return s.slice(start, i + 1);
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
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${
                process.env.PERPLEXITY_API_KEY
            }`,
        },
        body: JSON.stringify({
            model: 'sonar-pro',
            stream: false,
            messages: [{ role: 'system', content: prompt }, ...history],
        }),
    });
    if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
    const j = await res.json();
    return j.choices[0].message.content as string;
}

/**
 * Runs a Canvas tool via a Python bridge.
 * @param tool - The name of the tool to run.
 * @param params - The parameters for the tool.
 * @returns The result of the tool execution.
 */
function runTool(tool: string, params: Params = {}): unknown {
    const raw = execSync('python3 tool_caller.py', {
        input: JSON.stringify({ tool, params }),
        encoding: 'utf8',
        maxBuffer: 5 * 1024 * 1024,
    });
    try {
        return JSON.parse(raw);
    } catch {
        return { error: `Invalid JSON from ${tool}`, raw };
    }
}

/**
 * Generates a plan for the given query using the LLM.
 * @param query - The user's query.
 * @param history - The conversation history.
 * @returns The plan as an object containing steps or a direct response.
 */
async function getPlan(query: string, history: Msg[]): Promise<{ steps?: string[]; direct?: string }> {
    const cleanHist = history.map(m => ({ role: m.role, content: stripContext(m.content) }));
    const prompt = PROMPT_PLAN.replace(/{{userQuery}}/g, query);
    const planTxt = await callLLM(prompt, cleanHist);

    const objStr = firstObject(planTxt);
    if (objStr) {
        try {
            const obj = JSON.parse(objStr) as PlanJson;
            if (Array.isArray(obj.steps) && obj.steps.length) {
                return { steps: obj.steps };
            }
        } catch { /* ignore */ }
    }
    return { direct: stripContext(planTxt).trim() };
}

/**
 * Executes a single step in the plan, with natural-language fallback.
 * @param args - The arguments for step execution.
 * @returns The result of the step execution.
 */
async function execStep(args: {
    i: number;
    steps: string[];
    toolsLog: ToolLogEntry[];
    stepsLog: StepLogEntry[];
    query: string;
    history: Msg[];
}): Promise<ExecResult> {
    const { i, steps, toolsLog, stepsLog, query, history } = args;
    const cleanHist = history.map(m => ({ role: m.role, content: stripContext(m.content) }));
    const prompt = PROMPT_EXECUTE
        .replace(/{{userQuery}}/g, query)
        .replace(/{{planJson}}/g, JSON.stringify({ steps }))
        .replace(/{{currentStep}}/g, String(i))
        .replace(/{{toolsLog}}/g, JSON.stringify(toolsLog))
        .replace(/{{stepsLog}}/g, JSON.stringify(stepsLog));

    const raw = await callLLM(prompt, cleanHist);

    const jsonStr = firstObject(raw);
    if (jsonStr) {
        try {
            return JSON.parse(jsonStr) as ExecResult;
        } catch { /* fall through to fallback */ }
    }

    // Fallback: the LLM answered in prose, so wrap it and finish
    return { result: stripContext(raw).trim(), done: true };
}

/**
 * Handles POST requests to the chat API route.
 * @param req - The incoming request.
 * @returns A server-sent event stream response.
 */
export async function POST(req: NextRequest) {
    const stream = new ReadableStream<Uint8Array>({
        async start(ctrl) {
            const enc = new TextEncoder();
            const enqueue = (type: string, data: object) =>
                ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`));

            try {
                const { messages }: { messages: Msg[] } = await req.json();
                const last = messages.at(-1);
                const query = last?.content.trim() || '';

                // 1) Plan or direct answer
                enqueue('status', { message: 'Planning…' });
                const planRes = await getPlan(query, messages);

                if (planRes.direct) {
                    enqueue('summary', { summary: planRes.direct, complete_all: true });
                    ctrl.enqueue(enc.encode('data: [DONE]\n\n'));
                    ctrl.close();
                    return;
                }

                // 2) JSON plan
                const steps = planRes.steps!;
                enqueue('plan', { plan: steps });

                // 3) Execute steps
                const toolsLog: ToolLogEntry[] = [];
                const stepsLog: StepLogEntry[] = [];
                outer: for (let i = 0; i < steps.length; i++) {
                    enqueue('status', { message: `Step ${i + 1}/${steps.length}` });
                    const act = await execStep({ i, steps, toolsLog, stepsLog, query, history: messages });

                    if (act.tool) {
                        const result = runTool(act.tool, act.params ?? {});
                        toolsLog.push({ tool: act.tool, params: act.params, result });
                        i--; // retry this step with updated context
                        continue;
                    }

                    stepsLog.push({ step: steps[i], output: act.result ?? '' });
                    enqueue('step', { index: i, step: steps[i], output: act.result ?? '' });
                    if (act.done || i === steps.length - 1) break outer;
                }

                // 4) Summary
                enqueue('status', { message: 'Finalising…' });
                const summary = await callLLM(
                    PROMPT_SUMMARY
                        .replace(/{{userQuery}}/g, query)
                        .replace(/{{stepsLog}}/g, JSON.stringify(stepsLog, null, 2)),
                    messages
                );
                const hidden = `<!--CONTEXT\n${JSON.stringify({ stepsLog, toolsLog })}\nCONTEXT-->`;
                enqueue('summary', { summary: summary + '\n\n' + hidden, complete_all: true });

                ctrl.enqueue(enc.encode('data: [DONE]\n\n'));
                ctrl.close();
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                enqueue('summary', { summary: `⚠️ ${msg}`, complete_all: true, error: true });
                ctrl.enqueue(enc.encode('data: [DONE]\n\n'));
                ctrl.close();
            }
        }
    });

    return new NextResponse(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        },
    });
}
