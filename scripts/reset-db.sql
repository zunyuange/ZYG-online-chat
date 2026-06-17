-- Drop all tables in correct order (respecting foreign keys)
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS evaluations;
DROP TABLE IF EXISTS visitor_blacklist;
DROP TABLE IF EXISTS queue;
DROP TABLE IF EXISTS staff_group_members;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS visitors;
DROP TABLE IF EXISTS sentences;
DROP TABLE IF EXISTS offline_messages;
DROP TABLE IF EXISTS chat_stats;
DROP TABLE IF EXISTS staff_users;
DROP TABLE IF EXISTS staff_groups;
DROP TABLE IF EXISTS robot_knowledge;
DROP TABLE IF EXISTS faq;
DROP TABLE IF EXISTS banwords;
DROP TABLE IF EXISTS evaluation_setting;
DROP TABLE IF EXISTS admin_users;
DROP TABLE IF EXISTS admin_config;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS todos;

-- Reset auto-increment counters
DELETE FROM sqlite_sequence;

VACUUM;