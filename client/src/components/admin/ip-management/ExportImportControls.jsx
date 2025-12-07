import { useRef } from 'react';

/**
 * Export/Import controls for IP rules
 */
export default function ExportImportControls({ rules, onImport, isLoading }) {
  const fileInputRef = useRef(null);

  const handleExport = (format) => {
    const data = rules?.data?.rules || [];
    
    if (format === 'json') {
      const jsonData = JSON.stringify(data, null, 2);
      downloadFile(jsonData, 'ip-rules.json', 'application/json');
    } else if (format === 'csv') {
      const headers = ['ip_address', 'rule_type', 'reason', 'rate_limit', 'expires_at', 'created_at'];
      const csvRows = [
        headers.join(','),
        ...data.map(rule => [
          rule.ip_address || rule.ip,
          rule.rule_type || rule.type,
          `"${(rule.reason || '').replace(/"/g, '""')}"`,
          rule.rate_limit_override || rule.rate_limit || '',
          rule.expires_at || '',
          rule.created_at || ''
        ].join(','))
      ];
      downloadFile(csvRows.join('\n'), 'ip-rules.csv', 'text/csv');
    }
  };

  const downloadFile = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      let rules;

      if (file.name.endsWith('.json')) {
        rules = JSON.parse(text);
      } else if (file.name.endsWith('.csv')) {
        // Parse CSV
        const lines = text.split('\n').filter(l => l.trim());
        const headers = lines[0].split(',');
        rules = lines.slice(1).map(line => {
          const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
          const rule = {};
          headers.forEach((header, i) => {
            let value = values[i] || '';
            // Remove quotes from CSV values
            if (value.startsWith('"') && value.endsWith('"')) {
              value = value.slice(1, -1).replace(/""/g, '"');
            }
            rule[header.trim()] = value;
          });
          return rule;
        });
      } else {
        throw new Error('Unsupported file format. Please use .json or .csv');
      }

      onImport?.(rules);
    } catch (err) {
      alert('Failed to import file: ' + err.message);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const ruleCount = rules?.data?.rules?.length || 0;

  return (
    <div className="flex items-center gap-2">
      {/* Export Dropdown */}
      <div className="relative group">
        <button
          disabled={ruleCount === 0}
          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export ({ruleCount})
        </button>
        <div className="absolute right-0 mt-1 w-32 bg-gray-800 rounded-lg border border-gray-700 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
          <button
            onClick={() => handleExport('json')}
            className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 rounded-t-lg"
          >
            Export as JSON
          </button>
          <button
            onClick={() => handleExport('csv')}
            className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 rounded-b-lg"
          >
            Export as CSV
          </button>
        </div>
      </div>

      {/* Import Button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isLoading}
        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        Import
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.csv"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
