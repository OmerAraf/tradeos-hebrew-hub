import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useTrades } from "@/lib/use-trades";
import { deleteTrade, newId, upsertTrade } from "@/lib/trade-store";
import { fmtMoney, pnl, rMultiple, type Direction, type Strategy, type Trade } from "@/lib/trade-types";
import { GlassCard, PageHeader } from "@/components/ui-blocks";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/trades")({
  head: () => ({
    meta: [
      { title: "יומן עסקאות — TRADE·OS 2050" },
      { name: "description", content: "רשימת העסקאות שלך עם סינון, עריכה ותוספת" },
    ],
  }),
  component: TradesPage,
});

type SortKey = "entryDate" | "symbol" | "pnl";

function TradesPage() {
  const trades = useTrades();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [dirFilter, setDirFilter] = useState<string>("all");
  const [stratFilter, setStratFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("entryDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [editing, setEditing] = useState<Trade | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);


  const openTrades = useMemo(
    () => trades.filter((t) => !t.exitDate || t.exitPrice == null),
    [trades],
  );
  const closedTrades = useMemo(
    () => trades.filter((t) => !!t.exitDate && t.exitPrice != null),
    [trades],
  );

  const filtered = useMemo(() => {
    let out = [...closedTrades];
    if (q) out = out.filter((t) => t.symbol.toLowerCase().includes(q.toLowerCase()));
    if (dirFilter !== "all") out = out.filter((t) => t.direction === dirFilter);
    if (stratFilter !== "all") out = out.filter((t) => t.strategy === stratFilter);
    if (dateFrom) out = out.filter((t) => t.entryDate >= dateFrom);
    if (dateTo) out = out.filter((t) => t.entryDate <= dateTo + "T23:59:59Z");
    out.sort((a, b) => {
      let av: number | string, bv: number | string;
      if (sortKey === "pnl") { av = pnl(a); bv = pnl(b); }
      else if (sortKey === "symbol") { av = a.symbol; bv = b.symbol; }
      else { av = a.entryDate; bv = b.entryDate; }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return out;
  }, [closedTrades, q, dirFilter, stratFilter, dateFrom, dateTo, sortKey, sortDir]);

  function openNew() {
    setEditing({
      id: newId(),
      symbol: "",
      direction: "long",
      entryDate: new Date().toISOString().slice(0, 10),
      exitDate: undefined,
      entryPrice: 0,
      exitPrice: undefined,
      quantity: 0,
      fees: 0,
      strategy: "swing",
    });
    setDialogOpen(true);
  }

  function openEdit(t: Trade) {
    setEditing({
      ...t,
      entryDate: t.entryDate.slice(0, 10),
      exitDate: t.exitDate ? t.exitDate.slice(0, 10) : undefined,
    });
    setDialogOpen(true);
  }

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  }

  return (
    <div>
      <PageHeader
        title="יומן עסקאות"
        subtitle={`${closedTrades.length} סגורות · ${openTrades.length} פתוחות`}
        actions={
          <Button onClick={openNew} className="gap-1">
            <Plus className="h-4 w-4" /> עסקה חדשה
          </Button>
        }
      />

      {openTrades.length > 0 && (
        <GlassCard className="mb-4">
          <div className="mb-3 flex items-baseline justify-between">
            <div className="text-sm font-semibold">פוזיציות פתוחות</div>
            <div className="text-xs text-muted-foreground">{openTrades.length} פוזיציות</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="p-2 text-right font-medium">סימבול</th>
                  <th className="p-2 text-right font-medium">כיוון</th>
                  <th className="p-2 text-right font-medium">תאריך כניסה</th>
                  <th className="p-2 text-right font-medium">כמות</th>
                  <th className="p-2 text-right font-medium">מחיר כניסה</th>
                  <th className="p-2 text-right font-medium">שווי עלות</th>
                  <th className="p-2 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {[...openTrades]
                  .sort((a, b) => b.entryDate.localeCompare(a.entryDate))
                  .map((t) => {
                    const cost = t.entryPrice * t.quantity;
                    return (
                      <tr key={t.id} className="border-t border-white/5 bg-[oklch(0.82_0.18_200/0.04)]">
                        <td className="p-2 font-semibold" dir="ltr">{t.symbol}</td>
                        <td className="p-2">
                          <span className={`rounded px-1.5 py-0.5 text-xs ${t.direction === "long" ? "bg-profit/20 text-profit" : "bg-loss/20 text-loss"}`}>
                            {t.direction === "long" ? "לונג" : "שורט"}
                          </span>
                        </td>
                        <td className="p-2" dir="ltr">{t.entryDate.slice(0, 10)}</td>
                        <td className="p-2" dir="ltr">{t.quantity}</td>
                        <td className="p-2" dir="ltr">${t.entryPrice.toFixed(2)}</td>
                        <td className="p-2 font-semibold" dir="ltr">${cost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="p-2">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteId(t.id)}>
                              <Trash2 className="h-4 w-4 text-loss" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}


      <GlassCard className="mb-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div>
            <Label className="text-xs">חיפוש סימבול</Label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="AAPL" />
          </div>
          <div>
            <Label className="text-xs">כיוון</Label>
            <Select value={dirFilter} onValueChange={setDirFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                <SelectItem value="long">לונג</SelectItem>
                <SelectItem value="short">שורט</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">אסטרטגיה</Label>
            <Select value={stratFilter} onValueChange={setStratFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                <SelectItem value="swing">סווינג</SelectItem>
                <SelectItem value="long-term">לונג טרם</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">מתאריך</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">עד תאריך</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="mb-3 flex items-baseline justify-between">
          <div className="text-sm font-semibold">עסקאות סגורות</div>
          <div className="text-xs text-muted-foreground">{filtered.length} מתוך {closedTrades.length}</div>
        </div>

        {filtered.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">לא נמצאו עסקאות התואמות לסינון.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="cursor-pointer p-2 text-right font-medium" onClick={() => toggleSort("symbol")}>סימבול</th>
                  <th className="p-2 text-right font-medium">כיוון</th>
                  <th className="p-2 text-right font-medium">אסטרטגיה</th>
                  <th className="cursor-pointer p-2 text-right font-medium" onClick={() => toggleSort("entryDate")}>כניסה</th>
                  <th className="p-2 text-right font-medium">יציאה</th>
                  <th className="p-2 text-right font-medium">כמות</th>
                  <th className="p-2 text-right font-medium">מחיר כניסה</th>
                  <th className="p-2 text-right font-medium">מחיר יציאה</th>
                  <th className="cursor-pointer p-2 text-right font-medium" onClick={() => toggleSort("pnl")}>P&L</th>
                  <th className="p-2 text-right font-medium">R</th>
                  <th className="p-2 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const p = pnl(t);
                  const r = rMultiple(t);
                  return (
                    <tr
                      key={t.id}
                      className={`border-t border-white/5 ${p >= 0 ? "bg-[oklch(0.75_0.2_145/0.05)]" : "bg-[oklch(0.65_0.24_25/0.05)]"}`}
                    >
                      <td className="p-2 font-semibold" dir="ltr">{t.symbol}</td>
                      <td className="p-2">
                        <span className={`rounded px-1.5 py-0.5 text-xs ${t.direction === "long" ? "bg-profit/20 text-profit" : "bg-loss/20 text-loss"}`}>
                          {t.direction === "long" ? "לונג" : "שורט"}
                        </span>
                      </td>
                      <td className="p-2 text-xs">{t.strategy === "swing" ? "סווינג" : "לונג טרם"}</td>
                      <td className="p-2" dir="ltr">{t.entryDate.slice(0, 10)}</td>
                      <td className="p-2" dir="ltr">
                        {t.exitDate ? t.exitDate.slice(0, 10) : <span className="rounded bg-neon/20 px-1.5 py-0.5 text-xs text-neon">פתוחה</span>}
                      </td>
                      <td className="p-2" dir="ltr">{t.quantity}</td>
                      <td className="p-2" dir="ltr">${t.entryPrice.toFixed(2)}</td>
                      <td className="p-2" dir="ltr">{t.exitPrice != null ? `$${t.exitPrice.toFixed(2)}` : "—"}</td>
                      <td className={`p-2 font-semibold ${t.exitPrice == null ? "text-muted-foreground" : p >= 0 ? "text-profit" : "text-loss"}`} dir="ltr">
                        {t.exitPrice == null ? "—" : fmtMoney(p)}
                      </td>
                      <td className="p-2" dir="ltr">{r == null ? "—" : r.toFixed(2)}</td>
                      <td className="p-2">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(t.id)}>
                            <Trash2 className="h-4 w-4 text-loss" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <TradeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        trade={editing}
        onSave={async (t) => {
          try {
            await upsertTrade(t);
            toast.success("העסקה נשמרה");
            setDialogOpen(false);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "שמירה נכשלה");
          }
        }}
      />

      <AlertDialog open={deleteId != null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק את העסקה?</AlertDialogTitle>
            <AlertDialogDescription>פעולה זו אינה הפיכה.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const id = deleteId;
                setDeleteId(null);
                if (id) {
                  try {
                    await deleteTrade(id);
                    toast.success("העסקה נמחקה");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "מחיקה נכשלה");
                  }
                }
              }}
            >
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TradeDialog({
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
