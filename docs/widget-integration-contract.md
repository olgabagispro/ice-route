# Widget Integration Contract

This app embeds the Furboats voice widget as a second AI agent. The widget and host app communicate through DOM `CustomEvent`s.

## Widget -> Host Actions

The host currently supports two actions. Coordinates are passed as `lng, lat` because this is the format used by agent text commands.

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
- `route.updated`: sent whenever the waypoint list changes. Payload contains `{ waypointCount, totalDistanceNm, waypoints }`.

## Widget Developer Tasks

1. Render a stable transcript element in the widget shadow DOM where user and assistant subtitle text is continuously appended.
2. When the assistant produces an actionable instruction, emit a structured `furboats.action` event. Keep `/action ...` transcript text as a human-readable fallback, but the structured event should be the primary integration path.
3. Listen for `ice-route.command` on both the widget custom element and `window`. Use `route.updated` and `waypoint.added` to update the agent context.
4. Do not execute arbitrary transcript text. Only emit actions from an allowlist: `navigate` and `add_waypoint` for now.
5. Include a unique action id in future payloads when possible so the host can de-duplicate repeated voice/transcript events.
