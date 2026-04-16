"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Category } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";

interface BudgetWithUsage {
  id: string;
  category_id: string;
  amount: number;
  period: string;
  start_date: string;
  category: Category;
  spent: number;
}

const defaultForm = {
  category_id: "",
  amount: "",
  period: "monthly" as "weekly" | "monthly" | "yearly",
};

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<BudgetWithUsage[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<BudgetWithUsage | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    const now = new Date();
    const start = format(startOfMonth(now), "yyyy-MM-dd");
    const end = format(endOfMonth(now), "yyyy-MM-dd");

    const [budgetRes, catRes, txRes] = await Promise.all([
      supabase.from("budgets").select("*, categories(*)").eq("period", "monthly"),
      supabase.from("categories").select("*").eq("type", "expense").order("name"),
      supabase.from("transactions").select("category_id, amount").eq("type", "expense").gte("date", start).lte("date", end),
    ]);

    const txs = txRes.data ?? [];
    const spentMap: Record<string, number> = {};
    txs.forEach(t => {
      if (t.category_id) spentMap[t.category_id] = (spentMap[t.category_id] ?? 0) + Number(t.amount);
    });

    const enriched = (budgetRes.data ?? []).map((b: any) => ({
      ...b,
      category: b.categories,
      spent: spentMap[b.category_id] ?? 0,
    }));

    setBudgets(enriched);
    setCategories(catRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const usedCategoryIds = budgets.map(b => b.category_id);
  const availableCategories = categories.filter(
    c => !usedCategoryIds.includes(c.id) || c.id === editTarget?.category_id
  );

  const openAdd = () => {
    setEditTarget(null);
    setForm(defaultForm);
    setOpen(true);
  };

  const openEdit = (b: BudgetWithUsage) => {
    setEditTarget(b);
    setForm({ category_id: b.category_id, amount: String(b.amount), period: b.period as any });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.category_id || !form.amount) return;
    setSaving(true);
    const payload = {
      category_id: form.category_id,
      amount: parseFloat(form.amount),
      period: form.period,
      start_date: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    };
    let error;
    if (editTarget) {
      ({ error } = await supabase.from("budgets").update(payload).eq("id", editTarget.id));
    } else {
      ({ error } = await supabase.from("budgets").insert(payload));
    }
    setSaving(false);
    if (error) { console.error(error); return; }
    setOpen(false);
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("確定刪除這個預算？")) return;
    await supabase.from("budgets").delete().eq("id", id);
    fetchAll();
  };

  const fmt = (n: number) => `$${Number(n).toLocaleString()}`;
  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const overallPct = totalBudget > 0 ? Math.min(Math.round((totalSpent / totalBudget) * 100), 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-foreground">預算管理</h1>
        <Button onClick={openAdd} size="sm">
          <Plus className="w-4 h-4 mr-1" /> 新增預算
        </Button>
      </div>

      {/* 總覽 */}
      <div className="bg-card border border-border rounded-lg p-6 mb-6">
        <div className="grid grid-cols-3 gap-4 text-center mb-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">本月預算總額</p>
            <p className="text-xl font-mono font-semibold text-foreground">{fmt(totalBudget)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">已使用</p>
            <p className={`text-xl font-mono font-semibold ${totalSpent > totalBudget ? "text-destructive" : "text-chart-4"}`}>{fmt(totalSpent)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">剩餘</p>
            <p className={`text-xl font-mono font-semibold ${totalBudget - totalSpent >= 0 ? "text-chart-1" : "text-destructive"}`}>{fmt(totalBudget - totalSpent)}</p>
          </div>
        </div>
        <ProgressBar pct={overallPct} />
        <p className="text-xs text-muted-foreground text-right mt-1">{overallPct}% 已使用</p>
      </div>

      {/* 各分類預算 */}
      {loading ? (
        <p className="text-muted-foreground text-sm">載入中...</p>
      ) : budgets.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="text-muted-foreground text-sm">尚未設定任何預算，點右上角新增</p>
        </div>
      ) : (
        <div className="space-y-3">
          {budgets.map(b => {
            const pct = b.amount > 0 ? Math.min(Math.round((b.spent / b.amount) * 100), 100) : 0;
            const over = b.spent > b.amount;
            return (
              <div key={b.id} className="bg-card border border-border rounded-lg p-5 group">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{b.category?.name ?? "—"}</span>
                    {over && <span className="text-xs px-1.5 py-0.5 rounded bg-destructive/20 text-destructive">超出預算</span>}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-mono text-muted-foreground">
                      <span className={over ? "text-destructive font-semibold" : "text-foreground"}>{fmt(b.spent)}</span>
                      {" / "}{fmt(b.amount)}
                    </span>
                    <div className="hidden group-hover:flex gap-1">
                      <button onClick={() => openEdit(b)} className="p-1 hover:text-primary text-muted-foreground">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(b.id)} className="p-1 hover:text-destructive text-muted-foreground">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
                <ProgressBar pct={pct} danger={over} />
                <p className="text-xs text-muted-foreground mt-1">{pct}% · 剩餘 {fmt(Math.max(b.amount - b.spent, 0))}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editTarget ? "編輯預算" : "新增預算"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>支出分類</Label>
              <Select value={form.category_id} onValueChange={v => setForm({ ...form, category_id: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="選擇分類" /></SelectTrigger>
                <SelectContent>
                  {availableCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>預算金額（TWD）</Label>
              <Input className="mt-1" type="number" placeholder="0" value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <Label>週期</Label>
              <Select value={form.period} onValueChange={v => setForm({ ...form, period: v as any })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">每月</SelectItem>
                  <SelectItem value="weekly">每週</SelectItem>
                  <SelectItem value="yearly">每年</SelectItem>
                </SelectContent>
              </Select>
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

function ProgressBar({ pct, danger }: { pct: number; danger?: boolean }) {
  return (
    <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${danger ? "bg-destructive" : pct > 70 ? "bg-chart-4" : "bg-chart-1"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
