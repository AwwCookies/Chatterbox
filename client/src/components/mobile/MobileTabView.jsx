import { useState } from 'react';
import { useSwipe } from '../../hooks/useMobile';

function MobileTabView({ tabs, activeTab, onChange, children }) {
  const swipeHandlers = useSwipe(
    () => {
      // Swipe left - go to next tab
      const currentIndex = tabs.findIndex(t => t.id === activeTab);
      if (currentIndex < tabs.length - 1) {
        onChange(tabs[currentIndex + 1].id);
      }
    },
    () => {
      // Swipe right - go to previous tab
      const currentIndex = tabs.findIndex(t => t.id === activeTab);
      if (currentIndex > 0) {
        onChange(tabs[currentIndex - 1].id);
      }
    },
    { threshold: 50 }
  );

  const activeIndex = tabs.findIndex(t => t.id === activeTab);

  return (
    <div className="flex flex-col h-full">
      {/* Tab headers */}
      <div className="flex border-b border-gray-700 bg-twitch-gray sticky top-0 z-10 overflow-x-auto scrollbar-hide">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex-1 min-w-[80px] flex flex-col items-center py-3 px-4 relative transition-colors ${
              activeTab === tab.id
                ? 'text-twitch-purple'
                : 'text-gray-400 active:text-gray-300'
            }`}
          >
            {tab.icon && <tab.icon className="w-5 h-5 mb-1" />}
            <span className="text-xs font-medium whitespace-nowrap">{tab.label}</span>
            {tab.badge && (
              <span className="absolute top-2 right-2 px-1.5 py-0.5 text-[10px] font-medium bg-red-500 text-white rounded-full">
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            )}
            {/* Active indicator */}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-twitch-purple rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content with swipe */}
      <div 
        className="flex-1 overflow-hidden"
        {...swipeHandlers}
      >
        <div 
          className="flex h-full transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {tabs.map((tab) => (
            <div key={tab.id} className="w-full h-full flex-shrink-0 overflow-y-auto">
              {children(tab.id)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Simpler scrollable tab bar
function MobileScrollableTabs({ tabs, activeTab, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide p-2 bg-twitch-dark">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all ${
            activeTab === tab.id
              ? 'bg-twitch-purple text-white'
              : 'bg-twitch-gray text-gray-300 active:bg-gray-700'
          }`}
        >
          {tab.dotColor ? (
            <span className={`w-2 h-2 rounded-full ${tab.dotColor}`} />
          ) : tab.icon ? (
            <tab.icon className="w-4 h-4" />
          ) : null}
          <span className="text-sm font-medium">{tab.label}</span>
          {tab.badge !== undefined && tab.badge !== null && (
            <span className={`px-1.5 py-0.5 text-xs font-medium rounded-full ${
              activeTab === tab.id ? 'bg-white/20' : 'bg-gray-600'
            }`}>
              {typeof tab.badge === 'number' ? tab.badge.toLocaleString() : tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export { MobileTabView, MobileScrollableTabs };
export default MobileTabView;
