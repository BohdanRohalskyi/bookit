# Frontend Specification — Bookit

> **Implementation-Ready Frontend Specification**
>
> Derived from: BACKEND-SPEC-Bookit-20260331.md, api/openapi/spec.yaml

---

## Document Information

| Attribute | Value |
|-----------|-------|
| Document version | v1.0 |
| Created date | 2026-03-31 |
| Framework | Vite + React 18 + TypeScript |
| Router | React Router v6 |
| UI Library | shadcn/ui (Tailwind CSS) |
| Server State | TanStack Query v5 |
| Client State | Zustand |
| HTTP Client | openapi-fetch |

---

## 1. Project Structure

```
frontend/
├── src/
│   ├── api/
│   │   ├── client.ts              # openapi-fetch client setup
│   │   ├── types.ts               # Generated from OpenAPI (do not edit)
│   │   └── queryKeys.ts           # Query key factory
│   │
│   ├── components/
│   │   ├── ui/                    # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   └── ...
│   │   ├── forms/                 # Form components
│   │   │   ├── LoginForm.tsx
│   │   │   ├── RegisterForm.tsx
│   │   │   ├── BusinessForm.tsx
│   │   │   ├── LocationForm.tsx
│   │   │   ├── ServiceForm.tsx
│   │   │   └── BookingForm.tsx
│   │   ├── layouts/               # Layout components
│   │   │   ├── AppLayout.tsx
│   │   │   ├── AuthLayout.tsx
│   │   │   └── ProviderLayout.tsx
│   │   └── shared/                # Shared components
│   │       ├── ProtectedRoute.tsx
│   │       ├── LoadingSpinner.tsx
│   │       ├── ErrorState.tsx
│   │       ├── EmptyState.tsx
│   │       ├── Pagination.tsx
│   │       └── ConfirmDialog.tsx
│   │
│   ├── features/                  # Feature modules
│   │   ├── auth/
│   │   ├── bookings/
│   │   ├── businesses/
│   │   ├── locations/
│   │   ├── services/
│   │   ├── staff/
│   │   ├── equipment/
│   │   └── search/
│   │
│   ├── hooks/                     # Shared hooks
│   │   ├── useAuth.ts
│   │   └── useDebounce.ts
│   │
│   ├── pages/                     # Route pages
│   │   ├── auth/
│   │   ├── customer/
│   │   └── provider/
│   │
│   ├── stores/                    # Zustand stores
│   │   ├── authStore.ts
│   │   └── uiStore.ts
│   │
│   ├── lib/                       # Utilities
│   │   ├── utils.ts               # cn() helper, etc.
│   │   └── validation.ts          # Zod schemas
│   │
│   ├── router/
│   │   └── index.tsx              # Route config
│   │
│   ├── App.tsx
│   └── main.tsx
│
├── public/
├── index.html
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── components.json                 # shadcn/ui config
└── vite.config.ts
```

---

## 2. Authentication Configuration

| Setting | Value |
|---------|-------|
| Token storage | httpOnly cookie (set by backend) |
| Token refresh | Interceptor-based (retry on 401) |
| Access token lifetime | 30 minutes |
| Refresh token lifetime | 30 days |

---

## 3. API Client Setup

### 3.1 Type Generation

```bash
# Generate types from OpenAPI spec
npx openapi-typescript ../api/openapi/spec.yaml -o src/api/types.ts
```

Add to `package.json`:
```json
{
  "scripts": {
    "generate:types": "openapi-typescript ../api/openapi/spec.yaml -o src/api/types.ts"
  }
}
```

### 3.2 Client Configuration

```typescript
// src/api/client.ts
import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './types';
import { useAuthStore } from '../stores/authStore';

const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// Create typed client
export const client = createClient<paths>({
  baseUrl,
  credentials: 'include', // Send httpOnly cookies
});

// Auth refresh middleware
const authMiddleware: Middleware = {
  async onResponse({ response, request }) {
    // Skip if already a refresh request
    if (request.url.includes('/auth/refresh')) {
      return response;
    }

    // Handle 401 - attempt token refresh
    if (response.status === 401) {
      const refreshResponse = await client.POST('/api/v1/auth/refresh', {});

      if (refreshResponse.response.ok) {
        // Retry original request with new cookie
        return client.fetch(request);
      } else {
        // Refresh failed - logout
        useAuthStore.getState().logout();
        window.location.href = '/auth/login';
      }
    }

    return response;
  },
};

client.use(authMiddleware);

export default client;
```

### 3.3 Query Key Factory

