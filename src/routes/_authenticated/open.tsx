import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTrades } from "@/lib/use-trades";
import { deleteTrade, upsertTrade } from "@/lib/trade-store";
import type { Trade } from "@/lib/trade-types";
import { GlassCard, KpiCard, PageHeader } from "@/components/ui-blocks";
import { TradeDialog } from "@/components/trade-dialog";
import { RowActions } from "@/components/row-actions";
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
      { name: "description", content: "פוזיציות פתוחות עם עלות, כמות ופרטי כניסה" },
    ],
  }),
  component: OpenPage,
});

function OpenPage() {
  const trades = useTrades();
  const openTrades = useMemo(
    () => trades.filter((t) => !t.exitDate || t.exitPrice == null),
    [trades],
  );

  const [editing, setEditing] = useState<Trade | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function openEdit(t: Trade) {
    setEditing({
      ...t,
      entryDate: t.entryDate.slice(0, 10),
      exitDate: t.exitDate ? t.exitDate.slice(0, 10) : undefined,
    });
    setDialogOpen(true);
  }

  const totalCost = useMemo(
    () => openTrades.reduce((s, t) => s + t.entryPrice * t.quantity, 0),
    [openTrades],
  );
  const uniqSymbols = useMemo(
    () => new Set(openTrades.map((t) => t.symbol)).size,
    [openTrades],
  );

  useEffect(() => {
    // keep hash clean if navigated with one
    if (typeof window !== "undefined" && window.location.hash) {
      history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  return (
    <div>
      <PageHeader
        title="עסקאות בעבודה"
        subtitle="פוזיציות פתוחות שטרם נסגרו"
      />

      {openTrades.length === 0 ? (
        <GlassCard className="text-center">
          <p className="text-muted-foreground">אין כרגע פוזיציות פתוחות.</p>
        </GlassCard>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
            <KpiCard label="פוזיציות פתוחות" value={openTrades.length} tone="accent" />
            <KpiCard label="סימבולים ייחודיים" value={uniqSymbols} />
            <KpiCard
              label="שווי עלות כולל"
              value={`$${totalCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            />
          </div>

          <GlassCard>
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
                          <td className="p-2 font-semibold" dir="ltr">
                            ${cost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-2">
                            <RowActions onEdit={() => openEdit(t)} onDelete={() => setDeleteId(t.id)} />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </GlassCard>
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
