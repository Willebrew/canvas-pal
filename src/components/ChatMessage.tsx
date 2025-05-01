// src/components/ChatMessage.tsx
'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import clsx from 'clsx';

interface Props {
    role: 'user' | 'assistant';
    content: string;
    isLoading?: boolean;
}

export default function ChatMessage({ role, content, isLoading = false }: Props) {
    const isUser = role === 'user';

    // 1. Strip out any <!--CONTEXT…CONTEXT--> comments
    // 2. Normalize newlines
    // 3. Trim leading/trailing blank lines
    const md = content
        .replace(/<!--CONTEXT[\s\S]*?CONTEXT-->/g, '')
        .replace(/\r\n/g, '\n')
        .trim();

    const bubbleCls = clsx(
        'max-w-[75%] rounded-2xl px-4 py-3 shadow-md',
        'whitespace-pre-wrap break-words',
        isUser
            ? 'bg-blue-600 text-white dark:bg-blue-500'
            : isLoading
                ? 'bg-[rgb(var(--color-container))]/70 text-[rgb(var(--color-foreground))]/60'
                : 'bg-[rgb(var(--color-container))] text-[rgb(var(--color-foreground))]'
    );

    return (
        <div className={clsx('flex mb-2', isUser ? 'justify-end' : 'justify-start')}>
            {!isUser && (
                <img
                    src="/logo.png"
                    alt="CP"
                    className={clsx('mr-2 mt-1 w-8 h-8 rounded-full', isLoading && 'animate-pulse')}
                />
            )}

            <div className={bubbleCls}>
                {isUser ? (
                    <span className="leading-relaxed">{md}</span>
                ) : isLoading ? (
                    <span className="animate-pulse">Working on it…</span>
                ) : (
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                            h1: ({ children }) => <h1 className="text-2xl font-bold my-2">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-xl font-semibold my-2">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-lg font-semibold my-2">{children}</h3>,

                            hr: () => <hr className="border-t border-base my-4" />,

                            p: ({ children }) => <p className="mb-2 leading-relaxed">{children}</p>,

                            a: ({ href, children }) => (
                                <a href={href} className="text-primary underline">
                                    {children}
                                </a>
                            ),

                            ul: ({ children }) => <ul className="list-disc pl-5 mb-2">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal pl-5 mb-2">{children}</ol>,
                            li: ({ children }) => <li className="mb-1">{children}</li>,

                            table: ({ children }) => (
                                <div className="my-4 overflow-auto">
                                    <table className="w-full border border-base text-sm">{children}</table>
                                </div>
                            ),
                            thead: ({ children }) => (
                                <thead className="bg-[rgb(var(--color-container))]">{children}</thead>
                            ),
                            th: ({ children }) => (
                                <th className="border border-base px-2 py-1 font-semibold">{children}</th>
                            ),
                            td: ({ children }) => (
                                <td className="border border-base px-2 py-1 align-top">{children}</td>
                            ),

                            blockquote: ({ children }) => (
                                <blockquote className="border-l-4 border-accent pl-4 italic mb-2">
                                    {children}
                                </blockquote>
                            ),
                        }}
                    >
                        {md}
                    </ReactMarkdown>
                )}
            </div>

            {isUser && <div className="w-8 shrink-0" />}
        </div>
    );
}
