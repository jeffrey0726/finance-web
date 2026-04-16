"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Account, AccountType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  bank: "銀行帳戶",
  cash: "現金",
  investment: "投資",
  real_estate: "房產",
  credit_card: "信用卡",
  loan: "貸款",
};

const LIABILITY_TYPES: AccountType[] = ["credit_card", "loan"];

const defaultForm = {
  name: "",
  type: "bank" as AccountType,
  balance: "",
  currency: "TWD",
  note: "",
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Account | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  const fetchAccounts = async () => {
    const { data } = await supabase
      .from("accounts")
      .select("*")
      .order("created_at", { ascending: true });
    setAccounts(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const assets = accounts.filter((a) => !a.is_liability);
  const liabilities = accounts.filter((a) => a.is_liability);
  const totalAssets = assets.reduce((s, a) => s + Number(a.balance), 0);
  const totalLiabilities = liabilities.reduce((s, a) => s + Number(a.balance), 0);
  const netWorth = totalAssets - totalLiabilities;

  const openAdd = () => {
    setEditTarget(null);
    setForm(defaultForm);
    setOpen(true);
  };

  const openEdit = (account: Account) => {
    setEditTarget(account);
    setForm({
      name: account.name,
      type: account.type,
      balance: String(account.balance),
      currency: account.currency,
      note: account.note ?? "",
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.balance) return;
    setSaving(true);
    const is_liability = LIABILITY_TYPES.includes(form.type);
    const payload = {
      name: form.name,
      type: form.type,
      balance: parseFloat(form.balance),
      currency: form.currency,
      note: form.note || null,
      is_liability,
    };

    if (editTarget) {
      await supabase.from("accounts").update(payload).eq("id", editTarget.id);
    } else {
      await supabase.from("accounts").insert(payload);
    }

    setSaving(false);
    setOpen(false);
    fetchAccounts();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("確定要刪除這個帳戶嗎？")) return;
    await supabase.from("accounts").delete().eq("id", id);
    fetchAccounts();
  };

  const fmt = (n: number) =>
    n.toLocaleString("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-foreground">資產總覽</h1>
        <Button onClick={openAdd} size="sm">
          <Plus className="w-4 h-4 mr-1" /> 新增帳戶
        </Button>
      </div>

      {/* 淨資產摘要 */}
      <div className="bg-card border border-border rounded-lg p-6 mb-6">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-sm text-muted-foreground mb-1">總資產</p>
            <p className="text-xl font-mono font-semibold text-chart-1">{fmt(totalAssets)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">總負債</p>
            <p className="text-xl font-mono font-semibold text-destructive">{fmt(totalLiabilities)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">淨資產</p>
            <p className={`text-xl font-mono font-semibold ${netWorth >= 0 ? "text-chart-1" : "text-destructive"}`}>
              {fmt(netWorth)}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">載入中...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 資產 */}
          <div className="bg-card border border-border rounded-lg p-5">
            <h2 className="text-base font-semibold text-foreground mb-4">資產</h2>
            {assets.length === 0 ? (
              <p className="text-muted-foreground text-sm">尚無資產帳戶</p>
            ) : (
              <div className="space-y-2">
                {assets.map((a) => (
                  <AccountRow key={a.id} account={a} onEdit={openEdit} onDelete={handleDelete} fmt={fmt} />
                ))}
                <div className="border-t border-border pt-2 mt-2 flex justify-between text-sm font-semibold">
                  <span className="text-muted-foreground">小計</span>
                  <span className="text-chart-1 font-mono">{fmt(totalAssets)}</span>
                </div>
              </div>
            )}
          </div>

          {/* 負債 */}
          <div className="bg-card border border-border rounded-lg p-5">
            <h2 className="text-base font-semibold text-foreground mb-4">負債</h2>
            {liabilities.length === 0 ? (
              <p className="text-muted-foreground text-sm">尚無負債帳戶</p>
            ) : (
              <div className="space-y-2">
                {liabilities.map((a) => (
                  <AccountRow key={a.id} account={a} onEdit={openEdit} onDelete={handleDelete} fmt={fmt} />
                ))}
                <div className="border-t border-border pt-2 mt-2 flex justify-between text-sm font-semibold">
                  <span className="text-muted-foreground">小計</span>
                  <span className="text-destructive font-mono">{fmt(totalLiabilities)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 新增/編輯 Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editTarget ? "編輯帳戶" : "新增帳戶"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>帳戶名稱</Label>
              <Input
                className="mt-1"
                placeholder="例：台新銀行"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label>類型</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as AccountType })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ACCOUNT_TYPE_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>目前餘額（TWD）</Label>
              <Input
                className="mt-1"
                type="number"
                placeholder="0"
                value={form.balance}
                onChange={(e) => setForm({ ...form, balance: e.target.value })}
              />
            </div>
            <div>
              <Label>備註（選填）</Label>
              <Input
                className="mt-1"
                placeholder="備註"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
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

function AccountRow({
  account,
  onEdit,
  onDelete,
  fmt,
}: {
  account: Account;
  onEdit: (a: Account) => void;
  onDelete: (id: string) => void;
  fmt: (n: number) => string;
}) {
  return (
    <div className="flex items-center justify-between py-2 px-1 hover:bg-secondary/50 rounded group">
      <div>
        <p className="text-sm font-medium text-foreground">{account.name}</p>
        <p className="text-xs text-muted-foreground">{ACCOUNT_TYPE_LABELS[account.type]}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className={`font-mono text-sm font-semibold ${account.is_liability ? "text-destructive" : "text-chart-1"}`}>
          {fmt(Number(account.balance))}
        </span>
        <div className="hidden group-hover:flex gap-1">
          <button onClick={() => onEdit(account)} className="p-1 hover:text-primary text-muted-foreground">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(account.id)} className="p-1 hover:text-destructive text-muted-foreground">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
