const { pool } = require('../config/database');

// Fallbacks if the settings rows are missing (they are seeded by migration 025).
const DEFAULTS = {
  passDurationMinutes: 60,
  extensionDurationMinutes: 60,
  maxExtensions: 3,
};

/**
 * Read the admin-configurable gatepass settings (category 'gatepass' in system_settings).
 * Always returns sane numeric values, falling back to DEFAULTS on any issue.
 */
async function getGatepassSettings() {
  try {
    const [rows] = await pool.execute(
      "SELECT setting_key, setting_value FROM system_settings WHERE category = 'gatepass'"
    );
    const map = {};
    for (const row of rows) map[row.setting_key] = row.setting_value;

    const num = (val, fallback) => {
      const n = parseInt(val, 10);
      return Number.isFinite(n) && n > 0 ? n : fallback;
    };

    return {
      passDurationMinutes: num(map.pass_duration_minutes, DEFAULTS.passDurationMinutes),
      extensionDurationMinutes: num(map.extension_duration_minutes, DEFAULTS.extensionDurationMinutes),
      maxExtensions: num(map.max_extensions, DEFAULTS.maxExtensions),
    };
  } catch (error) {
    console.error('getGatepassSettings error:', error.message);
    return { ...DEFAULTS };
  }
}

module.exports = { getGatepassSettings, DEFAULTS };
