// src/components/ChatHeader.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Sun, Moon, Plus, List, KeyRound } from 'lucide-react';

interface ChatHeaderProps {
    onNewChatAction:       () => void;
    onHistoryToggleAction: () => void;
    historyOpen:           boolean;
    onCredentialsAction:   () => void;
}

export default function ChatHeader({
                                       onNewChatAction,
                                       onHistoryToggleAction,
                                       historyOpen,
                                       onCredentialsAction,
                                   }: ChatHeaderProps) {
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');

    useEffect(() => {
        const stored = sessionStorage.getItem('canvaspal_theme') as 'light' | 'dark' | null;
        const initial = stored ?? 'dark';
        setTheme(initial);
        document.documentElement.classList.toggle('light', initial === 'light');
    }, []);

    const toggleTheme = () => {
        const next = theme === 'light' ? 'dark' : 'light';
        setTheme(next);
        document.documentElement.classList.toggle('light', next === 'light');
        sessionStorage.setItem('canvaspal_theme', next);
    };

    return (
        <header
            className={`sticky top-0 z-20 flex items-center justify-between border-b px-6 py-4 backdrop-blur-md ${
                theme === 'light'
                    ? 'bg-[#f3f3f3] text-black border-[#e5e5e5]'
                    : 'bg-[rgb(30,30,30)] text-white border-[rgb(24,24,24)]'
            }`}
        >
            {/* Left: history, new chat, title */}
            <div className="flex items-center gap-3">
                <button
                    onClick={onHistoryToggleAction}
                    className="rounded-full p-2 transition hover:bg-border"
                    aria-label={historyOpen ? 'Close conversation history' : 'Open conversation history'}
                >
                    <List className={`h-5 w-5 ${historyOpen ? 'text-accent' : ''}`} />
                </button>
                <button
                    onClick={onNewChatAction}
                    className="rounded-full p-2 transition hover:bg-border"
                    aria-label="New chat"
                >
                    <Plus className="h-5 w-5" />
                </button>
                <h1 className="text-2xl font-bold ml-2">CanvasPal</h1>
            </div>

            {/* Right: theme toggle, user circle */}
            <div className="flex items-center gap-3">
                <button
                    onClick={onCredentialsAction}
                    className="rounded-full p-2 transition hover:bg-border"
                    aria-label="Configure Canvas credentials"
                >
                    <KeyRound className="h-5 w-5" />
                </button>
                <button
                    onClick={toggleTheme}
                    className="rounded-full p-2 transition hover:bg-border"
                    aria-label="Toggle light/dark mode"
                >
                    {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                </button>
                <div className="w-8 h-8 rounded-full bg-gray-500" aria-label="User profile" />
            </div>
        </header>
    );
}
