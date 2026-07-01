# Settings Page

Manage TM1 connections, browser theme, local cache, and saved cube configs — all without touching `config.ini` by hand.

> 📸 **Screenshot needed:** Settings page with the TM1 Instances card expanded and a connection's fields visible.

## Appearance

Theme switcher: **System** (follows OS preference), **Light**, or **Dark**. Persists in `localStorage`.

## TM1 Instances

A tab per instance defined in `config.ini`. Each tab shows the instance's fields as editable rows.

### Read-only config.ini

If OptimusPy was launched with an explicit `--config PATH` (see [TM1 Connection](../getting-started/tm1-connection.md#sharing-configini-across-tools)), that file is treated as owned by another tool and the Settings page switches to read-only mode: a banner explains that the config is managed externally, and the create/edit/delete controls below are hidden. **Test Connection** still works, since it doesn't write to the file. The default `config/config.ini` (no `--config` flag) is never read-only.

### Editing fields

- Click any value to edit it.
- Click the **×** next to a field to delete that key from the section.
- Click **Add Field** to add a new key/value pair (freeform — type any TM1py-supported parameter name).
- Use **Update Password (write-only)** to change the password without exposing the current value.

Click **Save** to persist changes to `config.ini`.

> 📸 **Screenshot needed:** A field row with the delete (×) button and the Add Field button below.

### Test Connection

Validates the current field values against the live TM1 server without saving. Returns server name and cube count on success, or a clear error toast on failure.

> 📸 **Screenshot needed:** A success toast showing "Connected to {server} ({cube_count} cubes)".

### New Instance

Click **+ New Instance** above the tabs. A modal asks for the instance name (no `]` characters, no leading/trailing whitespace). The new section appears as an empty tab where you add fields.

### Delete Instance

The red **Delete Instance** button at the bottom of each tab removes the section from `config.ini` after a confirmation modal. Permanent.

## Cache

Two caches are stored in your browser's `localStorage`:

| Cache | Key prefix | TTL |
|---|---|---|
| Scan results | `op-scan-` | 24 hours |
| Cube intelligence (dimension metadata) | `op-intel-` | 7 days |

Click **Clear Cache** to wipe both, plus the in-memory state. Use this after server-side changes (deleted string elements, renamed dimensions, fresh data load) to force a clean fetch.

## Saved Cube Configs

Lists every JSON config saved in `configs/` from the Optimize workflow. Each row shows cube name, instance, mode, and a **Delete** button. Useful for cleaning up experiments.
