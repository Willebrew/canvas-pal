import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

export const runtime = 'nodejs';

function runTool(tool: string, params: Record<string, unknown> = {}): unknown {
    const raw = execSync('python3 tool_caller.py', {
        input: JSON.stringify({ tool, params }),
        encoding: 'utf8',
        maxBuffer: 5 * 1024 * 1024,
    });
    try {
        return JSON.parse(raw);
    } catch {
        return raw;
    }
}

export async function GET() {
    const result = runTool('get_todo_list', {});
    return NextResponse.json(result);
}
