'use client';
/**
 * DocumentBodyEditor — dynamically imported to avoid SSR issues with ReactQuill.
 * Do NOT import this directly — use:
 *   const DocumentBodyEditor = dynamic(() => import('./DocumentBodyEditor'), { ssr: false });
 */

import { useRef } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ align: ['', 'center', 'right', 'justify'] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ color: [] }, { background: [] }],
    [{ size: ['small', false, 'large', 'huge'] }],
    [{ indent: '-1' }, { indent: '+1' }],
    ['clean'],
  ],
};

const FORMATS = [
  'header', 'bold', 'italic', 'underline', 'strike',
  'align', 'list', 'bullet',
  'color', 'background', 'size', 'indent',
];

interface Props {
  value: string;
  onChange: (html: string) => void;
  /** Ref that gives parent access to insertPlaceholder via quill.getEditor() */
  quillRef: React.MutableRefObject<ReactQuill | null>;
}

export default function DocumentBodyEditor({ value, onChange, quillRef }: Props) {
  return (
    <>
      <style>{`
        /* Placeholder chips inside the Quill editor */
        .ql-editor .ll-ph {
          display: inline-block;
          background: #dbeafe;
          color: #1e40af;
          border: 1px solid #93c5fd;
          border-radius: 4px;
          padding: 1px 6px;
          font-size: 0.8em;
          font-weight: 600;
          white-space: nowrap;
          line-height: 1.6;
        }
        .ql-editor .ll-ph-special {
          background: #d1fae5;
          color: #065f46;
          border-color: #6ee7b7;
        }
        .ql-editor {
          font-family: 'Times New Roman', Times, serif;
          font-size: 12pt;
          line-height: 1.8;
          min-height: 480px;
          white-space: break-spaces;
          tab-size: 8;
        }
        .ql-editor p,
        .ql-editor div {
          white-space: break-spaces;
        }
        .ql-container { border-bottom-left-radius: 6px; border-bottom-right-radius: 6px; }
        .ql-toolbar { border-top-left-radius: 6px; border-top-right-radius: 6px; }
      `}</style>
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={onChange}
        modules={MODULES}
        formats={FORMATS}
        preserveWhitespace
      />
    </>
  );
}
