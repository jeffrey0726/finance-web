"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const CHART_COLORS = ["#F85149", "#58A6FF", "#FF9500", "#BF5AF2", "#FFD60A", "#3FB950", "#7D8590"];

export default function DashboardPage() {
  const [netWorth, setNetWorth] = useState(0);
  const [totalAssets, setTotalAssets] = useState(0);
  const [totalLiabilities, setTotalLiabilities] = useState(0);
  const [monthIncome, setMonthIncome] = useState(0);
  const [monthExpense, setMonthExpense] = useState(0);
  const [budgetUsage, setBudgetUsage] = useState(0);
  const [recentTx, setRecentTx] = useState<any[]>([]);
  const [barData, setBarData] = useState<any[]>([]);
  const [pieData, setPieData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const now = new Date();
      const start = format(startOfMonth(now), "yyyy-MM-dd");
      const end = format(endOfMonth(now), "yyyy-MM-dd");

      // 取過去 6 個月的收支資料
      const sixMonthsAgo = format(startOfMonth(subMonths(now, 5)), "yyyy-MM-dd");

      const [accRes, txRes, budgetRes, allTxRes] = await Promise.all([
        supabase.from("accounts").select("balance, is_liability"),
        supabase.from("transactions")
          .select("type, amount, date, description, categories(name), accounts!transactions_account_id_fkey(name)")
          .gte("date", start).lte("date", end)
          .order("date", { ascending: false }),
        supabase.from("budgets").select("amount").eq("period", "monthly"),
        supabase.from("transactions")
          .select("type, amount, date, category_id, categories(name)")
          .gte("date", sixMonthsAgo).lte("date", end),
      ]);

      // 資產
      const accounts = accRes.data ?? [];
      const assets = accounts.filter(a => !a.is_liability).reduce((s, a) => s + Number(a.balance), 0);
      const liabilities = accounts.filter(a => a.is_liability).reduce((s, a) => s + Number(a.balance), 0);
      setTotalAssets(assets);
      setTotalLiabilities(liabilities);
      setNetWorth(assets - liabilities);

      // 本月收支
      const txs = txRes.data ?? [];
      const income = txs.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
      const expense = txs.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
      setMonthIncome(income);
      setMonthExpense(expense);
      setRecentTx(txs.slice(0, 5));

      // 預算使用率
      const totalBudget = (budgetRes.data ?? []).reduce((s, b) => s + Number(b.amount), 0);
      setBudgetUsage(totalBudget > 0 ? Math.round((expense / totalBudget) * 100) : 0);

      // 柱狀圖：過去 6 個月收支
      const allTxs = allTxRes.data ?? [];
      const monthMap: Record<string, { month: string; 收入: number; 支出: number }> = {};
      for (let i = 5; i >= 0; i--) {
        const m = subMonths(now, i);
        const key = format(m, "yyyy-MM");
        monthMap[key] = { month: format(m, "M月"), 收入: 0, 支出: 0 };
      }
      allTxs.forEach(t => {
        const key = t.date.slice(0, 7);
        if (monthMap[key]) {
          if (t.type === "income") monthMap[key].收入 += Number(t.amount);
          if (t.type === "expense") monthMap[key].支出 += Number(t.amount);
        }
      });
      setBarData(Object.values(monthMap));

      // 圓餅圖：本月各分類支出
      const catMap: Record<string, number> = {};
      txs.filter(t => t.type === "expense").forEach(t => {
        const name = (t as any).categories?.name ?? "其他";
        catMap[name] = (catMap[name] ?? 0) + Number(t.amount);
      });
      setPieData(Object.entries(catMap).map(([name, value]) => ({ name, value })));

      setLoading(false);
    };

    fetchData();
  }, []);

  const fmt = (n: number) => `$${Math.abs(n).toLocaleString()}`;
  const month = format(new Date(), "M月");

  const cards = [
    { label: "淨資產", value: fmt(netWorth), sub: `資產 ${fmt(totalAssets)} - 負債 ${fmt(totalLiabilities)}`, color: netWorth >= 0 ? "text-chart-1" : "text-destructive" },
    { label: `${month}收入`, value: fmt(monthIncome), sub: "本月累計", color: "text-chart-1" },
    { label: `${month}支出`, value: fmt(monthExpense), sub: "本月累計", color: "text-destructive" },
    { label: "預算使用", value: `${budgetUsage}%`, sub: "本月預算", color: budgetUsage > 90 ? "text-destructive" : budgetUsage > 70 ? "text-chart-4" : "text-chart-1" },
  ];

  const tooltipStyle = {
    backgroundColor: "#161B22",
    border: "1px solid #30363D",
    borderRadius: "8px",
    color: "#E6EDF3",
    fontSize: "12px",
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground mb-6">Dashboard</h1>

      {/* 統計卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <div key={card.label} className="bg-card border border-border rounded-lg p-5">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className={`text-2xl font-mono font-semibold mt-1 ${loading ? "text-muted-foreground" : card.color}`}>
              {loading ? "—" : card.value}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* 圖表區 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        {/* 收支走勢 */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">近 6 個月收支</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#30363D" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "#7D8590", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#7D8590", fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toLocaleString()}`, ""]} />
              <Bar dataKey="收入" fill="#3FB950" radius={[4, 4, 0, 0]} />
              <Bar dataKey="支出" fill="#F85149" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 本月支出分佈 */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">本月支出分佈</h2>
          {pieData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center">
              <p className="text-muted-foreground text-sm">本月尚無支出記錄</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                  dataKey="value" paddingAngle={3}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toLocaleString()}`, ""]} />
                <Legend iconType="circle" iconSize={8}
                  formatter={(value) => <span style={{ color: "#7D8590", fontSize: "12px" }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 最近交易 */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-base font-semibold text-foreground mb-4">最近交易</h2>
        {loading ? (
          <p className="text-muted-foreground text-sm">載入中...</p>
        ) : recentTx.length === 0 ? (
          <p className="text-muted-foreground text-sm">本月尚無交易記錄</p>
        ) : (
          <div className="space-y-2">
            {recentTx.map((tx, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground font-mono w-24">{tx.date}</span>
                  <span className="text-sm text-foreground">{tx.description || "—"}</span>
                  {tx.categories && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                      {tx.categories.name}
                    </span>
                  )}
                </div>
                <span className={`font-mono text-sm font-semibold ${tx.type === "income" ? "text-chart-1" : "text-destructive"}`}>
                  {tx.type === "income" ? "+" : "-"}{fmt(Number(tx.amount))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
