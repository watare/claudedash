/**
 * ConfirmKillDialog component - confirmation dialog before killing an agent
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ConfirmKillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  storyId: string;
  onConfirm: () => void;
  isKilling?: boolean;
}

export function ConfirmKillDialog({
  open,
  onOpenChange,
  storyId,
  onConfirm,
  isKilling,
}: ConfirmKillDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="confirm-kill-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Kill Agent?</AlertDialogTitle>
          <AlertDialogDescription>
            Kill agent working on Story {storyId}? The story will need to be retried.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isKilling} data-testid="kill-dialog-cancel">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-[#F6465D] hover:bg-[#F6465D]/90 text-white"
            onClick={onConfirm}
            disabled={isKilling}
            data-testid="kill-dialog-confirm"
          >
            {isKilling ? 'Killing...' : 'Kill Agent'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
