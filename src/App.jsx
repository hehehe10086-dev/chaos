import { useEffect, useState } from 'react';

export default function App() {
  const [health, setHealth] = useState('checking…');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => setHealth(`ok · ${data.time}`))
      .catch((err) => setHealth(`error: ${err}`));
  }, []);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-stone-900 px-4 text-stone-100">
      <h1 className="text-5xl font-bold tracking-widest">CHAOS</h1>
      <p className="text-center text-stone-400">Step into history&apos;s tipping points.</p>
      <p className="rounded bg-stone-800 px-3 py-1 font-mono text-sm">API: {health}</p>
    </main>
  );
}
