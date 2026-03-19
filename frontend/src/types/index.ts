export interface User {
  id: string;
  organizationId: string;
  organizationName: string;
  role: 'user' | 'admin' | 'super_admin';
  isAdmin: boolean;
}

export interface Organization {
  id: string;
  name: string;
  email: string;
  sport?: string;
  logoUrl?: string;
  createdAt: string;
}

export interface Event {
  id: string;
  title: string;
  description?: string;
  date: string;
  time?: string;
  location?: string;
  organizationId: string;
  organizationName: string;
  imageUrl?: string;
  sport?: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface EventsResponse {
  data: Event[];
  pagination: Pagination;
}

export interface AdminStats {
  events: {
    total: number;
    published: number;
    upcoming: number;
    thisMonth: number;
  };
  organizations: {
    total: number;
    active: number;
  };
  recentEvents: Event[];
  sportBreakdown: { sport: string; count: number }[];
  orgBreakdown: { organization: string; count: number }[];
}

export type AuthContextType = {
  currentUser: User | null;
  token: string | null;
  login: (accessCode: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
};
