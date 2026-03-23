"use client";
import React from 'react';

export default function Info({ text, className = '' }: { text: string; className?: string }) {
  return (
    <span className={["relative inline-block group align-middle", className].join(' ')}>
      <span className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-700 text-[10px] font-semibold select-none">i</span>
      <span className="hidden group-hover:block absolute z-30 left-1/2 -translate-x-1/2 mt-2 w-[280px] max-w-[80vw] rounded border border-gray-200 bg-white text-gray-800 text-xs p-3 shadow-lg">
        {text}
      </span>
    </span>
  );
}




