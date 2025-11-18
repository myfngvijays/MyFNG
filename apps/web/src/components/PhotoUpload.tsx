'use client';

import { useState, useRef } from 'react';
import { Camera, Upload, X, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface PhotoUploadProps {
  onUpload: (urls: string[]) => void;
  maxPhotos?: number;
  label?: string;
  required?: boolean;
}

export default function PhotoUpload({ 
  onUpload, 
  maxPhotos = 5, 
  label = 'Upload Photos',
  required = false 
}: PhotoUploadProps) {
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (photos.length + files.length > maxPhotos) {
      alert(`Maximum ${maxPhotos} photos allowed`);
      return;
    }

    setPhotos(prev => [...prev, ...files]);
    
    // Generate previews
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const uploadPhotos = async () => {
    if (photos.length === 0) {
      alert('Please select at least one photo');
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const uploadedUrls: string[] = [];

      for (const photo of photos) {
        const fileExt = photo.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `photos/${fileName}`;

        const { data, error } = await supabase.storage
          .from('media')
          .upload(filePath, photo);

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from('media')
          .getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
      }

      setUploaded(true);
      onUpload(uploadedUrls);
      
      // Reset after 2 seconds
      setTimeout(() => {
        setPhotos([]);
        setPreviews([]);
        setUploaded(false);
      }, 2000);

    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload photos. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="label">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <p className="text-sm text-gray-500 mb-3">
          Upload up to {maxPhotos} photos (JPG, PNG, max 5MB each)
        </p>
      </div>

      {/* Photo Previews */}
      {previews.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {previews.map((preview, index) => (
            <div key={index} className="relative group">
              <img 
                src={preview} 
                alt={`Preview ${index + 1}`} 
                className="w-full h-32 object-cover rounded-lg border-2 border-gray-200"
              />
              <button
                type="button"
                onClick={() => removePhoto(index)}
                className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Buttons */}
      <div className="flex gap-3">
        {photos.length < maxPhotos && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/jpg"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-outline flex-1"
              disabled={uploading || uploaded}
            >
              <Camera className="w-5 h-5" />
              Select Photos
            </button>
          </>
        )}

        {photos.length > 0 && !uploaded && (
          <button
            type="button"
            onClick={uploadPhotos}
            disabled={uploading}
            className="btn btn-primary flex-1"
          >
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Upload {photos.length} Photo{photos.length > 1 ? 's' : ''}
              </>
            )}
          </button>
        )}

        {uploaded && (
          <div className="btn bg-green-500 text-white flex-1 cursor-default">
            <CheckCircle className="w-5 h-5" />
            Uploaded Successfully!
          </div>
        )}
      </div>

      {/* Guidelines */}
      <div className="bg-blue-50 p-4 rounded-lg text-sm">
        <h4 className="font-semibold mb-2 text-brand-my">📸 Photo Guidelines:</h4>
        <ul className="text-gray-700 space-y-1 list-disc list-inside">
          <li>Ensure good lighting for clear photos</li>
          <li>Capture all relevant angles</li>
          <li>Include close-ups of any damage or issues</li>
          <li>Photos should be clear and focused</li>
        </ul>
      </div>
    </div>
  );
}

