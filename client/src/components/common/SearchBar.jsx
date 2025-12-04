import { useState } from 'react';
import { Search, X } from 'lucide-react';

function SearchBar({ 
  placeholder = 'Search...', 
  onSearch, 
  defaultValue = '',
  className = '' 
}) {
  const [value, setValue] = useState(defaultValue);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch?.(value);
  };

  const handleClear = () => {
    setValue('');
    onSearch?.('');
  };

  return (
    <form onSubmit={handleSubmit} className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-twitch-dark border border-gray-600 rounded-md py-2 pl-10 pr-10 text-white placeholder-gray-400 focus:outline-none focus:border-twitch-purple"
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </form>
  );
}

export default SearchBar;
