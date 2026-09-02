-- Migration: Add Letterhead and Watermark columns to organizations table
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS letterhead_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS letterhead_watermark_url text,
ADD COLUMN IF NOT EXISTS letterhead_watermark_opacity numeric DEFAULT 0.10,
ADD COLUMN IF NOT EXISTS letterhead_logo_height integer DEFAULT 130,
ADD COLUMN IF NOT EXISTS letterhead_header_url text,
ADD COLUMN IF NOT EXISTS letterhead_footer_url text,
ADD COLUMN IF NOT EXISTS letterhead_header_text text,
ADD COLUMN IF NOT EXISTS letterhead_footer_text text,
ADD COLUMN IF NOT EXISTS letterhead_header_height integer DEFAULT 80;
