import {
  bigserial, boolean, doublePrecision, index, integer, jsonb, pgTable, serial, text,
  timestamp, uniqueIndex, bigint,
} from 'drizzle-orm/pg-core';

const tz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const devices = pgTable('devices', {
  id: text('id').primaryKey(),
  name: text('name'),
  tokenHash: text('token_hash').notNull(),
  createdAt: tz('created_at').notNull().defaultNow(),
  lastSeenAt: tz('last_seen_at'),
  lastRssi: integer('last_rssi'),
  fwVersion: text('fw_version'),
  lastUptimeS: integer('last_uptime_s'),
  lastHeapFree: integer('last_heap_free'),
  lastBacklog: integer('last_backlog'),
  // Tambahan di luar CLAUDE.md Bagian 6: dibutuhkan halaman Perangkat (buffer_full).
  lastBufferFull: boolean('last_buffer_full'),
  // Tambahan: sensor mana yang terdeteksi firmware ({dht22,bmp280,bh1750,rain}), untuk "belum terhubung".
  lastSensors: jsonb('last_sensors'),
});

export const readingsMinute = pgTable(
  'readings_minute',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    deviceId: text('device_id').notNull(),
    ts: tz('ts').notNull(),
    tempDht: doublePrecision('temp_dht'),
    humDht: doublePrecision('hum_dht'),
    tempBmp: doublePrecision('temp_bmp'),
    pressureHpa: doublePrecision('pressure_hpa'),
    lux: doublePrecision('lux'),
    rainAnalogAvg: doublePrecision('rain_analog_avg'),
    rainWetSeconds: integer('rain_wet_seconds'),
    samples: integer('samples'),
    receivedAt: tz('received_at').notNull().defaultNow(),
    isBackfill: boolean('is_backfill').notNull().default(false),
  },
  (t) => [
    uniqueIndex('readings_minute_device_ts_uq').on(t.deviceId, t.ts),
    index('readings_minute_ts_idx').on(t.ts),
  ],
);

export const rainEvents = pgTable(
  'rain_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    deviceId: text('device_id').notNull(),
    ts: tz('ts').notNull(),
    state: text('state').notNull(),
    receivedAt: tz('received_at').notNull().defaultNow(),
    isBackfill: boolean('is_backfill').notNull().default(false),
  },
  (t) => [uniqueIndex('rain_events_device_ts_state_uq').on(t.deviceId, t.ts, t.state)],
);

export const fuzzyPredictions = pgTable(
  'fuzzy_predictions',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    deviceId: text('device_id').notNull(),
    ts: tz('ts').notNull(),
    configVersion: text('config_version').notNull(),
    deltaP3h: doublePrecision('delta_p3h'),
    rh: doublePrecision('rh'),
    dewPoint: doublePrecision('dew_point'),
    dpd: doublePrecision('dpd'),
    memberships: jsonb('memberships'),
    ruleStrengths: jsonb('rule_strengths'),
    probability: doublePrecision('probability'),
    category: text('category'),
    predictRain: boolean('predict_rain'),
    status: text('status').notNull(),
  },
  (t) => [uniqueIndex('fuzzy_predictions_device_ts_uq').on(t.deviceId, t.ts)],
);

export const bmkgForecasts = pgTable(
  'bmkg_forecasts',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    adm4: text('adm4').notNull(),
    analysisDate: tz('analysis_date').notNull(),
    utcDatetime: tz('utc_datetime').notNull(),
    localDatetime: text('local_datetime'),
    t: doublePrecision('t'),
    hu: doublePrecision('hu'),
    weatherCode: integer('weather_code'),
    weatherDesc: text('weather_desc'),
    tcc: doublePrecision('tcc'),
    ws: doublePrecision('ws'),
    wd: text('wd'),
    raw: jsonb('raw'),
    fetchedAt: tz('fetched_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('bmkg_forecasts_uq').on(t.adm4, t.analysisDate, t.utcDatetime)],
);

export const evaluationSlots = pgTable(
  'evaluation_slots',
  {
    id: serial('id').primaryKey(),
    slotStart: tz('slot_start').notNull(),
    slotEnd: tz('slot_end').notNull(),
    deviceId: text('device_id').notNull(),
    wetMinutes: integer('wet_minutes'),
    dataMinutes: integer('data_minutes'),
    actualRain: boolean('actual_rain'),
    fuzzyPredictionId: bigint('fuzzy_prediction_id', { mode: 'number' }),
    fuzzyPredictRain: boolean('fuzzy_predict_rain'),
    fuzzyProbability: doublePrecision('fuzzy_probability'),
    bmkgForecastId: bigint('bmkg_forecast_id', { mode: 'number' }),
    bmkgWeatherDesc: text('bmkg_weather_desc'),
    bmkgPredictRain: boolean('bmkg_predict_rain'),
    fuzzyCorrect: boolean('fuzzy_correct'),
    bmkgCorrect: boolean('bmkg_correct'),
  },
  (t) => [uniqueIndex('evaluation_slots_device_start_uq').on(t.deviceId, t.slotStart)],
);

export const appConfig = pgTable('app_config', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type ReadingRow = typeof readingsMinute.$inferSelect;
export type PredictionRow = typeof fuzzyPredictions.$inferSelect;
export type BmkgRow = typeof bmkgForecasts.$inferSelect;
export type EvaluationSlotRow = typeof evaluationSlots.$inferSelect;
export type RainEventRow = typeof rainEvents.$inferSelect;
export type DeviceRow = typeof devices.$inferSelect;
