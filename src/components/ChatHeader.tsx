'use client';

import { useState, useEffect } from 'react';
import { Sun, Moon, Plus } from 'lucide-react';

interface ChatHeaderProps {
    /**
     * Callback function triggered when the "New Chat" button is clicked.
     */
    onNewChatAction: () => void;
}

/**
 * ChatHeader component.
 * Renders the header of the application, including the title, theme toggle, and "New Chat" button.
 *
 * @param {ChatHeaderProps} props - The properties passed to the component.
 * @param {() => void} props.onNewChatAction - Callback function for starting a new chat.
 * @returns {JSX.Element} The rendered ChatHeader component.
 */
export default function ChatHeader({ onNewChatAction }: ChatHeaderProps) {
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');

    /**
     * Initializes the theme based on the value stored in sessionStorage.
     * Defaults to 'dark' if no value is found.
     */
    useEffect(() => {
        const stored = sessionStorage.getItem('canvaspal_theme') as
            | 'light'
            | 'dark'
            | null;
        const initial = stored ?? 'dark';
        setTheme(initial);
        document.documentElement.classList.toggle('light', initial === 'light');
    }, []);

    /**
     * Toggles the theme between 'light' and 'dark'.
     * Updates the DOM and stores the new theme in sessionStorage.
     */
    const toggleTheme = () => {
        const next = theme === 'light' ? 'dark' : 'light';
        setTheme(next);
        document.documentElement.classList.toggle('light', next === 'light');
        sessionStorage.setItem('canvaspal_theme', next);
    };

    return (
        <header
            className={`sticky top-0 z-20 flex items-center justify-between border-b px-6 py-4 backdrop-blur-md
        ${
                theme === 'light'
                    ? 'bg-[#f3f3f3] text-black border-[#e5e5e5]'
                    : 'bg-[rgb(30,30,30)] text-white border-[rgb(24,24,24)]'
            }`}
        >
            {/* Application title */}
            <h1 className="text-2xl font-bold">CanvasPal</h1>

            <div className="flex items-center gap-3">
                {/* Theme toggle button */}
                <button
                    onClick={toggleTheme}
                    className="rounded-full p-2 transition hover:bg-border"
                    aria-label="Toggle light/dark mode"
                >
                    {theme === 'light' ? (
                        <Moon className="h-5 w-5" />
                    ) : (
                        <Sun className="h-5 w-5" />
                    )}
                </button>

                {/* New Chat button */}
                <button
                    onClick={onNewChatAction}
                    className="btn flex items-center gap-1 transition hover:opacity-90"
                >
                    <Plus className="h-4 w-4" /> New&nbsp;Chat
                </button>
            </div>
        </header>
    );
}
