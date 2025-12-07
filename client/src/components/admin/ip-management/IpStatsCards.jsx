import { useMemo } from 'react';

/**
 * Summary statistics cards for IP management
 */
export default function IpStatsCards({ liveData, rulesData, selectedCount = 0 }) {
  const stats = useMemo(() => {
    const rules = rulesData?.data?.rules || [];
    return {
      activeIps: liveData?.data?.totalActiveIps || 0,
      totalRequests: liveData?.data?.totalRequests || 0,
      blocked: rules.filter(r => (r.type || r.rule_type) === 'block').length,
      rateLimited: rules.filter(r => (r.type || r.rule_type) === 'rate-limit').length,
      whitelisted: rules.filter(r => (r.type || r.rule_type) === 'whitelist').length,
      expiringSoon: rules.filter(r => {
        if (!r.expires_at) return false;
        const expires = new Date(r.expires_at);
        const now = new Date();
        const hourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
        return expires > now && expires < hourFromNow;
      }).length,
    };
  }, [liveData, rulesData]);

  const cards = [
    {
      label: 'Active IPs',
      value: stats.activeIps,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
        </svg>
      ),
    },
    {
      label: 'Blocked',
      value: stats.blocked,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      ),
    },
    {
      label: 'Rate Limited',
      value: stats.rateLimited,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Whitelisted',
      value: stats.whitelisted,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
  ];

  // Add expiring soon if there are any
  if (stats.expiringSoon > 0) {
    cards.push({
      label: 'Expiring Soon',
      value: stats.expiringSoon,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/10',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    });
  }

  // Add selected count if any
  if (selectedCount > 0) {
    cards.push({
      label: 'Selected',
      value: selectedCount,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    });
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`${card.bgColor} rounded-lg p-4 border border-gray-700/50`}
        >
          <div className="flex items-center justify-between">
            <div className="text-gray-400 text-xs font-medium uppercase tracking-wide">
              {card.label}
            </div>
            <div className={card.color}>{card.icon}</div>
          </div>
          <div className={`text-2xl font-bold ${card.color} mt-2`}>{card.value}</div>
        </div>
      ))}
    </div>
  );
}
