-- Seed users for Plawminary MySQL database
INSERT INTO users (id, name, dept, role, password_hash)
VALUES
('admin', 'Admin User', 'Administration', 'admin', '$2y$10$YKBGlbFLrLzVmGxsZaLo9.aXU9C9kRLirsVBi77M03C6lc5iasKFy'),
('2023-0001', 'Juan Dela Cruz', 'Col. of Business Administration', 'user', '$2y$10$I8nxMsY6qghYqnz2Ws86eOC/aDbRB/Y2zqV3nNyTW0l0A4cDmU1dq')
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    dept = VALUES(dept),
    role = VALUES(role),
    password_hash = VALUES(password_hash);

