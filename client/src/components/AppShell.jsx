import React, { useState, useEffect } from 'react';
import Navbar from './Navbar';
import CommandPalette from './CommandPalette';

export default function AppShell({ children }) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const handler = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-apple-bg text-apple-text">
      <Navbar onOpenCommandPalette={() => setPaletteOpen(true)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <main id="main-content" className="flex-1">
        {children}
      </main>
    </div>
  );
}
