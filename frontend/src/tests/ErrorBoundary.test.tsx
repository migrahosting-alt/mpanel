/**
 * ErrorBoundary Component Tests
 * Tests error boundary, error messages, and empty states
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary, ErrorMessage, EmptyState } from '../components/ErrorBoundary';

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

describe('ErrorBoundary', () => {
  // Suppress console.error for these tests
  const originalError = console.error;
  beforeAll(() => {
    console.error = vi.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });

  it('should render children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('should catch and display error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
  });

  it('should display error message in fallback UI', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  it('should show reload button', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Reload Page/i)).toBeInTheDocument();
  });

  it('should show go back button', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Go Back/i)).toBeInTheDocument();
  });

  it('should reload page on reload button click', () => {
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true,
    });

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByText(/Reload Page/i));
    expect(reloadMock).toHaveBeenCalled();
  });
});

describe('ErrorMessage', () => {
  it('should render error message', () => {
    render(<ErrorMessage message="Test error message" />);
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('should render with error icon', () => {
    const { container } = render(<ErrorMessage message="Error" />);
    // ExclamationTriangleIcon should be present
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('should show retry button when onRetry provided', () => {
    const retryMock = vi.fn();
    render(<ErrorMessage message="Error" onRetry={retryMock} />);
    
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('should not show retry button when onRetry not provided', () => {
    render(<ErrorMessage message="Error" />);
    
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
  });

  it('should call onRetry when retry button clicked', () => {
    const retryMock = vi.fn();
    render(<ErrorMessage message="Error" onRetry={retryMock} />);
    
    fireEvent.click(screen.getByText('Retry'));
    expect(retryMock).toHaveBeenCalledTimes(1);
  });

  it('should have error styling', () => {
    const { container } = render(<ErrorMessage message="Error" />);
    const errorDiv = container.firstChild;
    
    expect(errorDiv).toHaveClass('bg-red-50');
  });
});

describe('EmptyState', () => {
  it('should render title', () => {
    render(<EmptyState title="No Data" />);
    expect(screen.getByText('No Data')).toBeInTheDocument();
  });

  it('should render description', () => {
    render(<EmptyState title="No Data" description="Add some items to get started" />);
    expect(screen.getByText('Add some items to get started')).toBeInTheDocument();
  });

  it('should render custom icon', () => {
    const CustomIcon = () => <div data-testid="custom-icon">Icon</div>;
    render(<EmptyState title="No Data" icon={<CustomIcon />} />);
    
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('should not render icon when not provided', () => {
    const { container } = render(<EmptyState title="No Data" />);
    const icon = container.querySelector('[data-testid="custom-icon"]');
    
    expect(icon).not.toBeInTheDocument();
  });

  it('should render action button', () => {
    const action = {
      label: 'Add Item',
      onClick: vi.fn(),
    };
    
    render(<EmptyState title="No Data" action={action} />);
    expect(screen.getByText('Add Item')).toBeInTheDocument();
  });

  it('should call action onClick when button clicked', () => {
    const actionMock = vi.fn();
    const action = {
      label: 'Add Item',
      onClick: actionMock,
    };
    
    render(<EmptyState title="No Data" action={action} />);
    fireEvent.click(screen.getByText('Add Item'));
    
    expect(actionMock).toHaveBeenCalledTimes(1);
  });

  it('should not render action button when not provided', () => {
    render(<EmptyState title="No Data" />);
    const button = screen.queryByRole('button');
    
    expect(button).not.toBeInTheDocument();
  });

  it('should center content', () => {
    const { container } = render(<EmptyState title="No Data" />);
    const wrapper = container.firstChild;
    
    expect(wrapper).toHaveClass('text-center');
  });
});

describe('Integration: Error Handling', () => {
  it('should show ErrorMessage for API failures', () => {
    const errorMessage = 'Failed to load data from server';
    render(<ErrorMessage message={errorMessage} onRetry={vi.fn()} />);
    
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('should show EmptyState when no data', () => {
    const items: any[] = [];
    render(
      <div>
        {items.length === 0 ? (
          <EmptyState
            title="No items found"
            description="Create your first item"
            action={{ label: 'Create Item', onClick: vi.fn() }}
          />
        ) : (
          <div>Items list</div>
        )}
      </div>
    );
    
    expect(screen.getByText('No items found')).toBeInTheDocument();
    expect(screen.getByText('Create your first item')).toBeInTheDocument();
  });
});
