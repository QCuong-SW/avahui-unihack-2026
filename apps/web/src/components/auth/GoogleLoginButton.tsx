'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

interface GoogleLoginButtonProps {
  onClick: () => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function GoogleLoginButton({
  onClick,
  isLoading,
  disabled,
}: GoogleLoginButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      className="flex w-full items-center justify-center gap-3 rounded-none border border-zinc-700 bg-white px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider text-zinc-900 shadow-sm transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-avalanche-red" />
      ) : (
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#EA4335"
            d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3 14.7 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.8H12z"
          />
        </svg>
      )}
      <span>
        {isLoading ? 'Đang xác thực Google...' : 'Tiếp tục với Google'}
      </span>
    </button>
  );
}
