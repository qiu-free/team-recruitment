INSERT INTO users (id, username, password_hash, nickname, bio, skills, weekly_hours) VALUES
('user_a', 'alice', 'scrypt:6X2thVuew_I1_mkKSDx2yQ:zQnr3AmDIASuPIP3pkMls9RJI0V7CNQvpkRiSgiLxTo', '林知夏', '喜欢把模糊想法做成可以使用的产品。', '["产品设计", "用户研究", "项目管理"]', 10),
('user_b', 'bob', 'scrypt:2w0XA6GM8UGsFbQlOI8VGQ:xUVXSrPlxUOYsaM4Yqb22BZnj17fXwEt6ucrpl_vRSg', '周予安', '前端开发学习者，喜欢把复杂交互做得简单。', '["React", "TypeScript", "Web 开发"]', 8),
('user_c', 'cathy', 'scrypt:E0IRQe5f-eg2NwXKXYqHmw:8z-pYT9Jv1t-EdPZ6WgZbf7_507Bs8q5ADB6XDPiw44', '许清禾', '正在积累数据可视化和测试实践。', '["Python", "数据可视化", "测试"]', 6),
('user_d', 'david', 'scrypt:P6YTQsXNYuj8Hl3U_jfVfg:S52g5w9Q0GsTO8g4xyzD2_k43lM1icyXZm0gnJlfM5k', '陈默', '希望参与真实项目，负责落地和文档。', '["Node.js", "PostgreSQL", "文档"]', 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO projects (id, owner_id, title, goal, progress, expected_outcome, recruitment_paused) VALUES
('project_open', 'user_a', '校园智能导览', '为新生制作一个更容易理解的校园路线与服务地图。', '已完成用户访谈，正在制作第一版原型。', '可交互原型和一份用户测试报告。', FALSE),
('project_paused', 'user_a', '绿色校园能耗看板', '用可视化方式帮助同学理解校园能源使用。', '数据字段已经整理，等待招募恢复后开始开发。', '一套可演示的能耗分析看板。', TRUE),
('project_full', 'user_d', '社团活动协作台', '让社团负责人可以快速分配活动准备工作。', '核心功能已完成，正在补充测试。', '可部署的活动协作工具。', FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_roles (id, project_id, name, skills, capacity) VALUES
('role_open_frontend', 'project_open', '前端开发', '["React", "TypeScript", "Web 开发"]', 1),
('role_open_research', 'project_open', '用户研究', '["用户研究", "访谈"]', 2),
('role_paused_data', 'project_paused', '数据可视化', '["Python", "数据可视化"]', 2),
('role_full_backend', 'project_full', '后端开发', '["Node.js", "PostgreSQL"]', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_members (id, project_id, user_id, role_id, is_owner) VALUES
('member_owner_open', 'project_open', 'user_a', NULL, TRUE),
('member_owner_paused', 'project_paused', 'user_a', NULL, TRUE),
('member_owner_full', 'project_full', 'user_d', NULL, TRUE),
('member_full_backend', 'project_full', 'user_b', 'role_full_backend', FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO applications (id, project_id, applicant_id, role_id, reason, contribution, profile_snapshot, status) VALUES
('application_b_open', 'project_open', 'user_b', 'role_open_frontend', '我有 React 和 TypeScript 课程项目经验。', '负责首页、角色卡片和移动端适配。', '{"nickname":"周予安","bio":"前端开发学习者，喜欢把复杂交互做得简单。","skills":["React","TypeScript","Web 开发"],"weeklyHours":8}', 'pending'),
('application_c_open', 'project_open', 'user_c', 'role_open_frontend', '我正在学习前端，也能负责可视化部分。', '协助数据展示组件和测试用例。', '{"nickname":"许清禾","bio":"正在积累数据可视化和测试实践。","skills":["Python","数据可视化","测试"],"weeklyHours":6}', 'pending')
ON CONFLICT (id) DO NOTHING;
