// Shared building blocks. Large tap targets for phones.

const VARIANTS = {
  primary:
    'bg-bronze text-ink hover:bg-bronze-bright active:bg-bronze-bright font-semibold shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]',
  quiet: 'bg-ink-3 text-marble hover:bg-ink-4 active:bg-ink-4 border border-ink-4',
  danger: 'bg-blood text-marble hover:bg-blood-bright active:bg-blood-bright font-semibold',
  ghost: 'text-marble-dim hover:text-marble underline-offset-4 hover:underline',
};

export function Button({ variant = 'primary', className = '', ...props }) {
  return (
    <button
      className={`min-h-12 shrink-0 rounded-lg px-5 font-display text-sm whitespace-nowrap tracking-[0.08em] transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

export function Input({ className = '', ...props }) {
  return (
    <input
      className={`min-h-12 w-full rounded-lg border border-ink-4 bg-ink px-4 text-[17px] text-marble placeholder:text-marble-faint focus:border-bronze focus:outline-none ${className}`}
      {...props}
    />
  );
}

export function ErrorText({ error, className = '' }) {
  if (!error) return null;
  return (
    <p role="alert" className={`text-sm text-blood-bright ${className}`}>
      {error.message ?? String(error)}
    </p>
  );
}

export function Badge({ kind }) {
  const human = kind === 'human';
  return (
    <span
      className={`rounded px-1.5 py-0.5 font-display text-[0.62rem] tracking-[0.12em] ${
        human ? 'bg-bronze/20 text-bronze-bright' : 'bg-ink-4 text-marble-dim'
      }`}
    >
      {human ? 'HUMAN' : 'AI'}
    </span>
  );
}

/** Full-screen dimmed layer for dialogs. */
export function Overlay({ children, label, layer = 'z-40' }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className={`fixed inset-0 ${layer} grid animate-fade-in place-items-center overflow-y-auto bg-ink/85 p-4 backdrop-blur-sm`}
    >
      {children}
    </div>
  );
}
