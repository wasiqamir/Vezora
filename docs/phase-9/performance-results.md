# Phase 9 performance results

Measured on this machine with `node scripts/phase9-perf.mjs`. These are local timings, not a hosted load test.

| Check | Result |
|---|---|
| 400-object project JSON | 82,694 bytes in under 1 ms |
| 2048×2048 raster buffer | 16 MB allocated and touched in 4 ms |
| Object cap | Documents reject more than 400 objects |
| Upload cap | 8 MB, edges 64–4096 |
| Reconstruction | Images wider than 2048 px are scaled down before tracing |
| Job queue | One reconstruction runs at a time in this server process |

## Low memory

A 2048×2048 RGBA buffer is about 16 MB. The upload edge limit is 4096, which is about 64 MB before the reconstruction step scales it down. The server runs one reconstruction at a time so two traces do not allocate that buffer together.

Dashboard lists do not send project documents. Template previews are small SVG markup, not stored image thumbnails.

## Canvas and autosave

Wheel zoom updates the React tree once per changed zoom percent, not on every wheel tick. Autosave still waits 2 seconds after an edit. Leaving the page does not start a second save while one is already in flight.
