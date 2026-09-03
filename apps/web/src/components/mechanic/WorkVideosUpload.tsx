'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';

interface Props {
  leadId: string;
  onUploadComplete?: () => void;
}

export default function WorkVideosUpload({ leadId, onUploadComplete }: Props) {
  const [videos, setVideos] = useState<Array<{ id: string; url: string }>>([]);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    try {
      const res = await fetch(`/api/mechanic/jobs/${leadId}/upload-photos?category=after_video`);
      const json = await res.json().catch(() => ({}));
      const rows = Array.isArray(json?.data) ? json.data : [];
      setVideos(rows.map((row: any) => ({ id: String(row.id), url: String(row.photo_url || '') })));
    } catch {
      setVideos([]);
    }
  };

  useEffect(() => {
    void load();
  }, [leadId]);

  const upload = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      for (const [index, file] of files.entries()) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('photo_type', `AFTER_VIDEO-${Date.now()}-${index}`);
        formData.append('photo_category', 'after_video');
        const response = await fetch(`/api/mechanic/jobs/${leadId}/upload-photos`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(json?.error || 'Failed to upload video');
      }
      await load();
      onUploadComplete?.();
      toast.success('Service video uploaded');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to upload video');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-sm font-semibold text-slate-800">Service work videos</p>
      <p className="text-xs text-slate-500 mt-0.5 mb-2">
        Regular service videos (not extra work). These show on QC as Work videos.
      </p>
      <div className="flex flex-wrap gap-2 items-center">
        {videos.map((clip) => (
          <video
            key={clip.id}
            src={clip.url}
            className="h-20 w-28 rounded-lg object-cover bg-black"
            controls
            preload="metadata"
          />
        ))}
        <label className={`btn btn-outline text-xs ${uploading ? 'opacity-60' : ''}`}>
          {uploading ? 'Uploading...' : 'Add service video'}
          <input
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              e.currentTarget.value = '';
              void upload(files);
            }}
          />
        </label>
      </div>
    </div>
  );
}
