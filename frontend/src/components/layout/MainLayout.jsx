import React from 'react';
import { Sidebar } from './Sidebar';
import { GlobalRiskBanner } from './GlobalRiskBanner';
import { Outlet } from 'react-router-dom';

/**
 * Main Layout Shell
 * Houses Sidebar, Global Banner, and child routes.
 * Handles the structure of the "Read-Mostly Terminal"
 */
export const MainLayout = () => {
    return (
        <div className="flex h-screen w-screen bg-transparent overflow-hidden text-text-primary">
            {/* Sidebar Navigation */}
            <Sidebar />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col bg-transparent relative h-full">
                {/* Sticky Risk Banner */}
                <GlobalRiskBanner />

                {/* Child Pages Route Outlet */}
                <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 relative">
                    <div className="absolute inset-0 z-[-1] pointer-events-none opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0ibm9uZSIvPjxwYXRoIGQ9Ik0wIDIwaDQwTTIwIDB2NDAiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIiBzdHJva2Utd2lkdGg9IjEiLz48L3N2Zz4=')]"></div>

                    <div className="max-w-[1600px] mx-auto w-full">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};
