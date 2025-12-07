import { useMemo } from 'react';
import { 
  AreaChart, 
  Area, 
  ResponsiveContainer
} from 'recharts';
import { Gauge, Wifi, WifiOff } from 'lucide-react';

// Real-time messages per second widget with animated visualization
export function LiveMpsWidget({ mps = 0, mpsHistory = [], peakMps = 0, isConnected = false }) {
  const maxValue = Math.max(...mpsHistory.map(d => d.value), 10);
  const avgMps = mpsHistory.length > 0 
    ? mpsHistory.reduce((sum, d) => sum + d.value, 0) / mpsHistory.length 
    : 0;
  
  const level = useMemo(() => {
    if (mps === 0) return 'idle';
    if (mps < 5) return 'low';
    if (mps < 20) return 'medium';
    if (mps < 50) return 'high';
    return 'extreme';
  }, [mps]);

  const levelConfig = {
    idle: { color: 'text-gray-500', bg: 'bg-gray-700', gradient: '#6b7280' },
    low: { color: 'text-green-400', bg: 'bg-green-500/20', gradient: '#22c55e' },
    medium: { color: 'text-cyan-400', bg: 'bg-cyan-500/20', gradient: '#22d3ee' },
    high: { color: 'text-twitch-purple', bg: 'bg-twitch-purple/20', gradient: '#9147ff' },
    extreme: { color: 'text-pink-400', bg: 'bg-pink-500/20', gradient: '#ec4899' }
  };

  const config = levelConfig[level];

  return (
    <div className="bg-twitch-gray rounded-xl border border-gray-700/50 p-5 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${config.bg}`}>
            <Gauge className={`w-5 h-5 ${config.color}`} />
          </div>
          <div>
            <span className="text-sm font-medium text-white">Live Throughput</span>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>avg: <span className="text-gray-400">{avgMps.toFixed(1)}</span></span>
              <span>•</span>
              <span>peak: <span className="text-yellow-400 font-medium">{peakMps}</span></span>
            </div>
          </div>
        </div>
        
        {/* Connection status */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
          isConnected ? 'bg-green-500/20' : 'bg-red-500/20'
        }`}>
          {isConnected ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-green-400" />
              <span className="text-xs font-medium text-green-400">Live</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-red-400" />
              <span className="text-xs font-medium text-red-400">Offline</span>
            </>
          )}
        </div>
      </div>

      {/* Main Number Display */}
      <div className="flex items-end gap-3 mb-4">
        <span className={`text-6xl font-bold tabular-nums tracking-tight transition-colors duration-300 ${config.color}`}>
          {mps}
        </span>
        <div className="mb-2">
          <span className="text-gray-400 text-sm block">msg/s</span>
          {mps > 0 && (
            <div className={`flex items-center gap-1 mt-0.5`}>
              <div className={`w-2 h-2 rounded-full ${config.color} animate-pulse`} 
                style={{ backgroundColor: config.gradient }} 
              />
              <span className={`text-xs font-medium ${config.color}`}>
                {level === 'extreme' ? 'SURGE' : level === 'high' ? 'ACTIVE' : 'STEADY'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Sparkline Chart */}
      <div className="h-20 flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={mpsHistory} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="mpsGradientLive" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={config.gradient} stopOpacity={0.5}/>
                <stop offset="100%" stopColor={config.gradient} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={config.gradient}
              strokeWidth={2}
              fill="url(#mpsGradientLive)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Time labels */}
      <div className="flex justify-between text-[10px] text-gray-600 mt-2">
        <span>60s ago</span>
        <span>now</span>
      </div>

      {/* Activity bars */}
      <div className="flex gap-0.5 mt-3 h-5 items-end">
        {mpsHistory.slice(-40).map((d, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm transition-all duration-150"
            style={{
              height: `${Math.max(15, (d.value / maxValue) * 100)}%`,
              backgroundColor: d.value === 0 
                ? '#374151' 
                : d.value < 5 
                  ? '#22c55e' 
                  : d.value < 20 
                    ? '#22d3ee' 
                    : d.value < 50
                      ? '#9147ff'
                      : '#ec4899',
              opacity: 0.3 + (i / 40) * 0.7
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default LiveMpsWidget;
