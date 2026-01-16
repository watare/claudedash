import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MainContent } from './MainContent';

describe('MainContent', () => {
  it('renders children content', () => {
    render(<MainContent><div data-testid="test-child">Hello</div></MainContent>);
    expect(screen.getByTestId('test-child')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('renders as main element', () => {
    render(<MainContent>Content</MainContent>);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('has correct background color', () => {
    render(<MainContent>Content</MainContent>);
    const main = screen.getByRole('main');
    expect(main).toHaveClass('bg-[#0B0E11]');
  });

  it('has overflow-auto for scrolling', () => {
    render(<MainContent>Content</MainContent>);
    const main = screen.getByRole('main');
    expect(main).toHaveClass('overflow-auto');
  });

  it('has proper padding', () => {
    render(<MainContent>Content</MainContent>);
    const main = screen.getByRole('main');
    expect(main).toHaveClass('p-6');
  });

  it('fills available space with flex-1', () => {
    render(<MainContent>Content</MainContent>);
    const main = screen.getByRole('main');
    expect(main).toHaveClass('flex-1');
  });
});
