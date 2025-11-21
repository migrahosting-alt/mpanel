/**
 * LoadingSkeleton Component Tests
 * Tests all skeleton loading components
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  LoadingSkeleton,
  TableSkeleton,
  CardSkeleton,
  PageLoader,
  SpinnerIcon,
} from '../components/LoadingSkeleton';

describe('LoadingSkeleton', () => {
  it('should render default skeleton', () => {
    const { container } = render(<LoadingSkeleton />);
    const skeleton = container.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
  });

  it('should render multiple skeleton bars', () => {
    const { container } = render(<LoadingSkeleton count={3} />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons).toHaveLength(3);
  });

  it('should apply custom height', () => {
    const { container } = render(<LoadingSkeleton height="h-12" />);
    const skeleton = container.querySelector('.h-12');
    expect(skeleton).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(<LoadingSkeleton className="custom-class" />);
    const skeleton = container.querySelector('.custom-class');
    expect(skeleton).toBeInTheDocument();
  });
});

describe('TableSkeleton', () => {
  it('should render table skeleton with default rows and columns', () => {
    const { container } = render(<TableSkeleton />);
    const table = container.querySelector('table');
    expect(table).toBeInTheDocument();
  });

  it('should render specified number of rows', () => {
    const { container } = render(<TableSkeleton rows={5} />);
    const rows = container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(5);
  });

  it('should render specified number of columns', () => {
    const { container } = render(<TableSkeleton rows={1} columns={4} />);
    const cells = container.querySelectorAll('tbody tr:first-child td');
    expect(cells).toHaveLength(4);
  });

  it('should have header row', () => {
    const { container } = render(<TableSkeleton columns={3} />);
    const headers = container.querySelectorAll('thead th');
    expect(headers).toHaveLength(3);
  });

  it('should animate skeleton bars', () => {
    const { container } = render(<TableSkeleton rows={2} columns={2} />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe('CardSkeleton', () => {
  it('should render default number of cards', () => {
    const { container } = render(<CardSkeleton />);
    const cards = container.querySelectorAll('.border');
    expect(cards).toHaveLength(3); // Default count
  });

  it('should render specified number of cards', () => {
    const { container } = render(<CardSkeleton count={5} />);
    const cards = container.querySelectorAll('.border');
    expect(cards).toHaveLength(5);
  });

  it('should use grid layout', () => {
    const { container } = render(<CardSkeleton />);
    const grid = container.querySelector('.grid');
    expect(grid).toBeInTheDocument();
  });

  it('should animate skeleton bars in cards', () => {
    const { container } = render(<CardSkeleton count={2} />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe('PageLoader', () => {
  it('should render loading text', () => {
    render(<PageLoader />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should center content', () => {
    const { container } = render(<PageLoader />);
    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass('flex', 'items-center', 'justify-center');
  });

  it('should display spinner icon', () => {
    const { container } = render(<PageLoader />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('should be full height', () => {
    const { container } = render(<PageLoader />);
    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass('min-h-screen');
  });
});

describe('SpinnerIcon', () => {
  it('should render SVG spinner', () => {
    const { container } = render(<SpinnerIcon />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should have animate-spin class', () => {
    const { container } = render(<SpinnerIcon />);
    const svg = container.querySelector('.animate-spin');
    expect(svg).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(<SpinnerIcon className="custom-spinner" />);
    const svg = container.querySelector('.custom-spinner');
    expect(svg).toBeInTheDocument();
  });

  it('should have default size classes', () => {
    const { container } = render(<SpinnerIcon />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('h-5', 'w-5');
  });

  it('should be visible (not hidden)', () => {
    const { container } = render(<SpinnerIcon />);
    const svg = container.querySelector('svg');
    expect(svg).toBeVisible();
  });
});

describe('Integration: Loading States', () => {
  it('should render TableSkeleton while loading data', () => {
    const { container } = render(
      <div>
        {true && <TableSkeleton rows={5} columns={4} />}
        {false && <div>Data loaded</div>}
      </div>
    );

    expect(container.querySelector('table')).toBeInTheDocument();
    expect(screen.queryByText('Data loaded')).not.toBeInTheDocument();
  });

  it('should switch from skeleton to content when loaded', () => {
    const { rerender, container } = render(
      <div>
        {true && <TableSkeleton />}
        {false && <div>Data loaded</div>}
      </div>
    );

    expect(container.querySelector('table')).toBeInTheDocument();

    rerender(
      <div>
        {false && <TableSkeleton />}
        {true && <div>Data loaded</div>}
      </div>
    );

    expect(container.querySelector('table')).not.toBeInTheDocument();
    expect(screen.getByText('Data loaded')).toBeInTheDocument();
  });
});
