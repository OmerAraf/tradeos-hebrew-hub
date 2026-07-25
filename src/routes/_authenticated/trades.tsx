import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FileUp, Plus } from "lucide-react";
import { useTrades } from "@/lib/use-trades";
import { deleteTrade, newId, upsertTrade } from "@/lib/trade-store";
import { fmtMoney, pnl, rMultiple, type Trade } from "@/lib/trade-types";
import { GlassCard, PageHeader } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/trades")({
  head: () => ({
    meta: [
      { title: "יומן עסקאות — TRADE·OS 2050" },
      { name: "description", content: "רשימת עסקאות סגורות עם סינון, עריכה ותוספת" },
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

  const closedTrades = useMemo(
    () => trades.filter((t) => !!t.exitDate && t.exitPrice != null),
    [trades],
  );
  const openCount = useMemo(
    () => trades.filter((t) => !t.exitDate || t.exitPrice == null).length,
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#new") {
      openNew();
      router.navigate({ to: "/trades", hash: "", replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.state.location.hash]);

  return (
    <div>
      <PageHeader
        title="יומן עסקאות"
        subtitle={`${closedTrades.length} סגורות · ${openCount} בעבודה`}
        actions={
          <>
            <Button asChild variant="outline" className="gap-1">
              <Link to="/import">
                <FileUp className="h-4 w-4" /> ייבוא CSV
              </Link>
            </Button>
            <Button onClick={openNew} className="gap-1">
              <Plus className="h-4 w-4" /> עסקה חדשה
            </Button>
          </>
        }
      />

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
                      <td className="p-2" dir="ltr">{t.exitDate ? t.exitDate.slice(0, 10) : "—"}</td>
                      <td className="p-2" dir="ltr">{t.quantity}</td>
                      <td className="p-2" dir="ltr">${t.entryPrice.toFixed(2)}</td>
                      <td className="p-2" dir="ltr">{t.exitPrice != null ? `$${t.exitPrice.toFixed(2)}` : "—"}</td>
                      <td className={`p-2 font-semibold ${p >= 0 ? "text-profit" : "text-loss"}`} dir="ltr">
                        {fmtMoney(p)}
                      </td>
                      <td className="p-2" dir="ltr">{r == null ? "—" : r.toFixed(2)}</td>
                      <td className="p-2">
                        <RowActions onEdit={() => openEdit(t)} onDelete={() => setDeleteId(t.id)} />
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
