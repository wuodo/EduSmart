"use client";
import React from 'react';

export function Button({ variant = 'primary', className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'success' | 'ghost' }) {
  const base = 'inline-flex items-center justify-center rounded px-4 py-2 text-sm transition';
  const variants: Record<string, string> = {
    primary: 'bg-btnblue text-white hover:opacity-90',
    success: 'bg-btngreen text-white hover:opacity-90',
    ghost: 'border hover:bg-white/10'
  };
  return <button className={[base, variants[variant], className].join(' ')} {...props} />;
}

export function Card({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={["bg-transparent border border-white/30 rounded backdrop-blur-sm", className].join(' ')} {...props} />;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={["border rounded px-3 py-2", props.className].join(' ')} />
}


