import './globals.css';
import type { ReactNode } from 'react';

/**
 * Metadata for the application.
 * Contains the title of the application.
 */
export const metadata = { title: 'CanvasPal' };

/**
 * Root layout component for the application.
 * Wraps the entire application with the necessary HTML structure and global styles.
 *
 * @param {Object} props - The properties passed to the component.
 * @param {ReactNode} props.children - The child components to be rendered inside the layout.
 * @returns {JSX.Element} The root layout structure.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en" className="bg-bg text-foreground">
        <body className="min-h-screen flex flex-col">{children}</body>
        </html>
    );
}
