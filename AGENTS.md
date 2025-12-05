# Agent Instructions

## API Documentation Requirements

When making changes to the backend API:

1. **Always update `api.md`** - Document any new endpoints, parameters, request/response formats, or changes to existing endpoints.

2. **Always update the API Debug Panel** - Add new endpoints to `client/src/components/common/ApiDebugPanel.jsx` in the `apiEndpoints` array so they can be tested from the UI.

## API Debug Panel Structure

The debug panel organizes endpoints by category. When adding a new endpoint:

```javascript
{
  category: 'CategoryName',
  endpoints: [
    { 
      method: 'GET',           // HTTP method
      path: '/endpoint/:param', // Path with route params prefixed with :
      description: 'Short description',
      params: ['param', 'queryParam1', 'queryParam2'], // Path + query params
      body: { key: 'value' }   // Optional: for POST/PATCH/PUT requests
    },
  ]
}
```

## Checklist

- [ ] New API endpoint added to server
- [ ] Endpoint documented in `api.md`
- [ ] Endpoint added to `ApiDebugPanel.jsx`
- [ ] Client service/hook updated if needed
