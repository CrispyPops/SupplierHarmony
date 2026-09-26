# Build status

The project has been converted to a local web application.

## User experience

Double-click `START-SUPPLIER-HARMONY.bat`. The script checks for Node.js, installs dependencies on first run, builds the frontend, starts the local server and opens the application in the browser.

## Local services

- Frontend: Vite/React
- Server: Node.js HTTP server
- Database: SQLite via Node.js built-in `node:sqlite`
- Authentication: local sessions and PBKDF2 password hashing
- Files: local filesystem
- Backups: ZIP files in `data/backups`

Initial administrator: `admin` / `root` (change immediately after first login).
