import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Skeleton } from './skeleton';

describe('Skeleton', () => {
  it('renders a div element', () => {
    render(<Skeleton data-testid="skeleton" />);
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('has animate-pulse class for loading animation', () => {
    render(<Skeleton data-testid="skeleton" />);
    expect(screen.getByTestId('skeleton')).toHaveClass('animate-pulse');
  });

  it('has rounded-md class for rounded corners', () => {
    render(<Skeleton data-testid="skeleton" />);
    expect(screen.getByTestId('skeleton')).toHaveClass('rounded-md');
  });

  it('has dark background color from theme', () => {
    render(<Skeleton data-testid="skeleton" />);
    expect(screen.getByTestId('skeleton')).toHaveClass('bg-[#2B3139]');
  });

  it('accepts and applies custom className', () => {
    render(<Skeleton data-testid="skeleton" className="h-10 w-20" />);
    const skeleton = screen.getByTestId('skeleton');
    expect(skeleton).toHaveClass('h-10');
    expect(skeleton).toHaveClass('w-20');
  });

  it('passes through additional HTML attributes', () => {
    render(<Skeleton data-testid="skeleton" aria-label="Loading content" />);
    expect(screen.getByTestId('skeleton')).toHaveAttribute('aria-label', 'Loading content');
  });

  it('can be used for card skeleton with height', () => {
    render(<Skeleton data-testid="skeleton" className="h-40" />);
    expect(screen.getByTestId('skeleton')).toHaveClass('h-40');
  });
});
