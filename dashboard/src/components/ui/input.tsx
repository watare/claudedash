import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border bg-[#2B3139] px-3 py-2 text-sm text-[#EAECEF] placeholder:text-[#848E9C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0E11] disabled:cursor-not-allowed disabled:opacity-50',
          error
            ? 'border-[#F6465D] focus-visible:ring-[#F6465D]'
            : 'border-[#2B3139] focus-visible:ring-[#F0B90B]',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export { Input };
