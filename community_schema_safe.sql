-- Safe Community Schema - Handles existing tables gracefully
-- Run this if you're getting column errors

-- Add missing columns to existing profiles table
DO $$ 
BEGIN
    -- Add is_active column to profiles if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_active') THEN
        ALTER TABLE profiles ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    END IF;
    
    -- Add avatar_url column to profiles if it doesn't exist  
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'avatar_url') THEN
        ALTER TABLE profiles ADD COLUMN avatar_url TEXT;
    END IF;
END $$;

-- Community Discussions
DROP TABLE IF EXISTS community_discussions CASCADE;
CREATE TABLE community_discussions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    category VARCHAR(100),
    is_popular BOOLEAN DEFAULT FALSE,
    reply_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Discussion Replies
DROP TABLE IF EXISTS discussion_replies CASCADE;
CREATE TABLE discussion_replies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    discussion_id UUID REFERENCES community_discussions(id) ON DELETE CASCADE,
    author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_reply_id UUID REFERENCES discussion_replies(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Angels System
DROP TABLE IF EXISTS angels CASCADE;
CREATE TABLE angels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    specialty VARCHAR(255),
    experience_description TEXT,
    bio TEXT,
    support_style TEXT[],
    max_souls INTEGER DEFAULT 3,
    current_souls INTEGER DEFAULT 0,
    is_available BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    rating DECIMAL(3,2) DEFAULT 0.0,
    total_ratings INTEGER DEFAULT 0,
    response_time_hours INTEGER DEFAULT 2,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Angel-Soul Relationships
DROP TABLE IF EXISTS angel_soul_relationships CASCADE;
CREATE TABLE angel_soul_relationships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    angel_id UUID REFERENCES angels(id) ON DELETE CASCADE,
    soul_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    relationship_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    last_checkin TIMESTAMP WITH TIME ZONE,
    next_scheduled TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(angel_id, soul_id)
);

-- Mentors System
DROP TABLE IF EXISTS mentors CASCADE;
CREATE TABLE mentors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    specialty VARCHAR(255),
    experience_description TEXT,
    bio TEXT,
    is_professional BOOLEAN DEFAULT FALSE,
    credentials TEXT,
    session_count INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0.0,
    total_ratings INTEGER DEFAULT 0,
    is_available BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Community Activities
DROP TABLE IF EXISTS community_activities CASCADE;
CREATE TABLE community_activities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    activity_type VARCHAR(100),
    location VARCHAR(255),
    is_virtual BOOLEAN DEFAULT FALSE,
    max_participants INTEGER,
    current_participants INTEGER DEFAULT 0,
    organizer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    scheduled_date TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    status VARCHAR(50) DEFAULT 'upcoming',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE community_discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE discussion_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE angels ENABLE ROW LEVEL SECURITY;
ALTER TABLE angel_soul_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentors ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_activities ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
CREATE POLICY "Enable read access for all users" ON community_discussions FOR SELECT USING (is_active = true);
CREATE POLICY "Enable insert for authenticated users only" ON community_discussions FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Enable update for users based on user_id" ON community_discussions FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Enable read access for all users" ON angels FOR SELECT USING (is_active = true);
CREATE POLICY "Enable insert for authenticated users only" ON angels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Enable update for users based on user_id" ON angels FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Enable read access for all users" ON mentors FOR SELECT USING (is_active = true);
CREATE POLICY "Enable insert for authenticated users only" ON mentors FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Enable update for users based on user_id" ON mentors FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Enable read access for all users" ON community_activities FOR SELECT USING (is_active = true);
CREATE POLICY "Enable insert for authenticated users only" ON community_activities FOR INSERT WITH CHECK (auth.uid() = organizer_id);

-- Insert some sample data for testing
INSERT INTO community_discussions (title, content, author_id, category, is_popular) 
SELECT 
    'Welcome to the Community!',
    'This is our first discussion post. Feel free to share your thoughts and connect with others.',
    id,
    'General',
    true
FROM profiles 
WHERE email = (SELECT email FROM auth.users LIMIT 1)
ON CONFLICT DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_discussions_active ON community_discussions(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discussions_category ON community_discussions(category, is_active);
CREATE INDEX IF NOT EXISTS idx_angels_active ON angels(is_