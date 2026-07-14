import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Download, FileUp, Upload } from "lucide-react";
import { GlassCard, PageHeader } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { exportJson, getTrades, importJson, saveTrades } from "@/lib/trade-store";
import {
  autoMap,
  dedupeAgainst,
  matchToTrades,
  parseCsv,
  rowsToTxs,
  type ColumnMap,
  type RawRow,
} from "@/lib/csv-import";
import { fmtMoney, pnl, type Trade } from "@/lib/trade-types";
import { toast } from "sonner";

export const Route = createFileRoute("/import")({
  head: () => ({
    meta: [
      { title: "ייבוא וגיבוי — TRADE·OS 2050" },
      { name: "description", content: "ייבוא CSV, מיפוי עמודות אוטומטי, גיבוי JSON" },
    ],
  }),
  component: ImportPage,
});

function ImportPage() {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<RawRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [map, setMap] = useState<Partial<ColumnMap>>({});
  const [preview, setPreview] = useState<Trade[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);

  function parseText(csv: string) {
    setText(csv);
    const parsed = parseCsv(csv);
    if (!parsed.length) {
      setRows([]);
      setHeaders([]);
      setMap({});
      setPreview([]);
      return;
    }
    const hs = Object.keys(parsed[0]);
    setRows(parsed);
    setHeaders(hs);
    const m = autoMap(hs);
    setMap(m);
    tryPreview(parsed, m);
  }

  function tryPreview(parsedRows: RawRow[], m: Partial<ColumnMap>) {
    if (m.symbol && m.quantity && m.price && m.date && m.side) {
      const txs = rowsToTxs(parsedRows, m as ColumnMap);
      const trades = matchToTrades(txs);
      const filtered = dedupeAgainst(getTrades(), trades);
      setPreview(filtered);
    } else {
      setPreview([]);
    }
  }

  function updateMap(k: keyof ColumnMap, v: string) {
    const nm = { ...map, [k]: v };
    setMap(nm);
    tryPreview(rows, nm);
  }

  const mappingComplete = useMemo(
    () => Boolean(map.symbol && map.quantity && map.price && map.date && map.side),
    [map],
  );

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => parseText(String(reader.result || ""));
    reader.readAsText(f);
  }

  function confirmImport() {
    if (!preview.length) return toast.error("אין עסקאות חדשות לייבוא");
    saveTrades([...getTrades(), ...preview]);
    toast.success(`יובאו ${preview.length} עסקאות`);
    setPreview([]);
    setText("");
    setRows([]);
    setHeaders([]);
    setMap({});
  }

  function doExport() {
    const data = exportJson();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tradeos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("הגיבוי הורד");
  }

  function onJsonFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const n = importJson(String(reader.result || ""));
        toast.success(`שוחזרו ${n} עסקאות`);
      } catch {
        toast.error("קובץ לא תקין");
      }
    };
    reader.readAsText(f);
    e.target.value = "";
  }

  const fields: { key: keyof ColumnMap; label: string; required: boolean }[] = [
    { key: "symbol", label: "סימבול", required: true },
    { key: "quantity", label: "כמות", required: true },
    { key: "price", label: "מחיר", required: true },
    { key: "date", label: "תאריך", required: true },
    { key: "side", label: "צד (קנייה/מכירה)", required: true },
    { key: "fees", label: "עמלות", required: false },
  ];

  return (
    <div>
      <PageHeader title="ייבוא / גיבוי" subtitle="ייבוא מ־CSV ומיפוי עמודות אוטומטי" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GlassCard>
          <div className="mb-2 text-sm font-semibold">ייבוא CSV</div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-1">
              <FileUp className="h-4 w-4" /> בחר קובץ CSV
            </Button>
            <input type="file" ref={fileRef} className="hidden" accept=".csv,text/csv" onChange={onFile} />
          </div>
          <Label className="mt-3 block">או הדבק טקסט:</Label>
          <Textarea
            value={text}
            onChange={(e) => parseText(e.target.value)}
            placeholder="Symbol,Qty,Price,Date,Side&#10;AAPL,50,224.50,2025-01-08,BUY&#10;AAPL,50,238.10,2025-01-22,SELL"
            rows={8}
            dir="ltr"
            className="mt-1 font-mono text-xs"
          />

          {headers.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-sm font-semibold">מיפוי עמודות</div>
              <div className="grid grid-cols-2 gap-2">
                {fields.map((f) => (
                  <div key={f.key}>
                    <Label className="text-xs">
                      {f.label} {f.required && <span className="text-loss">*</span>}
                    </Label>
                    <Select
                      value={map[f.key] ?? ""}
                      onValueChange={(v) => updateMap(f.key, v === "__none" ? "" : v)}
                    >
                      <SelectTrigger><SelectValue placeholder="בחר עמודה" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">—</SelectItem>
                        {headers.map((h) => (
                          <SelectItem key={h} value={h} dir="ltr">{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              {!mappingComplete && (
                <p className="mt-2 text-xs text-loss">חסרים שדות חובה. אנא השלם את המיפוי.</p>
              )}
            </div>
          )}
        </GlassCard>

        <GlassCard>
          <div className="mb-2 text-sm font-semibold">גיבוי JSON</div>
          <p className="mb-3 text-xs text-muted-foreground">
            ייצוא כל הנתונים שלך לקובץ JSON. שחזור מקובץ יחליף את הנתונים הקיימים.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={doExport} className="gap-1">
              <Download className="h-4 w-4" /> ייצוא JSON
            </Button>
            <Button variant="outline" onClick={() => jsonRef.current?.click()} className="gap-1">
              <Upload className="h-4 w-4" /> ייבוא JSON
            </Button>
            <input type="file" ref={jsonRef} accept=".json,application/json" className="hidden" onChange={onJsonFile} />
          </div>
        </GlassCard>
      </div>

      {preview.length > 0 && (
        <GlassCard className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold">
              תצוגה מקדימה — {preview.length} עסקאות חדשות (כפילויות דולגו)
            </div>
            <Button onClick={confirmImport}>אישור וייבוא</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="p-2 text-right font-medium">סימבול</th>
                  <th className="p-2 text-right font-medium">כיוון</th>
                  <th className="p-2 text-right font-medium">כניסה</th>
                  <th className="p-2 text-right font-medium">יציאה</th>
                  <th className="p-2 text-right font-medium">כמות</th>
                  <th className="p-2 text-right font-medium">מחיר כניסה</th>
                  <th className="p-2 text-right font-medium">מחיר יציאה</th>
                  <th className="p-2 text-right font-medium">P&L</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((t) => {
                  const p = pnl(t);
                  return (
                    <tr key={t.id} className="border-t border-white/5">
                      <td className="p-2 font-semibold" dir="ltr">{t.symbol}</td>
                      <td className="p-2">{t.direction === "long" ? "לונג" : "שורט"}</td>
                      <td className="p-2" dir="ltr">{t.entryDate.slice(0, 10)}</td>
                      <td className="p-2" dir="ltr">{t.exitDate.slice(0, 10)}</td>
                      <td className="p-2" dir="ltr">{t.quantity}</td>
                      <td className="p-2" dir="ltr">${t.entryPrice.toFixed(2)}</td>
                      <td className="p-2" dir="ltr">${t.exitPrice.toFixed(2)}</td>
                      <td className={`p-2 font-semibold ${p >= 0 ? "text-profit" : "text-loss"}`} dir="ltr">
                        {fmtMoney(p)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
