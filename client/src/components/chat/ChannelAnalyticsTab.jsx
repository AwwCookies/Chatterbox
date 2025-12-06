import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { channelsApi } from '../../services/api';
import { useEmotes } from '../../hooks/useEmotes';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ScatterChart,
  Scatter,
  HeatMap,
  ScatterChart as ScatterChartType
} from 'recharts';
import {
  TrendingUp,
  Users,
  MessageSquare,
  Zap,
  Calendar,
  Clock,
  Filter,
  Loader2,
  AlertCircle,
  BarChart3,
  Activity
} from 'lucide-react';

const getApiBase = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:3000`;
};

const API_BASE = getApiBase();

// Utility functions
const formatNumber = (num) => {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatHour = (hour) => {
  return `${hour}:00`;
};

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Get the appropriate emote URL based on the emote ID format
const getTwitchEmoteUrl = (emoteId) => {
  // All Twitch emotes use the v2 CDN format now
  return `https://static-cdn.jtvnw.net/emoticons/v2/${emoteId}/default/dark/2.0`;
};

// Emote display component with fallback support
function EmoteDisplay({ emoteId }) {
  const [imgError, setImgError] = useState(false);
  const [emoteName, setEmoteName] = useState(null);
  
  // Try to look up the emote name from the global emote cache
  useEffect(() => {
    // Check if this is a known Twitch global emote by ID
    const knownEmotes = {
      '25': 'Kappa',
      '1': 'emote1',
      '28': 'MrDestructoid',
      '33': 'DansGame',
      '52': 'ThunBeast',
      '354': 'PogChamp',
      '28087': 'WutFace',
      '30259': 'HeyGuys',
      '58765': 'NotLikeThis',
      '81274': 'VoHiYo',
      '86': 'BibleThump',
      '115234': 'BabyRage',
      '425618': 'LUL',
      '1035663': 'PogBones',
      '1907227': 'RaccPls',
      '305535174': 'jassHi',
      '301445381': 'xqcL',
    };
    
    if (knownEmotes[emoteId]) {
      setEmoteName(knownEmotes[emoteId]);
    }
  }, [emoteId]);

  if (!emoteId) return null;

  return (
    <div className="flex items-center gap-2">
      {!imgError ? (
        <img
          src={getTwitchEmoteUrl(emoteId)}
          alt={emoteName || emoteId}
          className="w-8 h-8 object-contain"
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="w-8 h-8 bg-gray-700 rounded flex items-center justify-center">
          <span className="text-xs text-gray-400">?</span>
        </div>
      )}
      <span className="text-white font-medium">
        {emoteName || <span className="text-gray-400 text-xs font-mono">{emoteId}</span>}
      </span>
    </div>
  );
}

