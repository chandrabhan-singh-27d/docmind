'use client';

import { useCallback, useState } from 'react';
import type { DragEvent, ChangeEvent } from 'react';

interface UploadedDoc {
  readonly id: string;
  readonly filename: string;
  readonly totalChunks: number;
}

interface UploadState {
  readonly status: 'idle' | 'uploading' | 'success' | 'error';
  readonly message: string;
  readonly document: UploadedDoc | null;
}

const INITIAL_STATE: UploadState = {
  status: 'idle',
  message: '',
  document: null,
};

const ACCEPTED_TYPES = '.pdf,.txt,.md';

const uploadFile = async (file: File): Promise<UploadedDoc> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/documents', {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message ?? 'Upload failed');
  }

  return data.document as UploadedDoc;
};

export default function UploadDropzone({
  onUploadComplete,
}: {
  readonly onUploadComplete?: (doc: UploadedDoc) => void;
}) {
  const [state, setState] = useState<UploadState>(INITIAL_STATE);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setState({ status: 'uploading', message: `Uploading ${file.name}...`, document: null });

      try {
        const doc = await uploadFile(file);
        setState({
          status: 'success',
          message: `${doc.filename} uploaded (${doc.totalChunks} chunks)`,
          document: doc,
        });
        onUploadComplete?.(doc);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Upload failed';
        setState({ status: 'error', message, document: null });
      }
    },
    [onUploadComplete],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const borderColor = isDragOver
    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
    : state.status === 'error'
      ? 'border-red-400'
      : state.status === 'success'
        ? 'border-green-400'
        : 'border-zinc-300 dark:border-zinc-700';

  return (
    <div
      data-testid="upload-dropzone"
      className={`relative rounded-lg border-2 border-dashed p-6 text-center transition-colors sm:p-8 ${borderColor}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept={ACCEPTED_TYPES}
        onChange={handleChange}
        className="absolute inset-0 cursor-pointer opacity-0"
        disabled={state.status === 'uploading'}
      />

      <div className="space-y-2">
        <p className="text-base font-medium text-zinc-700 dark:text-zinc-300">
          {state.status === 'uploading'
            ? 'Processing...'
            : 'Drop a document here or click to upload'}
        </p>
        <p className="text-sm text-zinc-500">PDF, TXT, or Markdown (max 20MB)</p>
      </div>

      {state.message && (
        <p
          className={`mt-3 text-base ${
            state.status === 'error'
              ? 'text-red-600'
              : state.status === 'success'
                ? 'text-green-600'
                : 'text-zinc-500'
          }`}
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
