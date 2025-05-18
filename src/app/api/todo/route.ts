import { NextResponse } from 'next/server';
import { runTool }      from '@/lib/runTool';

export const runtime = 'nodejs';

export async function GET() {
    try {
        const todos = await runTool('get_todo_list');
        return NextResponse.json(todos);
    } catch (error: unknown) {
        const message =
            error instanceof Error ? error.message : String(error);
        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}

