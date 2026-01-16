# Story 5.7: Notification Preferences Configuration

Status: ready-for-dev

## Story

As a **user**,
I want **to configure which notifications I receive on which channels**,
So that **I'm not overwhelmed but don't miss important events** (FR51).

## Acceptance Criteria

1. **Given** I access settings
   **When** I view notification preferences
   **Then** I see a matrix of event types vs channels
   **And** I can toggle each combination on/off

2. **Given** I change a preference
   **When** I save settings
   **Then** preferences are persisted to the database
   **And** take effect immediately without restart

3. **Given** default preferences
   **When** no customization is made
   **Then** all events go to console + dashboard
   **And** critical/approval events go to webhook/Slack if configured

4. **Given** I want to disable a channel entirely
   **When** I toggle the channel header
   **Then** all event types for that channel are disabled
   **And** the column shows as disabled state

5. **Given** I want to reset to defaults
   **When** I click "Reset to Defaults"
   **Then** all preferences return to default settings
   **And** a confirmation dialog prevents accidental reset

## Tasks / Subtasks

- [ ] Task 1: Create notification preferences schema (AC: #1)
  - [ ] Define preference structure:
    ```typescript
    {
      userId: string;
      channels: {
        console: { enabled: true, events: [...] },
        dashboard: { enabled: true, events: [...] },
        webhook: { enabled: boolean, events: [...] },
        slack: { enabled: boolean, events: [...] }
      }
    }
    ```
  - [ ] Define event types: `approval`, `stuck`, `complete`, `error`, `info`
  - [ ] Define default preferences matrix

- [ ] Task 2: Add preferences table to SQLite (AC: #2)
  - [ ] Create `notification_preferences` table:
    ```sql
    CREATE TABLE notification_preferences (
      id INTEGER PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      preferences TEXT NOT NULL, -- JSON blob
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    ```
  - [ ] Create migration file
  - [ ] Add get/set methods to database module

- [ ] Task 3: Create preferences API endpoints (AC: #2)
  - [ ] `GET /api/settings/notifications` - Get user's preferences
  - [ ] `PUT /api/settings/notifications` - Update preferences
  - [ ] `POST /api/settings/notifications/reset` - Reset to defaults
  - [ ] Validate preference structure on save

- [ ] Task 4: Create NotificationSettings component (AC: #1, #4)
  - [ ] Create `dashboard/src/components/settings/NotificationSettings.tsx`
  - [ ] Render matrix table with events as rows, channels as columns
  - [ ] Implement checkbox toggles for each cell
  - [ ] Add channel header toggle for bulk enable/disable
  - [ ] Show disabled state for unconfigured channels (webhook/slack)

- [ ] Task 5: Implement preference persistence (AC: #2)
  - [ ] Create `useNotificationPreferences` hook
  - [ ] Load preferences on settings page mount
  - [ ] Save preferences on change (debounced)
  - [ ] Show save status indicator (saving/saved)
  - [ ] Handle save errors with retry option

- [ ] Task 6: Apply preferences in notification service (AC: #2, #3)
  - [ ] Load user preferences on service initialization
  - [ ] Check preferences before sending to each channel
  - [ ] Cache preferences with invalidation on update
  - [ ] Broadcast preference update via WebSocket for real-time sync

- [ ] Task 7: Implement default preferences (AC: #3)
  - [ ] Define default matrix:
    | Event | Console | Dashboard | Webhook | Slack |
    |-------|---------|-----------|---------|-------|
    | approval | Yes | Yes | Yes | Yes |
    | stuck | Yes | Yes | Yes | Yes |
    | complete | Yes | Yes | No | Yes |
    | error | Yes | Yes | Yes | Yes |
    | info | Yes | Yes | No | No |
  - [ ] Return defaults when no user preference exists
  - [ ] Mark webhook/slack as unavailable if not configured

- [ ] Task 8: Implement reset to defaults (AC: #5)
  - [ ] Add "Reset to Defaults" button
  - [ ] Show confirmation dialog before reset
  - [ ] Call reset API endpoint
  - [ ] Refresh preferences in UI after reset

- [ ] Task 9: Create Settings page integration (AC: #1)
  - [ ] Add Notifications tab to Settings page
  - [ ] Include explanatory text about each channel
  - [ ] Show channel configuration status (configured/not configured)
  - [ ] Link to secrets configuration for webhook/slack setup

- [ ] Task 10: Write tests
  - [ ] Test preference schema validation
  - [ ] Test database CRUD operations
  - [ ] Test API endpoints
  - [ ] Test NotificationSettings component
  - [ ] Test preference application in notification service

## Dev Notes

### Critical Implementation Rules

1. **ES Modules Only** - Use `import/export` syntax
2. **API Response Format** - Use `{ data: {...}, meta: {...} }` for success
3. **Debounce Saves** - Don't save on every toggle, debounce 500ms

### Preference Schema

```typescript
// shared/types/notifications.ts

export type NotificationEventType =
  | 'approval'
  | 'stuck'
  | 'complete'
  | 'error'
  | 'info';

export type NotificationChannel =
  | 'console'
  | 'dashboard'
  | 'webhook'
  | 'slack';

export interface ChannelPreference {
  enabled: boolean;
  events: NotificationEventType[];
}

export interface NotificationPreferences {
  userId: string;
  channels: Record<NotificationChannel, ChannelPreference>;
  updatedAt: string;
}
```

### Default Preferences Matrix

```typescript
const DEFAULT_PREFERENCES: NotificationPreferences = {
  channels: {
    console: {
      enabled: true,
      events: ['approval', 'stuck', 'complete', 'error', 'info']
    },
    dashboard: {
      enabled: true,
      events: ['approval', 'stuck', 'complete', 'error', 'info']
    },
    webhook: {
      enabled: true,  // Only if configured
      events: ['approval', 'stuck', 'error']
    },
    slack: {
      enabled: true,  // Only if configured
      events: ['approval', 'stuck', 'complete', 'error']
    }
  }
};
```

### API Endpoints

```
GET /api/settings/notifications
Response: {
  data: {
    preferences: NotificationPreferences,
    channelStatus: {
      webhook: { configured: boolean, url?: string },
      slack: { configured: boolean }
    }
  }
}

PUT /api/settings/notifications
Body: { preferences: NotificationPreferences }
Response: { data: { updated: true } }

POST /api/settings/notifications/reset
Response: { data: { preferences: NotificationPreferences } }
```

### Settings Component UI

```
+---------------------------------------------------------------+
| Notification Preferences                                        |
|---------------------------------------------------------------|
|                    | Console | Dashboard | Webhook* | Slack*   |
|---------------------------------------------------------------|
| Channel Toggle     |   [x]   |    [x]    |   [x]   |   [x]    |
|---------------------------------------------------------------|
| Approval Required  |   [x]   |    [x]    |   [x]   |   [x]    |
| Agent Stuck        |   [x]   |    [x]    |   [x]   |   [x]    |
| Epic/Project Done  |   [x]   |    [x]    |   [ ]   |   [x]    |
| Critical Error     |   [x]   |    [x]    |   [x]   |   [x]    |
| Info/Status        |   [x]   |    [x]    |   [ ]   |   [ ]    |
|---------------------------------------------------------------|
| * Configure in Secrets      [Reset to Defaults]                 |
+---------------------------------------------------------------+
```

### Preference Caching in Backend

```javascript
// src/services/notification.js

class NotificationService {
  constructor() {
    this.preferencesCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  async getPreferences(userId) {
    const cached = this.preferencesCache.get(userId);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.preferences;
    }

    const preferences = await db.getNotificationPreferences(userId);
    this.preferencesCache.set(userId, {
      preferences: preferences || DEFAULT_PREFERENCES,
      timestamp: Date.now()
    });
    return preferences || DEFAULT_PREFERENCES;
  }

  invalidateCache(userId) {
    this.preferencesCache.delete(userId);
    // Broadcast to other server instances if clustered
  }

  async shouldNotify(userId, eventType, channel) {
    const prefs = await this.getPreferences(userId);
    const channelPrefs = prefs.channels[channel];
    return channelPrefs.enabled && channelPrefs.events.includes(eventType);
  }
}
```

### React Component Pattern

```typescript
// dashboard/src/components/settings/NotificationSettings.tsx

export const NotificationSettings: React.FC = () => {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [channelStatus, setChannelStatus] = useState<ChannelStatus | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Debounced save
  const debouncedSave = useMemo(
    () => debounce(async (prefs: NotificationPreferences) => {
      setIsSaving(true);
      await api.put('/api/settings/notifications', { preferences: prefs });
      setIsSaving(false);
      setLastSaved(new Date());
    }, 500),
    []
  );

  const handleToggle = (channel: NotificationChannel, event?: NotificationEventType) => {
    const updated = { ...preferences };
    if (event) {
      // Toggle specific event
      const events = updated.channels[channel].events;
      updated.channels[channel].events = events.includes(event)
        ? events.filter(e => e !== event)
        : [...events, event];
    } else {
      // Toggle entire channel
      updated.channels[channel].enabled = !updated.channels[channel].enabled;
    }
    setPreferences(updated);
    debouncedSave(updated);
  };

  // ... render matrix table
};
```

### File Structure

```
src/
├── db/
│   └── migrations/
│       └── 003_notification_preferences.sql  # NEW
├── api/
│   └── settings.js                           # NEW: Settings routes
└── services/
    └── notification.js                       # Add preference checking

dashboard/src/
├── components/
│   └── settings/
│       ├── NotificationSettings.tsx          # NEW
│       └── NotificationSettings.test.tsx     # NEW
├── pages/
│   └── Settings.tsx                          # Add notifications tab
└── hooks/
    └── useNotificationPreferences.ts         # NEW
```

### References

- [Source: epics.md#Story 5.7] - Original requirements
- [Source: architecture.md#SQLite Schema] - Database patterns
- [Source: architecture.md#API Response Format] - API conventions
- [Source: project-context.md#Zustand Pattern] - Store pattern for preferences

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

