-- Community Page Database Schema
-- Clean version without problematic columns

-- Community Discussions/Chats
CREATE TABLE IF NOT EXISTS community_discussions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    category VARCHAR(100),
    is_popular BOOLEAN DEFAULT FALSE,
    reply_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Discussion Replies
CREATE TABLE IF NOT EXISTS discussion_replies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    discussion_id UUID REFERENCES community_discussions(id) ON DELETE CASCADE,
    author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_reply_id UUID REFERENCES discussion_replies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Angels System
CREATE TABLE IF NOT EXISTS angels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    specialty VARCHAR(255),
    experience_description TEXT,
    bio TEXT,
    support_style TEXT[],
    max_souls INTEGER DEFAULT 3,
    current_souls INTEGER DEFAULT 0,
    is_available BOOLEAN DEFAULT TRUE,
    rating DECIMAL(3,2) DEFAULT 0.0,
    total_ratings INTEGER DEFAULT 0,
    response_time_hours INTEGER DEFAULT 2,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Angel-Soul Relationships
CREATE TABLE IF NOT EXISTS angel_soul_relationships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    angel_id UUID REFERENCES angels(id) ON DELETE CASCADE,
    soul_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    relationship_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'active',
    last_checkin TIMESTAMP WITH TIME ZONE,
    next_scheduled TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(angel_id, soul_id)
);

-- Angel Check-ins
CREATE TABLE IF NOT EXISTS angel_checkins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    relationship_id UUID REFERENCES angel_soul_relationships(id) ON DELETE CASCADE,
    message TEXT,
    mood_rating INTEGER CHECK (mood_rating >= 1 AND mood_rating <= 5),
    checkin_type VARCHAR(50) DEFAULT 'regular',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mentors System
CREATE TABLE IF NOT EXISTS mentors (
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mentor Sessions
CREATE TABLE IF NOT EXISTS mentor_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    mentor_id UUID REFERENCES mentors(id) ON DELETE CASCADE,
    mentee_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    session_type VARCHAR(50) DEFAULT 'chat',
    status VARCHAR(50) DEFAULT 'scheduled',
    scheduled_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Community Activities/Adventures
CREATE TABLE IF NOT EXISTS community_activities (
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activity Participants
CREATE TABLE IF NOT EXISTS activity_participants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    activity_id UUID REFERENCES community_activities(id) ON DELETE CASCADE,
    participant_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'registered',
    UNIQUE(activity_id, participant_id)
);

-- Discussion Bookmarks
CREATE TABLE IF NOT EXISTS discussion_bookmarks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    discussion_id UUID REFERENCES community_discussions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, discussion_id)
);

-- Angel Ratings
CREATE TABLE IF NOT EXISTS angel_ratings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    angel_id UUID REFERENCES angels(id) ON DELETE CASCADE,
    rater_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(angel_id, rater_id)
);

-- Mentor Ratings
CREATE TABLE IF NOT EXISTS mentor_ratings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    mentor_id UUID REFERENCES mentors(id) ON DELETE CASCADE,
    rater_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(mentor_id, rater_id)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_discussions_author ON community_discussions(author_id);
CREATE INDEX IF NOT EXISTS idx_discussions_category ON community_discussions(category);
CREATE INDEX IF NOT EXISTS idx_discussions_created ON community_discussions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discussions_popular ON community_discussions(is_popular, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_replies_discussion ON discussion_replies(discussion_id);
CREATE INDEX IF NOT EXISTS idx_replies_author ON discussion_replies(author_id);

CREATE INDEX IF NOT EXISTS idx_angels_available ON angels(is_available);
CREATE INDEX IF NOT EXISTS idx_angel_relationships_status ON angel_soul_relationships(status);

CREATE INDEX IF NOT EXISTS idx_mentors_available ON mentors(is_available);
CREATE INDEX IF NOT EXISTS idx_mentor_sessions_status ON mentor_sessions(status);

CREATE INDEX IF NOT EXISTS idx_activities_status ON community_activities(status, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_activity_participants ON activity_participants(activity_id, status);

-- Row Level Security
ALTER TABLE community_discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE discussion_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE angels ENABLE ROW LEVEL SECURITY;
ALTER TABLE angel_soul_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentors ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_activities ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
CREATE POLICY "Enable read access for all users" ON community_discussions FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON community_discussions FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Enable update for users based on author_id" ON community_discussions FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Enable read access for all users" ON angels FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON angels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Enable update for users based on user_id" ON angels FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Enable read access for all users" ON mentors FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON mentors FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Enable update for users based on user_id" ON mentors FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Enable read access for all users" ON community_activities FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON community_activities FOR INSERT WITH CHECK (auth.uid() = organizer_id);

-- Functions to update counters
CREATE OR REPLACE FUNCTION update_discussion_reply_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE community_discussions 
        SET reply_count = reply_count + 1,
            last_activity = NOW()
        WHERE id = NEW.discussion_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE community_discussions 
        SET reply_count = reply_count - 1,
            last_activity = NOW()
        WHERE id = OLD.discussion_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_angel_soul_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
        UPDATE angels 
        SET current_souls = current_souls + 1
        WHERE id = NEW.angel_id;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status = 'active' AND NEW.status != 'active' THEN
            UPDATE angels 
            SET current_souls = current_souls - 1
            WHERE id = NEW.angel_id;
        ELSIF OLD.status != 'active' AND NEW.status = 'active' THEN
            UPDATE angels 
            SET current_souls = current_souls + 1
            WHERE id = NEW.angel_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' AND OLD.status = 'active' THEN
        UPDATE angels 
        SET current_souls = current_souls - 1
        WHERE id = OLD.angel_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers
DROP TRIGGER IF EXISTS trigger_update_discussion_reply_count ON discussion_replies;
CREATE TRIGGER trigger_update_discussion_reply_count
    AFTER INSERT OR DELETE ON discussion_replies
    FOR EACH ROW EXECUTE FUNCTION update_discussion_reply_count();

DROP TRIGGER IF EXISTS trigger_update_angel_soul_count ON angel_soul_relationships;
CREATE TRIGGER trigger_update_angel_soul_count
    AFTER INSERT OR UPDATE OR DELETE ON angel_soul_relationships
    FOR EACH ROW EXECUTE FUNCTION update_angel_soul_count();