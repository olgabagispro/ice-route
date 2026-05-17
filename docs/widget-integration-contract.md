# Widget Integration Contract

This app embeds the Furboats voice widget as a second AI agent. The widget and host app communicate through DOM `CustomEvent`s.

## Widget -> Host Actions

The host supports the actions below. Coordinates are passed as `lng, lat` because this is the format used by agent text commands.

### Navigate Map

Text fallback inside assistant transcript:

```text
/action navigate lng,lat,zoom
```

Example:

```text
/action navigate 37.6173,55.7558,8
```

Preferred structured event:

```js
window.dispatchEvent(new CustomEvent("furboats.action", {
  detail: {
    action: "navigate",
    params: { lng: 37.6173, lat: 55.7558, zoom: 8 }
  }
}));
```

Host behavior: fly the Leaflet map to the coordinate at the requested zoom.

### Add Waypoint

Text fallback inside assistant transcript:

```text
/action add_waypoint lng,lat,name
```

Example:

```text
/action add_waypoint 37.6173,55.7558,Moscow test waypoint
```

Preferred structured event:

```js
window.dispatchEvent(new CustomEvent("furboats.action", {
  detail: {
    action: "add_waypoint",
    params: { lng: 37.6173, lat: 55.7558, name: "Moscow test waypoint" }
  }
}));
```

Host behavior: add the point to the current route and fly the map to it.

### Insert Waypoint Into Route

Use when the user asks to add a point between two existing route points, for example "add leg between point 1 and point 2".

Text fallback inside assistant transcript:

```text
/action insert_waypoint lng,lat,after_leg,name
```

Example:

```text
/action insert_waypoint 37.6173,55.7558,1,Inserted voice waypoint
```

Preferred structured event:

```js
window.dispatchEvent(new CustomEvent("furboats.action", {
  detail: {
    action: "insert_waypoint",
    params: {
      lng: 37.6173,
      lat: 55.7558,
      afterLeg: 1,
      name: "Inserted voice waypoint"
    }
  }
}));
```

Host behavior: insert the waypoint after route point `afterLeg`, so `afterLeg: 1` places it between point 1 and point 2. Existing ice-class analysis is invalidated locally.

### Delete Route Leg

Use when the user asks to remove a route segment, for example "delete leg 2".

Text fallback inside assistant transcript:

```text
/action delete_leg leg_number
```

Example:

```text
/action delete_leg 2
```

Preferred structured event:

```js
window.dispatchEvent(new CustomEvent("furboats.action", {
  detail: {
    action: "delete_leg",
    params: { leg: 2 }
  }
}));
```

Host behavior: remove the endpoint of that leg. For example, deleting leg 2 removes point 3 and connects point 2 to point 4. Existing ice-class analysis is invalidated locally.

### Calculate Route

Use when the user asks to calculate or recalculate the route.

Text fallback:

```text
/action calculate_route
```

Preferred structured event:

```js
window.dispatchEvent(new CustomEvent("furboats.action", {
  detail: { action: "calculate_route" }
}));
```

Host behavior: call the same ICE class calculation as the Calculate button. Requires at least two waypoints and a complete navigation period.

### Set Navigation Period

Use when the user tells the assistant the route date range.

Text fallback:

```text
/action set_navigation_period start_date,end_date
```

Example:

```text
/action set_navigation_period 2026-02-01,2026-02-14
```

Preferred structured event:

```js
window.dispatchEvent(new CustomEvent("furboats.action", {
  detail: {
    action: "set_navigation_period",
    params: { startDate: "2026-02-01", endDate: "2026-02-14" }
  }
}));
```

Host behavior: update the route navigation period. Dates should be ISO `YYYY-MM-DD`.

### Get Navigation Period

Use when the widget needs to inspect the current period before deciding whether to ask a follow-up question.

Text fallback:

```text
/action get_navigation_period
```

Preferred structured event:

```js
window.dispatchEvent(new CustomEvent("furboats.action", {
  detail: { action: "get_navigation_period" }
}));
```

Host behavior: emit `navigation_period.current` with `{ navigationPeriod: { startDate, endDate, complete } }`.

### Generate Full Report

Use when the user asks for a summary/full report.

Text fallback:

```text
/action generate_report
```

Preferred structured event:

```js
window.dispatchEvent(new CustomEvent("furboats.action", {
  detail: { action: "generate_report" }
}));
```

Host behavior: download the current PDF report. Requires a current ICE class analysis.

## Host -> Widget Commands

The host emits commands to both the widget element and `window`:

```js
new CustomEvent("ice-route.command", {
  detail: {
    command: "route.updated",
    payload: {},
    source: "ice-route",
    sentAt: "2026-05-16T12:00:00.000Z"
  }
})
```

Supported commands:

- `waypoint.added`: sent when a new waypoint is added. Payload contains `{ waypoint: { id, lat, lng, name } }`.
- `route.updated`: sent whenever the waypoint list changes. Payload contains `{ waypointCount, totalDistanceNm, waypoints, navigationPeriod, analyzed, legs }`. When `analyzed` is `false`, leg ice-class fields are `null`.
- `ice_class.updated`: sent after the host receives a fresh AI ice-class analysis. Payload contains route coordinates, `navigationPeriod`, plus `legs[]` with `{ from, to, distanceNm, iceClass, thickness, risk, integrity, demandingSegment, advisories }`.
- `navigation_period.current`: sent when the widget requests the current navigation period. Payload contains `{ navigationPeriod: { startDate, endDate, complete } }`.
- `navigation_period.updated`: sent when the host or widget sets/clears the navigation period. Payload contains `{ navigationPeriod: { startDate, endDate, complete } }`.
- `navigation_period.required`: sent when route calculation is requested without a complete period. Payload contains `{ reason, message, currentPeriod }`. The widget should ask the user for start and end dates, then emit `set_navigation_period`.
- `calculate_route.rejected`: sent when the widget requests route calculation but there are not enough waypoints or calculation is already running.
- `insert_waypoint.rejected`: sent when the widget requests insertion into a leg that does not exist.
- `delete_leg.rejected`: sent when the widget requests deletion of a leg that does not exist.
- `report.generated`: sent after the host starts a PDF report download.
- `report.unavailable`: sent when the widget requests a report but no current ICE class analysis exists.

Current host behavior:

- The first ice-class analysis is initiated by the user from the host app after selecting at least two route points.
- A complete navigation period is required before ice-class calculation. The backend ice-analysis request uses the period as a primary input and asks for the worst expected ice load across the full interval.
- After a successful analysis, later route changes invalidate the existing ice-class result locally. The host does not automatically call AI again.
- The widget should treat `ice_class.updated` as the authoritative analyzed route context for voice answers. If a later `route.updated` has `analyzed: false`, the previous ice-class context is stale and should not be used as current guidance.
- A fresh `ice_class.updated` is emitted only after the user presses Calculate again and the AI request succeeds.

## Widget Developer Tasks

1. Render a stable transcript element in the widget shadow DOM where user and assistant subtitle text is continuously appended.
2. When the assistant produces an actionable instruction, emit a structured `furboats.action` event. Keep `/action ...` transcript text as a human-readable fallback, but the structured event should be the primary integration path.
3. Listen for `ice-route.command` on both the widget custom element and `window`. Use `route.updated` and `waypoint.added` to update the agent context.
4. Do not execute arbitrary transcript text. Only emit actions from an allowlist: `navigate`, `add_waypoint`, `insert_waypoint`, `delete_leg`, `set_navigation_period`, `get_navigation_period`, `calculate_route`, and `generate_report`.
5. When receiving `navigation_period.required`, ask the user for a start and end date before retrying `calculate_route`.
6. Include a unique action id in future payloads when possible so the host can de-duplicate repeated voice/transcript events.