```typescript
// src/api/queryKeys.ts
export const queryKeys = {
  // Auth
  auth: {
    user: () => ['auth', 'user'] as const,
  },

  // Businesses
  businesses: {
    all: () => ['businesses'] as const,
    list: (params?: { page?: number }) =>
      ['businesses', 'list', params] as const,
    detail: (id: string) =>
      ['businesses', 'detail', id] as const,
  },

  // Locations
  locations: {
    all: () => ['locations'] as const,
    list: (businessId: string, params?: { page?: number }) =>
      ['locations', 'list', businessId, params] as const,
    detail: (id: string) =>
      ['locations', 'detail', id] as const,
  },

  // Services
  services: {
    all: () => ['services'] as const,
    list: (locationId: string, params?: { page?: number }) =>
      ['services', 'list', locationId, params] as const,
    detail: (id: string) =>
      ['services', 'detail', id] as const,
  },

  // Staff
  staff: {
    all: () => ['staff'] as const,
    list: (locationId: string, params?: { page?: number }) =>
      ['staff', 'list', locationId, params] as const,
    detail: (id: string) =>
      ['staff', 'detail', id] as const,
  },

  // Equipment
  equipment: {
    all: () => ['equipment'] as const,
    list: (locationId: string, params?: { page?: number }) =>
      ['equipment', 'list', locationId, params] as const,
    detail: (id: string) =>
      ['equipment', 'detail', id] as const,
  },

  // Bookings
  bookings: {
    all: () => ['bookings'] as const,
    mine: (params?: { status?: string; page?: number }) =>
      ['bookings', 'mine', params] as const,
    provider: (params?: { locationId?: string; status?: string; page?: number }) =>
      ['bookings', 'provider', params] as const,
    detail: (id: string) =>
      ['bookings', 'detail', id] as const,
  },

  // Availability
  availability: {
    slots: (serviceId: string, date: string, duration?: number) =>
      ['availability', 'slots', serviceId, date, duration] as const,
    location: (locationId: string) =>
      ['availability', 'location', locationId] as const,
  },

  // Search
  search: {
    locations: (params?: { q?: string; category?: string; city?: string }) =>
      ['search', 'locations', params] as const,
  },
} as const;
```

---

## 4. State Management

### 4.1 Auth Store (Zustand)

```typescript
// src/stores/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { components } from '../api/types';
import client from '../api/client';

type User = components['schemas']['User'];

interface AuthState {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  setUser: (user: User) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false,

      setUser: (user) => set({
        user,
        isAuthenticated: true
      }),

      logout: async () => {
        try {
          await client.POST('/api/v1/auth/logout', {});
        } catch {
          // Ignore logout errors
        }
        set({
          user: null,
          isAuthenticated: false
        });
      },

      checkAuth: async () => {
        if (get().isInitialized) return;

        set({ isLoading: true });
        try {
          const { data } = await client.GET('/api/v1/users/me', {});
          if (data) {
            set({
              user: data,
              isAuthenticated: true
            });
          }
        } catch {
          set({
            user: null,
            isAuthenticated: false
          });
        } finally {
          set({
            isLoading: false,
            isInitialized: true
          });
        }
      },
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
```

### 4.2 UI Store (Zustand)

```typescript
// src/stores/uiStore.ts
import { create } from 'zustand';

interface UIState {
  // Sidebar state
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  // Modal state
  confirmDialog: {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null;
  showConfirmDialog: (config: Omit<NonNullable<UIState['confirmDialog']>, 'isOpen'>) => void;
  hideConfirmDialog: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  confirmDialog: null,
  showConfirmDialog: (config) => set({
    confirmDialog: { ...config, isOpen: true }
  }),
  hideConfirmDialog: () => set({ confirmDialog: null }),
}));
```

---

## 5. Router Configuration

