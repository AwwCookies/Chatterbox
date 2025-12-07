import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { 
  DollarSign, 
  Gift, 
  Gem, 
  Crown, 
  Star, 
  TrendingUp,
  Users,
  Zap,
  Trophy,
  PartyPopper,
  Radio,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Heart,
  Clock
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import api from '../../services/api';
import { formatNumber, formatRelative, formatDateTime } from '../../utils/formatters';
import LoadingSpinner from '../common/LoadingSpinner';

// Custom tooltip for charts
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-gray-300 text-xs mb-1">{label}</p>
      {payload.map((entry, idx) => (
        <p key={idx} className="text-sm font-medium" style={{ color: entry.color }}>
          {entry.name}: {formatNumber(entry.value)}
        </p>
      ))}
    </div>
  );
};

// Stat card with icon and gradient
function StatCard({ icon: Icon, label, value, subValue, gradient, iconColor }) {
  return (
    <div className={`bg-gradient-to-br ${gradient} rounded-xl p-4 border border-gray-700/50`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-300 text-xs mb-1">{label}</p>
          <p className="text-2xl font-bold text-white">{formatNumber(value)}</p>
          {subValue && <p className="text-xs text-gray-400 mt-1">{subValue}</p>}
        </div>
        <div className={`p-2 rounded-lg bg-black/20`}>
          <Icon className={`w-5 h-5 ${iconColor || 'text-white'}`} />
        </div>
      </div>
    </div>
  );
}

// Leaderboard component
function Leaderboard({ title, icon: Icon, iconColor, data, columns, emptyMessage }) {
  const [expanded, setExpanded] = useState(false);
  const displayData = expanded ? data : data.slice(0, 5);
  
  return (
    <div className="bg-twitch-gray rounded-xl border border-gray-700/50">
      <div className="p-4 border-b border-gray-700/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${iconColor}`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <span className="font-medium text-white">{title}</span>
        </div>
        {data.length > 5 && (
          <button 
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-twitch-purple hover:underline flex items-center gap-1"
          >
            {expanded ? 'Show less' : `Show all ${data.length}`}
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
      </div>
      
      {data.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <Icon className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-700/50">
          {displayData.map((item, idx) => (
            <div key={item.userId || idx} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-700/20">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                idx === 0 ? 'bg-yellow-500 text-yellow-900' :
                idx === 1 ? 'bg-gray-300 text-gray-700' :
                idx === 2 ? 'bg-orange-400 text-orange-900' :
                'bg-gray-600 text-gray-300'
              }`}>
                {item.rank || idx + 1}
              </div>
              <Link 
                to={`/user/${item.username}`}
                className="flex-1 min-w-0"
              >
                <span className="text-white hover:text-twitch-purple truncate block">
                  {item.displayName || item.username}
                </span>
              </Link>
              {columns.map((col, colIdx) => (
                <div key={colIdx} className={`text-right ${col.className || ''}`}>
                  <span className={col.valueClass || 'text-white font-medium'}>
                    {col.format ? col.format(item[col.key]) : item[col.key]}
                  </span>
                  {col.subKey && (
                    <span className="text-xs text-gray-500 block">
                      {col.subFormat ? col.subFormat(item[col.subKey]) : item[col.subKey]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Recent activity item
function ActivityItem({ icon: Icon, iconBg, title, subtitle, value, valueColor, timestamp }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-700/20">
      <div className={`p-2 rounded-lg ${iconBg}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm truncate">{title}</p>
        {subtitle && <p className="text-gray-500 text-xs truncate">{subtitle}</p>}
      </div>
      <div className="text-right">
        <span className={`font-bold ${valueColor}`}>{value}</span>
        <span className="text-xs text-gray-500 block">{formatRelative(timestamp)}</span>
      </div>
    </div>
  );
}

// Tier badge
function TierBadge({ tier, isPrime }) {
  if (isPrime) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs font-medium">
        <Crown className="w-3 h-3" />
        Prime
      </span>
    );
  }
  
  const tierNum = tier === '1000' ? 1 : tier === '2000' ? 2 : tier === '3000' ? 3 : 1;
  const colors = {
    1: 'bg-purple-500/20 text-purple-400',
    2: 'bg-cyan-500/20 text-cyan-400',
    3: 'bg-yellow-500/20 text-yellow-400'
  };
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${colors[tierNum]} text-xs font-medium`}>
      <Star className="w-3 h-3" />
      Tier {tierNum}
    </span>
  );
}

// Sub type badge
function SubTypeBadge({ type }) {
  const config = {
    sub: { label: 'New Sub', color: 'bg-green-500/20 text-green-400', icon: Star },
    resub: { label: 'Resub', color: 'bg-purple-500/20 text-purple-400', icon: Heart },
    subgift: { label: 'Gift', color: 'bg-pink-500/20 text-pink-400', icon: Gift },
    submysterygift: { label: 'Mystery Gift', color: 'bg-pink-500/20 text-pink-400', icon: Sparkles },
    primepaidupgrade: { label: 'Prime Upgrade', color: 'bg-blue-500/20 text-blue-400', icon: TrendingUp },
    giftpaidupgrade: { label: 'Gift Upgrade', color: 'bg-cyan-500/20 text-cyan-400', icon: TrendingUp },
  };
  
  const cfg = config[type] || { label: type, color: 'bg-gray-500/20 text-gray-400', icon: Star };
  const Icon = cfg.icon;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${cfg.color} text-xs font-medium`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

export default function ChannelMonetizationTab({ channelName }) {
  const [period, setPeriod] = useState(30);
  const [activeSection, setActiveSection] = useState('overview'); // overview, subs, bits, raids
  
  // Fetch monetization summary
  const { data: monetization, isLoading: monetizationLoading } = useQuery({
    queryKey: ['channel-monetization', channelName, period],
    queryFn: async () => {
      const res = await api.get(`/channels/${channelName}/monetization?days=${period}`);
      return res.data;
    },
    staleTime: 60000,
    refetchInterval: 60000,
  });
  
  // Fetch top gifters
  const { data: topGifters, isLoading: giftersLoading } = useQuery({
    queryKey: ['channel-top-gifters', channelName, period],
    queryFn: async () => {
      const res = await api.get(`/channels/${channelName}/monetization/top-gifters?days=${period}&limit=25`);
      return res.data;
    },
    staleTime: 60000,
  });
  
  // Fetch top bit givers
  const { data: topBits, isLoading: bitsLoading } = useQuery({
    queryKey: ['channel-top-bits', channelName, period],
    queryFn: async () => {
      const res = await api.get(`/channels/${channelName}/monetization/top-bits?days=${period}&limit=25`);
      return res.data;
    },
    staleTime: 60000,
  });
  
  // Fetch recent subs
  const { data: recentSubs, isLoading: subsLoading } = useQuery({
    queryKey: ['channel-recent-subs', channelName],
    queryFn: async () => {
      const res = await api.get(`/channels/${channelName}/monetization/recent-subs?limit=50`);
      return res.data;
    },
    staleTime: 30000,
  });
  
  // Fetch recent bits
  const { data: recentBitsData, isLoading: recentBitsLoading } = useQuery({
    queryKey: ['channel-recent-bits', channelName],
    queryFn: async () => {
      const res = await api.get(`/channels/${channelName}/monetization/recent-bits?limit=50`);
      return res.data;
    },
    staleTime: 30000,
  });
  
  // Fetch raids
  const { data: raidsData, isLoading: raidsLoading } = useQuery({
    queryKey: ['channel-raids', channelName],
    queryFn: async () => {
      const res = await api.get(`/channels/${channelName}/monetization/raids?limit=50`);
      return res.data;
    },
    staleTime: 60000,
  });
  
  // Prepare chart data
  const chartData = useMemo(() => {
    if (!monetization?.daily) return [];
    return monetization.daily.map(d => ({
      date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      bits: d.bits,
      subs: d.subs,
      gifts: d.gifts
    }));
  }, [monetization?.daily]);
  
  // Pie chart data for sub breakdown
  const subBreakdownData = useMemo(() => {
    if (!monetization?.summary?.subscriptions) return [];
    const subs = monetization.summary.subscriptions;
    return [
      { name: 'New Subs', value: subs.newSubs, color: '#22c55e' },
      { name: 'Resubs', value: subs.resubs, color: '#a855f7' },
      { name: 'Gift Subs', value: subs.giftsGiven, color: '#ec4899' },
      { name: 'Prime', value: subs.primeSubs, color: '#3b82f6' },
    ].filter(d => d.value > 0);
  }, [monetization?.summary?.subscriptions]);
  
  const summary = monetization?.summary || {};
  const isLoading = monetizationLoading;
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with period selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500">
            <DollarSign className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Monetization</h2>
            <p className="text-sm text-gray-400">Track bits, subs, gifts, and more</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {[7, 30, 90, 365].map(days => (
            <button
              key={days}
              onClick={() => setPeriod(days)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                period === days
                  ? 'bg-twitch-purple text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {days === 365 ? '1y' : `${days}d`}
            </button>
          ))}
        </div>
      </div>
      
      {/* Overview Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Gem}
          label="Total Bits"
          value={summary.bits?.total || 0}
          subValue={`~$${summary.bits?.estimatedValue || '0.00'} value`}
          gradient="from-purple-500/20 to-pink-500/20"
          iconColor="text-purple-400"
        />
        <StatCard
          icon={Gift}
          label="Gift Subs Given"
          value={summary.subscriptions?.giftsGiven || 0}
          subValue={`${summary.subscriptions?.uniqueGifters || 0} gifters`}
          gradient="from-pink-500/20 to-red-500/20"
          iconColor="text-pink-400"
        />
        <StatCard
          icon={Star}
          label="Total Subs"
          value={(summary.subscriptions?.newSubs || 0) + (summary.subscriptions?.resubs || 0)}
          subValue={`${summary.subscriptions?.primeSubs || 0} Prime`}
          gradient="from-green-500/20 to-emerald-500/20"
          iconColor="text-green-400"
        />
        <StatCard
          icon={Radio}
          label="Raids Received"
          value={summary.raids?.total || 0}
          subValue={`${formatNumber(summary.raids?.totalViewers || 0)} viewers`}
          gradient="from-orange-500/20 to-yellow-500/20"
          iconColor="text-orange-400"
        />
      </div>
      
      {/* Hype Train & Tier Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-twitch-gray rounded-xl p-4 border border-gray-700/50 flex items-center gap-3">
          <PartyPopper className="w-8 h-8 text-yellow-400" />
          <div>
            <p className="text-xs text-gray-400">Hype Trains</p>
            <p className="text-xl font-bold text-white">{summary.hypeTrains?.total || 0}</p>
            <p className="text-xs text-yellow-400">Max Level: {summary.hypeTrains?.maxLevel || 0}</p>
          </div>
        </div>
        <div className="bg-twitch-gray rounded-xl p-4 border border-gray-700/50">
          <p className="text-xs text-gray-400 mb-2">Tier Breakdown</p>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <p className="text-lg font-bold text-purple-400">{summary.subscriptions?.byTier?.tier1 || 0}</p>
              <p className="text-xs text-gray-500">T1</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-cyan-400">{summary.subscriptions?.byTier?.tier2 || 0}</p>
              <p className="text-xs text-gray-500">T2</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-yellow-400">{summary.subscriptions?.byTier?.tier3 || 0}</p>
              <p className="text-xs text-gray-500">T3</p>
            </div>
          </div>
        </div>
        <div className="bg-twitch-gray rounded-xl p-4 border border-gray-700/50">
          <p className="text-xs text-gray-400 mb-1">Bit Events</p>
          <p className="text-xl font-bold text-white">{summary.bits?.events || 0}</p>
          <p className="text-xs text-purple-400">{summary.bits?.uniqueGivers || 0} unique cheerers</p>
        </div>
        <div className="bg-twitch-gray rounded-xl p-4 border border-gray-700/50">
          <p className="text-xs text-gray-400 mb-1">New Subs</p>
          <p className="text-xl font-bold text-green-400">{summary.subscriptions?.newSubs || 0}</p>
        </div>
        <div className="bg-twitch-gray rounded-xl p-4 border border-gray-700/50">
          <p className="text-xs text-gray-400 mb-1">Resubs</p>
          <p className="text-xl font-bold text-purple-400">{summary.subscriptions?.resubs || 0}</p>
        </div>
      </div>
      
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily Activity Chart */}
        <div className="lg:col-span-2 bg-twitch-gray rounded-xl border border-gray-700/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-twitch-purple" />
              Daily Activity
            </h3>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="bitsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="subsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="giftsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#6b7280" fontSize={12} tickLine={false} />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="bits" name="Bits" stroke="#a855f7" fill="url(#bitsGradient)" strokeWidth={2} />
                <Area type="monotone" dataKey="subs" name="Subs" stroke="#22c55e" fill="url(#subsGradient)" strokeWidth={2} />
                <Area type="monotone" dataKey="gifts" name="Gifts" stroke="#ec4899" fill="url(#giftsGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-500">
              No data available for this period
            </div>
          )}
        </div>
        
        {/* Sub Breakdown Pie */}
        <div className="bg-twitch-gray rounded-xl border border-gray-700/50 p-5">
          <h3 className="font-medium text-white flex items-center gap-2 mb-4">
            <Star className="w-5 h-5 text-green-400" />
            Subscription Breakdown
          </h3>
          {subBreakdownData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={subBreakdownData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {subBreakdownData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  content={({ payload }) => {
                    if (!payload?.length) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm">
                        <span style={{ color: data.color }}>{data.name}: {formatNumber(data.value)}</span>
                      </div>
                    );
                  }}
                />
                <Legend 
                  verticalAlign="bottom"
                  formatter={(value, entry) => (
                    <span className="text-gray-300 text-xs">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-500">
              No subscription data
            </div>
          )}
        </div>
      </div>
      
      {/* Section Tabs */}
      <div className="border-b border-gray-700">
        <nav className="flex space-x-4">
          {[
            { id: 'overview', label: 'Leaderboards', icon: Trophy },
            { id: 'subs', label: 'Recent Subs', icon: Star },
            { id: 'bits', label: 'Recent Bits', icon: Gem },
            { id: 'raids', label: 'Raids', icon: Radio },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors ${
                activeSection === tab.id
                  ? 'border-twitch-purple text-twitch-purple'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>
      
      {/* Section Content */}
      {activeSection === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Gifters */}
          <Leaderboard
            title="Top Gift Sub Givers"
            icon={Gift}
            iconColor="bg-pink-500"
            data={topGifters?.topGifters || []}
            emptyMessage="No gift subs recorded yet"
            columns={[
              { 
                key: 'totalGifts', 
                format: v => formatNumber(v),
                valueClass: 'text-pink-400 font-bold'
              }
            ]}
          />
          
          {/* Top Bit Givers */}
          <Leaderboard
            title="Top Bit Cheerers"
            icon={Gem}
            iconColor="bg-purple-500"
            data={topBits?.topBitGivers || []}
            emptyMessage="No bits recorded yet"
            columns={[
              { 
                key: 'totalBits', 
                format: v => formatNumber(v),
                valueClass: 'text-purple-400 font-bold',
                subKey: 'largestCheer',
                subFormat: v => `Largest: ${formatNumber(v)}`
              }
            ]}
          />
        </div>
      )}
      
      {activeSection === 'subs' && (
        <div className="bg-twitch-gray rounded-xl border border-gray-700/50">
          <div className="p-4 border-b border-gray-700/50 flex items-center justify-between">
            <h3 className="font-medium text-white flex items-center gap-2">
              <Star className="w-5 h-5 text-green-400" />
              Recent Subscriptions
            </h3>
            <span className="text-sm text-gray-400">{recentSubs?.total || 0} total</span>
          </div>
          
          {subsLoading ? (
            <div className="p-8 text-center">
              <LoadingSpinner />
            </div>
          ) : (recentSubs?.subscriptions?.length || 0) === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Star className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No subscriptions recorded yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700/50 max-h-[500px] overflow-y-auto">
              {recentSubs.subscriptions.map(sub => (
                <div key={sub.id} className="px-4 py-3 hover:bg-gray-700/20">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link to={`/user/${sub.user.username}`} className="text-white hover:text-twitch-purple font-medium">
                          {sub.user.displayName || sub.user.username}
                        </Link>
                        <SubTypeBadge type={sub.subType} />
                        <TierBadge tier={sub.tier} isPrime={sub.isPrime} />
                      </div>
                      
                      {sub.recipient && (
                        <p className="text-sm text-gray-400 mt-1">
                          Gifted to{' '}
                          <Link to={`/user/${sub.recipient.username}`} className="text-pink-400 hover:underline">
                            {sub.recipient.displayName || sub.recipient.username}
                          </Link>
                        </p>
                      )}
                      
                      {sub.giftCount > 1 && (
                        <p className="text-sm text-pink-400 mt-1">
                          <Sparkles className="w-3 h-3 inline mr-1" />
                          Gifted {sub.giftCount} subs!
                        </p>
                      )}
                      
                      {sub.cumulativeMonths > 1 && (
                        <p className="text-xs text-gray-500 mt-1">
                          {sub.cumulativeMonths} months total
                          {sub.streakMonths && ` • ${sub.streakMonths} month streak`}
                        </p>
                      )}
                      
                      {sub.message && (
                        <p className="text-sm text-gray-300 mt-2 italic">"{sub.message}"</p>
                      )}
                    </div>
                    
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {formatRelative(sub.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {activeSection === 'bits' && (
        <div className="bg-twitch-gray rounded-xl border border-gray-700/50">
          <div className="p-4 border-b border-gray-700/50 flex items-center justify-between">
            <h3 className="font-medium text-white flex items-center gap-2">
              <Gem className="w-5 h-5 text-purple-400" />
              Recent Bit Cheers
            </h3>
            <span className="text-sm text-gray-400">{recentBitsData?.total || 0} total</span>
          </div>
          
          {recentBitsLoading ? (
            <div className="p-8 text-center">
              <LoadingSpinner />
            </div>
          ) : (recentBitsData?.bits?.length || 0) === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Gem className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No bit cheers recorded yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700/50 max-h-[500px] overflow-y-auto">
              {recentBitsData.bits.map(bit => (
                <div key={bit.id} className="px-4 py-3 hover:bg-gray-700/20 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link to={`/user/${bit.user.username}`} className="text-white hover:text-twitch-purple font-medium">
                        {bit.user.displayName || bit.user.username}
                      </Link>
                      <span className={`font-bold ${
                        bit.amount >= 10000 ? 'text-red-400' :
                        bit.amount >= 5000 ? 'text-blue-400' :
                        bit.amount >= 1000 ? 'text-green-400' :
                        bit.amount >= 100 ? 'text-purple-400' :
                        'text-gray-400'
                      }`}>
                        {formatNumber(bit.amount)} bits
                      </span>
                    </div>
                    {bit.message && (
                      <p className="text-sm text-gray-300 mt-1">{bit.message}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {formatRelative(bit.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {activeSection === 'raids' && (
        <div className="space-y-4">
          {/* Raid Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-twitch-gray rounded-xl p-4 border border-gray-700/50">
              <p className="text-xs text-gray-400 mb-1">Total Raids</p>
              <p className="text-2xl font-bold text-white">{raidsData?.stats?.totalRaids || 0}</p>
            </div>
            <div className="bg-twitch-gray rounded-xl p-4 border border-gray-700/50">
              <p className="text-xs text-gray-400 mb-1">Total Raiders</p>
              <p className="text-2xl font-bold text-orange-400">{formatNumber(raidsData?.stats?.totalViewers || 0)}</p>
            </div>
            <div className="bg-twitch-gray rounded-xl p-4 border border-gray-700/50">
              <p className="text-xs text-gray-400 mb-1">Largest Raid</p>
              <p className="text-2xl font-bold text-green-400">{formatNumber(raidsData?.stats?.largestRaid || 0)}</p>
            </div>
            <div className="bg-twitch-gray rounded-xl p-4 border border-gray-700/50">
              <p className="text-xs text-gray-400 mb-1">Avg Viewers</p>
              <p className="text-2xl font-bold text-purple-400">{formatNumber(raidsData?.stats?.avgViewers || 0)}</p>
            </div>
          </div>
          
          {/* Raid List */}
          <div className="bg-twitch-gray rounded-xl border border-gray-700/50">
            <div className="p-4 border-b border-gray-700/50">
              <h3 className="font-medium text-white flex items-center gap-2">
                <Radio className="w-5 h-5 text-orange-400" />
                Raid History
              </h3>
            </div>
            
            {raidsLoading ? (
              <div className="p-8 text-center">
                <LoadingSpinner />
              </div>
            ) : (raidsData?.raids?.length || 0) === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Radio className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No raids recorded yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-700/50 max-h-[400px] overflow-y-auto">
                {raidsData.raids.map(raid => (
                  <div key={raid.id} className="px-4 py-3 hover:bg-gray-700/20 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-orange-500/20">
                        <Radio className="w-4 h-4 text-orange-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">
                          {raid.raiderChannel ? (
                            <Link to={`/channel/${raid.raiderChannel.name}`} className="hover:text-twitch-purple">
                              {raid.raiderDisplayName || raid.raiderName}
                            </Link>
                          ) : (
                            raid.raiderDisplayName || raid.raiderName
                          )}
                        </p>
                        <p className="text-xs text-gray-500">{formatRelative(raid.timestamp)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-orange-400 font-bold">{formatNumber(raid.viewerCount)}</p>
                      <p className="text-xs text-gray-500">viewers</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