// Chart components
function MetricCard({ icon: Icon, label, value, subValue, trend, color = 'text-blue-400' }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {subValue && <p className="text-xs text-gray-500 mt-1">{subValue}</p>}
        </div>
        <div className={`p-2 rounded-lg bg-gray-700/50 ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {trend !== undefined && (
        <div className={`mt-2 flex items-center gap-1 text-xs ${trend > 0 ? 'text-green-400' : trend < 0 ? 'text-red-400' : 'text-gray-400'}`}>
          <TrendingUp className={`w-3 h-3 ${trend < 0 ? 'rotate-180' : ''}`} />
          <span>{trend > 0 ? '+' : ''}{trend}%</span>
        </div>
      )}
    </div>
  );
}

function ChartContainer({ title, children, loading, error }) {
  if (loading) {
    return (
      <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700/50">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">{title}</h3>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-twitch-purple" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700/50">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">{title}</h3>
        <div className="flex items-center justify-center h-64 text-gray-400">
          <AlertCircle className="w-5 h-5 mr-2" />
          Failed to load data
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700/50">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function PeriodSelector({ value, onChange, options }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map(({ label, value: val }) => (
        <button
          key={val}
          onClick={() => onChange(val)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            value === val
              ? 'bg-twitch-purple text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ChannelAnalyticsTab({ channelName }) {
  const [hourlyPeriod, setHourlyPeriod] = useState(24);
  const [dailyPeriod, setDailyPeriod] = useState(30);
  const [topUsersPeriod, setTopUsersPeriod] = useState(7);
  const [heatmapPeriod, setHeatmapPeriod] = useState(30);
  const [modActionsPeriod, setModActionsPeriod] = useState(30);
  const [engagementPeriod, setEngagementPeriod] = useState(30);

  // Fetch data
  const { data: hourlyData, isLoading: hourlyLoading, error: hourlyError } = useQuery({
    queryKey: ['channel-analytics', channelName, 'hourly', hourlyPeriod],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/channels/${channelName}/analytics/hourly?hours=${hourlyPeriod}`);
      if (!res.ok) throw new Error('Failed to fetch hourly data');
      return res.json();
    },
  });

  const { data: dailyData, isLoading: dailyLoading, error: dailyError } = useQuery({
    queryKey: ['channel-analytics', channelName, 'daily', dailyPeriod],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/channels/${channelName}/analytics/daily?days=${dailyPeriod}`);
      if (!res.ok) throw new Error('Failed to fetch daily data');
      return res.json();
    },
  });

  const { data: topUsersData, isLoading: topUsersLoading, error: topUsersError } = useQuery({
    queryKey: ['channel-analytics', channelName, 'top-users', topUsersPeriod],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/channels/${channelName}/analytics/top-users?days=${topUsersPeriod}`);
      if (!res.ok) throw new Error('Failed to fetch top users');
      return res.json();
    },
  });

  const { data: heatmapData, isLoading: heatmapLoading, error: heatmapError } = useQuery({
    queryKey: ['channel-analytics', channelName, 'heatmap', heatmapPeriod],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/channels/${channelName}/analytics/heatmap?days=${heatmapPeriod}`);
      if (!res.ok) throw new Error('Failed to fetch heatmap');
      return res.json();
    },
  });

  const { data: modActionsData, isLoading: modActionsLoading, error: modActionsError } = useQuery({
    queryKey: ['channel-analytics', channelName, 'mod-actions', modActionsPeriod],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/channels/${channelName}/analytics/mod-actions?days=${modActionsPeriod}`);
      if (!res.ok) throw new Error('Failed to fetch mod actions');
      return res.json();
    },
  });

  const { data: engagementData, isLoading: engagementLoading, error: engagementError } = useQuery({
    queryKey: ['channel-analytics', channelName, 'engagement', engagementPeriod],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/channels/${channelName}/analytics/engagement?days=${engagementPeriod}`);
      if (!res.ok) throw new Error('Failed to fetch engagement');
      return res.json();
    },
  });

  const [topEmotesPeriod, setTopEmotesPeriod] = useState(30);
  const { data: topEmotesData, isLoading: topEmotesLoading, error: topEmotesError } = useQuery({
    queryKey: ['channel-analytics', channelName, 'top-emotes', topEmotesPeriod],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/channels/${channelName}/analytics/top-emotes?days=${topEmotesPeriod}`);
      if (!res.ok) throw new Error('Failed to fetch top emotes');
      return res.json();
    },
  });

  // Prepare heatmap grid data
  const heatmapGrid = heatmapData?.data ? Array.from({ length: 7 }, (_, day) => {
    return Array.from({ length: 24 }, (_, hour) => {
      const found = heatmapData.data.find(d => d.dayOfWeek === day && d.hourOfDay === hour);
      return found ? { day, hour, value: found.messageCount } : { day, hour, value: 0 };
    });
  }) : [];

  const maxHeatmapValue = Math.max(...(heatmapData?.data?.map(d => d.messageCount) || [0]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <BarChart3 className="w-7 h-7 text-twitch-purple" />
          Channel Analytics
        </h2>
        <p className="text-gray-400 mt-1">Detailed statistics and trends for #{channelName}</p>
      </div>

      {/* Engagement Metrics */}
      {engagementData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {engagementData.metrics.map(metric => (
            <MetricCard
              key={metric.name}
              icon={metric.name === 'Total Messages' ? MessageSquare : Users}
              label={metric.name}
              value={formatNumber(metric.current)}
              subValue={`Previous period: ${formatNumber(metric.previous)}`}
              trend={metric.percentChange}
              color={metric.percentChange > 0 ? 'text-green-400' : 'text-red-400'}
            />
          ))}
        </div>
      )}

      {/* Daily Messages Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartContainer title="Daily Messages" loading={dailyLoading} error={dailyError}>
            <PeriodSelector
              value={dailyPeriod}
              onChange={setDailyPeriod}
              options={[
                { label: '7 days', value: 7 },
                { label: '30 days', value: 30 },
                { label: '90 days', value: 90 },
              ]}
            />
            {dailyData?.data && (
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={dailyData.data}>
                  <defs>
                    <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#9147ff" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#9147ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis 
                    dataKey="day" 
                    stroke="#888"
                    tickFormatter={formatDate}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis stroke="#888" tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                    labelFormatter={formatDate}
                    formatter={(value) => formatNumber(value)}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="messageCount" 
                    stroke="#9147ff" 
                    fillOpacity={1} 
                    fill="url(#colorMessages)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartContainer>
        </div>

        {/* Top Users */}
        <ChartContainer title={`Top Users (${topUsersPeriod}d)`} loading={topUsersLoading} error={topUsersError}>
          <PeriodSelector
            value={topUsersPeriod}
            onChange={setTopUsersPeriod}
            options={[
              { label: '7 days', value: 7 },
              { label: '30 days', value: 30 },
            ]}
          />
          {topUsersData?.data && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {topUsersData.data.map((user, i) => (
                <div key={user.username} className="flex items-center gap-3 pb-2 border-b border-gray-700/50">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    i === 0 ? 'bg-yellow-500 text-black' :
                    i === 1 ? 'bg-gray-300 text-black' :
                    i === 2 ? 'bg-orange-500 text-black' :
                    'bg-gray-600 text-white'
                  }`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{user.displayName || user.username}</p>
                    <p className="text-xs text-gray-400">{formatNumber(user.messageCount)} messages</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ChartContainer>
      </div>

      {/* Hourly Activity */}
      <ChartContainer title="Hourly Activity" loading={hourlyLoading} error={hourlyError}>
        <PeriodSelector
          value={hourlyPeriod}
          onChange={setHourlyPeriod}
          options={[
            { label: '24h', value: 24 },
            { label: '7d', value: 168 },
            { label: '14d', value: 336 },
          ]}
        />
        {hourlyData?.data && (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={hourlyData.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis 
                dataKey="hour" 
                stroke="#888"
                tickFormatter={hour => formatDate(hour)}
                tick={{ fontSize: 12 }}
              />
              <YAxis stroke="#888" tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                formatter={(value) => formatNumber(value)}
              />
              <Legend />
              <Bar dataKey="messageCount" fill="#9147ff" name="Messages" radius={[4, 4, 0, 0]} />
              <Line dataKey="uniqueUsers" stroke="#00d4ff" strokeWidth={2} name="Unique Users" />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </ChartContainer>

      {/* Activity Heatmap */}
      <ChartContainer title="Activity Heatmap (Hour × Day of Week)" loading={heatmapLoading} error={heatmapError}>
        <PeriodSelector
          value={heatmapPeriod}
          onChange={setHeatmapPeriod}
          options={[
            { label: '7d', value: 7 },
            { label: '30d', value: 30 },
            { label: '90d', value: 90 },
          ]}
        />
        {heatmapData?.data && (
          <div className="overflow-x-auto mt-4">
            <div className="inline-block min-w-full">
              <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(24, minmax(40px, 1fr))' }}>
                {/* Header - Hours */}
                <div className="col-span-full grid gap-0.5" style={{ gridTemplateColumns: 'repeat(24, minmax(40px, 1fr))' }}>
                  {Array.from({ length: 24 }).map((_, h) => (
                    <div key={`h${h}`} className="text-center text-xs text-gray-400 pb-2">
                      {h}
                    </div>
                  ))}
                </div>

                {/* Heatmap rows by day of week */}
                {dayNames.map((dayName, day) => {
                  const dayData = heatmapData.data.filter(d => d.dayOfWeek === day);
                  return (
                    <div key={`row-${day}`} className="contents">
                      {/* Day label */}
                      <div className="text-xs text-gray-400 pr-2 flex items-center">{dayName}</div>
                      {/* Cells */}
                      {dayData.sort((a, b) => a.hourOfDay - b.hourOfDay).map(cell => {
                        const intensity = maxHeatmapValue > 0 ? cell.messageCount / maxHeatmapValue : 0;
                        const bgColor = intensity === 0 ? 'bg-gray-800' :
                          intensity < 0.25 ? 'bg-blue-900/30' :
                          intensity < 0.5 ? 'bg-blue-800/50' :
                          intensity < 0.75 ? 'bg-twitch-purple/50' :
                          'bg-twitch-purple';
                        
                        return (
                          <div
                            key={`${day}-${cell.hourOfDay}`}
                            className={`w-10 h-10 rounded-md ${bgColor} border border-gray-700 flex items-center justify-center cursor-pointer hover:border-white transition-colors group relative`}
                            title={`${dayNames[day]} ${cell.hourOfDay}:00 - ${formatNumber(cell.messageCount)} messages`}
                          >
                            <div className="absolute hidden group-hover:flex bg-gray-900 text-white text-xs px-2 py-1 rounded-md whitespace-nowrap -top-8 z-10 border border-gray-700">
                              {formatNumber(cell.messageCount)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </ChartContainer>

      {/* Mod Actions */}
      {modActionsData?.data.length > 0 && (
        <ChartContainer title="Moderation Activity" loading={modActionsLoading} error={modActionsError}>
          <PeriodSelector
            value={modActionsPeriod}
            onChange={setModActionsPeriod}
            options={[
              { label: '7d', value: 7 },
              { label: '30d', value: 30 },
              { label: '90d', value: 90 },
            ]}
          />
          {modActionsData?.data && (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={modActionsData.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="actionType" stroke="#888" tick={{ fontSize: 12 }} />
                <YAxis stroke="#888" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                  formatter={(value) => formatNumber(value)}
                />
                <Legend />
                <Bar dataKey="totalCount" fill="#ff6b6b" name="Total" radius={[4, 4, 0, 0]} />
                <Bar dataKey="todayCount" fill="#ffd43b" name="Today" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartContainer>
      )}

      {/* Top Emotes */}
      {topEmotesData?.data.length > 0 && (
        <ChartContainer title="Top Emotes" loading={topEmotesLoading} error={topEmotesError}>
          <PeriodSelector
            value={topEmotesPeriod}
            onChange={setTopEmotesPeriod}
            options={[
              { label: '7d', value: 7 },
              { label: '30d', value: 30 },
              { label: '90d', value: 90 },
            ]}
          />
          <div className="bg-twitch-dark rounded-lg border border-gray-700 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700 bg-twitch-gray">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Rank</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Emote</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">Uses</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">Unique Users</th>
                </tr>
              </thead>
              <tbody>
                {topEmotesData.data.slice(0, 20).map((emote, index) => (
                  <tr key={index} className="border-b border-gray-800 hover:bg-twitch-gray/50 transition-colors">
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-twitch-purple/20 text-twitch-purple font-bold text-xs">
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <EmoteDisplay emoteId={emote.emoteId} />
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span className="text-twitch-purple font-semibold">{formatNumber(emote.usageCount)}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-400">{formatNumber(emote.uniqueUsers)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartContainer>
      )}
    </div>
  );
}

export default ChannelAnalyticsTab;
