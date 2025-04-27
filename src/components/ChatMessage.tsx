'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import clsx from 'clsx';

/**
 * Props interface for the ChatMessage component.
 * @property {'user' | 'assistant'} role - The role of the message sender (either 'user' or 'assistant').
 * @property {string} content - The content of the chat message.
 * @property {boolean} [isLoading] - Optional flag indicating if the assistant's message is loading.
 */
interface Props {
    role: 'user' | 'assistant';
    content: string;
    isLoading?: boolean;
}

/**
 * ChatMessage component renders a chat bubble for either the user or the assistant.
 * It supports Markdown rendering for assistant messages and provides a loading state.
 *
 * @param {Props} props - The properties passed to the component.
 * @returns {JSX.Element} The rendered chat message component.
 */
export default function ChatMessage({ role, content, isLoading = false }: Props) {
    const isUser = role === 'user'; // Determine if the message is from the user.

    return (
        <div
            className={clsx(
                'flex items-start mb-4',
                isUser ? 'justify-end' : 'justify-start' // Align messages based on the sender.
            )}
        >
            {/* Assistant avatar or loading indicator */}
            {!isUser && (
                <div className="flex-shrink-0 mr-2 mt-1">
                    {isLoading
                        ? <div className="w-8 h-8 rounded-full bg-accent animate-pulse" /> // Loading animation.
                        : <img src="/logo.png" alt="CP" className="w-8 h-8 rounded-full" /> // Assistant avatar.
                    }
                </div>
            )}

            {/* Chat bubble */}
            <div
                className={clsx(
                    'max-w-[70%] whitespace-pre-wrap rounded-2xl p-4 shadow-lg',
                    isUser
                        ? 'bg-blue-600 text-white dark:bg-blue-500' // User message styling.
                        : 'bg-gray-50 text-gray-900 dark:bg-[#1e1e1e] dark:text-gray-100' // Assistant message styling.
                )}
            >
                {isUser ? (
                    // Render plain text for user messages.
                    <span className="text-base leading-relaxed">{content}</span>
                ) : (
                    // Render Markdown for assistant messages.
                    <div className="prose prose-lg dark:prose-invert break-words">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]} // Enable GitHub-flavored Markdown and math support.
                            rehypePlugins={[rehypeKatex]} // Enable LaTeX rendering.
                            components={{
                                // Custom table styling for Markdown tables.
                                table: ({ children }) => (
                                    <table className="w-full table-auto border border-current mb-4">
                                        {children}
                                    </table>
                                ),
                                thead: ({ children }) => (
                                    <thead className="bg-gray-200 dark:bg-gray-700">
                                    {children}
                                    </thead>
                                ),
                                th: ({ children }) => (
                                    <th className="border border-current px-3 py-1 text-left">
                                        {children}
                                    </th>
                                ),
                                td: ({ children }) => (
                                    <td className="border border-current px-3 py-1">
                                        {children}
                                    </td>
                                ),
                            }}
                        >
                            {content}
                        </ReactMarkdown>
                    </div>
                )}
            </div>

            {/* Spacer for aligning user-side avatar */}
            {isUser && <div className="w-8 h-8 flex-shrink-0 ml-2" />}
        </div>
    );
}
