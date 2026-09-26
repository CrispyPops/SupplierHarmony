# Supplier Harmony - Local Web Edition

This edition runs entirely on one Windows PC as a local web application. It does not use Lovable or Supabase at runtime.

## First use

1. Install Node.js LTS on the Windows PC if it is not already installed.
2. Extract this folder somewhere convenient, e.g. `C:\SupplierHarmony`.
3. Double-click `START-SUPPLIER-HARMONY.bat`.
4. The script installs dependencies on first run, builds the frontend, starts the local server, and opens Edge/Chrome at `http://127.0.0.1:3000`.
5. Log in with:
   - Username: `admin`
   - Password: `root`
6. Change the password immediately in Settings.

## Data location

All application data is stored under `data\\`:

- `data\\supplier-harmony.db` - SQLite database
- `data\\documents\\suppliers` - supplier files
- `data\\documents\\contracts` - contract files
- `data\\backups` - backups

## Portable use

The application folder can be copied to another Windows PC. Node.js must be installed on that PC. The database and documents remain in the `data` folder.

## Stopping the server

Close the console window running Supplier Harmony, or run `STOP-SUPPLIER-HARMONY.bat`.

## Multi-PC later

The frontend is kept separate from the local data layer so the local SQLite server can later be replaced with a central network API/PostgreSQL deployment without rebuilding the UI from scratch.
