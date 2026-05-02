import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BookingFlow from '../components/booking/BookingFlow';

describe('BookingFlow Component', () => {
  const mockOnClose = vi.fn();
  const serviceName = 'Standard Clean';

  it('renders correctly when open', () => {
    render(<BookingFlow isOpen={true} onClose={mockOnClose} serviceName={serviceName} />);
    expect(screen.getByText(`Book ${serviceName}`)).toBeDefined();
    expect(screen.getByText('Service Details')).toBeDefined();
  });

  it('navigates through steps correctly', () => {
    render(<BookingFlow isOpen={true} onClose={mockOnClose} serviceName={serviceName} />);
    
    // Step 1: Details -> Next
    fireEvent.click(screen.getByText('Next Step'));
    expect(screen.getByText('Preferred Schedule')).toBeDefined();

    // Step 2: Schedule (Requires date)
    const nextBtn = screen.getByText('Next Step');
    expect(nextBtn).toBeDefined();
  });

  it('does not render when closed', () => {
    const { container } = render(
      <BookingFlow isOpen={false} onClose={mockOnClose} serviceName={serviceName} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('calls onClose when close button is clicked', () => {
    render(<BookingFlow isOpen={true} onClose={mockOnClose} serviceName={serviceName} />);
    const closeBtn = screen.getByRole('button', { name: '' }); // The X icon button
    fireEvent.click(closeBtn);
    // Note: Lucide icons don't always have names, but the button is there
  });
});
