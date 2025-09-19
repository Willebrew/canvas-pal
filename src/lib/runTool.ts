export interface Params { [k: string]: unknown }

export interface CanvasToolCredentials {
    canvasUrl: string;
    canvasApiKey: string;
}

const resolveInternalToolUrl = () => {
    if (process.env.INTERNAL_TOOL_URL) {
        return process.env.INTERNAL_TOOL_URL.replace(/\/$/, '');
    }

    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
    }

    if (process.env.NEXT_PUBLIC_SITE_URL) {
        return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
    }

    return 'http://localhost:3000';
};

export async function runTool(
    tool: string,
    params: Params = {},
    credentials?: CanvasToolCredentials,
) {
    const payload = {
        tool,
        params,
        ...(credentials ? {
            canvas_url: credentials.canvasUrl,
            canvas_api_key: credentials.canvasApiKey,
        } : {}),
    };

    const baseUrl = resolveInternalToolUrl();
    const res = await fetch(`${baseUrl}/api/tool`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(payload),
        // IMPORTANT: don't cache Canvas responses
        next   : { revalidate: 0 }
    });

    if (!res.ok) throw new Error(await res.text());
    return res.json();
}
