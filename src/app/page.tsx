// src/app/page.tsx
'use client';

import 'katex/dist/katex.min.css';
import React, {
    useState,
    useEffect,
    useRef,
    useCallback,
    useMemo,
    FormEvent,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ChatHeader from '@/components/ChatHeader';
import ChatMessage from '@/components/ChatMessage';
import PlanChain from '@/components/PlanChain';

type PlanItem =
    | string
    | { step: string; action?: string; description?: string }
    | { action: string; tool?: string }
    | { tool: string; params?: Record<string, unknown> };

type Msg = { role: 'user' | 'assistant'; content: unknown; isLoading?: boolean };

interface Course { id: number; name: string; }
interface TodoItem {
    assignment_name: string;
    status: string;
    course_name: string;
    course_id: number;
    assignment_id: number;
}

const toDisplay = (c: unknown) =>
    typeof c === 'string'
        ? c
        : c == null
            ? ''
            : (() => {
                try { return JSON.stringify(c, null, 2); }
                catch { return '[Object]'; }
            })();

const stripHidden = (s: string) =>
    (typeof s === 'string' ? s.replace(/<!--CONTEXT[\s\S]*?CONTEXT-->/g, '') : '');

const isMsg = (v: unknown): v is Msg =>
    typeof v === 'object' && !!v && 'role' in v && 'content' in v;

function OverflowScroll({ text }: { text: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLDivElement>(null);
    const [isOverflow, setIsOverflow] = useState(false);
    const [width, setWidth] = useState(0);

    const id = useMemo(() => `ticker-${Math.random().toString(36).substr(2, 9)}`, []);
    const keyframesName = `scroll-${id}`;
    const duration = Math.min(Math.max(width / 50, 3), 15);

    useEffect(() => {
        const check = () => {
            if (containerRef.current && textRef.current) {
                const cw = containerRef.current.clientWidth;
                const tw = textRef.current.scrollWidth;
                setIsOverflow(tw > cw);
                setWidth(tw);
            }
        };
        const t = setTimeout(check, 50);
        window.addEventListener('resize', check);
        return () => {
            clearTimeout(t);
            window.removeEventListener('resize', check);
        };
    }, [text]);

    if (!isOverflow) {
        return (
            <div ref={containerRef} className="overflow-hidden whitespace-nowrap text-left">
                <div ref={textRef}>{text}</div>
            </div>
        );
    }

    const tickerStyle: React.CSSProperties = {
        display: 'inline-block',
        whiteSpace: 'nowrap',
        animation: `${keyframesName} ${duration}s linear infinite`,
    };

    return (
        <div ref={containerRef} className="overflow-hidden whitespace-nowrap text-left">
            <div ref={textRef} className="hidden">{text}</div>
            <div className="ticker-container">
                <div style={tickerStyle}>
                    <span>{text}</span>
                    <span className="px-4">&nbsp;</span>
                    <span>{text}</span>
                    <span className="px-4">&nbsp;</span>
                </div>
                <style jsx>{`
                    .ticker-container { width: 100%; overflow: hidden; }
                    @keyframes ${keyframesName} {
                        0%   { transform: translate3d(0, 0, 0); }
                        100% { transform: translate3d(-50%, 0, 0); }
                    }
                `}</style>
            </div>
        </div>
    );
}

export default function HomePage() {
    /* chat state */
    const [messages, setMessages] = useState<Msg[]>([]);
    const [plan, setPlan] = useState<PlanItem[]>([]);
    const [done, setDone] = useState<number[]>([]);
    const [planVisible, setPlanVisible] = useState(false);

    /* UI state */
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);

    /* widget data */
    const [courses, setCourses] = useState<Course[]>([]);
    const [todos, setTodos] = useState<TodoItem[]>([]);

    const bottomRef = useRef<HTMLDivElement>(null);
    const abortRef = useRef<AbortController | null>(null);

    /* splash animation */
    const showSplash = messages.length === 0;
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const pixels = useMemo(() => {
        const colors = ['bg-red-600','bg-yellow-500','bg-green-600','bg-purple-600','bg-pink-600','bg-orange-500'];
        return Array.from({ length: 60 }, (_, id) => ({
            id, x: Math.random()*100, y: Math.random()*100,
            color: colors[Math.floor(Math.random()*colors.length)],
            delay: Math.random()*2, duration: 1 + Math.random()*2,
        }));
    }, []);

    /* fetch widgets */
    useEffect(() => {
        (async () => {
            try {
                const [cRes, tRes] = await Promise.all([
                    fetch('/api/courses'),
                    fetch('/api/todo'),
                ]);
                setCourses(await cRes.json());
                setTodos(await tRes.json());
            } catch {
                setCourses([]);
                setTodos([]);
            }
        })();
    }, []);

    /* restore & persist chat */
    useEffect(() => {
        const saved = sessionStorage.getItem('canvaspal_messages');
        if (saved) {
            try {
                setMessages(JSON.parse(saved).filter(isMsg));
            } catch {
                sessionStorage.removeItem('canvaspal_messages');
            }
        }
    }, []);
    useEffect(() => sessionStorage.setItem('canvaspal_messages', JSON.stringify(messages)), [messages]);
    useEffect(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages, loading]);

    /* actions */
    const newChat = () => {
        abortRef.current?.abort();
        abortRef.current = null;
        setMessages([]);
        setPlan([]);
        setDone([]);
        setInput('');
        setLoading(false);
        setPlanVisible(false);
        sessionStorage.clear();
    };
    const cancel = () => {
        abortRef.current?.abort();
        abortRef.current = null;
        setLoading(false);
        setPlanVisible(false);
        setMessages(m => [
            ...m.slice(0, -1),
            { role: 'assistant', content: 'Stopped' },
        ]);
    };

    const send = useCallback(async (override?: string) => {
        const text = override?.trim() ?? input.trim();
        if (!text || loading) return;

        // Build the system-context message only for the request (never store in visible state)
        const systemContext = JSON.stringify({ courses, todos });
        const systemMsg = { role: 'system', content: systemContext };

        // Visible state: user + placeholder
        const userMsg: Msg = { role: 'user', content: text };
        setPlan([]); setDone([]); setPlanVisible(true);
        setMessages(prev => [...prev, userMsg, { role: 'assistant', content: '', isLoading: true }]);
        if (!override) setInput('');
        setLoading(true);

        // Build request-history including the system msg up front
        const requestHistory = [systemMsg, ...messages, userMsg];

        const ctrl = new AbortController();
        abortRef.current = ctrl;

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: requestHistory }),
                signal: ctrl.signal,
            });
            if (!res.ok) throw new Error(await res.text());

            const reader = res.body!.getReader();
            const dec = new TextDecoder();
            let buf = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done || ctrl.signal.aborted) break;
                buf += dec.decode(value, { stream: true });
                const parts = buf.split('\n\n');
                buf = parts.pop()!;
                for (const p of parts) {
                    if (!p.startsWith('data: ')) continue;
                    const raw = p.slice(6).trim();
                    if (raw === '[DONE]') continue;
                    const evt = JSON.parse(raw);
                    if (evt.type === 'plan') setPlan(evt.plan);
                    if (evt.type === 'step') setDone(d => [...d, evt.index]);
                    if (evt.type === 'summary') {
                        setPlanVisible(false);
                        setMessages(prev => [
                            ...prev.slice(0, -1),
                            { role: 'assistant', content: toDisplay(evt.summary) }
                        ]);
                    }
                }
            }
        } catch (e: unknown) {
            if (ctrl.signal.aborted) return;
            const msg = e instanceof Error ? e.message : String(e);
            setMessages(prev => [
                ...prev.slice(0, -1),
                { role: 'assistant', content: `⚠️ ${msg}` }
            ]);
        } finally {
            setLoading(false);
            abortRef.current = null;
        }
    }, [input, loading, messages, courses, todos]);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        send();
    };

    return (
        <motion.div className="flex flex-col h-screen bg-background text-foreground" layout>
            <ChatHeader
                onNewChatAction={newChat}
                onHistoryToggleAction={() => setHistoryOpen(o => !o)}
                historyOpen={historyOpen}
            />

            <AnimatePresence>
                {planVisible && plan.length > 0 && (
                    <motion.div
                        key="plan"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="sticky top-16 z-10 bg-background/30 backdrop-blur-md border-b border-base px-4 py-2"
                    >
                        <PlanChain plan={plan} done={done} />
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.div className="flex flex-1 overflow-hidden" layout>
                <AnimatePresence initial={false}>
                    {historyOpen && (
                        <motion.aside
                            key="sidebar"
                            initial={{ width: 0 }}
                            animate={{ width: 288 }}
                            exit={{ width: 0 }}
                            transition={{ type: 'tween', duration: 0.3 }}
                            className="bg-container border-r border-base flex flex-col overflow-y-auto"
                        >
                            <h2 className="px-4 py-2 font-semibold border-b border-base">
                                Conversations
                            </h2>
                        </motion.aside>
                    )}
                </AnimatePresence>

                <motion.div className="relative flex-1 flex flex-col overflow-hidden" layout>
                    <AnimatePresence>
                        {showSplash && (
                            <motion.div className="absolute inset-0 flex flex-col items-center z-10">
                                <motion.div className="absolute inset-0 z-0 pointer-events-none">
                                    {mounted && pixels.map(p => (
                                        <motion.div
                                            key={p.id}
                                            className={`w-1 h-1 ${p.color} absolute rounded-sm`}
                                            style={{ left: `${p.x}%`, top: `${p.y}%` }}
                                            animate={{ opacity: [0,1,0] }}
                                            transition={{ repeat: Infinity, duration: p.duration, delay: p.delay }}
                                        />
                                    ))}
                                </motion.div>

                                <motion.div
                                    className="relative z-10 mt-[20vh] flex flex-col items-center space-y-4"
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                                >
                                    <img src="/logo.png" alt="CanvasPal" className="w-32 h-32" />
                                    <motion.h1
                                        className="text-4xl font-bold"
                                        animate={{ scale: [1,1.05,1] }}
                                        transition={{ repeat: Infinity, duration: 4 }}
                                    >
                                        CanvasPal
                                    </motion.h1>
                                    <motion.p
                                        className="text-muted-foreground"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.5 }}
                                    >
                                        Focus on Learning, Not on Canvas
                                    </motion.p>

                                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
                                        {/* My Courses */}
                                        <motion.div
                                            className="bg-background/40 backdrop-blur-md border border-base rounded-2xl p-6 shadow"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                        >
                                            <h3 className="font-semibold mb-3">My Courses</h3>
                                            <ul className="space-y-2">
                                                {courses.map((c,i) => (
                                                    <motion.li
                                                        key={c.id}
                                                        initial={{ opacity:0,x:-10 }}
                                                        animate={{ opacity:1,x:0 }}
                                                        transition={{ delay:0.1*i }}
                                                    >
                                                        <button
                                                            className="w-full text-left px-2 py-1 rounded hover:bg-background/20"
                                                            onClick={() => send(`Tell me everything coming up in ${c.name}.`)}
                                                        >
                                                            {c.name}
                                                        </button>
                                                    </motion.li>
                                                ))}
                                            </ul>
                                        </motion.div>

                                        {/* To-Do List */}
                                        <motion.div
                                            className="bg-background/40 backdrop-blur-md border border-base rounded-2xl p-6 shadow"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.2 }}
                                        >
                                            <h3 className="font-semibold mb-3">To-Do List</h3>
                                            <ul className="space-y-2">
                                                {todos.slice(0,5).map((t,i) => (
                                                    <motion.li
                                                        key={i}
                                                        initial={{ opacity:0,x:-10 }}
                                                        animate={{ opacity:1,x:0 }}
                                                        transition={{ delay:0.1*i }}
                                                    >
                                                        <button
                                                            className="flex justify-between items-center w-full px-2 py-1 rounded hover:bg-background/20"
                                                            onClick={() => send(
                                                                `Show me the details for “${t.assignment_name}” from the course “${t.course_name}”. ` +
                                                                `<!--CONTEXT${JSON.stringify({
                                                                    course_id:t.course_id,
                                                                    course_name:t.course_name,
                                                                    assignment_id:t.assignment_id
                                                                })}CONTEXT-->`
                                                            )}
                                                        >
                                                            <div className="flex-1 min-w-0 text-left">
                                                                <OverflowScroll text={t.assignment_name} />
                                                            </div>
                                                            <span className="bg-accent/20 text-accent px-2 py-0.5 rounded-full text-xs flex-shrink-0 ml-4">
                                {t.status}
                              </span>
                                                        </button>
                                                    </motion.li>
                                                ))}
                                            </ul>
                                        </motion.div>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
                        {messages.map((m,i) => (
                            <motion.div key={i} initial={{ opacity:0,y:10 }} animate={{ opacity:1,y:0 }}>
                                <ChatMessage
                                    role={m.role}
                                    content={stripHidden(toDisplay(m.content))}
                                    isLoading={m.isLoading}
                                />
                            </motion.div>
                        ))}
                        <div ref={bottomRef} />
                    </div>

                    {/* input footer */}
                    <div className="sticky bottom-0 z-20 bg-background/30 backdrop-blur-md border-t border-base p-4">
                        <form onSubmit={handleSubmit} className="flex items-center space-x-2">
                            <input
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                disabled={loading}
                                placeholder="Ask CanvasPal anything…"
                                className="flex-1 p-3 bg-transparent outline-none placeholder:text-muted-foreground text-sm"
                            />
                            <button
                                type={loading ? 'button' : 'submit'}
                                onClick={loading ? cancel : undefined}
                                className={`p-2 rounded ${
                                    loading
                                        ? 'text-destructive border border-destructive hover:bg-destructive/10'
                                        : 'text-primary border-primary hover:bg-primary/10'
                                }`}
                            >
                                {loading ? 'Cancel' : 'Send'}
                            </button>
                        </form>
                    </div>
                </motion.div>
            </motion.div>
        </motion.div>
    );
}
