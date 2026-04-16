"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Account, Category, Transaction } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Plus, Pencil, Trash2, CalendarIcon } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { zhTW } from "date-fns/locale";

const defaultForm = {
  type: "expense" as "income" | "expense" | "transfer",
  amount: "",
  date: new Date(),
  account_id: "",
  to_account_id: "",
  category_id: "",
  description: "",
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<(Transaction & { accounts: Account; categories: Category | null })[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Transaction | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [monthFilter, setMonthFilter] = useState(() => format(new Date(), "yyyy-MM"));

  const getMonthRange = (ym: string) => {
    const d = new Date(`${ym}-01`);
    return [format(startOfMonth(d), "yyyy-MM-dd"), format(endOfMonth(d), "yyyy-MM-dd")];
  };

  const fetchAll = async () => {
    const [start, end] = getMonthRange(monthFilter);
    const [txRes, accRes, catRes] = await Promise.all([
      supabase
        .from("transactions")
        .select("*, accounts!transactions_account_id_fkey(*), categories(*)")
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: false }),
      supabase.from("accounts").select("*").order("created_at"),
      supabase.from("categories").select("*").order("name"),
    ]);
    if (txRes.error) console.error("tx error:", txRes.error);
    setTransactions((txRes.data as any) ?? []);
    setAccounts(accRes.data ?? []);
    setCategories(catRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [monthFilter]);

  const totalIncome = transactions.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = transactions.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);

  const openAdd = () => {
    setEditTarget(null);
    setForm({ ...defaultForm, date: new Date(), account_id: accounts[0]?.id ?? "" });
    setOpen(true);
  };

  const openEdit = (tx: Transaction) => {
    setEditTarget(tx);
    setForm({
      type: tx.type as any,
      amount: String(tx.amount),
      date: new Date(tx.date),
      account_id: tx.account_id,
      to_account_id: tx.to_account_id ?? "",
      category_id: tx.category_id ?? "",
      description: tx.description ?? "",
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.amount || !form.account_id) return;
    setSaving(true);
    const payload = {
      type: form.type,
      amount: parseFloat(form.amount),
      date: format(form.date, "yyyy-MM-dd"),
      account_id: form.account_id,
      to_account_id: form.type === "transfer" ? form.to_account_id || null : null,
      category_id: form.category_id || null,
      description: form.description || null,
    };
    let error;
    if (editTarget) {
      ({ error } = await supabase.from("transactions").update(payload).eq("id", editTarget.id));
    } else {
      ({ error } = await supabase.from("transactions").insert(payload));
    }
    setSaving(false);
    if (error) { console.error("save error:", error); return; }
    setOpen(false);
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("確定刪除這筆交易？")) return;
    await supabase.from("transactions").delete().eq("id", id);
    fetchAll();
  };

  const fmt = (n: number) => `$${Number(n).toLocaleString()}`;
  const filteredCategories = categories.filter(c =>
    form.type === "transfer" ? true : c.type === form.type
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-foreground">交易記錄</h1>
        <Button onClick={openAdd} size="sm">
          <Plus className="w-4 h-4 mr-1" /> 新增交易
        </Button>
      </div>

      {/* 月份篩選 + 摘要 */}
      <div className="flex items-center gap-4 mb-6">
        <Input
          type="month"
          value={monthFilter}
          onChange={e => setMonthFilter(e.target.value)}
          className="w-40"
        />
        <div className="flex gap-4 text-sm">
          <span>收入：<span className="text-chart-1 font-mono font-semibold">{fmt(totalIncome)}</span></span>
          <span>支出：<span className="text-destructive font-mono font-semibold">{fmt(totalExpense)}</span></span>
          <span>結餘：<span className={`font-mono font-semibold ${totalIncome - totalExpense >= 0 ? "text-chart-1" : "text-destructive"}`}>{fmt(totalIncome - totalExpense)}</span></span>
        </div>
      </div>

      {/* 交易列表 */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left p-4 font-medium">日期</th>
              <th className="text-left p-4 font-medium">說明</th>
              <th className="text-left p-4 font-medium">分類</th>
              <th className="text-left p-4 font-medium">帳戶</th>
              <th className="text-right p-4 font-medium">金額</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">載入中...</td></tr>
            ) : transactions.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">本月尚無交易記錄</td></tr>
            ) : (
              transactions.map(tx => (
                <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-secondary/30 group">
                  <td className="p-4 text-muted-foreground font-mono">{tx.date}</td>
                  <td className="p-4 text-foreground">{tx.description || "—"}</td>
                  <td className="p-4">
                    {tx.categories ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-secondary text-foreground">
                        {tx.categories.name}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="p-4 text-muted-foreground">{(tx as any).accounts?.name ?? "—"}</td>
                  <td className={`p-4 text-right font-mono font-semibold ${tx.type === "income" ? "text-chart-1" : tx.type === "expense" ? "text-destructive" : "text-muted-foreground"}`}>
                    {tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""}{fmt(Number(tx.amount))}
                  </td>
                  <td className="p-4">
                    <div className="hidden group-hover:flex gap-1 justify-end">
                      <button onClick={() => openEdit(tx)} className="p-1 hover:text-primary text-muted-foreground">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(tx.id)} className="p-1 hover:text-destructive text-muted-foreground">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 新增/編輯 Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editTarget ? "編輯交易" : "新增交易"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* 類型 */}
            <div>
              <Label>類型</Label>
              <div className="flex gap-2 mt-1">
                {(["expense", "income", "transfer"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setForm({ ...form, type: t, category_id: "" })}
                    className={`flex-1 py-1.5 rounded text-sm font-medium border transition-colors ${form.type === t
                      ? t === "income" ? "bg-chart-1/20 border-chart-1 text-chart-1"
                        : t === "expense" ? "bg-destructive/20 border-destructive text-destructive"
                          : "bg-primary/20 border-primary text-primary"
                      : "border-border text-muted-foreground hover:border-foreground"}`}
                  >
                    {t === "income" ? "收入" : t === "expense" ? "支出" : "轉帳"}
                  </button>
                ))}
              </div>
            </div>

            {/* 金額 */}
            <div>
              <Label>金額</Label>
              <Input className="mt-1" type="number" placeholder="0" value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })} />
            </div>

            {/* 日期 */}
            <div>
              <Label>日期</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full mt-1 justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(form.date, "yyyy/MM/dd", { locale: zhTW })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-card border-border">
                  <Calendar mode="single" selected={form.date}
                    onSelect={d => d && setForm({ ...form, date: d })} />
                </PopoverContent>
              </Popover>
            </div>

            {/* 帳戶 */}
            <div>
              <Label>帳戶</Label>
              <Select value={form.account_id} onValueChange={v => setForm({ ...form, account_id: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="選擇帳戶" /></SelectTrigger>
                <SelectContent>
                  {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* 轉帳目標帳戶 */}
            {form.type === "transfer" && (
              <div>
                <Label>目標帳戶</Label>
                <Select value={form.to_account_id} onValueChange={v => setForm({ ...form, to_account_id: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="選擇目標帳戶" /></SelectTrigger>
                  <SelectContent>
                    {accounts.filter(a => a.id !== form.account_id).map(a =>
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* 分類 */}
            {form.type !== "transfer" && (
              <div>
                <Label>分類</Label>
                <Select value={form.category_id} onValueChange={v => setForm({ ...form, category_id: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="選擇分類" /></SelectTrigger>
                  <SelectContent>
                    {filteredCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* 說明 */}
            <div>
              <Label>說明（選填）</Label>
              <Input className="mt-1" placeholder="備註" value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>

            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving ? "儲存中..." : "儲存"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
