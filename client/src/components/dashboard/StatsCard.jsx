import { formatNumber } from '../../utils/formatters';

// Large hero stat card with gradient background
export function HeroStatCard({ 
  icon: Icon, 
  label, 
  value, 
  subValue,
  gradient = 'from-twitch-purple to-indigo-600',
  trend,
  trendLabel
}) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${gradient} p-6 shadow-lg`}>
      {/* Background decoration */}
      <div className="absolute right-0 top-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-white/10" />
      <div className="absolute right-8 top-8 h-16 w-16 rounded-full bg-white/5" />
      
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-white/20">
            <Icon className="w-5 h-5 text-white" />
          </div>
          <span className="text-white/80 font-medium">{label}</span>
        </div>
        
        <div className="flex items-end gap-2">
          <span className="text-4xl font-bold text-white tracking-tight">
            {formatNumber(value)}
          </span>
          {subValue && (
            <span className="text-white/60 text-sm mb-1">{subValue}</span>
          )}
        </div>
        
        {trend !== undefined && (
          <div className="mt-2 flex items-center gap-1">
            <span className={`text-sm font-medium ${trend >= 0 ? 'text-green-300' : 'text-red-300'}`}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </span>
            {trendLabel && <span className="text-white/50 text-xs">{trendLabel}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// Mini stat card for secondary metrics
export function MiniStatCard({ 
  icon: Icon, 
  label, 
  value, 
  color = 'text-twitch-purple',
  bgColor = 'bg-twitch-purple/10',
  pulse = false 
}) {
  return (
    <div className="bg-twitch-gray rounded-lg p-4 border border-gray-700/50 hover:border-gray-600 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${bgColor}`}>
          <Icon className={`w-4 h-4 ${color} ${pulse ? 'animate-pulse' : ''}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xl font-bold text-white leading-tight">{formatNumber(value)}</p>
          <p className="text-xs text-gray-400 truncate">{label}</p>
        </div>
      </div>
    </div>
  );
}

// Stat card with sparkline/mini chart
export function SparklineStatCard({ 
  icon: Icon, 
  label, 
  value, 
  data = [],
  color = '#9147ff',
  bgColor = 'bg-twitch-purple/10',
  textColor = 'text-twitch-purple'
}) {
  const max = Math.max(...data, 1);
  
  return (
    <div className="bg-twitch-gray rounded-lg p-4 border border-gray-700/50">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${bgColor}`}>
            <Icon className={`w-4 h-4 ${textColor}`} />
          </div>
          <span className="text-sm text-gray-400">{label}</span>
        </div>
        <span className="text-xl font-bold text-white">{formatNumber(value)}</span>
      </div>
      
      {/* Mini sparkline */}
      <div className="flex items-end gap-0.5 h-8">
        {data.slice(-20).map((v, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm transition-all"
            style={{
              height: `${Math.max(8, (v / max) * 100)}%`,
              backgroundColor: color,
              opacity: 0.4 + (i / 20) * 0.6
            }}
          />
        ))}
      </div>
    </div>
  );
}

// Percentage ring stat
export function RingStatCard({ label, value, max, color = '#9147ff', icon: Icon }) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  return (
    <div className="bg-twitch-gray rounded-lg p-4 border border-gray-700/50 flex flex-col items-center">
      <div className="relative">
        <svg className="w-20 h-20 transform -rotate-90">
          <circle
            cx="40"
            cy="40"
            r="36"
            stroke="#374151"
            strokeWidth="6"
            fill="none"
          />
          <circle
            cx="40"
            cy="40"
            r="36"
            stroke={color}
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {Icon ? (
            <Icon className="w-6 h-6" style={{ color }} />
          ) : (
            <span className="text-lg font-bold text-white">{percentage.toFixed(0)}%</span>
          )}
        </div>
      </div>
      <span className="text-xs text-gray-400 mt-2">{label}</span>
      <span className="text-sm font-medium text-white">{formatNumber(value)} / {formatNumber(max)}</span>
    </div>
  );
}

export default { HeroStatCard, MiniStatCard, SparklineStatCard, RingStatCard };
