import { CheckCircle2, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function RowActions({
  onEdit,
  onDelete,
  onClose,
}: {
  onEdit: () => void;
  onDelete: () => void;
  onClose?: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="פעולות">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        <DropdownMenuItem onSelect={onEdit} className="gap-2 py-3">
          <Pencil className="h-4 w-4" /> עריכה
        </DropdownMenuItem>
        {onClose && (
          <DropdownMenuItem onSelect={onClose} className="gap-2 py-3">
            <CheckCircle2 className="h-4 w-4" /> סגור פוזיציה
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={onDelete} className="gap-2 py-3 text-loss focus:text-loss">
          <Trash2 className="h-4 w-4" /> מחיקה
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
