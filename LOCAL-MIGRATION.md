# Local migration status

Supplier Harmony is now structured as a local web application for a single Windows PC.

- React/Vite frontend: retained
- Supabase runtime calls: replaced by local HTTP API
- Database: local SQLite using Node.js built-in SQLite
- Authentication: local cookie-backed sessions
- Roles: local admin/editor/viewer
- Documents: local filesystem under `data/documents`
- Backups: local ZIP files under `data/backups`
- Future multi-PC path: the frontend/data layer can be pointed at a central API/PostgreSQL service later

The application is started with `START-SUPPLIER-HARMONY.bat`.
