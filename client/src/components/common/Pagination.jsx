import { ChevronLeft, ChevronRight } from 'lucide-react';

function Pagination({ 
  currentPage, 
  totalPages, 
  onPageChange,
  className = '' 
}) {
  const pages = [];
  const maxVisible = 5;
  
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);
  
  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1);
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="p-2 rounded-md bg-twitch-gray text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {start > 1 && (
        <>
          <button
            onClick={() => onPageChange(1)}
            className="px-3 py-1 rounded-md bg-twitch-gray text-white hover:bg-gray-600"
          >
            1
          </button>
          {start > 2 && <span className="text-gray-400">...</span>}
        </>
      )}

      {pages.map(page => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          className={`px-3 py-1 rounded-md ${
            page === currentPage
              ? 'bg-twitch-purple text-white'
              : 'bg-twitch-gray text-white hover:bg-gray-600'
          }`}
        >
          {page}
        </button>
      ))}

      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="text-gray-400">...</span>}
          <button
            onClick={() => onPageChange(totalPages)}
            className="px-3 py-1 rounded-md bg-twitch-gray text-white hover:bg-gray-600"
          >
            {totalPages}
          </button>
        </>
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="p-2 rounded-md bg-twitch-gray text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

export default Pagination;
