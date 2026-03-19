# SportCal — Bermuda Sports Events Calendar

**SportCal** is the official sports events calendar for Bermuda, built for the Department of Sports & Recreation. It allows national sports associations to publish and manage events, and the public to discover upcoming competitions and tournaments across the island.

---

## Features

- **Public Events Feed** — Browse all upcoming sports events with search, sport filtering, and smart sorting
- **Interactive Calendar** — Full calendar view (month/list) with colour-coded events by sport
- **Event Details** — Rich event pages with description, location, organizer, and share functionality
- **Organization Login** — Secure access-code-based authentication for each sports association
- **Create & Edit Events** — Authenticated organizations can manage their own events
- **Admin Dashboard** — Super admin analytics: event counts, sport breakdowns, organization activity, audit logs
- **Role-Based Access Control** — `user`, `admin`, and `super_admin` roles
- **Audit Logging** — All create/update/delete/login actions are logged
- **Image Support** — Events support image URLs or local file uploads

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 18 | UI framework |
| TypeScript | 5 | Type safety |
| Vite | 5 | Build tool |
| Tailwind CSS | 3 | Utility-first styling |
| FullCalendar | 6 | Interactive calendar |
| Axios | 1.6 | HTTP client |
| React Router | 6 | Client-side routing |
| React Hot Toast | 2.4 | Notifications |
| Lucide React | 0.358 | SVG icons |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Node.js | 20+ | Runtime |
| Express | 4.18 | HTTP framework |
| TypeScript | 5 | Type safety |
| Prisma ORM | 5 | Database ORM |
| SQLite | — | Database (dev) / PostgreSQL (prod) |
| JWT | 9 | Authentication tokens |
| Multer | 1.4 | File uploads |
| Helmet | 7 | Security headers |
| Morgan | 1.10 | HTTP logging |

### Design System
The UI follows the **NSGB HUB 2.0** design system:
- Brand gradient: `#1e3799` → `#e84393` (Blue to Pink)
- Glassmorphism navbar with `backdrop-filter: blur(12px)`
- Card-based layouts with soft shadows and hover lifts
- Inter font family, 16px base, 1.6 line height

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+

### Installation

```bash
# Clone the repository
git clone https://github.com/ejohnsonbda/sportcal.git
cd sportcal

# Install all dependencies
npm run install:all

# Set up the database
cd backend
cp .env.example .env
npm run db:migrate
npm run db:seed
cd ..
```

### Development

```bash
# Run both frontend and backend concurrently
npm run dev

# Or run separately:
npm run dev:backend   # API on http://localhost:3001
npm run dev:frontend  # App on http://localhost:5173
```

### Production Build

```bash
npm run build
```

---

## API Reference

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Login with access code |
| `GET` | `/api/auth/me` | Get current user |
| `POST` | `/api/auth/logout` | Logout |

### Events
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/events` | List events (with filters) |
| `GET` | `/api/events/:id` | Get single event |
| `POST` | `/api/events` | Create event (auth required) |
| `PUT` | `/api/events/:id` | Update event (owner/admin) |
| `DELETE` | `/api/events/:id` | Delete event (owner/admin) |
| `GET` | `/api/events/sports` | List distinct sports |

### Organizations
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/organizations` | List organizations (public) |
| `GET` | `/api/organizations/:id` | Get organization |
| `POST` | `/api/organizations` | Create org (admin) |
| `PUT` | `/api/organizations/:id` | Update org (admin) |
| `DELETE` | `/api/organizations/:id` | Deactivate org (super_admin) |

### Admin
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/stats` | Dashboard statistics |
| `GET` | `/api/admin/audit-logs` | Audit log entries |
| `GET` | `/api/admin/events` | All events incl. unpublished |
| `GET` | `/api/admin/organizations` | All orgs with access codes |
| `PATCH` | `/api/admin/events/:id/toggle-published` | Toggle event visibility |

---

## Access Credentials

### Super Admin
| Access Code | Name | Role |
|---|---|---|
| `safehands` | Department of Sports & Recreation | super_admin |
| `juren` | UMIN Design | super_admin |

### Organizations
Each of the 27 registered Bermuda sports associations has a unique access code. Contact the Department of Sports & Recreation for credentials.

---

## Environment Variables

### Backend (`backend/.env`)
```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"
PORT=3001
NODE_ENV=development
CORS_ORIGIN="http://localhost:5173"
```

---

## Project Structure

```
sportcal/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema
│   │   └── migrations/         # Migration files
│   ├── src/
│   │   ├── config/             # Database client
│   │   ├── controllers/        # Route handlers
│   │   ├── middleware/         # Auth, error handling
│   │   ├── routes/             # Express routers
│   │   └── utils/              # JWT, seed script
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── context/            # React context (Auth)
│   │   ├── lib/                # API client
│   │   ├── pages/              # Page components
│   │   ├── types/              # TypeScript types
│   │   └── utils/              # Utilities
│   └── package.json
└── README.md
```

---

## License

© 2026 Department of Sports & Recreation, Bermuda. All rights reserved.
