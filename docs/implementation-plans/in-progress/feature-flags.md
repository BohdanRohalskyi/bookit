---
title: "Feature Flags with Firebase Remote Config"
status: NEW
created: 2026-04-02
author: "Claude"
---

# Plan: Feature Flags with Firebase Remote Config

## Summary

Implement feature flags using Firebase Remote Config to enable/disable features across all platforms (Go API, React Web, React Native Mobile) without redeployment. Single Firebase Console dashboard to manage all flags.

**Goal:** Toggle features on/off from Firebase Console, instantly reflected across API + Web + Mobile.

---

## Phases

### Phase 1: Enable Remote Config in Firebase Console `[PENDING]`

1. Go to Firebase Console → pt-duo-bookit → Remote Config
2. Click "Create configuration" (or "Get started")
3. Add first test parameter:
   - Parameter name: `feature_test`
   - Default value: `false`
4. Click "Publish changes"

**Verification:** Parameter visible in Remote Config dashboard.

---

### Phase 2: Backend Integration (Go) `[PENDING]`

#### 2.1 Install Firebase Admin SDK

```bash
cd api
go get firebase.google.com/go/v4
```

#### 2.2 Create Flag Service

**File: `api/internal/platform/flags/flags.go`**

```go
package flags

import (
	"context"
	"log"
	"sync"
	"time"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/remoteconfig"
)

type Service struct {
	client    *remoteconfig.Client
	template  *remoteconfig.Template
	mu        sync.RWMutex
	lastFetch time.Time
	cacheTTL  time.Duration
}

func NewService(ctx context.Context, projectID string) (*Service, error) {
	app, err := firebase.NewApp(ctx, &firebase.Config{
		ProjectID: projectID,
	})
	if err != nil {
		return nil, err
	}

	client, err := app.RemoteConfig(ctx)
	if err != nil {
		return nil, err
	}

	svc := &Service{
		client:   client,
		cacheTTL: 5 * time.Minute,
	}

	if err := svc.refresh(ctx); err != nil {
		log.Printf("warning: failed to fetch initial flags: %v", err)
	}

	return svc, nil
}

func (s *Service) refresh(ctx context.Context) error {
	template, err := s.client.Template(ctx)
	if err != nil {
		return err
	}

	s.mu.Lock()
	s.template = template
	s.lastFetch = time.Now()
	s.mu.Unlock()

	return nil
}

func (s *Service) IsEnabled(ctx context.Context, name string) bool {
	s.mu.RLock()
	needsRefresh := time.Since(s.lastFetch) > s.cacheTTL
	s.mu.RUnlock()

	if needsRefresh {
		go s.refresh(ctx) // background refresh
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.template == nil {
		return false
	}

	param, ok := s.template.Parameters[name]
	if !ok {
		return false
	}

	return param.DefaultValue.Value == "true"
}

func (s *Service) GetString(ctx context.Context, name string) string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.template == nil {
		return ""
	}

	param, ok := s.template.Parameters[name]
	if !ok {
		return ""
	}

	return param.DefaultValue.Value
}
```

#### 2.3 Initialize in main.go

**File: `api/cmd/server/main.go`**

Add import:
```go
"github.com/BohdanRohalskyi/bookit/api/internal/platform/flags"
```

Add after database connection:
```go
// Initialize feature flags
flagService, err := flags.NewService(ctx, cfg.GCPProject)
if err != nil {
	return fmt.Errorf("init flags: %w", err)
}
log.Printf("feature flags initialized")
```

#### 2.4 Add Flags Endpoint

**File: `api/cmd/server/main.go`** (add route)

```go
// Feature flags endpoint (for frontend)
router.GET("/api/v1/flags", func(c *gin.Context) {
	c.JSON(200, gin.H{
		"feature_test": flagService.IsEnabled(c.Request.Context(), "feature_test"),
	})
})
```

**Verification:**
- `curl https://bookit-api-staging.../api/v1/flags` returns `{"feature_test": false}`
- Toggle in Firebase Console → refresh → returns `true`

---

### Phase 3: Frontend Integration (React Web) `[PENDING]`

#### 3.1 Get Firebase Config

1. Firebase Console → Project Settings → General
2. Scroll to "Your apps" → Web app
3. Copy `firebaseConfig` object values

#### 3.2 Add Secrets

```bash
gh secret set VITE_FIREBASE_API_KEY --body "AIza..."
gh secret set VITE_FIREBASE_APP_ID --body "1:898535472060:web:..."
```

Also create `web/.env.local`:
```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_APP_ID=1:898535472060:web:...
```

#### 3.3 Install Firebase SDK

```bash
cd web
npm install firebase
```

#### 3.4 Create Firebase Config

**File: `web/src/lib/firebase.ts`**