```typescript
// src/router/index.tsx
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '../components/shared/ProtectedRoute';
import { ProviderRoute } from '../components/shared/ProviderRoute';

// Layouts
import { AppLayout } from '../components/layouts/AppLayout';
import { AuthLayout } from '../components/layouts/AuthLayout';
import { ProviderLayout } from '../components/layouts/ProviderLayout';

// Auth pages
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { VerifyEmailPage } from '../pages/auth/VerifyEmailPage';
import { OAuthCallbackPage } from '../pages/auth/OAuthCallbackPage';

// Customer pages
import { SearchPage } from '../pages/customer/SearchPage';
import { LocationDetailPage } from '../pages/customer/LocationDetailPage';
import { BookingPage } from '../pages/customer/BookingPage';
import { BookingConfirmationPage } from '../pages/customer/BookingConfirmationPage';
import { MyBookingsPage } from '../pages/customer/MyBookingsPage';
import { BookingDetailPage } from '../pages/customer/BookingDetailPage';
import { ProfilePage } from '../pages/customer/ProfilePage';
import { BecomeProviderPage } from '../pages/customer/BecomeProviderPage';

// Provider pages
import { ProviderDashboardPage } from '../pages/provider/DashboardPage';
import { BusinessListPage } from '../pages/provider/BusinessListPage';
import { BusinessCreatePage } from '../pages/provider/BusinessCreatePage';
import { BusinessEditPage } from '../pages/provider/BusinessEditPage';
import { LocationListPage } from '../pages/provider/LocationListPage';
import { LocationCreatePage } from '../pages/provider/LocationCreatePage';
import { LocationEditPage } from '../pages/provider/LocationEditPage';
import { ServiceListPage } from '../pages/provider/ServiceListPage';
import { ServiceCreatePage } from '../pages/provider/ServiceCreatePage';
import { ServiceEditPage } from '../pages/provider/ServiceEditPage';
import { StaffListPage } from '../pages/provider/StaffListPage';
import { StaffCreatePage } from '../pages/provider/StaffCreatePage';
import { StaffEditPage } from '../pages/provider/StaffEditPage';
import { EquipmentListPage } from '../pages/provider/EquipmentListPage';
import { EquipmentCreatePage } from '../pages/provider/EquipmentCreatePage';
import { EquipmentEditPage } from '../pages/provider/EquipmentEditPage';
import { AvailabilityPage } from '../pages/provider/AvailabilityPage';
import { ProviderBookingsPage } from '../pages/provider/BookingsPage';

// Error pages
import { NotFoundPage } from '../pages/NotFoundPage';

export const router = createBrowserRouter([
  // ===========================================
  // Public Auth Routes
  // ===========================================
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'verify-email', element: <VerifyEmailPage /> },
      { path: 'oauth/:provider/callback', element: <OAuthCallbackPage /> },
    ],
  },

  // ===========================================
  // Public Routes
  // ===========================================
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <SearchPage /> },
      { path: 'location/:id', element: <LocationDetailPage /> },
    ],
  },

  // ===========================================
  // Protected Customer Routes
  // ===========================================
  {
    path: '/',
    element: <ProtectedRoute><AppLayout /></ProtectedRoute>,
    children: [
      { path: 'book/:locationId', element: <BookingPage /> },
      { path: 'booking/:id/confirmation', element: <BookingConfirmationPage /> },
      { path: 'my-bookings', element: <MyBookingsPage /> },
      { path: 'my-bookings/:id', element: <BookingDetailPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'become-provider', element: <BecomeProviderPage /> },
    ],
  },

  // ===========================================
  // Provider Routes
  // ===========================================
  {
    path: '/provider',
    element: <ProviderRoute><ProviderLayout /></ProviderRoute>,
    children: [
      { index: true, element: <ProviderDashboardPage /> },

      // Businesses
      { path: 'businesses', element: <BusinessListPage /> },
      { path: 'businesses/new', element: <BusinessCreatePage /> },
      { path: 'businesses/:id/edit', element: <BusinessEditPage /> },

      // Locations
      { path: 'businesses/:businessId/locations', element: <LocationListPage /> },
      { path: 'businesses/:businessId/locations/new', element: <LocationCreatePage /> },
      { path: 'locations/:id/edit', element: <LocationEditPage /> },

      // Services
      { path: 'locations/:locationId/services', element: <ServiceListPage /> },
      { path: 'locations/:locationId/services/new', element: <ServiceCreatePage /> },
      { path: 'services/:id/edit', element: <ServiceEditPage /> },

      // Staff
      { path: 'locations/:locationId/staff', element: <StaffListPage /> },
      { path: 'locations/:locationId/staff/new', element: <StaffCreatePage /> },
      { path: 'staff/:id/edit', element: <StaffEditPage /> },

      // Equipment
      { path: 'locations/:locationId/equipment', element: <EquipmentListPage /> },
      { path: 'locations/:locationId/equipment/new', element: <EquipmentCreatePage /> },
      { path: 'equipment/:id/edit', element: <EquipmentEditPage /> },

      // Availability
      { path: 'locations/:locationId/availability', element: <AvailabilityPage /> },

      // Bookings
      { path: 'bookings', element: <ProviderBookingsPage /> },
    ],
  },

  // ===========================================
  // 404
  // ===========================================
  { path: '*', element: <NotFoundPage /> },
]);
```

---

## 6. Shared Components

### 6.1 ProtectedRoute

```typescript
// src/components/shared/ProtectedRoute.tsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { LoadingSpinner } from './LoadingSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, isInitialized } = useAuthStore();
  const location = useLocation();

  if (!isInitialized || isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
```

### 6.2 ProviderRoute

```typescript
// src/components/shared/ProviderRoute.tsx
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { LoadingSpinner } from './LoadingSpinner';

interface ProviderRouteProps {
  children: React.ReactNode;
}

export function ProviderRoute({ children }: ProviderRouteProps) {
  const { user, isAuthenticated, isLoading, isInitialized } = useAuthStore();

  if (!isInitialized || isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  if (!user?.is_provider) {
    return <Navigate to="/become-provider" replace />;
  }

  return <>{children}</>;
}
```

