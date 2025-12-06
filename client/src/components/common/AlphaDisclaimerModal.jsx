import { useState, useEffect } from 'react';
import { AlertTriangle, Construction } from 'lucide-react';

const STORAGE_KEY = 'chatterbox-alpha-accepted';
const CONFIRMATION_PHRASE = 'okay yeah i understand';

export default function AlphaDisclaimerModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    // Check if user has already accepted
    const accepted = localStorage.getItem(STORAGE_KEY);
    if (!accepted) {
      setIsOpen(true);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (inputValue.toLowerCase().trim() === CONFIRMATION_PHRASE) {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
      setIsOpen(false);
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-gray-800 border border-yellow-500/50 rounded-xl max-w-lg w-full shadow-2xl">
        {/* Header */}
        <div className="bg-yellow-500/20 border-b border-yellow-500/30 px-6 py-4 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/30 rounded-lg">
              <Construction className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-yellow-400">Alpha Software Warning</h2>
              <p className="text-yellow-300/70 text-sm">Please read before continuing</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-4">
          <div className="flex gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-300">
              <strong className="text-red-400">This is alpha software.</strong> You are using an early, unstable version of Chatterbox.
            </div>
          </div>

          <div className="space-y-3 text-gray-300 text-sm">
            <p>By continuing, you acknowledge and accept that:</p>
            <ul className="space-y-2 ml-4">
              <li className="flex gap-2">
                <span className="text-yellow-400">•</span>
                <span><strong>Things will break.</strong> Features may stop working without warning.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-yellow-400">•</span>
                <span><strong>Data will be deleted.</strong> Messages, users, and all stored data may be wiped at any time.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-yellow-400">•</span>
                <span><strong>Nothing is permanent.</strong> The UI, features, and functionality will change drastically.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-yellow-400">•</span>
                <span><strong>Expect instability.</strong> Crashes, errors, and unexpected behavior are normal.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-yellow-400">•</span>
                <span><strong>No guarantees.</strong> We make no promises about uptime, data retention, or feature availability.</span>
              </li>
            </ul>
          </div>

          <div className="pt-2">
            <p className="text-gray-400 text-sm mb-3">
              To continue, type <code className="bg-gray-700 px-2 py-0.5 rounded text-yellow-400 font-mono">{CONFIRMATION_PHRASE}</code> below:
            </p>
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type the phrase to continue..."
                autoFocus
                className={`w-full px-4 py-3 bg-gray-900 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors ${
                  error 
                    ? 'border-red-500 focus:ring-red-500/50' 
                    : 'border-gray-600 focus:border-yellow-500 focus:ring-yellow-500/50'
                }`}
              />
              {error && (
                <p className="text-red-400 text-sm mt-2">
                  That doesn't match. Please type exactly: "{CONFIRMATION_PHRASE}"
                </p>
              )}
              <button
                type="submit"
                disabled={inputValue.toLowerCase().trim() !== CONFIRMATION_PHRASE}
                className="w-full mt-4 px-4 py-3 bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-600 disabled:cursor-not-allowed text-gray-900 disabled:text-gray-400 font-semibold rounded-lg transition-colors"
              >
                I Understand, Let Me In
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-900/50 border-t border-gray-700 rounded-b-xl">
          <p className="text-xs text-gray-500 text-center">
            This disclaimer will only be shown once per browser.
          </p>
        </div>
      </div>
    </div>
  );
}
