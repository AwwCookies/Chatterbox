import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatNumber } from '../../utils/formatters';

function MobileStatCard({ icon: Icon, label, value, subValue, color = 'text-twitch-purple', trend, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`flex-1 min-w-[140px] bg-twitch-gray rounded-xl p-4 border border-gray-700 ${
        onClick ? 'active:bg-gray-700 active:scale-98' : ''
      } transition-all`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-lg bg-gray-700/50 ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        {trend !== undefined && trend !== null && (
          <div className={`flex items-center text-xs font-medium ${
            trend > 0 ? 'text-green-400' : trend < 0 ? 'text-red-400' : 'text-gray-400'
          }`}>
            {trend > 0 ? (
              <ArrowUpRight className="w-3 h-3 mr-0.5" />
            ) : trend < 0 ? (
              <ArrowDownRight className="w-3 h-3 mr-0.5" />
            ) : null}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className="text-xl font-bold text-white text-left">{formatNumber(value)}</p>
      <p className="text-xs text-gray-400 text-left mt-0.5">{label}</p>
      {subValue && (
        <p className="text-[10px] text-gray-500 text-left mt-1">{subValue}</p>
      )}
    </button>
  );
}

export default MobileStatCard;