### 6.3 ErrorState

```typescript
// src/components/shared/ErrorState.tsx
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'An error occurred while loading data.',
  onRetry
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-muted-foreground mt-1">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" className="mt-4">
          <RefreshCw className="h-4 w-4 mr-2" />
          Try again
        </Button>
      )}
    </div>
  );
}
```

### 6.4 EmptyState

```typescript
// src/components/shared/EmptyState.tsx
import { LucideIcon } from 'lucide-react';
import { Button } from '../ui/button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, title, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-muted-foreground mt-1">{message}</p>
      {action && (
        <Button onClick={action.onClick} className="mt-4">
          {action.label}
        </Button>
      )}
    </div>
  );
}
```

### 6.5 Pagination

```typescript
// src/components/shared/Pagination.tsx
import { Button } from '../ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
```

---

## 7. Workflow 0: Authentication

### 7.1 LoginPage

**Route**: `/auth/login`
**Access**: Public only (redirect authenticated to `/`)

**Component tree**:
```
<LoginPage>
  <AuthLayout>
    <Card>
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>Sign in to your account</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm>
          <FormField name="email">
            <Input type="email" placeholder="Email" />
          </FormField>
          <FormField name="password">
            <Input type="password" placeholder="Password" />
          </FormField>
          <FormError />
          <Button type="submit">Sign in</Button>
        </LoginForm>
        <Separator text="or continue with" />
        <SocialButtons>
          <OAuthButton provider="google" />
          <OAuthButton provider="facebook" />
          <OAuthButton provider="paysera" />
        </SocialButtons>
      </CardContent>
      <CardFooter>
        <Link to="/auth/register">Don't have an account? Sign up</Link>
      </CardFooter>
    </Card>
  </AuthLayout>
</LoginPage>
```

**Form validation**:
```typescript
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});
```

**API call**:
```typescript
const loginMutation = useMutation({
  mutationFn: async (data: z.infer<typeof loginSchema>) => {
    const result = await client.POST('/api/v1/auth/login', { body: data });
    if (result.error) throw result.error;
    return result.data;
  },
  onSuccess: (data) => {
    authStore.setUser(data.user);
    navigate(from ?? '/');
  },
});
```

**Error mapping**:
| Error | UI Treatment |
|-------|--------------|
| 401 invalid-credentials | Inline form error: "Invalid email or password" |
| 422 validation-error | Field-level errors from `errors` map |
| Network error | Toast: "Connection failed. Please try again." |

---

### 7.2 RegisterPage

**Route**: `/auth/register`
**Access**: Public only

**Component tree**:
```
<RegisterPage>
  <AuthLayout>
    <Card>
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>Enter your details to get started</CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm>
          <FormField name="name" />
          <FormField name="email" />
          <FormField name="phone" />
          <FormField name="password" />
          <FormError />
          <Button type="submit">Create account</Button>
        </RegisterForm>
        <Separator />
        <SocialButtons />
      </CardContent>
      <CardFooter>
        <Link to="/auth/login">Already have an account? Sign in</Link>
      </CardFooter>
    </Card>
  </AuthLayout>
</RegisterPage>
```

**Form validation**:
```typescript
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(100),
  phone: z.string().regex(/^\+?[0-9]{7,15}$/, 'Invalid phone number'),
});
```

**API call**: `POST /api/v1/auth/register`

**On success**:
1. Store user in authStore
2. Navigate to `/` with toast: "Account created! Please check your email to verify."

---

### 7.3 VerifyEmailPage

**Route**: `/auth/verify-email?token=...`
**Access**: Public

**Component tree**:
```
<VerifyEmailPage>
  <AuthLayout>
    <Card>
      {status === 'loading' && <LoadingSpinner />}
      {status === 'success' && <SuccessMessage />}
      {status === 'error' && <ErrorMessage onRetry={resend} />}
    </Card>
  </AuthLayout>
</VerifyEmailPage>
```

**Flow**:
1. Extract `token` from URL search params
2. Call `POST /api/v1/auth/verify-email` with token
3. On success: show success message, redirect to `/` after 2s
4. On error: show error with "Resend verification email" button

---

### 7.4 OAuthCallbackPage

**Route**: `/auth/oauth/:provider/callback`
**Access**: Public

**Flow**:
1. Extract `code` and `state` from URL
2. Backend handles exchange via the callback endpoint
3. On success: redirect to intended destination
4. On error: redirect to `/auth/login` with error message

---

## 8. Workflow 1: User Profile

### 8.1 ProfilePage

**Route**: `/profile`
**Access**: Authenticated

**Component tree**:
```
<ProfilePage>
  <AppLayout>
    <PageHeader title="Profile" />
    <Card>
      <ProfileForm>
        <FormField name="name" />
        <FormField name="phone" />
        <FormField name="email" disabled />
        <EmailVerificationBadge />
        <Button type="submit">Save changes</Button>
      </ProfileForm>
    </Card>
    <Card>
      <ResendVerificationButton />  {/* if !email_verified */}
    </Card>
  </AppLayout>
</ProfilePage>
```

