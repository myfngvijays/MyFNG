-- ============================================
-- BLOG MODULE - Complete Schema
-- All tables for blog management system
-- ============================================

-- Blog Categories Table
CREATE TABLE IF NOT EXISTS public.blog_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    status INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Blog Tags Table
CREATE TABLE IF NOT EXISTS public.blog_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Blogs Table (Main Content)
CREATE TABLE IF NOT EXISTS public.blogs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- BASIC DETAILS
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    excerpt TEXT,
    content TEXT NOT NULL,
    
    -- SEO DATA (Stored as JSONB)
    seo_data JSONB,
    
    -- AUTHOR & OWNERSHIP
    author_id UUID REFERENCES public.users_login(id),
    created_by UUID REFERENCES public.users_login(id),
    updated_by UUID REFERENCES public.users_login(id),
    
    -- CATEGORIZATION
    category_id UUID REFERENCES public.blog_categories(id),
    read_time INT DEFAULT 3,
    featured_image TEXT,
    
    -- STATUS & VISIBILITY
    status VARCHAR(20) DEFAULT 'draft',
    is_featured BOOLEAN DEFAULT FALSE,
    is_premium BOOLEAN DEFAULT FALSE,
    
    -- POST TIMING
    published_at TIMESTAMP,
    scheduled_at TIMESTAMP,
    
    -- ANALYTICS
    views INT DEFAULT 0,
    likes INT DEFAULT 0,
    shares INT DEFAULT 0,
    
    -- SYSTEM FIELDS
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT blogs_status_check CHECK (status IN ('draft', 'published', 'archived'))
);

-- Blog Tag Mapping Table (Many-to-Many)
CREATE TABLE IF NOT EXISTS public.blog_tag_mapping (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blog_id UUID REFERENCES public.blogs(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES public.blog_tags(id) ON DELETE CASCADE,
    UNIQUE(blog_id, tag_id)
);

-- Blog Versions Table (Version History)
CREATE TABLE IF NOT EXISTS public.blog_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blog_id UUID REFERENCES public.blogs(id) ON DELETE CASCADE,
    old_title VARCHAR(255),
    old_content TEXT,
    old_seo_data JSONB,
    version_number INT,
    updated_by UUID REFERENCES public.users_login(id),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Blog Comments Table
CREATE TABLE IF NOT EXISTS public.blog_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blog_id UUID REFERENCES public.blogs(id) ON DELETE CASCADE,
    user_name VARCHAR(150),
    user_email VARCHAR(200),
    comment TEXT NOT NULL,
    parent_comment_id UUID REFERENCES public.blog_comments(id) ON DELETE CASCADE,
    status INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Blog Images Table (Additional Images)
CREATE TABLE IF NOT EXISTS public.blog_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blog_id UUID REFERENCES public.blogs(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    caption TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Blog Read Stats Table (Analytics)
CREATE TABLE IF NOT EXISTS public.blog_read_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blog_id UUID REFERENCES public.blogs(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    views INT DEFAULT 0,
    unique_visitors INT DEFAULT 0,
    avg_read_time INT DEFAULT 0,
    UNIQUE(blog_id, date)
);

-- ============================================
-- INDEXES for Performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_blogs_status ON public.blogs(status);
CREATE INDEX IF NOT EXISTS idx_blogs_category ON public.blogs(category_id);
CREATE INDEX IF NOT EXISTS idx_blogs_author ON public.blogs(author_id);
CREATE INDEX IF NOT EXISTS idx_blogs_published_at ON public.blogs(published_at);
CREATE INDEX IF NOT EXISTS idx_blogs_slug ON public.blogs(slug);
CREATE INDEX IF NOT EXISTS idx_blogs_is_featured ON public.blogs(is_featured);

CREATE INDEX IF NOT EXISTS idx_blog_tag_mapping_blog ON public.blog_tag_mapping(blog_id);
CREATE INDEX IF NOT EXISTS idx_blog_tag_mapping_tag ON public.blog_tag_mapping(tag_id);

CREATE INDEX IF NOT EXISTS idx_blog_versions_blog ON public.blog_versions(blog_id);
CREATE INDEX IF NOT EXISTS idx_blog_comments_blog ON public.blog_comments(blog_id);
CREATE INDEX IF NOT EXISTS idx_blog_comments_status ON public.blog_comments(status);
CREATE INDEX IF NOT EXISTS idx_blog_images_blog ON public.blog_images(blog_id);
CREATE INDEX IF NOT EXISTS idx_blog_read_stats_blog ON public.blog_read_stats(blog_id);
CREATE INDEX IF NOT EXISTS idx_blog_read_stats_date ON public.blog_read_stats(date);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_blog_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for blogs table
CREATE TRIGGER update_blogs_updated_at
    BEFORE UPDATE ON public.blogs
    FOR EACH ROW
    EXECUTE FUNCTION update_blog_updated_at();

-- Trigger for blog_categories table
CREATE TRIGGER update_blog_categories_updated_at
    BEFORE UPDATE ON public.blog_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_blog_updated_at();

-- Function to auto-save version history on blog update
CREATE OR REPLACE FUNCTION save_blog_version()
RETURNS TRIGGER AS $$
DECLARE
    v_version_number INT;
BEGIN
    -- Get next version number
    SELECT COALESCE(MAX(version_number), 0) + 1
    INTO v_version_number
    FROM public.blog_versions
    WHERE blog_id = NEW.id;
    
    -- Save old version
    INSERT INTO public.blog_versions (
        blog_id,
        old_title,
        old_content,
        old_seo_data,
        version_number,
        updated_by
    ) VALUES (
        NEW.id,
        OLD.title,
        OLD.content,
        OLD.seo_data,
        v_version_number,
        NEW.updated_by
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to save version on blog update
CREATE TRIGGER save_blog_version_trigger
    BEFORE UPDATE ON public.blogs
    FOR EACH ROW
    WHEN (OLD.title IS DISTINCT FROM NEW.title 
       OR OLD.content IS DISTINCT FROM NEW.content 
       OR OLD.seo_data IS DISTINCT FROM NEW.seo_data)
    EXECUTE FUNCTION save_blog_version();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE public.blog_categories IS 'Blog categories for organizing content';
COMMENT ON TABLE public.blog_tags IS 'Tags for blog posts';
COMMENT ON TABLE public.blogs IS 'Main blog posts table with SEO data and analytics';
COMMENT ON TABLE public.blog_tag_mapping IS 'Many-to-many relationship between blogs and tags';
COMMENT ON TABLE public.blog_versions IS 'Version history for blog posts';
COMMENT ON TABLE public.blog_comments IS 'User comments on blog posts';
COMMENT ON TABLE public.blog_images IS 'Additional images for blog posts';
COMMENT ON TABLE public.blog_read_stats IS 'Analytics for blog readership';

COMMENT ON COLUMN public.blogs.seo_data IS 'JSONB containing meta_title, meta_description, keywords, canonical_url, og_title, og_description, og_image';
COMMENT ON COLUMN public.blogs.status IS 'draft, published, or archived';
