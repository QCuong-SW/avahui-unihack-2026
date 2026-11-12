'use client';

import React from 'react';
import { ArrowRight, Loader2, Mail } from 'lucide-react';

interface EmailLoginFormProps {
  email: string;
  onEmailChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  disabled?: boolean;
  errorMessage?: string | null;
}

export function EmailLoginForm({
  email,
  onEmailChange,
  onSubmit,
  isLoading,
  disabled,
  errorMessage,
}: EmailLoginFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <div className="relative group">
        <Mail className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-zinc-500 transition-colors group-focus-within:text-avalanche-red" />
        <input
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          disabled={disabled || isLoading}
          placeholder="name@example.com"
          aria-label="Email address"
          className={`w-full rounded-lg border bg-zinc-900/90 py-3 pl-10 pr-4 font-mono text-xs text-white placeholder:text-zinc-500 transition-all duration-200 focus:outline-none disabled:opacity-50 ${
            errorMessage
              ? 'border-rose-500/80 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/40'
              : 'border-zinc-700/80 focus:border-avalanche-red focus:ring-2 focus:ring-avalanche-red/25 hover:border-zinc-600'
          }`}
        />
      </div>

      {errorMessage && (
        <p className="font-mono text-xs font-medium text-rose-400 animate-fade-down">{errorMessage}</p>
      )}

      <button
        type="submit"
        disabled={disabled || isLoading}
        className="group relative flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-avalanche-red via-red-600 to-avalanche-darkRed px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-avalanche-red/20 transition-all duration-200 hover:shadow-avalanche-red/35 hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-white" />
            <span>Đang gửi mã OTP...</span>
          </>
        ) : (
          <>
            <span>Tiếp tục với Email</span>
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </>
        )}
      </button>
    </form>
  );
}
