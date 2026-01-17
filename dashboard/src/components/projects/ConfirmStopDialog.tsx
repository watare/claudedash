/**
 * ConfirmStopDialog component - confirmation dialog before stopping a workflow
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

interface ConfirmStopDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  onConfirm: () => void;
  isStopping?: boolean;
}

export function ConfirmStopDialog({
  open,
  onOpenChange,
  projectName,
  onConfirm,
  isStopping,
}: ConfirmStopDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="confirm-stop-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Stop Workflow?</AlertDialogTitle>
          <AlertDialogDescription>
            Stop orchestration for {projectName}? Any running agents will be terminated and in-progress stories may need to be retried.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isStopping} data-testid="stop-dialog-cancel">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-[#F6465D] hover:bg-[#F6465D]/90 text-white"
            onClick={onConfirm}
            disabled={isStopping}
            data-testid="stop-dialog-confirm"
          >
            {isStopping ? 'Stopping...' : 'Stop Workflow'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
