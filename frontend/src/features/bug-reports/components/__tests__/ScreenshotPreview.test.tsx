import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ScreenshotPreview } from '../ScreenshotPreview';

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-url');
global.URL.revokeObjectURL = jest.fn();

describe('ScreenshotPreview', () => {
  const mockOnRemove = jest.fn();
  const defaultProps = {
    screenshots: [],
    onRemove: mockOnRemove,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render nothing when no screenshots are provided', () => {
      const { container } = render(<ScreenshotPreview {...defaultProps} />);
      expect(container.firstChild).toBeNull();
    });

    it('should render screenshot previews when files are provided', () => {
      const mockFiles = [
        new File(['content1'], 'test1.png', { type: 'image/png' }),
        new File(['content2'], 'test2.jpg', { type: 'image/jpeg' }),
      ];

      render(<ScreenshotPreview {...defaultProps} screenshots={mockFiles} />);

      expect(screen.getByText('Selected Screenshots')).toBeInTheDocument();
      expect(screen.getByText('test1.png')).toBeInTheDocument();
      expect(screen.getByText('test2.jpg')).toBeInTheDocument();
    });

    it('should display file information for each screenshot', () => {
      const mockFile = new File(['x'.repeat(1024 * 500)], 'screenshot.png', {
        type: 'image/png',
      }); // ~500KB

      render(<ScreenshotPreview {...defaultProps} screenshots={[mockFile]} />);

      expect(screen.getByText('screenshot.png')).toBeInTheDocument();
      expect(screen.getByText(/KB/)).toBeInTheDocument();
      expect(screen.getByText('PNG')).toBeInTheDocument();
    });

    it('should apply custom className when provided', () => {
      const mockFiles = [new File(['content'], 'test.png', { type: 'image/png' })];

      const { container } = render(
        <ScreenshotPreview {...defaultProps} screenshots={mockFiles} className="custom-class" />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('File Size Formatting', () => {
    it('should format bytes correctly', () => {
      const mockFile = new File(['x'.repeat(500)], 'small.png', { type: 'image/png' }); // 500 bytes

      render(<ScreenshotPreview {...defaultProps} screenshots={[mockFile]} />);

      expect(screen.getByText('500 B')).toBeInTheDocument();
    });

    it('should format kilobytes correctly', () => {
      const mockFile = new File(['x'.repeat(1024 * 50)], 'medium.png', { type: 'image/png' }); // 50KB

      render(<ScreenshotPreview {...defaultProps} screenshots={[mockFile]} />);

      expect(screen.getByText('50.0 KB')).toBeInTheDocument();
    });

    it('should format megabytes correctly', () => {
      const mockFile = new File(['x'.repeat(1024 * 1024 * 2.5)], 'large.png', {
        type: 'image/png',
      }); // 2.5MB

      render(<ScreenshotPreview {...defaultProps} screenshots={[mockFile]} />);

      expect(screen.getByText('2.50 MB')).toBeInTheDocument();
    });
  });

  describe('File Type Display', () => {
    it('should display PNG file type', () => {
      const mockFile = new File(['content'], 'test.png', { type: 'image/png' });

      render(<ScreenshotPreview {...defaultProps} screenshots={[mockFile]} />);

      expect(screen.getByText('PNG')).toBeInTheDocument();
    });

    it('should display JPEG file type', () => {
      const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

      render(<ScreenshotPreview {...defaultProps} screenshots={[mockFile]} />);

      expect(screen.getByText('JPEG')).toBeInTheDocument();
    });

    it('should display GIF file type', () => {
      const mockFile = new File(['content'], 'test.gif', { type: 'image/gif' });

      render(<ScreenshotPreview {...defaultProps} screenshots={[mockFile]} />);

      expect(screen.getByText('GIF')).toBeInTheDocument();
    });

    it('should display WEBP file type', () => {
      const mockFile = new File(['content'], 'test.webp', { type: 'image/webp' });

      render(<ScreenshotPreview {...defaultProps} screenshots={[mockFile]} />);

      expect(screen.getByText('WEBP')).toBeInTheDocument();
    });
  });

  describe('Thumbnail Generation', () => {
    it('should create object URLs for thumbnails', () => {
      const mockFiles = [
        new File(['content1'], 'test1.png', { type: 'image/png' }),
        new File(['content2'], 'test2.jpg', { type: 'image/jpeg' }),
      ];

      render(<ScreenshotPreview {...defaultProps} screenshots={mockFiles} />);

      expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
      expect(URL.createObjectURL).toHaveBeenCalledWith(mockFiles[0]);
      expect(URL.createObjectURL).toHaveBeenCalledWith(mockFiles[1]);
    });

    it('should render img elements with object URLs', () => {
      const mockFile = new File(['content'], 'test.png', { type: 'image/png' });

      render(<ScreenshotPreview {...defaultProps} screenshots={[mockFile]} />);

      const img = screen.getByAltText('test.png');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'mock-url');
    });

    it('should revoke object URLs on unmount', () => {
      const mockFiles = [
        new File(['content1'], 'test1.png', { type: 'image/png' }),
        new File(['content2'], 'test2.jpg', { type: 'image/jpeg' }),
      ];

      const { unmount } = render(<ScreenshotPreview {...defaultProps} screenshots={mockFiles} />);

      unmount();

      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('mock-url');
    });

    it('should revoke old URLs when screenshots change', () => {
      const initialFiles = [new File(['content1'], 'test1.png', { type: 'image/png' })];
      const newFiles = [new File(['content2'], 'test2.png', { type: 'image/png' })];

      const { rerender } = render(<ScreenshotPreview {...defaultProps} screenshots={initialFiles} />);

      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);

      rerender(<ScreenshotPreview {...defaultProps} screenshots={newFiles} />);

      // Should revoke old URL and create new one
      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
      expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    });
  });

  describe('File Removal', () => {
    it('should call onRemove with correct index when remove button is clicked', () => {
      const mockFiles = [
        new File(['content1'], 'test1.png', { type: 'image/png' }),
        new File(['content2'], 'test2.jpg', { type: 'image/jpeg' }),
        new File(['content3'], 'test3.gif', { type: 'image/gif' }),
      ];

      render(<ScreenshotPreview {...defaultProps} screenshots={mockFiles} />);

      const removeButtons = screen.getAllByLabelText(/Remove/);
      expect(removeButtons).toHaveLength(3);

      // Click remove button for second file
      fireEvent.click(removeButtons[1]);

      expect(mockOnRemove).toHaveBeenCalledTimes(1);
      expect(mockOnRemove).toHaveBeenCalledWith(1);
    });

    it('should have accessible remove button labels', () => {
      const mockFiles = [
        new File(['content1'], 'test1.png', { type: 'image/png' }),
        new File(['content2'], 'test2.jpg', { type: 'image/jpeg' }),
      ];

      render(<ScreenshotPreview {...defaultProps} screenshots={mockFiles} />);

      expect(screen.getByLabelText('Remove test1.png')).toBeInTheDocument();
      expect(screen.getByLabelText('Remove test2.jpg')).toBeInTheDocument();
    });

    it('should remove the correct file when multiple files exist', () => {
      const mockFiles = [
        new File(['content1'], 'first.png', { type: 'image/png' }),
        new File(['content2'], 'second.png', { type: 'image/png' }),
        new File(['content3'], 'third.png', { type: 'image/png' }),
      ];

      render(<ScreenshotPreview {...defaultProps} screenshots={mockFiles} />);

      const removeFirstButton = screen.getByLabelText('Remove first.png');
      fireEvent.click(removeFirstButton);

      expect(mockOnRemove).toHaveBeenCalledWith(0);

      jest.clearAllMocks();

      const removeThirdButton = screen.getByLabelText('Remove third.png');
      fireEvent.click(removeThirdButton);

      expect(mockOnRemove).toHaveBeenCalledWith(2);
    });
  });

  describe('Screenshot Order', () => {
    it('should maintain screenshot order as provided', () => {
      const mockFiles = [
        new File(['content1'], 'first.png', { type: 'image/png' }),
        new File(['content2'], 'second.png', { type: 'image/png' }),
        new File(['content3'], 'third.png', { type: 'image/png' }),
      ];

      render(<ScreenshotPreview {...defaultProps} screenshots={mockFiles} />);

      const filenames = screen.getAllByText(/\.png$/);
      expect(filenames[0]).toHaveTextContent('first.png');
      expect(filenames[1]).toHaveTextContent('second.png');
      expect(filenames[2]).toHaveTextContent('third.png');
    });
  });

  describe('Long Filename Handling', () => {
    it('should truncate long filenames with title attribute', () => {
      const longFilename = 'this-is-a-very-long-filename-that-should-be-truncated-properly.png';
      const mockFile = new File(['content'], longFilename, { type: 'image/png' });

      render(<ScreenshotPreview {...defaultProps} screenshots={[mockFile]} />);

      const filenameElement = screen.getByText(longFilename);
      expect(filenameElement).toHaveClass('truncate');
      expect(filenameElement).toHaveAttribute('title', longFilename);
    });
  });

  describe('Image Error Handling', () => {
    it('should handle image load errors gracefully', () => {
      const mockFile = new File(['content'], 'test.png', { type: 'image/png' });

      render(<ScreenshotPreview {...defaultProps} screenshots={[mockFile]} />);

      const img = screen.getByAltText('test.png');

      // Simulate image load error
      fireEvent.error(img);

      // Component should still render without crashing
      expect(screen.getByText('test.png')).toBeInTheDocument();
    });
  });

  describe('Multiple Screenshots Display', () => {
    it('should display all screenshots in a grid layout', () => {
      const mockFiles = Array.from({ length: 5 }, (_, i) =>
        new File([`content${i}`], `test${i}.png`, { type: 'image/png' })
      );

      render(<ScreenshotPreview {...defaultProps} screenshots={mockFiles} />);

      mockFiles.forEach((file) => {
        expect(screen.getByText(file.name)).toBeInTheDocument();
      });
    });

    it('should handle single screenshot', () => {
      const mockFile = new File(['content'], 'single.png', { type: 'image/png' });

      render(<ScreenshotPreview {...defaultProps} screenshots={[mockFile]} />);

      expect(screen.getByText('single.png')).toBeInTheDocument();
      expect(screen.getByText('Selected Screenshots')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible image alt text', () => {
      const mockFiles = [
        new File(['content1'], 'screenshot1.png', { type: 'image/png' }),
        new File(['content2'], 'screenshot2.jpg', { type: 'image/jpeg' }),
      ];

      render(<ScreenshotPreview {...defaultProps} screenshots={mockFiles} />);

      expect(screen.getByAltText('screenshot1.png')).toBeInTheDocument();
      expect(screen.getByAltText('screenshot2.jpg')).toBeInTheDocument();
    });

    it('should have accessible remove buttons', () => {
      const mockFile = new File(['content'], 'test.png', { type: 'image/png' });

      render(<ScreenshotPreview {...defaultProps} screenshots={[mockFile]} />);

      const removeButton = screen.getByLabelText('Remove test.png');
      expect(removeButton).toHaveAttribute('type', 'button');
    });
  });
});
