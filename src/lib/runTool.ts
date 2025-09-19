export interface Params { [k: string]: unknown }

export interface CanvasToolCredentials {
    canvasUrl: string;
    canvasApiKey: string;
}

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

    const res = await fetch(`${process.env.INTERNAL_TOOL_URL ?? ''}/api/tool`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(payload),
        // IMPORTANT: don't cache Canvas responses
        next   : { revalidate: 0 }
    });

    if (!res.ok) throw new Error(await res.text());
    return res.json();
}
