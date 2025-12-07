import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Database, 
  Table, 
  ChevronRight, 
  ChevronDown, 
  Key, 
  Link2, 
  Search,
  Play,
  AlertCircle,
  Clock,
  Hash,
  Loader2,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { adminApi } from '../../services/api';

function DatabaseViewerTab() {
  const [selectedTable, setSelectedTable] = useState(null);
  const [showSchema, setShowSchema] = useState(true);
  const [dataPage, setDataPage] = useState(0);
  const [orderBy, setOrderBy] = useState('id');
  const [orderDir, setOrderDir] = useState('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [customQuery, setCustomQuery] = useState('');
  const [queryResult, setQueryResult] = useState(null);
  const [queryError, setQueryError] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeView, setActiveView] = useState('browser'); // 'browser' or 'query'

  const ROWS_PER_PAGE = 50;

  // Fetch tables list
  const { data: tablesData, isLoading: tablesLoading } = useQuery({
    queryKey: ['admin', 'database', 'tables'],
    queryFn: () => adminApi.getDatabaseTables().then(res => res.data),
  });

  // Fetch table schema when selected
  const { data: schemaData, isLoading: schemaLoading } = useQuery({
    queryKey: ['admin', 'database', 'schema', selectedTable],
    queryFn: () => adminApi.getTableSchema(selectedTable).then(res => res.data),
    enabled: !!selectedTable,
  });

  // Fetch table data
  const { data: tableData, isLoading: dataLoading, refetch: refetchData } = useQuery({
    queryKey: ['admin', 'database', 'data', selectedTable, dataPage, orderBy, orderDir, searchQuery],
    queryFn: () => adminApi.getTableData(selectedTable, {
      limit: ROWS_PER_PAGE,
      offset: dataPage * ROWS_PER_PAGE,
      orderBy,
      orderDir,
      search: searchQuery
    }).then(res => res.data),
    enabled: !!selectedTable,
  });

  const handleTableSelect = (tableName) => {
    setSelectedTable(tableName);
    setDataPage(0);
    setOrderBy('id');
    setOrderDir('desc');
    setSearchQuery('');
  };

  const handleSort = (column) => {
    if (orderBy === column) {
      setOrderDir(orderDir === 'asc' ? 'desc' : 'asc');
    } else {
      setOrderBy(column);
      setOrderDir('desc');
    }
    setDataPage(0);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setDataPage(0);
    refetchData();
  };

  const executeQuery = async () => {
    if (!customQuery.trim()) return;
    
    setIsExecuting(true);
    setQueryError(null);
    setQueryResult(null);

    try {
      const response = await adminApi.executeDatabaseQuery(customQuery);
      setQueryResult(response.data);
    } catch (error) {
      setQueryError(error.response?.data?.error || error.message);
    } finally {
      setIsExecuting(false);
    }
  };

  const formatCellValue = (value) => {
    if (value === null) return <span className="text-gray-500 italic">NULL</span>;
    if (value === undefined) return <span className="text-gray-500 italic">undefined</span>;
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'object') {
      try {
        return <span className="text-xs font-mono">{JSON.stringify(value).slice(0, 100)}</span>;
      } catch {
        return '[Object]';
      }
    }
    const str = String(value);
    if (str.length > 100) return str.slice(0, 100) + '...';
    return str;
  };

  const tables = tablesData?.tables || [];
  const schema = schemaData?.columns || [];
  const rows = tableData?.rows || [];
  const totalRows = tableData?.total || 0;
  const totalPages = Math.ceil(totalRows / ROWS_PER_PAGE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Database className="w-6 h-6 text-twitch-purple" />
          <h2 className="text-xl font-semibold text-white">Database Viewer</h2>
          <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded">Read Only</span>
        </div>
        
        {/* View Toggle */}
        <div className="flex items-center space-x-2 bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setActiveView('browser')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              activeView === 'browser' 
                ? 'bg-twitch-purple text-white' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Table Browser
          </button>
          <button
            onClick={() => setActiveView('query')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              activeView === 'query' 
                ? 'bg-twitch-purple text-white' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            SQL Query
          </button>
        </div>
      </div>

      {activeView === 'browser' ? (
        <div className="flex gap-6">
          {/* Tables List */}
          <div className="w-64 flex-shrink-0">
            <div className="card">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Tables</h3>
              {tablesLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 text-twitch-purple animate-spin" />
                </div>
              ) : (
                <div className="space-y-1 max-h-[600px] overflow-y-auto">
                  {tables.map(table => (
                    <button
                      key={table.table_name}
                      onClick={() => handleTableSelect(table.table_name)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm transition-colors ${
                        selectedTable === table.table_name
                          ? 'bg-twitch-purple text-white'
                          : 'text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      <div className="flex items-center space-x-2 min-w-0">
                        <Table className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{table.table_name}</span>
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                        {table.row_count?.toLocaleString()}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Table Details */}
          <div className="flex-1 min-w-0">
            {selectedTable ? (
              <div className="space-y-4">
                {/* Table Header */}
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-medium text-white">{selectedTable}</h3>
                      <p className="text-sm text-gray-400">
                        {totalRows.toLocaleString()} rows • {schema.length} columns
                      </p>
                    </div>
                    <button
                      onClick={() => setShowSchema(!showSchema)}
                      className="flex items-center space-x-1 text-sm text-gray-400 hover:text-white"
                    >
                      {showSchema ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <span>Schema</span>
                    </button>
                  </div>

                  {/* Schema */}
                  {showSchema && (
                    <div className="border-t border-gray-700 pt-4">
                      {schemaLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-5 h-5 text-twitch-purple animate-spin" />
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {schema.map(col => (
                            <div 
                              key={col.column_name}
                              className="flex items-center space-x-2 px-2 py-1 bg-gray-800 rounded text-xs"
                            >
                              {col.is_primary_key && <Key className="w-3 h-3 text-yellow-500" title="Primary Key" />}
                              {col.foreign_key && <Link2 className="w-3 h-3 text-blue-500" title={`FK → ${col.foreign_key.foreign_table_name}`} />}
                              <span className="text-white truncate">{col.column_name}</span>
                              <span className="text-gray-500">{col.data_type}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Search */}
                <form onSubmit={handleSearch} className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search text columns..."
                      className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-twitch-purple"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-twitch-purple text-white rounded hover:bg-twitch-purple-dark"
                  >
                    Search
                  </button>
                </form>

                {/* Data Table */}
                <div className="card overflow-hidden">
                  {dataLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 text-twitch-purple animate-spin" />
                    </div>
                  ) : rows.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      No data found
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-700">
                              {schema.map(col => (
                                <th 
                                  key={col.column_name}
                                  onClick={() => handleSort(col.column_name)}
                                  className="px-3 py-2 text-left text-gray-400 font-medium cursor-pointer hover:text-white whitespace-nowrap"
                                >
                                  <div className="flex items-center space-x-1">
                                    <span>{col.column_name}</span>
                                    {orderBy === col.column_name && (
                                      orderDir === 'asc' 
                                        ? <ArrowUp className="w-3 h-3" />
                                        : <ArrowDown className="w-3 h-3" />
                                    )}
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row, i) => (
                              <tr 
                                key={i} 
                                className="border-b border-gray-800 hover:bg-gray-800/50"
                              >
                                {schema.map(col => (
                                  <td 
                                    key={col.column_name}
                                    className="px-3 py-2 text-gray-300 whitespace-nowrap max-w-xs truncate"
                                    title={String(row[col.column_name] ?? '')}
                                  >
                                    {formatCellValue(row[col.column_name])}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700">
                        <p className="text-sm text-gray-400">
                          Showing {dataPage * ROWS_PER_PAGE + 1} - {Math.min((dataPage + 1) * ROWS_PER_PAGE, totalRows)} of {totalRows.toLocaleString()}
                        </p>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setDataPage(p => Math.max(0, p - 1))}
                            disabled={dataPage === 0}
                            className="px-3 py-1 text-sm bg-gray-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600"
                          >
                            Previous
                          </button>
                          <span className="text-sm text-gray-400">
                            Page {dataPage + 1} of {totalPages}
                          </span>
                          <button
                            onClick={() => setDataPage(p => Math.min(totalPages - 1, p + 1))}
                            disabled={dataPage >= totalPages - 1}
                            className="px-3 py-1 text-sm bg-gray-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="card text-center py-12">
                <Database className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">Select a table to view its data</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* SQL Query View */
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Execute SQL Query</h3>
            <p className="text-xs text-gray-500 mb-3">Only SELECT queries are allowed. Results are limited to 100 rows.</p>
            
            <textarea
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              placeholder="SELECT * FROM users LIMIT 10"
              className="w-full h-32 px-4 py-3 bg-gray-800 border border-gray-700 rounded text-white font-mono text-sm placeholder-gray-500 focus:outline-none focus:border-twitch-purple resize-none"
            />
            
            <div className="flex items-center justify-between mt-3">
              <div className="text-xs text-gray-500">
                {queryResult && (
                  <span className="flex items-center space-x-2">
                    <Clock className="w-3 h-3" />
                    <span>{queryResult.executionTime}ms</span>
                    <span>•</span>
                    <Hash className="w-3 h-3" />
                    <span>{queryResult.rowCount} rows</span>
                  </span>
                )}
              </div>
              <button
                onClick={executeQuery}
                disabled={isExecuting || !customQuery.trim()}
                className="flex items-center space-x-2 px-4 py-2 bg-twitch-purple text-white rounded hover:bg-twitch-purple-dark disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExecuting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                <span>Execute</span>
              </button>
            </div>
          </div>

          {/* Query Error */}
          {queryError && (
            <div className="card bg-red-500/10 border border-red-500/50">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-red-400 font-medium">Query Error</h4>
                  <p className="text-sm text-red-300 mt-1 font-mono">{queryError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Query Results */}
          {queryResult && queryResult.rows.length > 0 && (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      {queryResult.fields.map((field, i) => (
                        <th 
                          key={i}
                          className="px-3 py-2 text-left text-gray-400 font-medium whitespace-nowrap"
                        >
                          {field.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {queryResult.rows.map((row, i) => (
                      <tr 
                        key={i} 
                        className="border-b border-gray-800 hover:bg-gray-800/50"
                      >
                        {queryResult.fields.map((field, j) => (
                          <td 
                            key={j}
                            className="px-3 py-2 text-gray-300 whitespace-nowrap max-w-xs truncate"
                            title={String(row[field.name] ?? '')}
                          >
                            {formatCellValue(row[field.name])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {queryResult && queryResult.rows.length === 0 && (
            <div className="card text-center py-8 text-gray-400">
              Query returned no results
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DatabaseViewerTab;
