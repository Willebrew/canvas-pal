export interface Params { [k: string]: unknown }

export async function runTool(tool: string, params: Params = {}) {
    const res = await fetch(`${process.env.INTERNAL_TOOL_URL ?? ''}/api/tool`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ tool, params }),
        // IMPORTANT: don't cache Canvas responses
        next   : { revalidate: 0 }
    });

    if (!res.ok) throw new Error(await res.text());
    return res.json();
}
