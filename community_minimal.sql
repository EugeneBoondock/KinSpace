-- Minimal Community Schema - Safe to run
-- This creates only the essential tables needed for the community page

-- Community Discussions
CREATE TABLE IF NOT EXISTS community_discussions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    author_id UUID,
    category VARCHAR(100),
    is_popular BOOLEAN DEFAULT FALSE,
    reply_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Angels System
CREATE TABLE IF NOT EXISTS angels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    specialty VARCHAR(255),
    bio TEXT,
    support_style TEXT[],
    max_souls INTEGER DEFAULT 3,
    current_souls INTEGER DEFAULT 0,
    is_available BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    rating DECIMAL(3,2) DEFAULT 0.0,
    response_time_hours INTEGER DEFAULT 2,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Angel-Soul Relationships
CREATE TABLE IF NOT EXISTS angel_soul_relationships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    angel_id UUID,
    soul_id UUID,
    relationship_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    last_checkin TIMESTAMP WITH TIME ZONE,
    next_scheduled TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mentors System
CREATE TABLE IF NOT EXISTS mentors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    specialty VARCHAR(255),
    experience_description TEXT,
    session_count INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0.0,
    is_available BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert sample data for testing (only if tables are empty)
INSERT INTO community_discussions (title, content, category, is_popular)
SELECT 'Welcome to KinSpace Community!', 'This is our first community discussion. Feel free to share your experiences and connect with others who understand your journey.', 'General', true
WHERE NOT EXISTS (SELECT 1 FROM community_discussions);

INSERT INTO community_discussions (title, content, category, is_popular)
SELECT 'Managing Daily Symptoms', 'How do you all manage your symptoms during busy days? Looking for practical tips that have worked for you.', 'Health Tips', true
WHERE NOT EXISTS (SELECT 1 FROM community_discussions WHERE title = 'Managing Daily Symptoms');

INSERT INTO community_discussions (title, content, category)
SELECT 'New Member Introduction', 'Hi everyone! Just joined the community and excited to connect with others. What advice would you give to someone just starting their health journey?', 'Introductions'
WHERE NOT EXISTS (SELECT 1 FROM community_discussions WHERE title = 'New Member Introduction');