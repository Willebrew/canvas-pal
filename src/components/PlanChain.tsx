// src/components/PlanChain.tsx
'use client';

import React from 'react';
import { motion } from 'framer-motion';

type PlanItem =
    | string
    | { step: string; action?: string; description?: string }
    | { action: string; tool?: string }
    | { tool: string; params?: Record<string, unknown> };

interface PlanChainProps {
    plan: PlanItem[];
    done: number[];
}

export default function PlanChain({ plan, done }: PlanChainProps) {
    return (
        <>
            <div className="text-xs font-semibold mb-2 text-muted-foreground">Plan:</div>
            <div className="space-y-2">
                {plan.map((stepItem, i) => {
                    const finished = done.includes(i);
                    const active = done.length === i && !finished;

                    let stepText: string;
                    try {
                        if (typeof stepItem === 'string') {
                            stepText = stepItem;
                        } else if ('step' in stepItem) {
                            stepText = `${stepItem.step}${stepItem.action ? `: ${stepItem.action}` : ''}${
                                stepItem.description ? ` - ${stepItem.description}` : ''
                            }`;
                        } else if ('action' in stepItem) {
                            stepText = `${stepItem.action}${stepItem.tool ? ` (tool: ${stepItem.tool})` : ''}`;
                        } else if ('tool' in stepItem) {
                            const hasParams = stepItem.params && Object.keys(stepItem.params).length > 0;
                            stepText = hasParams
                                ? `Call ${stepItem.tool}(${JSON.stringify(stepItem.params)})`
                                : `Call ${stepItem.tool}()`;
                        } else {
                            stepText = String(stepItem);
                        }
                    } catch {
                        stepText = JSON.stringify(stepItem);
                    }

                    return (
                        <div key={i} className="flex items-center space-x-2">
                            <motion.div
                                animate={active ? { scale: [1, 1.3, 1] } : {}}
                                className={`w-3 h-3 rounded-full ${
                                    finished ? 'bg-accent' : active ? 'bg-accent animate-pulse' : 'bg-border'
                                }`}
                            />
                            <span
                                className={[
                                    finished && 'line-through text-muted-foreground',
                                    active && 'shimmer',
                                ]
                                    .filter(Boolean)
                                    .join(' ')}
                            >
                                {stepText}
                            </span>
                        </div>
                    );
                })}
            </div>

            <style jsx>{`
                .shimmer {
                    color: transparent;
                    -webkit-text-fill-color: transparent;
                    background: linear-gradient(
                            90deg,
                            rgba(255, 255, 255, 0.2) 25%,
                            rgba(255, 255, 255, 0.6) 50%,
                            rgba(255, 255, 255, 0.2) 75%
                    );
                    background-size: 200% 100%;
                    background-clip: text;
                    -webkit-background-clip: text;
                    animation: shimmer 3s infinite;
                }

                @keyframes shimmer {
                    0% {
                        background-position: 200% 0;
                    }
                    100% {
                        background-position: -200% 0;
                    }
                }
            `}</style>
        </>
    );
}
