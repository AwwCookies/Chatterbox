import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  CartesianGrid,
  ComposedChart
} from 'recharts';
import { formatNumber } from '../../utils/formatters';

const COLORS = ['#9147ff', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#8b5cf6', '#10b981'];

// Custom tooltip component
const CustomTooltip = ({ active, payload, label, valueFormatter = formatNumber }) => {
  if (!active || !payload?.length) return null;
  
  return (
    <div className="bg-twitch-dark border border-gray-700 rounded-lg p-3 shadow-xl">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-medium" style={{ color: entry.color }}>
          {entry.name}: {valueFormatter(entry.value)}
        </p>
      ))}
    </div>
  );
};

// Large area chart for messages over time
export function MessagesAreaChart({ data, height = 200 }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="messagesGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#9147ff" stopOpacity={0.5}/>
              <stop offset="100%" stopColor="#9147ff" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
          <XAxis 
            dataKey="time" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#6b7280', fontSize: 10 }}
            interval="preserveStartEnd"
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#6b7280', fontSize: 10 }}
            tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area 
            type="monotone" 
            dataKey="count" 
            name="Messages"
            stroke="#9147ff" 
            strokeWidth={2}
            fill="url(#messagesGradient)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Multi-line chart for comparing data
export function MultiLineChart({ data, lines = [], height = 200 }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
          <XAxis 
            dataKey="time" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#6b7280', fontSize: 10 }}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#6b7280', fontSize: 10 }}
            tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ fontSize: '11px' }}
            iconSize={8}
          />
          {lines.map((line, i) => (
            <Line 
              key={line.dataKey}
              type="monotone" 
              dataKey={line.dataKey} 
              name={line.name}
              stroke={line.color || COLORS[i]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Bar chart for channel activity
export function ChannelActivityChart({ data, height = 200 }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
          <XAxis 
            type="number"
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#6b7280', fontSize: 10 }}
            tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
          />
          <YAxis 
            type="category"
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            width={80}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar 
            dataKey="messageCount" 
            name="Messages"
            fill="#9147ff" 
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Pie/donut chart for mod actions breakdown
export function ModActionsPieChart({ data, height = 200 }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  
  return (
    <div style={{ height }} className="relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={70}
            paddingAngle={2}
            dataKey="count"
            nameKey="actionType"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <span className="text-2xl font-bold text-white">{formatNumber(total)}</span>
          <p className="text-xs text-gray-400">Total</p>
        </div>
      </div>
    </div>
  );
}

// Stacked bar chart for daily breakdown
export function StackedBarChart({ data, bars = [], height = 200 }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#6b7280', fontSize: 10 }}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#6b7280', fontSize: 10 }}
            tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ fontSize: '11px' }}
            iconSize={8}
          />
          {bars.map((bar, i) => (
            <Bar 
              key={bar.dataKey}
              dataKey={bar.dataKey} 
              name={bar.name}
              stackId="a"
              fill={bar.color || COLORS[i]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Heatmap-style chart for peak hours
export function PeakHoursChart({ data, height = 80 }) {
  const max = Math.max(...data.map(d => d.count), 1);
  
  return (
    <div style={{ height }} className="flex flex-col">
      <div className="flex-1 flex items-end gap-1">
        {data.map((d, i) => (
          <div
            key={i}
            className="flex-1 flex flex-col items-center group"
          >
            <div 
              className="w-full rounded-t-sm transition-all cursor-pointer"
              style={{
                height: `${Math.max(10, (d.count / max) * 100)}%`,
                backgroundColor: d.count > max * 0.75 ? '#9147ff' : 
                                 d.count > max * 0.5 ? '#6366f1' :
                                 d.count > max * 0.25 ? '#4f46e5' : '#374151'
              }}
              title={`${d.hour}:00 - ${formatNumber(d.count)} messages`}
            />
          </div>
        ))}
      </div>
      <div className="flex mt-1">
        {[0, 6, 12, 18, 23].map(h => (
          <div key={h} className="flex-1 text-center text-[9px] text-gray-500">
            {h === 0 ? '12a' : h === 6 ? '6a' : h === 12 ? '12p' : h === 18 ? '6p' : '11p'}
          </div>
        ))}
      </div>
    </div>
  );
}

// Combined messages + mod actions chart
export function ActivityComposedChart({ data, height = 200 }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3}/>
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
          <XAxis 
            dataKey="time" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#6b7280', fontSize: 10 }}
          />
          <YAxis 
            yAxisId="left"
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#6b7280', fontSize: 10 }}
            tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
          />
          <YAxis 
            yAxisId="right"
            orientation="right"
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#6b7280', fontSize: 10 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ fontSize: '11px' }}
            iconSize={8}
          />
          <Area 
            yAxisId="left"
            type="monotone" 
            dataKey="messages" 
            name="Messages"
            stroke="#22c55e"
            strokeWidth={2}
            fill="url(#activityGradient)" 
          />
          <Line 
            yAxisId="right"
            type="monotone" 
            dataKey="modActions" 
            name="Mod Actions"
            stroke="#ef4444"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export default {
  MessagesAreaChart,
  MultiLineChart,
  ChannelActivityChart,
  ModActionsPieChart,
  StackedBarChart,
  PeakHoursChart,
  ActivityComposedChart
};
