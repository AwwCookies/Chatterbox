import { useState } from 'react';

/**
 * Modal for adding new IP rules
 */
export default function AddRuleModal({ onClose, onSubmit, isLoading }) {
  const [rule, setRule] = useState({
    ip: '',
    type: 'block',
    reason: '',
    rateLimit: 100,
    expiresAt: '',
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...rule,
      expiresAt: rule.expiresAt || null,
      rateLimit: rule.type === 'rate-limit' ? rule.rateLimit : undefined,
    });
  };

  const setQuickExpiry = (hours) => {
    if (hours === null) {
      setRule({ ...rule, expiresAt: '' });
    } else {
      const date = new Date();
      date.setHours(date.getHours() + hours);
      setRule({ ...rule, expiresAt: date.toISOString().slice(0, 16) });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl w-full max-w-lg border border-gray-700 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800">
          <div>
            <h3 className="text-lg font-semibold text-white">Add IP Rule</h3>
            <p className="text-sm text-gray-400 mt-0.5">Create a new block, rate-limit, or whitelist rule</p>
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
              IP Address <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={rule.ip}
              onChange={(e) => setRule({ ...rule, ip: e.target.value })}
              placeholder="192.168.1.1 or 192.168.1.0/24"
              className="w-full bg-gray-900 text-white rounded-lg px-4 py-2.5 border border-gray-700 focus:border-purple-500 focus:outline-none font-mono"
              autoFocus
            />
            <p className="text-gray-500 text-xs mt-1.5">
              Supports individual IPs, CIDR notation, or IPv6 addresses
            </p>
          </div>

          {/* Rule Type - Visual Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Rule Type</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'block', label: 'Block', icon: '🚫', color: 'red', desc: 'Deny all access' },
                { value: 'rate-limit', label: 'Rate Limit', icon: '⏱️', color: 'yellow', desc: 'Custom limit' },
                { value: 'whitelist', label: 'Whitelist', icon: '✅', color: 'green', desc: 'Skip limits' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRule({ ...rule, type: opt.value })}
                  className={`p-3 rounded-lg border-2 transition-all text-left ${
                    rule.type === opt.value
                      ? `border-${opt.color}-500 bg-${opt.color}-500/10`
                      : 'border-gray-700 hover:border-gray-600 bg-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{opt.icon}</span>
                    <span className={`font-medium ${rule.type === opt.value ? `text-${opt.color}-400` : 'text-white'}`}>
                      {opt.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Rate Limit (only for rate-limit type) */}
          {rule.type === 'rate-limit' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Requests per Minute
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={rule.rateLimit}
                  onChange={(e) => setRule({ ...rule, rateLimit: parseInt(e.target.value, 10) || 0 })}
                  min="1"
                  max="10000"
                  className="flex-1 bg-gray-900 text-white rounded-lg px-4 py-2 border border-gray-700 focus:border-purple-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-2 mt-2">
                {[10, 30, 60, 100, 200, 500].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setRule({ ...rule, rateLimit: val })}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      rule.rateLimit === val
                        ? 'bg-yellow-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {val}/min
                  </button>
                ))}
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
              value={rule.reason}
              onChange={(e) => setRule({ ...rule, reason: e.target.value })}
              placeholder="Add a note about why this rule was created"
              className="w-full bg-gray-900 text-white rounded-lg px-4 py-2 border border-gray-700 focus:border-purple-500 focus:outline-none"
            />
          </div>

          {/* Duration Quick Picks */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Duration</label>
            <div className="flex flex-wrap gap-2">
              {[
                { label: '1 hour', hours: 1 },
                { label: '6 hours', hours: 6 },
                { label: '24 hours', hours: 24 },
                { label: '7 days', hours: 168 },
                { label: '30 days', hours: 720 },
                { label: 'Permanent', hours: null },
              ].map(({ label, hours }) => {
                const isSelected = hours === null ? !rule.expiresAt : false;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setQuickExpiry(hours)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Advanced Options Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Advanced Options
          </button>

          {/* Advanced Options */}
          {showAdvanced && (
            <div className="space-y-4 p-4 bg-gray-900 rounded-lg border border-gray-700">
              {/* Custom Expiration */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Custom Expiration
                </label>
                <input
                  type="datetime-local"
                  value={rule.expiresAt}
                  onChange={(e) => setRule({ ...rule, expiresAt: e.target.value })}
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-purple-500 focus:outline-none"
                />
                <p className="text-gray-500 text-xs mt-1">Leave empty for permanent rule</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !rule.ip}
              className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Adding...
                </span>
              ) : (
                'Add Rule'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
