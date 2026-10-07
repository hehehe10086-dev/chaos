// Tests never touch the real database or a real LLM, whatever is in .env or the shell.
process.env.CHAOS_STORE = 'memory';
process.env.LLM_PROVIDER = 'mock';
delete process.env.VERCEL;