**API calls**:
- `GET /api/v1/users/me` — load current profile
- `PUT /api/v1/users/me` — update profile

---

## 9. Workflow 2: Provider Onboarding

### 9.1 BecomeProviderPage

**Route**: `/become-provider`
**Access**: Authenticated, non-provider

**Component tree**:
```
<BecomeProviderPage>
  <AppLayout>
    <Card>
      <CardHeader>
        <CardTitle>Become a Provider</CardTitle>
        <CardDescription>Start offering your services on Bookit</CardDescription>
      </CardHeader>
      <CardContent>
        <BenefitsList />
        <Button onClick={becomeProvider}>Get Started</Button>
      </CardContent>
    </Card>
  </AppLayout>
</BecomeProviderPage>
```

**API call**: `POST /api/v1/providers`

**On success**:
1. Refresh user data (is_provider = true)
2. Navigate to `/provider`

---

## 10. Workflow 3: Business Management

### 10.1 BusinessListPage

**Route**: `/provider/businesses`
**Access**: Provider

**Component tree**:
```
<BusinessListPage>
  <ProviderLayout>
    <PageHeader
      title="Businesses"
      action={<Button onClick={() => navigate('new')}>Add Business</Button>}
    />
    <BusinessList>
      {isLoading && <Skeleton count={3} />}
      {isError && <ErrorState onRetry={refetch} />}
      {data?.data.length === 0 && <EmptyState action="Create your first business" />}
      {data?.data.map(business => <BusinessCard key={business.id} />)}
    </BusinessList>
    <Pagination />
  </ProviderLayout>
</BusinessListPage>
```

**API call**: `GET /api/v1/businesses`

**Query**:
```typescript
const { data, isLoading, isError, refetch } = useQuery({
  queryKey: queryKeys.businesses.list({ page }),
  queryFn: () => client.GET('/api/v1/businesses', {
    params: { query: { page, per_page: 20 } }
  }),
});
```

---

### 10.2 BusinessCreatePage

**Route**: `/provider/businesses/new`
**Access**: Provider

**Component tree**:
```
<BusinessCreatePage>
  <ProviderLayout>
    <PageHeader title="Create Business" backLink="/provider/businesses" />
    <Card>
      <BusinessForm onSubmit={createBusiness}>
        <FormField name="name" />
        <FormField name="category" type="select" options={['beauty', 'sport', 'pet_care']} />
        <FormField name="description" type="textarea" />
        <Button type="submit">Create Business</Button>
      </BusinessForm>
    </Card>
  </ProviderLayout>
</BusinessCreatePage>
```

**Form validation**:
```typescript
const businessSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  category: z.enum(['beauty', 'sport', 'pet_care']),
  description: z.string().max(1000).optional(),
});
```

**API call**: `POST /api/v1/businesses`

**On success**: Navigate to `/provider/businesses` with toast

---

### 10.3 BusinessEditPage

**Route**: `/provider/businesses/:id/edit`
**Access**: Provider (own business)

**API calls**:
- `GET /api/v1/businesses/{id}` — load business
- `PUT /api/v1/businesses/{id}` — update business

---

## 11. Workflow 4: Location Management

### 11.1 LocationListPage

**Route**: `/provider/businesses/:businessId/locations`
**Access**: Provider

**Component tree**:
```
<LocationListPage>
  <ProviderLayout>
    <PageHeader
      title="Locations"
      subtitle={business.name}
      action={<Button>Add Location</Button>}
    />
    <LocationList>
      {locations.map(location => (
        <LocationCard
          key={location.id}
          location={location}
          actions={
            <>
              <Button variant="ghost" onClick={() => navigate(`/provider/locations/${location.id}/services`)}>
                Services
              </Button>
              <Button variant="ghost" onClick={() => navigate(`/provider/locations/${location.id}/staff`)}>
                Staff
              </Button>
              <Button variant="ghost" onClick={() => navigate(`/provider/locations/${location.id}/availability`)}>
                Hours
              </Button>
            </>
          }
        />
      ))}
    </LocationList>
  </ProviderLayout>
</LocationListPage>
```

**API call**: `GET /api/v1/locations?business_id={businessId}`

---

### 11.2 LocationCreatePage / LocationEditPage

**Form fields**:
- name (required)
- address (required)
- city (required)
- country (required)
- phone (optional)
- email (optional)
- timezone (default: Europe/Vilnius)

---

## 12. Workflow 5: Service Management

### 12.1 ServiceListPage

**Route**: `/provider/locations/:locationId/services`
**Access**: Provider

**API call**: `GET /api/v1/services?location_id={locationId}`

