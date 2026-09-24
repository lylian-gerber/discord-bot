"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceArea } from "recharts";

/** Palette catégorielle validée (fond sombre #141414) — ordre fixe, jamais recyclé. */
export const SERIES = [
  { key: "football", label: "Football", color: "#3987e5" },
  { key: "running", label: "Course", color: "#d95926" },
  { key: "trail", label: "Trail", color: "#199e70" },
  { key: "strength", label: "Muscu", color: "#c98500" },
] as const;

const axis = { stroke: "#737373", fontSize: 11, tickLine: false, axisLine: false } as const;
const tooltipStyle = {
  contentStyle: { background: "#1c1c1c", border: "1px solid #262626", borderRadius: 12, fontSize: 12, color: "#fafafa" },
  labelStyle: { color: "#a3a3a3", marginBottom: 4 },
  itemStyle: { color: "#fafafa", padding: 0 },
} as const;

export type WeeklyLoadPoint = { week: string; football: number; running: number; trail: number; strength: number; chronic: number };

export function WeeklyLoadChart({ data }: { data: WeeklyLoadPoint[] }) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 bg-fg" /> Moyenne 4 sem.
        </span>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="#262626" />
            <XAxis dataKey="week" {...axis} interval="preserveStartEnd" />
            <YAxis {...axis} width={40} />
            <Tooltip {...tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} formatter={(v, n) => [`${v} UA`, n]} />
            {SERIES.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stackId="load"
                fill={s.color}
                stroke="#141414"
                strokeWidth={1}
                radius={i === SERIES.length - 1 ? [4, 4, 0, 0] : 0}
                isAnimationActive={false}
              />
            ))}
            <Line dataKey="chronic" name="Moyenne 4 sem." stroke="#fafafa" strokeWidth={2} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export type ReadinessPoint = { day: string; total: number | null };

export function ReadinessChart({ data }: { data: ReadinessPoint[] }) {
  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#262626" />
          <ReferenceArea y1={65} y2={100} fill="#c6ff3d" fillOpacity={0.05} />
          <XAxis dataKey="day" {...axis} interval="preserveStartEnd" />
          <YAxis {...axis} domain={[0, 100]} ticks={[0, 35, 50, 65, 80, 100]} width={32} />
          <Tooltip {...tooltipStyle} formatter={(v) => [`${v}/100`, "Forme"]} />
          <Line dataKey="total" name="Forme" stroke="#c6ff3d" strokeWidth={2} dot={{ r: 3, fill: "#c6ff3d", stroke: "#141414", strokeWidth: 2 }} connectNulls isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export type VolumePoint = { week: string; hours: number };

export function RunVolumeChart({ data }: { data: VolumePoint[] }) {
  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="#262626" />
          <XAxis dataKey="week" {...axis} interval="preserveStartEnd" />
          <YAxis {...axis} width={32} />
          <Tooltip {...tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} formatter={(v) => [`${v} h`, "Course + trail"]} />
          <Bar dataKey="hours" fill="#199e70" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
