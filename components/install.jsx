'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

export function Install() {
  const [prompt, setPrompt] = useState(null);
  const [isIOS, setIOS] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    setIOS(!standalone && (/iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)));
    function ready(event) {
      event.preventDefault();
      setPrompt(event);
    }
    function installed() {
      setPrompt(null);
      setIOS(false);
    }
    window.addEventListener('beforeinstallprompt', ready);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', ready);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  if (!prompt && !isIOS) return null;
  return <div className="install">
    <button className="button quiet" type="button" aria-expanded={isIOS ? showHelp : undefined} onClick={async () => {
      if (prompt) {
        setPrompt(null);
        try { await prompt.prompt(); } catch { /* Browser dismissed the prompt. */ }
      } else setShowHelp(!showHelp);
    }}><Download size={16} /> Install app</button>
    {showHelp && <p role="status">In Safari, tap Share, then Add to Home Screen.</p>}
  </div>;
}