---

### 12.2 ServiceCreatePage / ServiceEditPage

**Form fields**:
- name (required)
- description (optional)
- duration_type: 'fixed' | 'flexible'
- duration_minutes (if fixed)
- time_unit_minutes: 30 | 60 (if flexible)
- min_duration_minutes (if flexible)
- max_duration_minutes (if flexible)
- price (required)
- price_type: 'flat' | 'per_unit'
- currency (default: EUR)

**Conditional fields**:
```typescript
{durationType === 'fixed' && <FormField name="duration_minutes" />}
{durationType === 'flexible' && (
  <>
    <FormField name="time_unit_minutes" />
    <FormField name="min_duration_minutes" />
    <FormField name="max_duration_minutes" />
  </>
)}
```

---

## 13. Workflow 6: Staff Management

### 13.1 StaffListPage

**Route**: `/provider/locations/:locationId/staff`
**Access**: Provider

**API call**: `GET /api/v1/staff?location_id={locationId}`

---

### 13.2 StaffCreatePage / StaffEditPage

**Form fields**:
- name (required)
- role (optional)

---

## 14. Workflow 7: Equipment Management

### 14.1 EquipmentListPage

**Route**: `/provider/locations/:locationId/equipment`
**Access**: Provider

**API call**: `GET /api/v1/equipment?location_id={locationId}`

---

### 14.2 EquipmentCreatePage / EquipmentEditPage

**Form fields**:
- name (required)
- capacity (default: 1)

---

## 15. Workflow 8: Availability Management

### 15.1 AvailabilityPage

**Route**: `/provider/locations/:locationId/availability`
**Access**: Provider

**Component tree**:
```
<AvailabilityPage>
  <ProviderLayout>
    <PageHeader title="Operating Hours" />
    <Card>
      <AvailabilityForm>
        {DAYS_OF_WEEK.map(day => (
          <DayScheduleRow
            key={day}
            day={day}
            isClosed={schedule[day].isClosed}
            startTime={schedule[day].startTime}
            endTime={schedule[day].endTime}
            onChange={updateDay}
          />
        ))}
        <Button type="submit">Save Schedule</Button>
      </AvailabilityForm>
    </Card>
  </ProviderLayout>
</AvailabilityPage>
```

**API calls**:
- `GET /api/v1/availability/location/{id}` — load schedule
- `PUT /api/v1/availability/location/{id}` — update schedule

---

## 16. Workflow 9: Customer Discovery

### 16.1 SearchPage

**Route**: `/` (homepage)
**Access**: Public

**Component tree**:
```
<SearchPage>
  <AppLayout>
    <Hero>
      <SearchBar>
        <Input placeholder="Search services..." />
        <CategorySelect />
        <CityInput />
        <Button>Search</Button>
      </SearchBar>
    </Hero>
    <SearchResults>
      {isLoading && <Skeleton count={6} />}
      {data?.data.map(location => <LocationCard key={location.id} />)}
      {data?.data.length === 0 && <EmptyState message="No results found" />}
    </SearchResults>
    <Pagination />
  </AppLayout>
</SearchPage>
```

**URL state**:
- `?q=` — search query
- `?category=` — beauty | sport | pet_care
- `?city=` — city filter
- `?page=` — pagination

**API call**: `GET /api/v1/search/locations`

---

### 16.2 LocationDetailPage

**Route**: `/location/:id`
**Access**: Public

**Component tree**:
```
<LocationDetailPage>
  <AppLayout>
    <LocationHeader>
      <BusinessLogo />
      <BusinessName />
      <LocationAddress />
      <CategoryBadge />
    </LocationHeader>
    <Tabs>
      <TabPanel value="services">
        <ServiceList>
          {services.map(service => (
            <ServiceCard
              key={service.id}
              service={service}
              onBook={() => navigate(`/book/${locationId}?service=${service.id}`)}
            />
          ))}
        </ServiceList>
      </TabPanel>
      <TabPanel value="info">
        <LocationInfo />
        <OperatingHours />
        <Map />
      </TabPanel>
    </Tabs>
  </AppLayout>
</LocationDetailPage>
```

**API calls**:
- `GET /api/v1/locations/{id}` — location details
- `GET /api/v1/services?location_id={id}` — services list

---

## 17. Workflow 10: Customer Booking

### 17.1 BookingPage

**Route**: `/book/:locationId`
**Access**: Authenticated

**Component tree**:
```
<BookingPage>
  <AppLayout>
    <BookingFlow>
      <Step1_ServiceSelection>
        <ServiceList selectable />
      </Step1_ServiceSelection>

      <Step2_DateTimeSelection>
        <DatePicker />
        <TimeSlotGrid>
          {slots.map(slot => (
            <TimeSlotButton
              key={slot.start_time}
              disabled={!slot.available}
            />
          ))}
        </TimeSlotGrid>
      </Step2_DateTimeSelection>

      <Step3_Confirmation>
        <BookingSummary />
        <NotesInput />
        <PriceTotal />
        <Button onClick={confirmBooking}>Confirm Booking</Button>
      </Step3_Confirmation>
    </BookingFlow>
  </AppLayout>
</BookingPage>
```

