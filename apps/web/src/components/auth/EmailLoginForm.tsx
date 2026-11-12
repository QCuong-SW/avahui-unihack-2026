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
    <form onSubmit={onSubmit} className="space-y-2.5" noValidate>
      <div className="relative">
        <Mail className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-zinc-500" />
        <input
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          disabled={disabled || isLoading}
          placeholder="name@example.com"
          aria-label="Email address"
          className={`w-full rounded-none border bg-zinc-900/90 py-3 pl-10 pr-4 font-mono text-xs text-white placeholder:text-zinc-500 focus:outline-none disabled:opacity-60 ${
            errorMessage
              ? 'border-rose-500 focus:border-rose-500'
              : 'border-zinc-700 focus:border-avalanche-red'
          }`}
        />
      </div>

      {errorMessage && (
        <p className="font-mono text-xs font-medium text-rose-400">{errorMessage}</p>
      )}

      <button
        type="submit"
        disabled={disabled || isLoading}
        className="flex w-full items-center justify-center gap-2 rounded-none bg-avalanche-red px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider text-white transition hover:bg-avalanche-darkRed disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Đang gửi mã OTP...</span>
          </>
        ) : (
          <>
            <span>Tiếp tục với Email</span>
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </form>
  );
}
