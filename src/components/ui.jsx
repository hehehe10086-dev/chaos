// Shared building blocks. Large tap targets for phones.

export function Button({ className = '', ...props }) {
  return (
    <button
      className={`min-h-12 rounded-lg bg-amber-500 px-5 font-semibold text-stone-900 active:bg-amber-400 disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}

export function Input({ className = '', ...props }) {
  return (
    <input
      className={`min-h-12 w-full rounded-lg border border-stone-600 bg-stone-800 px-4 text-base placeholder:text-stone-500 focus:border-amber-500 focus:outline-none ${className}`}
      {...props}
    />
  );
}

export function ErrorText({ error }) {
  if (!error) return null;
  return <p className="text-sm text-red-400">{error.message ?? String(error)}</p>;
}