**State**: Use Zustand for multi-step form state
```typescript
interface BookingFlowState {
  locationId: string | null;
  selectedServices: Array<{
    serviceId: string;
    startDatetime: string;
    durationMinutes?: number;
  }>;
  notes: string;

  // Actions
  addService: (service: ...) => void;
  removeService: (serviceId: string) => void;
  setNotes: (notes: string) => void;
  reset: () => void;
}
```

**API calls**:
- `GET /api/v1/services?location_id={id}` — available services
- `GET /api/v1/availability/slots?service_id={id}&date={date}` — time slots
- `POST /api/v1/bookings` — create booking

**Error handling**:
| Error | UI Treatment |
|-------|--------------|
| 409 slot-unavailable | Toast error + refetch slots |
| 400 validation | Field-level errors |

---

### 17.2 BookingConfirmationPage

**Route**: `/booking/:id/confirmation`
**Access**: Authenticated

**Component tree**:
```
<BookingConfirmationPage>
  <AppLayout>
    <Card>
      <SuccessIcon />
      <h1>Booking Confirmed!</h1>
      <BookingDetails />
      <Actions>
        <Button onClick={() => navigate('/my-bookings')}>View My Bookings</Button>
        <Button variant="outline" onClick={() => navigate('/')}>Book Another</Button>
      </Actions>
    </Card>
  </AppLayout>
</BookingConfirmationPage>
```

---

## 18. Workflow 11: Booking Management

### 18.1 MyBookingsPage (Customer)

**Route**: `/my-bookings`
**Access**: Authenticated

**Component tree**:
```
<MyBookingsPage>
  <AppLayout>
    <PageHeader title="My Bookings" />
    <Tabs defaultValue="upcoming">
      <TabsList>
        <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
        <TabsTrigger value="past">Past</TabsTrigger>
        <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
      </TabsList>
      <TabsContent value="upcoming">
        <BookingList status={['confirmed', 'pending_payment']} />
      </TabsContent>
      <TabsContent value="past">
        <BookingList status={['completed', 'no_show']} />
      </TabsContent>
      <TabsContent value="cancelled">
        <BookingList status={['cancelled_by_customer', 'cancelled_by_provider']} />
      </TabsContent>
    </Tabs>
  </AppLayout>
</MyBookingsPage>
```

**API call**: `GET /api/v1/bookings?status={status}`

---

### 18.2 BookingDetailPage (Customer)

**Route**: `/my-bookings/:id`
**Access**: Authenticated (own booking)

**Component tree**:
```
<BookingDetailPage>
  <AppLayout>
    <Card>
      <BookingHeader>
        <StatusBadge status={booking.status} />
        <BookingDate />
      </BookingHeader>
      <BookingItems>
        {booking.items.map(item => <BookingItemRow key={item.id} />)}
      </BookingItems>
      <BookingTotal />
      <LocationInfo />
      {canCancel && (
        <CancelButton onClick={showCancelDialog} />
      )}
    </Card>
  </AppLayout>
</BookingDetailPage>
```

**Cancel logic**:
- Show cancel button if status is `pending_payment` or `confirmed`
- Confirm via dialog
- Call `POST /api/v1/bookings/{id}/cancel`
- Invalidate bookings queries

---

### 18.3 ProviderBookingsPage

**Route**: `/provider/bookings`
**Access**: Provider

**Component tree**:
```
<ProviderBookingsPage>
  <ProviderLayout>
    <PageHeader title="Bookings" />
    <Filters>
      <LocationSelect />
      <StatusSelect />
      <DateRangePicker />
    </Filters>
    <BookingTable>
      <columns>
        - Customer name
        - Service(s)
        - Date/time
        - Status
        - Actions
      </columns>
    </BookingTable>
    <Pagination />
  </ProviderLayout>
</ProviderBookingsPage>
```

**URL state**:
- `?location_id=` — filter by location
- `?status=` — filter by status
- `?from_date=` — date range start
- `?to_date=` — date range end
- `?page=` — pagination

**API call**: `GET /api/v1/bookings/provider`

---

## 19. Form Validation Schemas

