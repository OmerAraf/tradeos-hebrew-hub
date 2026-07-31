import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Layers } from "lucide-react";
import { useTrades } from "@/lib/use-trades";
import { deleteTrade, upsertTrade } from "@/lib/trade-store";
import type { Trade } from "@/lib/trade-types";
import { GlassCard, KpiCard, PageHeader } from "@/components/ui-blocks";
import { TradeDialog } from "@/components/trade-dialog";
import { RowActions } from "@/components/row-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

export const Route = createFileRoute("/_authenticated/open")({
  head: () => ({
    meta: [
      { title: "עסקאות בעבודה — TRADE·OS 2050" },
      { name: "description", content: "פוזיציות פתוחות מקובצות לפי סימבול עם מחיר ממוצע משוקלל" },
    ],
  }),
  component: OpenPage,
});

interface Position {
  key: string;
  symbol: string;
  direction: Trade["direction"];
  lots: Trade[];
  quantity: number;
  costBasis: number;
  avgPrice: number;
  firstEntry: string;
}

const money = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function OpenPage() {
  const trades = useTrades();
  const openTrades = useMemo(
    () => trades.filter((t) => !t.exitDate || t.exitPrice == null),
    [trades],
  );

  const positions = useMemo<Position[]>(() => {
    const map = new Map<string, Trade[]>();
    for (const t of openTrades) {
      const key = `${t.symbol}|${t.direction}`;
      const arr = map.get(key);
      if (arr) arr.push(t);
      else map.set(key, [t]);
    }
    return [...map.entries()]
      .map(([key, lots]) => {
        const quantity = lots.reduce((s, t) => s + t.quantity, 0);
        const costBasis = lots.reduce((s, t) => s + t.quantity * t.entryPrice, 0);
        return {
          key,
          symbol: lots[0].symbol,
          direction: lots[0].direction,
          lots: [...lots].sort((a, b) => a.entryDate.localeCompare(b.entryDate)),
          quantity,
          costBasis,
          avgPrice: quantity > 0 ? costBasis / quantity : 0,
          firstEntry: lots.reduce(
            (min, t) => (t.entryDate < min ? t.entryDate : min),
            lots[0].entryDate,
          ),
        };
      })
      .sort((a, b) => b.costBasis - a.costBasis);
  }, [openTrades]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<Trade | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [closingGroup, setClosingGroup] = useState<Position | null>(null);
  const [groupExitDate, setGroupExitDate] = useState("");
  const [groupExitPrice, setGroupExitPrice] = useState("");
  const [busy, setBusy] = useState(false);

  function openEdit(t: Trade, prefillClose = false) {
    setEditing({
      ...t,
      entryDate: t.entryDate.slice(0, 10),
      exitDate: prefillClose
        ? new Date().toISOString().slice(0, 10)
        : t.exitDate
          ? t.exitDate.slice(0, 10)
          : undefined,
    });
    setDialogOpen(true);
  }

  const totalCost = useMemo(
    () => positions.reduce((s, p) => s + p.costBasis, 0),
    [positions],
  );

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash) {
      history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  async function confirmGroupClose() {
    if (!closingGroup) return;
    const price = Number(groupExitPrice);
    if (!groupExitDate) return toast.error("יש לבחור תאריך יציאה");
    if (!(price > 0)) return toast.error("מחיר יציאה חייב להיות חיובי");
    setBusy(true);
    try {
      for (const lot of closingGroup.lots) {
        await upsertTrade({
          ...lot,
          exitDate: groupExitDate + "T20:00:00Z",
          exitPrice: price,
        });
      }
      toast.success(`הפוזיציה ב-${closingGroup.symbol} נסגרה`);
      setClosingGroup(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "סגירה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="עסקאות בעבודה" subtitle="פוזיציות פתוחות מקובצות לפי סימבול" />

      {positions.length === 0 ? (
        <GlassCard className="text-center">
          <p className="text-muted-foreground">אין כרגע פוזיציות פתוחות.</p>
        </GlassCard>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
            <KpiCard label="פוזיציות פתוחות" value={positions.length} tone="accent" />
            <KpiCard label="סך כניסות" value={openTrades.length} />
            <KpiCard label="שווי עלות כולל" value={money(totalCost)} />
          </div>

          <div className="space-y-3">
            {positions.map((p) => {
              const isOpen = !!expanded[p.key];
              return (
                <GlassCard key={p.key} className="p-0">
                  <button
                    type="button"
                    onClick={() => setExpanded((s) => ({ ...s, [p.key]: !s[p.key] }))}
                    aria-expanded={isOpen}
                    className="flex w-full min-h-[44px] flex-col gap-3 rounded-2xl p-4 text-right transition active:scale-[0.99] md:p-5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold tracking-tight text-foreground md:text-3xl" dir="ltr">
                        {p.symbol}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${p.direction === "long" ? "bg-profit/20 text-profit" : "bg-loss/20 text-loss"}`}
                      >
                        {p.direction === "long" ? "לונג" : "שורט"}
                      </span>
                      {p.lots.length > 1 && (
                        <span className="flex items-center gap-1 rounded bg-neon/15 px-1.5 py-0.5 text-xs text-neon">
                          <Layers className="h-3 w-3" />
                          {p.lots.length} כניסות
                        </span>
                      )}
                      <ChevronDown
                        className={`ms-auto h-5 w-5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      <div>
                        <div className="text-xs text-muted-foreground">כמות</div>
                        <div className="font-semibold" dir="ltr">
                          {p.quantity.toLocaleString("en-US")}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">מחיר ממוצע</div>
                        <div className="font-semibold" dir="ltr">
                          ${p.avgPrice.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">שווי עלות</div>
                        <div className="font-semibold" dir="ltr">
                          {money(p.costBasis)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">כניסה ראשונה</div>
                        <div className="font-semibold" dir="ltr">
                          {p.firstEntry.slice(0, 10)}
                        </div>
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-white/5 px-4 pb-4 md:px-5 md:pb-5">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[420px] text-sm">
                          <thead>
                            <tr className="text-muted-foreground">
                              <th className="p-2 text-right font-medium">תאריך כניסה</th>
                              <th className="p-2 text-right font-medium">כמות</th>
                              <th className="p-2 text-right font-medium">מחיר כניסה</th>
                              <th className="p-2 text-right font-medium"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {p.lots.map((t) => (
                              <tr key={t.id} className="border-t border-white/5">
                                <td className="p-2" dir="ltr">{t.entryDate.slice(0, 10)}</td>
                                <td className="p-2" dir="ltr">{t.quantity.toLocaleString("en-US")}</td>
                                <td className="p-2" dir="ltr">${t.entryPrice.toFixed(2)}</td>
                                <td className="p-2">
                                  <RowActions
                                    onEdit={() => openEdit(t)}
                                    onClose={() => openEdit(t, true)}
                                    onDelete={() => setDeleteId(t.id)}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <Button
                        variant="outline"
                        className="mt-3 w-full"
                        onClick={() => {
                          setGroupExitDate(new Date().toISOString().slice(0, 10));
                          setGroupExitPrice("");
                          setClosingGroup(p);
                        }}
                      >
                        סגור את כל הפוזיציה
                      </Button>
                    </div>
                  )}
                </GlassCard>
              );
            })}
          </div>
        </>
      )}

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

      <Dialog open={closingGroup != null} onOpenChange={(o) => !o && setClosingGroup(null)}>
        <DialogContent className="glass-strong sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>לסגור את כל הפוזיציה?</DialogTitle>
            <DialogDescription>
              {closingGroup
                ? `${closingGroup.symbol} · ${closingGroup.quantity.toLocaleString("en-US")} יחידות · ${closingGroup.lots.length} כניסות ייסגרו במחיר אחיד.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>תאריך יציאה</Label>
              <Input type="date" value={groupExitDate} onChange={(e) => setGroupExitDate(e.target.value)} />
            </div>
            <div>
              <Label>מחיר יציאה</Label>
              <Input
                type="number"
                step="0.01"
                value={groupExitPrice}
                onChange={(e) => setGroupExitPrice(e.target.value)}
                dir="ltr"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClosingGroup(null)}>ביטול</Button>
            <Button onClick={confirmGroupClose} disabled={busy}>
              {busy ? "סוגר…" : "סגור פוזיציה"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
