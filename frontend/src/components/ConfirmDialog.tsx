import React from 'react';
import { Modal } from './Modal';
import { Button } from './ui';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Usuń',
  danger = true,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      maxWidth="max-w-sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Anuluj
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} isLoading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-muted">{description}</p>
    </Modal>
  );
}