```typescript
// src/lib/validation.ts
import { z } from 'zod';

// Auth
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(100),
  phone: z.string().regex(/^\+?[0-9]{7,15}$/, 'Invalid phone number'),
});

// Business
export const businessSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  category: z.enum(['beauty', 'sport', 'pet_care']),
  description: z.string().max(1000).optional(),
});

// Location
export const locationSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().min(1).max(200),
  city: z.string().min(1).max(100),
  country: z.string().min(1).max(100),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  timezone: z.string().default('Europe/Vilnius'),
});

// Service
export const serviceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  duration_type: z.enum(['fixed', 'flexible']),
  duration_minutes: z.number().min(15).optional(),
  time_unit_minutes: z.number().optional(),
  min_duration_minutes: z.number().min(15).optional(),
  max_duration_minutes: z.number().optional(),
  price: z.number().min(0),
  price_type: z.enum(['flat', 'per_unit']),
  currency: z.string().length(3).default('EUR'),
}).refine(data => {
  if (data.duration_type === 'fixed') {
    return data.duration_minutes !== undefined;
  }
  return true;
}, { message: 'Duration is required for fixed services', path: ['duration_minutes'] });

// Staff
export const staffSchema = z.object({
  name: z.string().min(1).max(100),
  role: z.string().max(100).optional(),
});

// Equipment
export const equipmentSchema = z.object({
  name: z.string().min(1).max(100),
  capacity: z.number().min(1).default(1),
});

// Booking
export const bookingSchema = z.object({
  location_id: z.string().uuid(),
  items: z.array(z.object({
    service_id: z.string().uuid(),
    start_datetime: z.string(),
    duration_minutes: z.number().min(15).optional(),
  })).min(1, 'Select at least one service'),
  notes: z.string().max(500).optional(),
});
```

---

## 20. Error Handling

### 20.1 Global Error Map

```typescript
// src/lib/errorHandling.ts
export const ERROR_MESSAGES: Record<string, string> = {
  // Auth
  'invalid-credentials': 'Invalid email or password',
  'email-already-exists': 'An account with this email already exists',
  'invalid-token': 'Invalid or expired token',
  'invalid-refresh-token': 'Session expired. Please log in again.',

  // Authorization
  'unauthorized': 'Please log in to continue',
  'forbidden': 'You don\'t have permission to perform this action',
  'provider-required': 'Provider account required',

  // Resources
  'not-found': 'Resource not found',
  'slot-unavailable': 'This time slot is no longer available',
  'cannot-cancel': 'This booking cannot be cancelled',
  'already-provider': 'You are already a provider',
  'email-already-verified': 'Email is already verified',

  // Rate limiting
  'rate-limited': 'Too many requests. Please try again later.',

  // Generic
  'validation-error': 'Please check your input',
  'internal-error': 'Something went wrong. Please try again.',
};

export function getErrorMessage(code: string): string {
  return ERROR_MESSAGES[code] || 'An unexpected error occurred';
}
```

### 20.2 Query Error Handling

```typescript
// In TanStack Query setup
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on auth errors
        if (error?.status === 401 || error?.status === 403) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      onError: (error) => {
        // Global mutation error handling
        const message = getErrorMessage(error?.code || 'internal-error');
        toast.error(message);
      },
    },
  },
});
```

---

## 21. TanStack Query Setup

```typescript
// src/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,      // 1 minute
      gcTime: 1000 * 60 * 5,     // 5 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});
```

---

## 22. Package Dependencies

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.23.0",
    "@tanstack/react-query": "^5.32.0",
    "zustand": "^4.5.0",
    "openapi-fetch": "^0.9.0",
    "react-hook-form": "^7.51.0",
    "@hookform/resolvers": "^3.3.0",
    "zod": "^3.23.0",
    "lucide-react": "^0.372.0",
    "date-fns": "^3.6.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.3.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "openapi-typescript": "^7.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0"
  }
}
```

---

## 23. Environment Variables

```bash
# .env.local (development)
VITE_API_URL=http://localhost:8080

# .env.production
VITE_API_URL=https://api.bookit.app
```

---

## 24. SPEC-TODOs

| # | Item | Must Resolve Before |
|---|------|---------------------|
| 1 | shadcn/ui component selection (which components to install) | Setup |
| 2 | Toast notification library (sonner vs react-hot-toast) | Implementation |
| 3 | Date picker component (shadcn date-picker vs react-day-picker) | Booking flow |
| 4 | Image upload for business logos | Business management |
| 5 | Map integration for location display | Location detail page |

---

## 25. Next Steps

1. **Initialize project**: `npm create vite@latest frontend -- --template react-ts`
2. **Install dependencies**: Copy package.json deps
3. **Setup Tailwind**: `npx tailwindcss init -p`
4. **Setup shadcn/ui**: `npx shadcn-ui@latest init`
5. **Generate types**: `npm run generate:types`
6. **Create API client**: `src/api/client.ts`
7. **Create stores**: `src/stores/authStore.ts`, `src/stores/uiStore.ts`
8. **Setup router**: `src/router/index.tsx`
9. **Build pages incrementally**: Auth → Search → Booking → Provider

---

*Generated by frontend-spec skill from BACKEND-SPEC and OpenAPI documents.*
