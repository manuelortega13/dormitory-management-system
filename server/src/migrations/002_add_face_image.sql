-- Migration: 002_add_face_image
-- Description: Add face_image column for parent verification during leave request approval
-- Created: 2026-02-26

-- Add face_image column to users table for storing base64 encoded face images
-- This will be used primarily for parent/guardian identity verification
ALTER TABLE users ADD COLUMN face_image LONGTEXT NULL AFTER photo_url;
