const { pool } = require('../config/database');

// Get all settings (grouped by category)
exports.getAllSettings = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, category, setting_key, setting_value, setting_type, description, options 
       FROM system_settings 
       ORDER BY category, id`
    );

    // Group settings by category
    const grouped = {};
    for (const row of rows) {
      if (!grouped[row.category]) {
        grouped[row.category] = [];
      }
      
      // Parse options if present
      let options = null;
      if (row.options) {
        // MySQL JSON columns may already be parsed
        if (Array.isArray(row.options)) {
          options = row.options;
        } else if (typeof row.options === 'string') {
          try {
            options = JSON.parse(row.options);
          } catch (e) {
            options = null;
          }
        }
      }
      
      // Convert value based on type
      let value = row.setting_value;
      if (row.setting_type === 'toggle') {
        value = row.setting_value === 'true';
      } else if (row.setting_type === 'number') {
        value = parseFloat(row.setting_value) || 0;
      }
      
      grouped[row.category].push({
        id: row.id,
        key: row.setting_key,
        value: value,
        type: row.setting_type,
        description: row.description,
        options: options
      });
    }

    res.json(grouped);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ message: 'Failed to fetch settings' });
  }
};

// Get settings by category
exports.getSettingsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    
    const [rows] = await pool.query(
      `SELECT id, category, setting_key, setting_value, setting_type, description, options 
       FROM system_settings 
       WHERE category = ?
       ORDER BY id`,
      [category]
    );

    const settings = rows.map(row => {
      let options = null;
      if (row.options) {
        // MySQL JSON columns may already be parsed
        if (Array.isArray(row.options)) {
          options = row.options;
        } else if (typeof row.options === 'string') {
          try {
            options = JSON.parse(row.options);
          } catch (e) {
            options = null;
          }
        }
      }
      
      let value = row.setting_value;
      if (row.setting_type === 'toggle') {
        value = row.setting_value === 'true';
      } else if (row.setting_type === 'number') {
        value = parseFloat(row.setting_value) || 0;
      }
      
      return {
        id: row.id,
        key: row.setting_key,
        value: value,
        type: row.setting_type,
        description: row.description,
        options: options
      };
    });

    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings by category:', error);
    res.status(500).json({ message: 'Failed to fetch settings' });
  }
};

// Update settings (batch update)
exports.updateSettings = async (req, res) => {
  try {
    const { settings } = req.body;
    const userId = req.user.id;

    if (!settings || !Array.isArray(settings)) {
      return res.status(400).json({ message: 'Settings array is required' });
    }

    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      for (const setting of settings) {
        const { category, key, value } = setting;
        
        // Convert value to string for storage
        let stringValue = value;
        if (typeof value === 'boolean') {
          stringValue = value ? 'true' : 'false';
        } else if (typeof value === 'number') {
          stringValue = value.toString();
        }

        await connection.query(
          `UPDATE system_settings 
           SET setting_value = ?, updated_by = ?, updated_at = NOW()
           WHERE category = ? AND setting_key = ?`,
          [stringValue, userId, category, key]
        );
      }

      await connection.commit();
      
      res.json({ message: 'Settings updated successfully' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ message: 'Failed to update settings' });
  }
};

// Update a single setting
exports.updateSetting = async (req, res) => {
  try {
    const { category, key } = req.params;
    const { value } = req.body;
    const userId = req.user.id;

    // Convert value to string for storage
    let stringValue = value;
    if (typeof value === 'boolean') {
      stringValue = value ? 'true' : 'false';
    } else if (typeof value === 'number') {
      stringValue = value.toString();
    }

    const [result] = await pool.query(
      `UPDATE system_settings 
       SET setting_value = ?, updated_by = ?, updated_at = NOW()
       WHERE category = ? AND setting_key = ?`,
      [stringValue, userId, category, key]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Setting not found' });
    }

    res.json({ message: 'Setting updated successfully' });
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ message: 'Failed to update setting' });
  }
};

// Get public branding (logo + name, no auth required)
exports.getPublicBranding = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT setting_key, setting_value FROM system_settings WHERE category = 'general' AND setting_key IN ('system_logo', 'dorm_name')`
    );

    const result = { logo: '', name: 'PAC DMS' };
    for (const row of rows) {
      if (row.setting_key === 'system_logo') result.logo = row.setting_value || '';
      if (row.setting_key === 'dorm_name') result.name = row.setting_value || 'PAC DMS';
    }
    res.json(result);
  } catch (error) {
    console.error('Error fetching public branding:', error);
    res.json({ logo: '', name: 'PAC DMS' });
  }
};

// Get a single setting value
exports.getSetting = async (req, res) => {
  try {
    const { category, key } = req.params;

    const [rows] = await pool.query(
      `SELECT setting_value, setting_type FROM system_settings 
       WHERE category = ? AND setting_key = ?`,
      [category, key]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Setting not found' });
    }

    const row = rows[0];
    let value = row.setting_value;
    
    if (row.setting_type === 'toggle') {
      value = row.setting_value === 'true';
    } else if (row.setting_type === 'number') {
      value = parseFloat(row.setting_value) || 0;
    }

    res.json({ value });
  } catch (error) {
    console.error('Error fetching setting:', error);
    res.status(500).json({ message: 'Failed to fetch setting' });
  }
};
