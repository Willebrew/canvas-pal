// src/app/page.tsx – v3.3.18
'use client';

import 'katex/dist/katex.min.css';
import React, {
    useState, useEffect, useRef, useCallback, useMemo, FormEvent,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ChatHeader from '@/components/ChatHeader';
import ChatMessage from '@/components/ChatMessage';

/* ---------- types ---------- */
type Msg = { role: 'user' | 'assistant'; content: unknown };

interface SSEPlanEvent   { type: 'plan';    plan: any[] }
interface SSEStatusEvent { type: 'status';  message: string }
interface SSEStepEvent   { type: 'step';    index: number; step: string; output: string }
interface SSESummEvent   { type: 'summary'; summary: string | object; complete_all?: boolean; error?: boolean }
type SSEEvent = SSEPlanEvent | SSEStatusEvent | SSEStepEvent | SSESummEvent;

/* ---------- helpers ---------- */
const toDisplay = (c: unknown): string => {
    if (typeof c === 'string') return c;
    if (c === null || c === undefined) return '';
    if (typeof c === 'object') {
        try {
            return JSON.stringify(c, null, 2);
        } catch (e) {
            return '[Object]';
        }
    }
    return String(c);
};

const stripHidden = (s: string): string =>
    s.replace(/<!--CONTEXT[\s\S]*?CONTEXT-->/g, '');

const isMsg = (v: unknown): v is Msg =>
    typeof v === 'object' && v !== null && 'role' in v && 'content' in v;

/* ---------- Plan chain ---------- */
function PlanChain({ plan, done }: { plan: any[]; done: number[] }) {
    return (
        <>
            <div className="text-xs font-semibold mb-2 text-muted-foreground">Plan:</div>
            <div className="space-y-2">
                {plan.map((stepItem, i) => {
                    const finished = done.includes(i);
                    const active = done.length === i && !finished;

                    // Handle case where stepItem is an object with keys {step, action, description}
                    const stepText = typeof stepItem === 'string'
                        ? stepItem
                        : (stepItem && typeof stepItem === 'object' && 'step' in stepItem)
                            ? `${stepItem.step}${stepItem.action ? `: ${stepItem.action}` : ''}${stepItem.description ? ` - ${stepItem.description}` : ''}`
                            : JSON.stringify(stepItem);

                    return (
                        <div key={i} className="flex items-center space-x-2">
                            <motion.div
                                animate={active ? { scale: [1, 1.3, 1] } : {}}
                                className={`w-3 h-3 rounded-full
                                    ${finished
                                    ? 'bg-accent'
                                    : active
                                        ? 'bg-accent animate-pulse'
                                        : 'bg-border'
                                }`}
                            />
                            <span className={finished ? 'line-through text-muted-foreground' : ''}>
                                {stepText}
                            </span>
                        </div>
                    );
                })}
            </div>
        </>
    );
}

/* ---------- Main page ---------- */
export default function HomePage() {
    const [messages, setMessages]       = useState<Msg[]>([]);
    const [plan, setPlan]               = useState<any[]>([]);
    const [done, setDone]               = useState<number[]>([]);
    const [input, setInput]             = useState('');
    const [loading, setLoading]         = useState(false);
    const [planVisible, setPlanVisible] = useState(false);

    const bottomRef = useRef<HTMLDivElement>(null);
    const abortRef  = useRef<AbortController | null>(null);

    /* ---------- splash pixels ---------- */
    const showSplash = messages.length === 0;
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const pixels = useMemo(() => {
        const colors = ['bg-red-600','bg-yellow-500','bg-green-600',
            'bg-purple-600','bg-pink-600','bg-orange-500'];
        return Array.from({ length: 60 }, (_, id) => ({
            id,
            x: Math.random() * 100,
            y: Math.random() * 100,
            color: colors[Math.floor(Math.random() * colors.length)],
            delay: Math.random() * 2,
            duration: 1 + Math.random() * 2,
        }));
    }, []);

    /* ---------- restore & persist ---------- */
    useEffect(() => {
        const saved = sessionStorage.getItem('canvaspal_messages');
        if (!saved) return;
        try {
            const raw = JSON.parse(saved);
            if (Array.isArray(raw)) setMessages(raw.filter(isMsg));
        } catch { sessionStorage.removeItem('canvaspal_messages'); }
    }, []);

    useEffect(() => {
        sessionStorage.setItem('canvaspal_messages', JSON.stringify(messages));
    }, [messages]);

    useEffect(() => {
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }, [messages, loading]);

    /* ---------- actions ---------- */
    const newChat = () => {
        abortRef.current?.abort();
        setMessages([]); setPlan([]); setDone([]);
        setInput(''); setLoading(false); setPlanVisible(false);
        sessionStorage.clear();
    };

    const cancel = () => {
        abortRef.current?.abort();
        setLoading(false); setPlanVisible(false);
        setMessages(m => [
            ...m.slice(0, -1),
            { role: 'assistant', content: 'Request cancelled.' },
        ]);
    };

    /* ---------- send / SSE ---------- */
    const send = useCallback(async () => {
        if (!input.trim() || loading) return;

        const dedup = messages.reduce<Msg[]>((acc, m) => {
            if (acc.length && acc.at(-1)!.role === 'assistant' && m.role === 'assistant') acc[acc.length - 1] = m;
            else acc.push(m);
            return acc;
        }, []);

        const userMsg: Msg = { role: 'user', content: input.trim() };
        const toSend = [...dedup, userMsg];

        setMessages(toSend);
        setPlan([]); setDone([]); setPlanVisible(true);
        setInput(''); setLoading(true);

        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: toSend }),
                signal: ctrl.signal,
            });
            if (!res.ok) throw new Error(await res.text());

            const reader = res.body!.getReader();
            const dec    = new TextDecoder();
            let buf      = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done || ctrl.signal.aborted) break;
                buf += dec.decode(value, { stream: true });
                const parts = buf.split('\n\n');
                buf = parts.pop() ?? '';

                for (const part of parts) {
                    if (!part.startsWith('data: ')) continue;
                    const raw = part.slice(6).trim();
                    if (raw === '[DONE]') continue;

                    let evt: SSEEvent;
                    try { evt = JSON.parse(raw) as SSEEvent; } catch { continue; }

                    if (evt.type === 'plan')   setPlan(evt.plan);
                    if (evt.type === 'step')   setDone(d => [...d, evt.index]);
                    if (evt.type === 'summary') {
                        setPlanVisible(false);
                        const txt = toDisplay(evt.summary);
                        setMessages(m => [...m, { role: 'assistant', content: txt }]);
                    }
                }
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            setPlanVisible(false);
            setMessages(m => [...m, { role: 'assistant', content: `⚠️ ${msg}` }]);
        } finally {
            setLoading(false);
            abortRef.current = null;
        }
    }, [input, loading, messages]);

    /* ---------- render ---------- */
    return (
        <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
            <ChatHeader onNewChatAction={newChat} />

            {/* Plan bar */}
            <AnimatePresence>
                {planVisible && plan.length > 0 && (
                    <motion.div
                        key="plan"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="sticky top-0 z-20 overflow-hidden bg-background/30 backdrop-blur-md border-b border-base px-4 py-2"
                    >
                        <PlanChain plan={plan} done={done} />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Splash */}
            {showSplash && (
                <motion.div
                    className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-tr from-accent/10 to-container/10 z-10 pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                >
                    {mounted && pixels.map(p => (
                        <motion.div
                            key={p.id}
                            className={`w-1 h-1 ${p.color} absolute rounded-sm`}
                            style={{ left: `${p.x}%`, top: `${p.y}%` }}
                            animate={{ opacity: [0, 1, 0] }}
                            transition={{ repeat: Infinity, duration: p.duration, delay: p.delay }}
                        />
                    ))}
                    <motion.div
                        className="relative z-20 flex flex-col items-center space-y-4"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                    >
                        <img src="/logo.png" alt="CanvasPal" className="w-32 h-32" />
                        <motion.h1
                            className="text-4xl font-bold"
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ repeat: Infinity, duration: 4 }}
                        >
                            CanvasPal
                        </motion.h1>
                        <motion.p
                            className="text-lg text-muted-foreground"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                        >
                            Focus on Learning, Not on Canvas
                        </motion.p>
                    </motion.div>
                </motion.div>
            )}

            {/* chat list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
                {messages.map((m, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <ChatMessage
                            role={m.role as 'user' | 'assistant'}
                            content={stripHidden(toDisplay(m.content))}
                        />
                    </motion.div>
                ))}
                <div ref={bottomRef} />
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 z-20 bg-background/30 backdrop-blur-md border-t border-base p-4">
                <form
                    onSubmit={(e: FormEvent) => { e.preventDefault(); send(); }}
                    className="flex items-center bg-background/30 backdrop-blur-md rounded px-2"
                >
                    <input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        disabled={loading}
                        placeholder="Ask CanvasPal anything…"
                        className="flex-1 p-3 bg-transparent outline-none placeholder:text-muted-foreground text-sm"
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                    />
                    <button
                        type={loading ? 'button' : 'submit'}
                        onClick={loading ? cancel : undefined}
                        className={`
                            p-2 ml-2 rounded
                            ${loading
                            ? 'text-destructive border border-destructive hover:bg-destructive/10'
                            : 'text-primary hover:bg-primary/10 disabled:opacity-50'}
                        `}
                    >
                        {loading ? 'Cancel' : 'Send'}
                    </button>
                </form>
            </div>
        </div>
    );
}
