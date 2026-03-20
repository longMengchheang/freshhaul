'use client';

import { useRef, useCallback, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  /** The trigger element (e.g. a Button). Must accept an onClick handler. */
  trigger: ReactNode;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
}

export default function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  disabled,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const openDialog = useCallback(() => {
    dialogRef.current?.showModal();
  }, []);

  const closeDialog = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  const handleConfirm = useCallback(async () => {
    closeDialog();
    await onConfirm();
  }, [closeDialog, onConfirm]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) {
        closeDialog();
      }
    },
    [closeDialog],
  );

  return (
    <>
      <span onClick={disabled ? undefined : openDialog} className="contents">
        {trigger}
      </span>
      <dialog
        ref={dialogRef}
        onClick={handleBackdropClick}
        className="m-auto max-w-md rounded-xl border border-slate-200/80 bg-white p-0 shadow-[0_20px_40px_-8px_rgba(50,50,93,0.18),0_12px_24px_-12px_rgba(0,0,0,0.1)] backdrop:bg-slate-900/15 backdrop:backdrop-blur-sm open:animate-in open:fade-in open:zoom-in-95 open:duration-150"
      >
        <div className="space-y-4 p-6 sm:p-8">
          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-950">{title}</h2>
            {description ? (
              <p className="text-sm leading-relaxed text-slate-600">{description}</p>
            ) : null}
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full px-5"
              onClick={closeDialog}
            >
              {cancelLabel}
            </Button>
            <Button
              type="button"
              variant={variant === 'destructive' ? 'destructive' : 'default'}
              size="sm"
              className="rounded-full px-5 font-bold shadow-sm"
              onClick={handleConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
