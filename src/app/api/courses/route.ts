import { NextRequest, NextResponse } from 'next/server';
import { runTool }      from '@/lib/runTool';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    try {
        const { canvasUrl, canvasApiKey } = await req.json();

        if (!canvasUrl || !canvasApiKey) {
            return NextResponse.json(
                { error: 'Canvas credentials are required.' },
                { status: 400 }
            );
        }

        const courses = await runTool(
            'get_courses',
            {},
            { canvasUrl, canvasApiKey }
        );
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
