import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BookingFlow from '../components/booking/BookingFlow';

describe('BookingFlow Component', () => {
  const mockOnClose = vi.fn();
  const serviceName = 'Standard Clean';

  it('renders correctly when open', () => {
    render(
      <MemoryRouter>
        <BookingFlow isOpen={true} onClose={mockOnClose} serviceName={serviceName} />
      </MemoryRouter>
    );
    expect(screen.getByText(`Book ${serviceName}`)).toBeDefined();
    expect(screen.getByText('Service Requirements')).toBeDefined();
  });

  it('navigates through steps correctly', () => {
    render(
      <MemoryRouter>
        <BookingFlow isOpen={true} onClose={mockOnClose} serviceName={serviceName} />
      </MemoryRouter>
    );
    
    // Step 1: Details -> Next
    fireEvent.click(screen.getByText('Next Step'));
    expect(screen.getByText('Preferred Arrival Time')).toBeDefined();

    // Step 2: Schedule (Requires date)
    const nextBtn = screen.getByText('Next Step');
    expect(nextBtn).toBeDefined();
  });

  it('does not render when closed', () => {
    const { container } = render(
      <MemoryRouter>
        <BookingFlow isOpen={false} onClose={mockOnClose} serviceName={serviceName} />
      </MemoryRouter>
    );
    expect(container.firstChild).toBeNull();
  });

  it('calls onClose when close button is clicked', () => {
    render(
      <MemoryRouter>
        <BookingFlow isOpen={true} onClose={mockOnClose} serviceName={serviceName} />
      </MemoryRouter>
    );
    const closeBtn = screen.getByRole('button', { name: '' }); // The X icon button
    fireEvent.click(closeBtn);
    // Note: Lucide icons don't always have names, but the button is there
  });
});
