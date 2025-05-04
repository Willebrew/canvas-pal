import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

/**
 * Specifies the runtime environment for the API route.
 * This is required by Next.js to define the runtime.
 */
export const runtime = 'nodejs';

/**
 * Executes a Python script with the specified tool and parameters.
 *
 * @param {string} tool - The name of the tool to execute.
 * @param {Record<string, unknown>} [params={}] - A key-value pair of parameters to pass to the tool.
 * @returns {unknown} - The parsed JSON response from the Python script, or the raw output if parsing fails.
 * @throws {Error} - If the `execSync` call fails.
 */
function runTool(tool: string, params: Record<string, unknown> = {}): unknown {
    const raw = execSync('python3 tool_caller.py', {
        input: JSON.stringify({ tool, params }),
        encoding: 'utf8',
        maxBuffer: 5 * 1024 * 1024, // Maximum buffer size for the output.
    });
    try {
        return JSON.parse(raw); // Attempt to parse the output as JSON.
    } catch {
        return raw; // Return raw output if JSON parsing fails.
    }
}

/**
 * Handles GET requests for the API route.
 *
 * @returns {Promise<NextResponse>} - A JSON response containing the result of the `get_courses` tool execution.
 */
export async function GET() {
    const result = runTool('get_courses', {});
    return NextResponse.json(result);
}
