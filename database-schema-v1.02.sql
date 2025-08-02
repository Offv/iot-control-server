-- Database Schema for IoT Control Server v1.02
-- Device Registry and Unit Configuration System

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS iot_control_v102;

-- Use the database
\c iot_control_v102;

-- Device Registry Table
-- Stores all discovered IO-Link devices with their MAC addresses
CREATE TABLE IF NOT EXISTS device_registry (
    id SERIAL PRIMARY KEY,
    mac_address VARCHAR(17) UNIQUE NOT NULL,
    ip_address VARCHAR(15) NOT NULL,
    subnet INTEGER NOT NULL,
    unit_number INTEGER,
    heater_type VARCHAR(10), -- 'A', 'B', 'C', 'T' (Temperature), 'O' (Other)
    device_name VARCHAR(100),
    device_type VARCHAR(50) DEFAULT 'IO-Link Master',
    is_validated BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    discovery_date TIMESTAMP DEFAULT NOW(),
    validation_date TIMESTAMP,
    last_seen TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Unit Configuration Table
-- Stores unit-level configuration
CREATE TABLE IF NOT EXISTS unit_config (
    id SERIAL PRIMARY KEY,
    unit_number INTEGER UNIQUE NOT NULL,
    subnet INTEGER NOT NULL,
    host_ip VARCHAR(15) NOT NULL,
    mqtt_port INTEGER DEFAULT 1883,
    mqtt_websocket_port INTEGER DEFAULT 9001,
    frontend_port INTEGER NOT NULL,
    backend_port INTEGER NOT NULL,
    database_port INTEGER DEFAULT 5432,
    unit_name VARCHAR(100),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Heater Configuration Table
-- Stores heater-specific configuration
CREATE TABLE IF NOT EXISTS heater_config (
    id SERIAL PRIMARY KEY,
    unit_number INTEGER NOT NULL,
    heater_type VARCHAR(10) NOT NULL, -- 'A', 'B', 'C', etc.
    device_mac VARCHAR(17) NOT NULL,
    device_ip VARCHAR(15) NOT NULL,
    temperature_port INTEGER DEFAULT 6,
    pid_port INTEGER DEFAULT 5,
    section_ports INTEGER[] DEFAULT '{1,2,3,4}',
    max_temperature INTEGER DEFAULT 750,
    min_temperature INTEGER DEFAULT 32,
    default_setpoint INTEGER DEFAULT 200,
    timer_duration INTEGER DEFAULT 15,
    mqtt_topic VARCHAR(200),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (device_mac) REFERENCES device_registry(mac_address),
    UNIQUE(unit_number, heater_type)
);

-- Port Configuration Table
-- Stores IO-Link port mappings for each heater
CREATE TABLE IF NOT EXISTS port_config (
    id SERIAL PRIMARY KEY,
    heater_id INTEGER NOT NULL,
    port_number INTEGER NOT NULL,
    section_number INTEGER NOT NULL,
    port_type VARCHAR(20) DEFAULT 'heater_section', -- 'heater_section', 'pid_output', 'temperature'
    is_protected BOOLEAN DEFAULT FALSE, -- Section 0 protection
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (heater_id) REFERENCES heater_config(id),
    UNIQUE(heater_id, port_number)
);

-- MQTT Topic Configuration Table
-- Stores MQTT topic mappings
CREATE TABLE IF NOT EXISTS mqtt_config (
    id SERIAL PRIMARY KEY,
    unit_number INTEGER NOT NULL,
    heater_type VARCHAR(10),
    topic_type VARCHAR(50) NOT NULL, -- 'temperature', 'status', 'command', 'pid'
    topic_pattern VARCHAR(200) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Installation Log Table
-- Tracks installation and configuration events
CREATE TABLE IF NOT EXISTS installation_log (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL, -- 'discovery', 'validation', 'configuration', 'error'
    event_description TEXT NOT NULL,
    device_mac VARCHAR(17),
    unit_number INTEGER,
    heater_type VARCHAR(10),
    status VARCHAR(20) DEFAULT 'success', -- 'success', 'error', 'warning'
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_device_registry_mac ON device_registry(mac_address);
CREATE INDEX IF NOT EXISTS idx_device_registry_unit ON device_registry(unit_number);
CREATE INDEX IF NOT EXISTS idx_device_registry_ip ON device_registry(ip_address);
CREATE INDEX IF NOT EXISTS idx_heater_config_unit_heater ON heater_config(unit_number, heater_type);
CREATE INDEX IF NOT EXISTS idx_heater_config_mac ON heater_config(device_mac);
CREATE INDEX IF NOT EXISTS idx_port_config_heater ON port_config(heater_id);
CREATE INDEX IF NOT EXISTS idx_mqtt_config_unit ON mqtt_config(unit_number);
CREATE INDEX IF NOT EXISTS idx_installation_log_event ON installation_log(event_type);
CREATE INDEX IF NOT EXISTS idx_installation_log_device ON installation_log(device_mac);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_device_registry_updated_at 
    BEFORE UPDATE ON device_registry 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_unit_config_updated_at 
    BEFORE UPDATE ON unit_config 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_heater_config_updated_at 
    BEFORE UPDATE ON heater_config 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_port_config_updated_at 
    BEFORE UPDATE ON port_config 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mqtt_config_updated_at 
    BEFORE UPDATE ON mqtt_config 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default MQTT topic patterns
INSERT INTO mqtt_config (unit_number, heater_type, topic_type, topic_pattern) VALUES
(1, 'A', 'temperature', 'instrument/unit1/htr_a/temperature'),
(1, 'B', 'temperature', 'instrument/unit1/htr_b/temperature'),
(1, 'A', 'status', 'instrument/unit1/htr_a/status'),
(1, 'B', 'status', 'instrument/unit1/htr_b/status'),
(1, 'A', 'command', 'instrument/unit1/htr_a/command'),
(1, 'B', 'command', 'instrument/unit1/htr_b/command'),
(2, 'A', 'temperature', 'instrument/unit2/htr_a/temperature'),
(2, 'B', 'temperature', 'instrument/unit2/htr_b/temperature'),
(2, 'A', 'status', 'instrument/unit2/htr_a/status'),
(2, 'B', 'status', 'instrument/unit2/htr_b/status'),
(2, 'A', 'command', 'instrument/unit2/htr_a/command'),
(2, 'B', 'command', 'instrument/unit2/htr_b/command')
ON CONFLICT DO NOTHING;

-- Create views for easier querying
CREATE OR REPLACE VIEW active_devices AS
SELECT 
    dr.mac_address,
    dr.ip_address,
    dr.subnet,
    dr.unit_number,
    dr.heater_type,
    dr.device_name,
    dr.is_validated,
    dr.last_seen
FROM device_registry dr
WHERE dr.is_active = TRUE AND dr.is_validated = TRUE;

CREATE OR REPLACE VIEW unit_summary AS
SELECT 
    uc.unit_number,
    uc.unit_name,
    uc.subnet,
    uc.host_ip,
    COUNT(hc.id) as heater_count,
    COUNT(dr.id) as device_count
FROM unit_config uc
LEFT JOIN heater_config hc ON uc.unit_number = hc.unit_number
LEFT JOIN device_registry dr ON uc.unit_number = dr.unit_number
WHERE uc.is_active = TRUE
GROUP BY uc.id, uc.unit_number, uc.unit_name, uc.subnet, uc.host_ip;

CREATE OR REPLACE VIEW heater_summary AS
SELECT 
    hc.unit_number,
    hc.heater_type,
    hc.device_mac,
    hc.device_ip,
    hc.max_temperature,
    hc.default_setpoint,
    hc.timer_duration,
    COUNT(pc.id) as port_count,
    hc.is_active
FROM heater_config hc
LEFT JOIN port_config pc ON hc.id = pc.heater_id
GROUP BY hc.id, hc.unit_number, hc.heater_type, hc.device_mac, hc.device_ip, 
         hc.max_temperature, hc.default_setpoint, hc.timer_duration, hc.is_active;

-- Grant permissions (adjust as needed)
-- GRANT ALL PRIVILEGES ON DATABASE iot_control_v102 TO iot_user;
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO iot_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO iot_user;

-- Insert sample data for testing (optional)
-- INSERT INTO unit_config (unit_number, subnet, host_ip, frontend_port, backend_port, unit_name) VALUES
-- (1, 20, '192.168.20.100', 33001, 38001, 'Unit 1'),
-- (2, 30, '192.168.30.100', 33002, 38002, 'Unit 2');

COMMIT; 