```typescript
import { initializeApp } from 'firebase/app';
import { getRemoteConfig, fetchAndActivate, getBoolean, getString } from 'firebase/remote-config';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "pt-duo-bookit.firebaseapp.com",
  projectId: "pt-duo-bookit",
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const remoteConfig = getRemoteConfig(app);

// 1 hour cache in prod, 1 minute in dev
remoteConfig.settings.minimumFetchIntervalMillis =
  import.meta.env.PROD ? 3600000 : 60000;

// Defaults (used before first fetch)
remoteConfig.defaultConfig = {
  feature_test: false,
};

let initialized = false;

export async function initFeatureFlags(): Promise<void> {
  if (initialized) return;
  try {
    await fetchAndActivate(remoteConfig);
    initialized = true;
  } catch (error) {
    console.warn('Failed to fetch feature flags:', error);
  }
}

export function isFeatureEnabled(name: string): boolean {
  return getBoolean(remoteConfig, name);
}

export function getFeatureValue(name: string): string {
  return getString(remoteConfig, name);
}
```

#### 3.5 Create React Hook

**File: `web/src/hooks/useFeatureFlag.ts`**

```typescript
import { useState, useEffect } from 'react';
import { initFeatureFlags, isFeatureEnabled } from '../lib/firebase';

export function useFeatureFlag(flagName: string): { enabled: boolean; loading: boolean } {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initFeatureFlags().then(() => {
      setEnabled(isFeatureEnabled(flagName));
      setLoading(false);
    });
  }, [flagName]);

  return { enabled, loading };
}
```

#### 3.6 Update Environment Types

**File: `web/src/vite-env.d.ts`** (add)

```typescript
interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_APP_ID: string
}
```

#### 3.7 Update CI Workflow

**File: `.github/workflows/web.yml`** (add to build step env)

```yaml
- name: Build
  working-directory: web
  env:
    VITE_API_URL: ${{ secrets.VITE_API_URL }}
    VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
    VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
  run: npm run build
```

**Verification:**
- Add `console.log(isFeatureEnabled('feature_test'))` in App.tsx
- Check browser console shows `false`
- Toggle in Firebase → refresh → shows `true`

---

### Phase 4: Usage Example `[PENDING]`

Add a visual indicator to verify flags work end-to-end.

**File: `web/src/App.tsx`** (temporary, for testing)

```tsx
import { useFeatureFlag } from './hooks/useFeatureFlag';

function App() {
  const { enabled: testFlag, loading } = useFeatureFlag('feature_test');

  // ... existing code ...

  return (
    <div className="app">
      <h1>Bookit</h1>

      {/* Feature flag indicator */}
      <div style={{ fontSize: '0.75rem', color: '#888' }}>
        Feature Test: {loading ? '...' : testFlag ? 'ON' : 'OFF'}
      </div>

      {/* ... rest of health check UI ... */}
    </div>
  );
}
```

---

### Phase 5: Mobile Setup (Future) `[PENDING]`

When mobile development starts:

```bash
npx expo install @react-native-firebase/app @react-native-firebase/remote-config
```

Same pattern:
```typescript
import remoteConfig from '@react-native-firebase/remote-config';

await remoteConfig().setDefaults({ feature_test: false });
await remoteConfig().fetchAndActivate();
const enabled = remoteConfig().getBoolean('feature_test');
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `api/internal/platform/flags/flags.go` | Create | Flag service with caching |
| `api/cmd/server/main.go` | Modify | Initialize flags, add endpoint |
| `web/src/lib/firebase.ts` | Create | Firebase + Remote Config init |
| `web/src/hooks/useFeatureFlag.ts` | Create | React hook for flags |
| `web/src/vite-env.d.ts` | Modify | Add Firebase env types |
| `.github/workflows/web.yml` | Modify | Add Firebase secrets to build |

---

## Secrets to Add

| Secret | Where | Value |
|--------|-------|-------|
| `VITE_FIREBASE_API_KEY` | GitHub Secrets | Firebase API key |
| `VITE_FIREBASE_APP_ID` | GitHub Secrets | Firebase App ID |

---

## Verification Checklist

- [ ] Remote Config enabled in Firebase Console
- [ ] `feature_test` parameter created with default `false`
- [ ] Backend `/api/v1/flags` endpoint returns flags
- [ ] Frontend displays flag status
- [ ] Toggle in Firebase Console → apps reflect change
- [ ] Works on staging environment
- [ ] Works on production environment

---

## Usage Pattern (After Implementation)

**Backend:**
```go
if flagService.IsEnabled(ctx, "new_booking_flow") {
    return handleNewBookingFlow(c)
}
return handleLegacyBookingFlow(c)
```

**Frontend:**
```tsx
const { enabled: newFlow } = useFeatureFlag('new_booking_flow');

return newFlow ? <NewBookingUI /> : <LegacyBookingUI />;
```

**Toggle:** Firebase Console → Remote Config → Change value → Publish

---

## Phase Status Reference

| Status | Meaning |
|--------|---------|
| `[PENDING]` | Not started |
| `[IN_PROGRESS]` | Currently being worked on |
| `[DONE]` | Completed and committed |
| `[CHANGED]` | Implementation differs from original plan |
| `[REJECTED]` | Phase was not implemented |
