import { useState } from 'react';

const DURATION_PRESETS = [
  { label: '1h', hours: 1 },
  { label: '6h', hours: 6 },
  { label: '24h', hours: 24 },
  { label: '7d', hours: 168 },
  { label: '30d', hours: 720 },
  { label: '∞', hours: null },
];

const ACTION_CONFIG = {
  block: {
    title: 'Block IP',
    description: 'Block all requests from this IP address',
    buttonColor: 'bg-red-600 hover:bg-red-700',
    buttonText: 'Block IP',
    reasonPlaceholder: 'e.g., Suspicious activity, spam',
  },
  'rate-limit': {
    title: 'Set Rate Limit',
    description: 'Apply a custom rate limit to this IP',
    buttonColor: 'bg-yellow-600 hover:bg-yellow-700',
    buttonText: 'Set Limit',
    reasonPlaceholder: 'e.g., High traffic user, API consumer',
  },
  whitelist: {
    title: 'Whitelist IP',
    description: 'Allow this IP to bypass rate limits',
    buttonColor: 'bg-green-600 hover:bg-green-700',
    buttonText: 'Whitelist IP',
    reasonPlaceholder: 'e.g., Trusted partner, internal service',
  },
};

/**
 * Modal for quick IP actions (block, rate-limit, whitelist)
 */
export default function QuickActionModal({
  ip,
  action,
  onClose,
  onSubmit,
  isLoading,
  isBulk = false,
  bulkCount = 0,
}) {
  const [reason, setReason] = useState('');
  const [rateLimit, setRateLimit] = useState(100);
  const [expiresAt, setExpiresAt] = useState('');
  const [selectedPreset, setSelectedPreset] = useState(null);

  const config = ACTION_CONFIG[action] || ACTION_CONFIG.block;

  const handlePresetClick = (hours) => {
    setSelectedPreset(hours);
    if (hours === null) {
      setExpiresAt('');
    } else {
      const date = new Date();
      date.setHours(date.getHours() + hours);
      setExpiresAt(date.toISOString().slice(0, 16));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ip,
      action,
      reason,
      rateLimit: action === 'rate-limit' ? rateLimit : undefined,
      expiresAt: expiresAt || null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl w-full max-w-md border border-gray-700 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div>
            <h3 className="text-lg font-semibold text-white">{config.title}</h3>
            <p className="text-sm text-gray-400 mt-0.5">{config.description}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* IP Address */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              {isBulk ? 'Selected IPs' : 'IP Address'}
            </label>
            <div className="bg-gray-900 rounded-lg px-4 py-2.5 border border-gray-700">
              {isBulk ? (
                <span className="text-purple-400 font-medium">{bulkCount} IPs selected</span>
              ) : (
                <span className="text-white font-mono">{ip}</span>
              )}
            </div>
          </div>

          {/* Rate Limit (only for rate-limit action) */}
          {action === 'rate-limit' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Requests per Minute
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={rateLimit}
                  onChange={(e) => setRateLimit(parseInt(e.target.value, 10) || 0)}
                  min="1"
                  max="10000"
                  className="flex-1 bg-gray-900 text-white rounded-lg px-4 py-2 border border-gray-700 focus:border-purple-500 focus:outline-none"
                />
                <div className="flex gap-1">
                  {[10, 50, 100, 500].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setRateLimit(val)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        rateLimit === val
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Reason <span className="text-gray-500">(optional)</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={config.reasonPlaceholder}
              className="w-full bg-gray-900 text-white rounded-lg px-4 py-2 border border-gray-700 focus:border-purple-500 focus:outline-none"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Duration</label>
            <div className="grid grid-cols-6 gap-2">
              {DURATION_PRESETS.map(({ label, hours }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => handlePresetClick(hours)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedPreset === hours || (hours === null && !expiresAt && selectedPreset === null)
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* Custom datetime input */}
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => {
                setExpiresAt(e.target.value);
                setSelectedPreset('custom');
              }}
              className="w-full mt-2 bg-gray-900 text-white rounded-lg px-4 py-2 border border-gray-700 focus:border-purple-500 focus:outline-none text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className={`flex-1 px-4 py-2.5 text-white rounded-lg transition-colors font-medium disabled:opacity-50 ${config.buttonColor}`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Applying...
                </span>
              ) : (
                config.buttonText
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
