import { useRef, useState } from 'react';

const MAX_MB = 20;

// Drag-and-drop or click to pick PDFs. Calls onFiles with the valid ones
// and onReject with a message for the rest.
export default function UploadDropzone({ onFiles, onReject, disabled }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handle = (fileList) => {
    const files = Array.from(fileList);
    const ok = [];
    const problems = [];
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.pdf')) problems.push(`${file.name} is not a PDF`);
      else if (file.size > MAX_MB * 1024 * 1024) problems.push(`${file.name} is larger than ${MAX_MB} MB`);
      else ok.push(file);
    }
    if (problems.length) onReject(problems.join('. '));
    if (ok.length) onFiles(ok);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current.click()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !disabled && inputRef.current.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) handle(e.dataTransfer.files);
      }}
      className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition ${
        dragging ? 'border-brand bg-brand-tint' : 'border-line-strong bg-surface hover:border-brand'
      } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <p className="font-medium text-body">Drop PDF notes here, or click to choose</p>
      <p className="mt-1 text-sm text-muted">PDFs with selectable text, up to {MAX_MB} MB each</p>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        onChange={(e) => {
          handle(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
