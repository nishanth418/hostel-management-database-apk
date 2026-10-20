# Hostel Management System - Mobile Backend

Completely independent, standalone cloud backend service designed for the Flutter Android Hostel Management mobile application.

## Architecture
- **Framework**: Express.js (Node.js)
- **Deployment Target**: Render Web Service
- **Database Support**: PostgreSQL (Supabase / Cloud Postgres) & MySQL (Aiven Cloud / Cloud MySQL)
- **Tables**: All 18 relational application tables
- **Mobile Compatibility**: Fully compatible with Flutter Android client endpoints and CRUD operations

## Key Endpoints
- `GET /api/health` - Comprehensive health & database connectivity status
- `GET /api/dashboard/stats` - Executive dashboard statistics & occupancy
- `GET /api/students` - Student residents listing & profile data
- `GET /api/hostels` - Hostel blocks, capacity, warden info
- `GET /api/rooms` - Room records, floor numbers, occupancy
- `GET /api/room-types` - Room type catalog (Single/Double/AC)
- `GET /api/wardens` - Warden directory and contact numbers
- `GET /api/mess` - Mess facilities, meal plans, catering
- `GET /api/meals` - Dining menus and pricing
- `GET /api/staff` - Mess staff personnel and roles
- `GET /api/suppliers` - Food & logistics vendor catalog
- `GET /api/inventory` - Stock items, categories, and inventory counts
- `GET /api/procurements` - Mess procurement batches
- `GET /api/payments` - Fee payment transactions & receipts
- `GET /api/reports` - Analytical report catalog & SQL generators
- `GET /api/tables` - Table explorer metadata
- `POST /api/query` - SQL Studio console executor
