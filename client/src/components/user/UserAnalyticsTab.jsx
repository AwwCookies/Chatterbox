import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '../../services/api';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import {
  TrendingUp,
  Clock,
  Calendar,
  MessageSquare,
  Hash,
  Zap,
  Loader2,
  AlertCircle,
  Flame,
  BarChart3
} from 'lucide-react';

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
  const h = hour % 12 || 12;
  const ampm = hour < 12 ? 'AM' : 'PM';
  return `${h}${ampm}`;
};

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Colors for charts
const COLORS = ['#9146FF', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

function StatCard({ title, value, subtitle, icon: Icon, color = 'text-twitch-purple', trend }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs text-gray-400 mb-1">{title}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
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

// Custom tooltip for charts
function CustomTooltip({ active, payload, label, formatter }) {
  if (!active || !payload || !payload.length) return null;
  
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg">
      <p className="text-gray-400 text-sm mb-1">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="text-white font-semibold">
          {formatter ? formatter(entry.value) : entry.value} {entry.name}
        </p>
      ))}
    </div>
  );
}

function UserAnalyticsTab({ username }) {
  const [activityPeriod, setActivityPeriod] = useState(30);
  const [channelsPeriod, setChannelsPeriod] = useState(30);
  const [emotesPeriod, setEmotesPeriod] = useState(30);

  // Fetch summary data
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['user-analytics', username, 'summary', activityPeriod],
    queryFn: async () => {
      const res = await usersApi.getSummaryAnalytics(username, { days: activityPeriod });
      return res.data;
    },
  });

  // Fetch activity data (hourly/daily distribution)
  const { data: activityData, isLoading: activityLoading, error: activityError } = useQuery({
    queryKey: ['user-analytics', username, 'activity', activityPeriod],
    queryFn: async () => {
      const res = await usersApi.getActivityAnalytics(username, { days: activityPeriod });
      return res.data;
    },
  });

  // Fetch channel analytics
  const { data: channelsData, isLoading: channelsLoading, error: channelsError } = useQuery({
    queryKey: ['user-analytics', username, 'channels', channelsPeriod],
    queryFn: async () => {
      const res = await usersApi.getChannelAnalytics(username, { days: channelsPeriod });
      return res.data;
    },
  });

  // Fetch emote analytics
  const { data: emotesData, isLoading: emotesLoading, error: emotesError } = useQuery({
    queryKey: ['user-analytics', username, 'emotes', emotesPeriod],
    queryFn: async () => {
      const res = await usersApi.getEmoteAnalytics(username, { days: emotesPeriod });
      return res.data;
    },
  });

  // Prepare hourly chart data (fill in missing hours)
  const hourlyChartData = [];
  for (let i = 0; i < 24; i++) {
    const found = activityData?.hourly?.find(h => h.hour === i);
    hourlyChartData.push({
      hour: formatHour(i),
      messages: found?.messageCount || 0
    });
  }

  // Prepare weekday chart data (fill in missing days)
  const weekdayChartData = [];
  for (let i = 0; i < 7; i++) {
    const found = activityData?.weekday?.find(d => d.day === i);
    weekdayChartData.push({
      day: dayNames[i],
      messages: found?.messageCount || 0
    });
  }

  // Prepare daily activity chart data
  const dailyChartData = activityData?.daily?.map(d => ({
    date: formatDate(d.day),
    messages: d.messageCount
  })) || [];

  // Prepare channel pie chart data
  const channelPieData = channelsData?.channels?.slice(0, 6).map((c, i) => ({
    name: c.displayName || c.name,
    value: c.messageCount,
    fill: COLORS[i % COLORS.length]
  })) || [];

  const summary = summaryData?.summary || {};

  const periodOptions = [
    { label: '7 Days', value: 7 },
    { label: '30 Days', value: 30 },
    { label: '90 Days', value: 90 },
    { label: '1 Year', value: 365 },
  ];

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-twitch-purple" />
          User Analytics
        </h2>
        <PeriodSelector
          value={activityPeriod}
          onChange={(val) => {
            setActivityPeriod(val);
            setChannelsPeriod(val);
            setEmotesPeriod(val);
          }}
          options={periodOptions}
        />
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard
          title="Messages"
          value={formatNumber(summary.totalMessages)}
          subtitle={`${activityPeriod} days`}
          icon={MessageSquare}
          color="text-twitch-purple"
        />
        <StatCard
          title="Active Days"
          value={summary.activeDays || 0}
          subtitle={`of ${activityPeriod}`}
          icon={Calendar}
          color="text-blue-400"
        />
        <StatCard
          title="Current Streak"
          value={`${summary.currentStreak || 0}d`}
          subtitle="consecutive days"
          icon={Flame}
          color="text-orange-400"
        />
        <StatCard
          title="Peak Hour"
          value={summary.peakHour !== null ? formatHour(summary.peakHour) : 'N/A'}
          subtitle={`${formatNumber(summary.peakHourMessages)} msgs`}
          icon={Clock}
          color="text-green-400"
        />
        <StatCard
          title="Avg Length"
          value={summary.avgMessageLength || 0}
          subtitle="characters"
          icon={Zap}
          color="text-yellow-400"
        />
        <StatCard
          title="Channels"
          value={channelsData?.channels?.length || 0}
          subtitle="active in"
          icon={Hash}
          color="text-pink-400"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Activity */}
        <ChartContainer
          title="Activity by Hour"
          loading={activityLoading}
          error={activityError}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={hourlyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="hour" 
                stroke="#9CA3AF" 
                fontSize={10}
                interval={2}
              />
              <YAxis stroke="#9CA3AF" fontSize={10} />
              <Tooltip content={<CustomTooltip formatter={formatNumber} />} />
              <Bar 
                dataKey="messages" 
                name="messages"
                fill="#9146FF"
                radius={[4, 4, 0, 0]}
              >
                {hourlyChartData.map((entry, index) => (
                  <Cell 
                    key={index} 
                    fill={entry.messages === Math.max(...hourlyChartData.map(d => d.messages)) ? '#FF6B6B' : '#9146FF'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Weekday Activity */}
        <ChartContainer
          title="Activity by Day of Week"
          loading={activityLoading}
          error={activityError}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={weekdayChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="day" stroke="#9CA3AF" fontSize={12} />
              <YAxis stroke="#9CA3AF" fontSize={10} />
              <Tooltip content={<CustomTooltip formatter={formatNumber} />} />
              <Bar 
                dataKey="messages" 
                name="messages"
                fill="#3B82F6"
                radius={[4, 4, 0, 0]}
              >
                {weekdayChartData.map((entry, index) => (
                  <Cell 
                    key={index} 
                    fill={COLORS[index % COLORS.length]} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Activity Over Time */}
        <ChartContainer
          title="Daily Activity"
          loading={activityLoading}
          error={activityError}
        >
          {dailyChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={dailyChartData}>
                <defs>
                  <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9146FF" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#9146FF" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="date" 
                  stroke="#9CA3AF" 
                  fontSize={10}
                  interval="preserveStartEnd"
                />
                <YAxis stroke="#9CA3AF" fontSize={10} />
                <Tooltip content={<CustomTooltip formatter={formatNumber} />} />
                <Area
                  type="monotone"
                  dataKey="messages"
                  name="messages"
                  stroke="#9146FF"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorMessages)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-60 text-gray-400">
              No activity data available
            </div>
          )}
        </ChartContainer>

        {/* Channel Distribution */}
        <ChartContainer
          title="Channel Distribution"
          loading={channelsLoading}
          error={channelsError}
        >
          {channelPieData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={240}>
                <PieChart>
                  <Pie
                    data={channelPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {channelPieData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => formatNumber(value)}
                    contentStyle={{ background: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {channelPieData.map((channel, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: channel.fill }}
                      />
                      <span className="text-sm text-gray-300 truncate max-w-[120px]">
                        #{channel.name}
                      </span>
                    </div>
                    <span className="text-sm text-white font-medium">
                      {formatNumber(channel.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-60 text-gray-400">
              No channel data available
            </div>
          )}
        </ChartContainer>
      </div>

      {/* Channel Details Table */}
      {channelsData?.channels?.length > 0 && (
        <ChartContainer
          title="Channel Activity Details"
          loading={channelsLoading}
          error={channelsError}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-left">
                  <th className="pb-3 font-medium">Channel</th>
                  <th className="pb-3 font-medium text-right">Messages</th>
                  <th className="pb-3 font-medium text-right">Active Days</th>
                  <th className="pb-3 font-medium text-right">First Message</th>
                  <th className="pb-3 font-medium text-right">Last Message</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                {channelsData.channels.map((channel, index) => (
                  <tr key={index} className="border-t border-gray-700/50">
                    <td className="py-3">
                      <span className="text-twitch-purple">#{channel.displayName || channel.name}</span>
                    </td>
                    <td className="py-3 text-right font-medium text-white">
                      {formatNumber(channel.messageCount)}
                    </td>
                    <td className="py-3 text-right">{channel.activeDays}</td>
                    <td className="py-3 text-right text-gray-400">
                      {formatDate(channel.firstMessage)}
                    </td>
                    <td className="py-3 text-right text-gray-400">
                      {formatDate(channel.lastMessage)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartContainer>
      )}

      {/* Top Words/Emotes */}
      {emotesData?.emotes?.length > 0 && (
        <ChartContainer
          title="Frequently Used Words"
          loading={emotesLoading}
          error={emotesError}
        >
          <div className="flex flex-wrap gap-2">
            {emotesData.emotes.map((emote, index) => (
              <div
                key={index}
                className="px-3 py-1.5 bg-gray-700/50 rounded-lg flex items-center gap-2"
              >
                <span className="text-white font-medium">{emote.emote}</span>
                <span className="text-gray-400 text-sm">×{formatNumber(emote.count)}</span>
              </div>
            ))}
          </div>
        </ChartContainer>
      )}
    </div>
  );
}

export default UserAnalyticsTab;
