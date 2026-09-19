INSERT INTO traits (name, normalized) VALUES
    ('Go', 'go'),
    ('PostgreSQL', 'postgresql'),
    ('Docker', 'docker'),
    ('React', 'react'),
    ('TypeScript', 'typescript'),
    ('Kubernetes', 'kubernetes'),
    ('Backend', 'backend')
ON CONFLICT (normalized) DO NOTHING;
