import { useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import { Loader2 } from 'lucide-react';

/**
 * InfiniteScroll wrapper component
 * Automatically loads more content when the user scrolls near the bottom
 */
function InfiniteScroll({
  children,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  isLoading,
  loadingComponent,
  endMessage = 'No more items to load',
  className = '',
}) {
  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: '100px',
  });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage && !isLoading) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, isLoading, fetchNextPage]);

  return (
    <div className={className}>
      {children}
      
      {/* Loading trigger / sentinel */}
      <div 
        ref={ref} 
        className="w-full py-4 flex flex-col items-center justify-center gap-2"
      >
        {isFetchingNextPage ? (
          loadingComponent || (
            <div className="flex items-center justify-center gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading more...</span>
            </div>
          )
        ) : hasNextPage ? (
          <button
            onClick={() => fetchNextPage()}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
          >
            Load more
          </button>
        ) : !isLoading ? (
          <div className="text-center text-gray-500 text-sm">
            {endMessage}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Simple loading spinner for initial load
 */
export function InfiniteScrollLoader() {
  return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="w-8 h-8 animate-spin text-twitch-purple" />
    </div>
  );
}

/**
 * Empty state component
 */
export function InfiniteScrollEmpty({ icon: Icon, message, submessage }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
      {Icon && <Icon className="w-12 h-12 mb-3 opacity-50" />}
      <p>{message}</p>
      {submessage && <p className="text-sm mt-1 text-gray-500">{submessage}</p>}
    </div>
  );
}

export default InfiniteScroll;
