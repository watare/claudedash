import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
  it('displays correct percentage', () => {
    render(<ProgressBar percent={75} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('clamps percent to maximum 100', () => {
    render(<ProgressBar percent={150} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('clamps percent to minimum 0', () => {
    render(<ProgressBar percent={-10} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('hides label when showLabel is false', () => {
    render(<ProgressBar percent={50} showLabel={false} />);
    expect(screen.queryByText('50%')).not.toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(<ProgressBar percent={60} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '60');
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuemax', '100');
  });

  it('applies custom height', () => {
    render(<ProgressBar percent={50} height={10} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveStyle({ height: '10px' });
  });
});
