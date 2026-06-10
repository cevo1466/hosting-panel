'use client';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface ChartPoint { name: string; cpu: number; ram: number; }

export default function RealtimeChart({ data }: { data: ChartPoint[] }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-full text-[#8a8f98] text-sm">
        Veri yükleniyor...
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#5e6ad2" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#5e6ad2" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorRam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#23252a" opacity={0.5} />
        <XAxis dataKey="name" stroke="#8a8f98" fontSize={11} />
        <YAxis stroke="#8a8f98" fontSize={11} domain={[0, 100]} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#0b0c10',
            borderColor: '#23252a',
            borderRadius: '8px',
            color: 'white',
          }}
        />
        <Area type="monotone" dataKey="cpu" stroke="#5e6ad2" strokeWidth={2} fillOpacity={1} fill="url(#colorCpu)" name="CPU (%)" />
        <Area type="monotone" dataKey="ram" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#colorRam)" name="RAM (%)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
