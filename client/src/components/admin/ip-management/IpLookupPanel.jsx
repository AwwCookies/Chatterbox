import { useState } from 'react';

/**
 * IP Lookup Panel - Shows detailed information about an IP
 * Can integrate with external services for geolocation
 */
export default function IpLookupPanel({ onLookup, onClose }) {
  const [ip, setIp] = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLookup = async () => {
    if (!ip) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Use ip-api.com free service (no API key needed)
      const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,mobile,proxy,hosting,query`);
      const data = await response.json();
      
      if (data.status === 'fail') {
        setError(data.message || 'Failed to lookup IP');
        setLookupResult(null);
      } else {
        setLookupResult(data);
      }
    } catch (err) {
      setError('Failed to lookup IP: ' + err.message);
      setLookupResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const getRiskIndicators = () => {
    if (!lookupResult) return [];
    const risks = [];
    
    if (lookupResult.proxy) {
      risks.push({ label: 'Proxy/VPN', level: 'high', icon: '🔒' });
    }
    if (lookupResult.hosting) {
      risks.push({ label: 'Hosting/DC', level: 'medium', icon: '🖥️' });
    }
    if (lookupResult.mobile) {
      risks.push({ label: 'Mobile', level: 'low', icon: '📱' });
    }
    
    return risks;
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          IP Lookup
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
          placeholder="Enter IP address..."
          className="flex-1 bg-gray-900 text-white rounded-lg px-4 py-2 border border-gray-700 focus:border-purple-500 focus:outline-none font-mono"
        />
        <button
          onClick={handleLookup}
          disabled={isLoading || !ip}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Looking up...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Lookup
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {lookupResult && (
        <div className="space-y-4">
          {/* Risk Indicators */}
          {getRiskIndicators().length > 0 && (
            <div className="flex flex-wrap gap-2">
              {getRiskIndicators().map((risk, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                    risk.level === 'high' ? 'bg-red-500/20 text-red-400' :
                    risk.level === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}
                >
                  <span>{risk.icon}</span>
                  {risk.label}
                </span>
              ))}
            </div>
          )}

          {/* Location Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-900 rounded-lg p-3">
              <div className="text-gray-400 text-xs uppercase tracking-wide mb-1">Location</div>
              <div className="text-white font-medium">
                {lookupResult.city && `${lookupResult.city}, `}
                {lookupResult.regionName && `${lookupResult.regionName}, `}
                {lookupResult.country}
              </div>
              {lookupResult.countryCode && (
                <div className="text-gray-500 text-sm mt-0.5">
                  {lookupResult.countryCode} • {lookupResult.zip || 'N/A'}
                </div>
              )}
            </div>

            <div className="bg-gray-900 rounded-lg p-3">
              <div className="text-gray-400 text-xs uppercase tracking-wide mb-1">Coordinates</div>
              <div className="text-white font-mono text-sm">
                {lookupResult.lat?.toFixed(4)}, {lookupResult.lon?.toFixed(4)}
              </div>
              <div className="text-gray-500 text-sm mt-0.5">
                {lookupResult.timezone || 'N/A'}
              </div>
            </div>

            <div className="bg-gray-900 rounded-lg p-3">
              <div className="text-gray-400 text-xs uppercase tracking-wide mb-1">ISP</div>
              <div className="text-white text-sm truncate" title={lookupResult.isp}>
                {lookupResult.isp || 'Unknown'}
              </div>
              <div className="text-gray-500 text-sm mt-0.5 truncate" title={lookupResult.org}>
                {lookupResult.org || 'N/A'}
              </div>
            </div>

            <div className="bg-gray-900 rounded-lg p-3">
              <div className="text-gray-400 text-xs uppercase tracking-wide mb-1">ASN</div>
              <div className="text-white font-mono text-sm truncate" title={lookupResult.as}>
                {lookupResult.as || 'N/A'}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 pt-2 border-t border-gray-700">
            <button
              onClick={() => onLookup?.(lookupResult.query, 'block')}
              className="flex-1 px-3 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors text-sm font-medium"
            >
              Block IP
            </button>
            <button
              onClick={() => onLookup?.(lookupResult.query, 'rate-limit')}
              className="flex-1 px-3 py-2 bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 rounded-lg transition-colors text-sm font-medium"
            >
              Rate Limit
            </button>
            <button
              onClick={() => onLookup?.(lookupResult.query, 'whitelist')}
              className="flex-1 px-3 py-2 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg transition-colors text-sm font-medium"
            >
              Whitelist
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!lookupResult && !error && !isLoading && (
        <div className="text-center py-8 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>Enter an IP address to look up its geolocation and details</p>
          <p className="text-sm text-gray-600 mt-1">Powered by ip-api.com</p>
        </div>
      )}
    </div>
  );
}
