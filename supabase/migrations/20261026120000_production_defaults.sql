-- RotiPOS: production-safe defaults.
--
-- A fresh production database has no demo seed. This migration only creates the
-- single store_settings row the app needs so public pages render before the
-- admin opens Settings for the first time. It never overwrites existing values.

insert into public.store_settings (
  id,
  store_name,
  timezone,
  business_hours,
  slot_interval_minutes,
  min_preorder_minutes,
  manual_qris_enabled
)
values (
  1,
  'RotiPOS',
  'Asia/Jakarta',
  $json${
    "0": { "closed": false, "open": "08:00", "close": "20:00" },
    "1": { "closed": false, "open": "08:00", "close": "20:00" },
    "2": { "closed": false, "open": "08:00", "close": "20:00" },
    "3": { "closed": false, "open": "08:00", "close": "20:00" },
    "4": { "closed": false, "open": "08:00", "close": "20:00" },
    "5": { "closed": false, "open": "08:00", "close": "20:00" },
    "6": { "closed": false, "open": "08:00", "close": "20:00" }
  }$json$::jsonb,
  30,
  60,
  false
)
on conflict (id) do nothing;
