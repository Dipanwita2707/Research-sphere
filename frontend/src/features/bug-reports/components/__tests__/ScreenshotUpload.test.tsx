import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ScreenshotUpload } from '../ScreenshotUpload';

describe('ScreenshotUpload', () => {
  const mockOnScreenshotsChange = jest.fn();
  const defaultProps = {
    screenshots: [],
    onScreenshotsChange: mockOnScreenshotsChange,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the upload component with default text', () => {
      render(<ScreenshotUpload {...defaultProps} />);

      expect(screen.getByText(/drag and drop screenshots here/i)).toBeInTheDocument();
      expect(screen.getByText(/or click to browse/i)).toBeInTheDocument();
    });

    it('should display file type and size limits', () => {
      render(<ScreenshotUpload {...defaultProps} />);

      expect(screen.getByText(/PNG, JPEG, JPG, GIF, WEBP/i)).toBeInTheDocument();
      expect(screen.getByText(/Max 5MB per file/i)).toBeInTheDocument();
      expect(screen.getByText(/Up to 5 files/i)).toBeInTheDocument();
    });

    it('should display custom limits when provided', () => {
      render(
        <ScreenshotUpload
          {...defaultProps}
          maxFiles={3}
          maxFileSize={2 * 1024 * 1024}
          acceptedTypes={['image/png', 'image/jpeg']}
        />
      );

      expect(screen.getByText(/PNG, JPEG/i)).toBeInTheDocument();
      expect(screen.getByText(/Max 2MB per file/i)).toBeInTheDocument();
      expect(screen.getByText(/Up to 3 files/i)).toBeInTheDocument();
    });

    it('should display screenshot count when files are selected', () => {
      const mockFiles = [
        new File(['content'], 'test1.png', { type: 'image/png' }),
        new File(['content'], 'test2.png', { type: 'image/png' }),
      ];

      render(<ScreenshotUpload {...defaultProps} screenshots={mockFiles} />);

      expect(screen.getByText('2 / 5')).toBeInTheDocument();
      expect(screen.getByText('2 screenshots selected')).toBeInTheDocument();
    });
  });

  describe('File Type Validation', () => {
    it('should accept valid image file types', async () => {
      render(<ScreenshotUpload {...defaultProps} />);

      const validFile = new File(['content'], 'test.png', { type: 'image/png' });
      const input = screen.getByLabelText(/upload screenshots/i) as HTMLInputElement;

      Object.defineProperty(input, 'files', {
        value: [validFile],
        writable: false,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(mockOnScreenshotsChange).toHaveBeenCalledWith([validFile]);
      });
    });

    it('should reject invalid file types', async () => {
      render(<ScreenshotUpload {...defaultProps} />);

      const invalidFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      const input = screen.getByLabelText(/upload screenshots/i) as HTMLInputElement;

      Object.defineProperty(input, 'files', {
        value: [invalidFile],
        writable: false,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByText(/Invalid file type/i)).toBeInTheDocument();
        expect(mockOnScreenshotsChange).not.toHaveBeenCalled();
      });
    });

    it('should accept all default image types', async () => {
      const imageTypes = [
        { name: 'test.png', type: 'image/png' },
        { name: 'test.jpg', type: 'image/jpeg' },
        { name: 'test.jpeg', type: 'image/jpg' },
        { name: 'test.gif', type: 'image/gif' },
        { name: 'test.webp', type: 'image/webp' },
      ];

      for (const imageType of imageTypes) {
        jest.clearAllMocks();
        const { unmount } = render(<ScreenshotUpload {...defaultProps} />);

        const validFile = new File(['content'], imageType.name, { type: imageType.type });
        const input = screen.getByLabelText(/upload screenshots/i) as HTMLInputElement;

        Object.defineProperty(input, 'files', {
          value: [validFile],
          writable: false,
        });

        fireEvent.change(input);

        await waitFor(() => {
          expect(mockOnScreenshotsChange).toHaveBeenCalledWith([validFile]);
        });

        unmount();
      }
    });
  });

  describe('File Size Validation', () => {
    it('should accept files within size limit', async () => {
      render(<ScreenshotUpload {...defaultProps} />);

      const validFile = new File(['x'.repeat(1024 * 1024)], 'test.png', { type: 'image/png' }); // 1MB
      const input = screen.getByLabelText(/upload screenshots/i) as HTMLInputElement;

      Object.defineProperty(input, 'files', {
        value: [validFile],
        writable: false,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(mockOnScreenshotsChange).toHaveBeenCalledWith([validFile]);
      });
    });

    it('should reject files exceeding size limit', async () => {
      render(<ScreenshotUpload {...defaultProps} />);

      const oversizedFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.png', {
        type: 'image/png',
      }); // 6MB
      const input = screen.getByLabelText(/upload screenshots/i) as HTMLInputElement;

      Object.defineProperty(input, 'files', {
        value: [oversizedFile],
        writable: false,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByText(/File size must not exceed 5MB/i)).toBeInTheDocument();
        expect(mockOnScreenshotsChange).not.toHaveBeenCalled();
      });
    });

    it('should respect custom size limit', async () => {
      const customMaxSize = 2 * 1024 * 1024; // 2MB
      render(<ScreenshotUpload {...defaultProps} maxFileSize={customMaxSize} />);

      const oversizedFile = new File(['x'.repeat(3 * 1024 * 1024)], 'large.png', {
        type: 'image/png',
      }); // 3MB
      const input = screen.getByLabelText(/upload screenshots/i) as HTMLInputElement;

      Object.defineProperty(input, 'files', {
        value: [oversizedFile],
        writable: false,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByText(/File size must not exceed 2MB/i)).toBeInTheDocument();
        expect(mockOnScreenshotsChange).not.toHaveBeenCalled();
      });
    });
  });

  describe('Maximum File Count Validation', () => {
    it('should accept files up to maximum count', async () => {
      render(<ScreenshotUpload {...defaultProps} />);

      const files = Array.from({ length: 5 }, (_, i) =>
        new File(['content'], `test${i}.png`, { type: 'image/png' })
      );
      const input = screen.getByLabelText(/upload screenshots/i) as HTMLInputElement;

      Object.defineProperty(input, 'files', {
        value: files,
        writable: false,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(mockOnScreenshotsChange).toHaveBeenCalledWith(files);
      });
    });

    it('should reject files exceeding maximum count', async () => {
      render(<ScreenshotUpload {...defaultProps} />);

      const files = Array.from({ length: 6 }, (_, i) =>
        new File(['content'], `test${i}.png`, { type: 'image/png' })
      );
      const input = screen.getByLabelText(/upload screenshots/i) as HTMLInputElement;

      Object.defineProperty(input, 'files', {
        value: files,
        writable: false,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByText(/You can upload a maximum of 5 screenshots/i)).toBeInTheDocument();
        expect(mockOnScreenshotsChange).not.toHaveBeenCalled();
      });
    });

    it('should prevent adding files when already at maximum', async () => {
      const existingFiles = Array.from({ length: 5 }, (_, i) =>
        new File(['content'], `existing${i}.png`, { type: 'image/png' })
      );

      render(<ScreenshotUpload {...defaultProps} screenshots={existingFiles} />);

      const newFile = new File(['content'], 'new.png', { type: 'image/png' });
      const input = screen.getByLabelText(/upload screenshots/i) as HTMLInputElement;

      Object.defineProperty(input, 'files', {
        value: [newFile],
        writable: false,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByText(/You can upload a maximum of 5 screenshots/i)).toBeInTheDocument();
        expect(mockOnScreenshotsChange).not.toHaveBeenCalled();
      });
    });

    it('should allow adding files when below maximum', async () => {
      const existingFiles = Array.from({ length: 3 }, (_, i) =>
        new File(['content'], `existing${i}.png`, { type: 'image/png' })
      );

      render(<ScreenshotUpload {...defaultProps} screenshots={existingFiles} />);

      const newFiles = [
        new File(['content'], 'new1.png', { type: 'image/png' }),
        new File(['content'], 'new2.png', { type: 'image/png' }),
      ];
      const input = screen.getByLabelText(/upload screenshots/i) as HTMLInputElement;

      Object.defineProperty(input, 'files', {
        value: newFiles,
        writable: false,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(mockOnScreenshotsChange).toHaveBeenCalledWith([...existingFiles, ...newFiles]);
      });
    });

    it('should respect custom maximum file count', async () => {
      render(<ScreenshotUpload {...defaultProps} maxFiles={3} />);

      const files = Array.from({ length: 4 }, (_, i) =>
        new File(['content'], `test${i}.png`, { type: 'image/png' })
      );
      const input = screen.getByLabelText(/upload screenshots/i) as HTMLInputElement;

      Object.defineProperty(input, 'files', {
        value: files,
        writable: false,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByText(/You can upload a maximum of 3 screenshots/i)).toBeInTheDocument();
        expect(mockOnScreenshotsChange).not.toHaveBeenCalled();
      });
    });
  });

  describe('Drag and Drop Functionality', () => {
    it('should handle drag enter event', () => {
      render(<ScreenshotUpload {...defaultProps} />);

      const dropzone = screen.getByText(/drag and drop screenshots here/i).closest('div');
      expect(dropzone).toBeInTheDocument();

      fireEvent.dragEnter(dropzone!);

      expect(screen.getByText(/Drop screenshots here/i)).toBeInTheDocument();
    });

    it('should handle drag leave event', () => {
      render(<ScreenshotUpload {...defaultProps} />);

      const dropzone = screen.getByText(/drag and drop screenshots here/i).closest('div');

      fireEvent.dragEnter(dropzone!);
      expect(screen.getByText(/Drop screenshots here/i)).toBeInTheDocument();

      fireEvent.dragLeave(dropzone!);
      expect(screen.getByText(/Drag and drop screenshots here/i)).toBeInTheDocument();
    });

    it('should handle file drop', async () => {
      render(<ScreenshotUpload {...defaultProps} />);

      const dropzone = screen.getByText(/drag and drop screenshots here/i).closest('div');
      const file = new File(['content'], 'dropped.png', { type: 'image/png' });

      const dropEvent = new Event('drop', { bubbles: true }) as any;
      dropEvent.dataTransfer = {
        files: [file],
      };

      fireEvent(dropzone!, dropEvent);

      await waitFor(() => {
        expect(mockOnScreenshotsChange).toHaveBeenCalledWith([file]);
      });
    });

    it('should validate dropped files', async () => {
      render(<ScreenshotUpload {...defaultProps} />);

      const dropzone = screen.getByText(/drag and drop screenshots here/i).closest('div');
      const invalidFile = new File(['content'], 'dropped.txt', { type: 'text/plain' });

      const dropEvent = new Event('drop', { bubbles: true }) as any;
      dropEvent.dataTransfer = {
        files: [invalidFile],
      };

      fireEvent(dropzone!, dropEvent);

      await waitFor(() => {
        expect(screen.getByText(/Invalid file type/i)).toBeInTheDocument();
        expect(mockOnScreenshotsChange).not.toHaveBeenCalled();
      });
    });

    it('should reset dragging state after drop', async () => {
      render(<ScreenshotUpload {...defaultProps} />);

      const dropzone = screen.getByText(/drag and drop screenshots here/i).closest('div');
      const file = new File(['content'], 'dropped.png', { type: 'image/png' });

      fireEvent.dragEnter(dropzone!);
      expect(screen.getByText(/Drop screenshots here/i)).toBeInTheDocument();

      const dropEvent = new Event('drop', { bubbles: true }) as any;
      dropEvent.dataTransfer = {
        files: [file],
      };

      fireEvent(dropzone!, dropEvent);

      await waitFor(() => {
        expect(screen.getByText(/Drag and drop screenshots here/i)).toBeInTheDocument();
      });
    });
  });

  describe('Click to Browse', () => {
    it('should open file dialog when clicking the dropzone', () => {
      render(<ScreenshotUpload {...defaultProps} />);

      const dropzone = screen.getByText(/drag and drop screenshots here/i).closest('div');
      const input = screen.getByLabelText(/upload screenshots/i) as HTMLInputElement;

      const clickSpy = jest.spyOn(input, 'click');

      fireEvent.click(dropzone!);

      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe('Error Display', () => {
    it('should display validation errors', async () => {
      render(<ScreenshotUpload {...defaultProps} />);

      const invalidFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      const input = screen.getByLabelText(/upload screenshots/i) as HTMLInputElement;

      Object.defineProperty(input, 'files', {
        value: [invalidFile],
        writable: false,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByText(/Invalid file type/i)).toBeInTheDocument();
      });
    });

    it('should display external errors passed as prop', () => {
      render(<ScreenshotUpload {...defaultProps} error="External error message" />);

      expect(screen.getByText('External error message')).toBeInTheDocument();
    });

    it('should prioritize external errors over validation errors', async () => {
      render(<ScreenshotUpload {...defaultProps} error="External error" />);

      const invalidFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      const input = screen.getByLabelText(/upload screenshots/i) as HTMLInputElement;

      Object.defineProperty(input, 'files', {
        value: [invalidFile],
        writable: false,
      });

      fireEvent.change(input);

      // External error should be displayed
      expect(screen.getByText('External error')).toBeInTheDocument();
    });

    it('should clear validation errors on successful file selection', async () => {
      const { unmount } = render(<ScreenshotUpload {...defaultProps} />);

      // First, trigger an error
      const invalidFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      let input = screen.getByLabelText(/upload screenshots/i) as HTMLInputElement;

      Object.defineProperty(input, 'files', {
        value: [invalidFile],
        writable: false,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByText(/Invalid file type/i)).toBeInTheDocument();
      });

      // Unmount and remount to reset the input element
      unmount();
      render(<ScreenshotUpload {...defaultProps} />);

      // Then, select a valid file
      const validFile = new File(['content'], 'test.png', { type: 'image/png' });
      input = screen.getByLabelText(/upload screenshots/i) as HTMLInputElement;

      Object.defineProperty(input, 'files', {
        value: [validFile],
        writable: false,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.queryByText(/Invalid file type/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Multiple File Selection', () => {
    it('should handle multiple valid files', async () => {
      render(<ScreenshotUpload {...defaultProps} />);

      const files = [
        new File(['content1'], 'test1.png', { type: 'image/png' }),
        new File(['content2'], 'test2.jpg', { type: 'image/jpeg' }),
        new File(['content3'], 'test3.gif', { type: 'image/gif' }),
      ];
      const input = screen.getByLabelText(/upload screenshots/i) as HTMLInputElement;

      Object.defineProperty(input, 'files', {
        value: files,
        writable: false,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(mockOnScreenshotsChange).toHaveBeenCalledWith(files);
      });
    });

    it('should reject all files if any file is invalid', async () => {
      render(<ScreenshotUpload {...defaultProps} />);

      const files = [
        new File(['content1'], 'test1.png', { type: 'image/png' }),
        new File(['content2'], 'test2.pdf', { type: 'application/pdf' }), // Invalid
        new File(['content3'], 'test3.jpg', { type: 'image/jpeg' }),
      ];
      const input = screen.getByLabelText(/upload screenshots/i) as HTMLInputElement;

      Object.defineProperty(input, 'files', {
        value: files,
        writable: false,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByText(/Invalid file type/i)).toBeInTheDocument();
        expect(mockOnScreenshotsChange).not.toHaveBeenCalled();
      });
    });
  });
});
