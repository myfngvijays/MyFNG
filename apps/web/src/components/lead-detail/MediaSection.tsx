'use client';

/**
 * Media Section Component
 * Display and upload images/videos for leads
 * Task: WA-601
 */

import { useState, useEffect } from 'react';
import { Image as ImageIcon, Video, Upload, X, ZoomIn } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface MediaSectionProps {
  lead: any;
  onUpdate?: () => void;
}

interface MediaFile {
  id: string;
  media_url: string;
  media_type: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  media_category: 'CUSTOMER_UPLOAD' | 'INSPECTION' | 'PROGRESS' | 'COMPLETION' | 'AUDIT' | 'DOCUMENT';
  caption?: string;
  uploaded_by?: string;
  created_at: string;
  uploader?: { full_name: string };
}

export default function MediaSection({ lead, onUpdate }: MediaSectionProps) {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('INSPECTION');
  const [caption, setCaption] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    fetchMedia();
  }, [lead.id]);

  async function fetchMedia() {
    setLoading(true);
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from('lead_media')
        .select(`
          *,
          uploader:uploaded_by(full_name)
        `)
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMediaFiles(data || []);
    } catch (error) {
      console.error('Error fetching media:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'video/mp4', 'video/quicktime'];
    if (!validTypes.includes(file.type)) {
      alert('Invalid file type. Only images (JPEG, PNG, WEBP) and videos (MP4, MOV) are allowed.');
      return;
    }

    setUploading(true);
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${lead.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `lead-media/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('myfng-media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('myfng-media')
        .getPublicUrl(filePath);

      // Save media record
      const mediaType = file.type.startsWith('image') ? 'IMAGE' : 'VIDEO';
      const { error: insertError } = await supabase.from('lead_media').insert({
        lead_id: lead.id,
        media_url: publicUrl,
        media_type: mediaType,
        media_category: selectedCategory,
        caption: caption || null,
        uploaded_by: user.id,
      });

      if (insertError) throw insertError;

      // Create event
      await supabase.from('lead_events').insert({
        lead_id: lead.id,
        event_type: 'MEDIA_UPLOADED',
        event_description: `${mediaType} uploaded - ${selectedCategory}`,
        event_data: { media_category: selectedCategory, media_type: mediaType },
        created_by: user.id,
      });

      alert('✅ Media uploaded successfully!');
      setCaption('');
      fetchMedia();
      onUpdate?.();
    } catch (error: any) {
      console.error('Error uploading media:', error);
      alert(`Failed to upload: ${error.message}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteMedia(mediaId: string) {
    if (!confirm('Are you sure you want to delete this media?')) return;

    const supabase = createClient();
    try {
      const { error } = await supabase
        .from('lead_media')
        .delete()
        .eq('id', mediaId);

      if (error) throw error;

      alert('✅ Media deleted successfully!');
      fetchMedia();
      onUpdate?.();
    } catch (error) {
      console.error('Error deleting media:', error);
      alert('Failed to delete media');
    }
  }

  const groupedMedia = mediaFiles.reduce((acc, file) => {
    if (!acc[file.media_category]) acc[file.media_category] = [];
    acc[file.media_category].push(file);
    return acc;
  }, {} as Record<string, MediaFile[]>);

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <ImageIcon className="w-5 h-5 text-brand-primary" />
        Media Section
      </h2>

      {/* Upload Form */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <h3 className="font-semibold mb-3">Upload New Media</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="CUSTOMER_UPLOAD">Customer Upload</option>
              <option value="INSPECTION">Inspection</option>
              <option value="PROGRESS">Progress</option>
              <option value="COMPLETION">Completion</option>
              <option value="AUDIT">Audit</option>
              <option value="DOCUMENT">Document</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Caption (Optional)</label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a description..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="btn btn-primary cursor-pointer inline-flex items-center gap-2">
              <Upload className="w-4 h-4" />
              {uploading ? 'Uploading...' : 'Choose File'}
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
            <p className="text-xs text-gray-500 mt-2">Max 10MB • Images: JPEG, PNG, WEBP • Videos: MP4, MOV</p>
          </div>
        </div>
      </div>

      {/* Media Gallery */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading media...</div>
      ) : mediaFiles.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <ImageIcon className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p>No media uploaded yet</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedMedia).map(([category, files]) => (
            <div key={category}>
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                {category === 'CUSTOMER_UPLOAD' && '📸'}
                {category === 'INSPECTION' && '🔍'}
                {category === 'PROGRESS' && '⚙️'}
                {category === 'COMPLETION' && '✅'}
                {category === 'AUDIT' && '📋'}
                {category === 'DOCUMENT' && '📄'}
                {category.replace(/_/g, ' ')} ({files.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {files.map((file) => (
                  <div key={file.id} className="relative group">
                    <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                      {file.media_type === 'IMAGE' ? (
                        <img
                          src={file.media_url}
                          alt={file.caption || 'Lead media'}
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => setPreviewImage(file.media_url)}
                        />
                      ) : (
                        <video
                          src={file.media_url}
                          className="w-full h-full object-cover"
                          controls
                        />
                      )}
                    </div>
                    {file.caption && (
                      <p className="text-xs text-gray-600 mt-1 truncate">{file.caption}</p>
                    )}
                    <p className="text-xs text-gray-400">
                      {new Date(file.created_at).toLocaleDateString()}
                    </p>
                    <button
                      onClick={() => handleDeleteMedia(file.id)}
                      className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-[90vh] object-contain"
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 bg-white text-gray-800 p-2 rounded-full"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

