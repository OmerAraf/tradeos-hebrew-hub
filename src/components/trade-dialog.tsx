import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Direction, Strategy, Trade } from "@/lib/trade-types";

export function TradeDialog({
  open,
  onOpenChange,
  trade,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  trade: Trade | null;
  onSave: (t: Trade) => void;
}) {
  const [form, setForm] = useState<Trade | null>(trade);
  useEffect(() => setForm(trade), [trade]);

  if (!form) return null;

  const set = <K extends keyof Trade>(k: K, v: Trade[K]) => setForm({ ...form, [k]: v });

  function submit() {
    if (!form) return;
    if (!form.symbol.trim()) return toast.error("חסר סימבול");
    if (form.quantity <= 0) return toast.error("כמות חייבת להיות חיובית");
    if (form.entryPrice <= 0) return toast.error("מחיר כניסה חייב להיות חיובי");
    const hasExitDate = !!form.exitDate;
    const hasExitPrice = form.exitPrice != null && !Number.isNaN(form.exitPrice) && form.exitPrice > 0;
    if (hasExitDate !== hasExitPrice) {
      return toast.error("להשלמת סגירה יש למלא גם תאריך יציאה וגם מחיר יציאה");
    }
    if (hasExitDate && form.exitDate && form.entryDate > form.exitDate) {
      return toast.error("תאריך יציאה לפני תאריך כניסה");
    }
    const normalized: Trade = {
      ...form,
      symbol: form.symbol.toUpperCase().trim(),
      entryDate: form.entryDate.length === 10 ? form.entryDate + "T14:30:00Z" : form.entryDate,
      exitDate: hasExitDate && form.exitDate
        ? (form.exitDate.length === 10 ? form.exitDate + "T20:00:00Z" : form.exitDate)
        : undefined,
      exitPrice: hasExitPrice ? form.exitPrice : undefined,
    };
    onSave(normalized);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{trade && form.symbol ? "עריכת עסקה" : "עסקה חדשה"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>סימבול</Label>
            <Input value={form.symbol} onChange={(e) => set("symbol", e.target.value)} placeholder="AAPL" dir="ltr" />
          </div>
          <div>
            <Label>כיוון</Label>
            <Select value={form.direction} onValueChange={(v) => set("direction", v as Direction)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="long">לונג</SelectItem>
                <SelectItem value="short">שורט</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>אסטרטגיה</Label>
            <Select value={form.strategy} onValueChange={(v) => set("strategy", v as Strategy)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="swing">סווינג</SelectItem>
                <SelectItem value="long-term">לונג טרם</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>תאריך כניסה</Label>
            <Input type="date" value={form.entryDate.slice(0, 10)} onChange={(e) => set("entryDate", e.target.value)} />
          </div>
          <div>
            <Label>תאריך יציאה <span className="text-xs text-muted-foreground">(רשות — השאר ריק לפוזיציה פתוחה)</span></Label>
            <Input
              type="date"
              value={form.exitDate ? form.exitDate.slice(0, 10) : ""}
              onChange={(e) => set("exitDate", e.target.value || undefined)}
            />
          </div>
          <div>
            <Label>מחיר כניסה</Label>
            <Input type="number" step="0.01" value={form.entryPrice} onChange={(e) => set("entryPrice", +e.target.value)} dir="ltr" />
          </div>
          <div>
            <Label>מחיר יציאה <span className="text-xs text-muted-foreground">(רשות)</span></Label>
            <Input
              type="number"
              step="0.01"
              value={form.exitPrice ?? ""}
              onChange={(e) => set("exitPrice", e.target.value === "" ? undefined : +e.target.value)}
              dir="ltr"
            />
          </div>
          <div>
            <Label>כמות</Label>
            <Input type="number" step="1" value={form.quantity} onChange={(e) => set("quantity", +e.target.value)} dir="ltr" />
          </div>
          <div>
            <Label>עמלות</Label>
            <Input type="number" step="0.01" value={form.fees} onChange={(e) => set("fees", +e.target.value)} dir="ltr" />
          </div>
          <div className="col-span-2">
            <Label>סטופ (אופציונלי)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.stopPrice ?? ""}
              onChange={(e) => set("stopPrice", e.target.value === "" ? undefined : +e.target.value)}
              dir="ltr"
            />
          </div>
          <div className="col-span-2">
            <Label>הערות</Label>
            <Textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button onClick={submit}>שמירה</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
