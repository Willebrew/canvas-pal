import { NextResponse } from 'next/server';
import { runTool }      from '@/lib/runTool';

export const runtime = 'nodejs';

export async function GET() {
    try {
        const courses = await runTool('get_courses');
        return NextResponse.json(courses);
    } catch (error: unknown) {
        const message =
            error instanceof Error ? error.message : String(error);
        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}
