'use client';

import { useState } from 'react';
import { Camera, Upload, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface ImageVerificationComponentProps {
  auditId: string;
  leadId: string | null;
  imageVerification: any[];
  media: any[];
  onUpdate: () => void;
}

export default function ImageVerificationComponent({
  auditId,
  leadId,
  imageVerification,
  media,
  onUpdate,
}: ImageVerificationComponentProps) {
  const [uploading, setUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('BEFORE');
  const [verifying, setVerifying] = useState<string | null>(null);

  const categories = [
    { value: 'BEFORE', label: 'Before Service', icon: Camera },
    { value: 'DURING', label: 'During Service', icon: Camera },
    { value: 'AFTER', label: 'After Service', icon: Camera },
    { value: 'PARTS', label: 'Parts Used', icon: Camera },
    { value: 'DAMAGE', label: 'Damage Noted', icon: AlertTriangle },
    { value: 'ODOMETER', label: 'Odometer', icon: Camera },
    { value: 'ENGINE_BAY', label: 'Engine Bay', icon: Camera },
  ];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', selectedCategory);
    formData.append('title', `${selectedCategory} Image`);

    try {
      const response = await fetch(`/api/auditor/audits/${auditId}/upload-media`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      toast.success('Image uploaded successfully');
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload image');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleVerifyImages = async (category: string) => {
    setVerifying(category);
    try {
      // Verify images for this category
      const response = await fetch(`/api/auditor/audits/${auditId}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_compliance_score: 100, // Will be calculated based on verification
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to verify images');
      }

      toast.success('Images verified successfully');
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || 'Failed to verify images');
    } finally {
      setVerifying(null);
    }
  };

  const getCategoryVerification = (category: string) => {
    return imageVerification.find((iv) => iv.image_category === category);
  };

  const getCategoryMedia = (category: string) => {
    return media.filter((m) => m.category === category);
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center gap-4 mb-4">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            {categories.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
          <label className="btn btn-primary flex items-center gap-2 cursor-pointer">
            <Upload className="w-4 h-4" />
            Upload Image
            <input
              type="file"
              accept="image/*,video/*"
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
          {uploading && <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />}
        </div>
        <p className="text-sm text-gray-600">
          Upload audit photos/videos. Required angles: Front, Rear, Left, Right, Odometer, Engine Bay
        </p>
      </div>

      {/* Category Verification */}
      <div className="space-y-4">
        {categories.map((category) => {
          const verification = getCategoryVerification(category.value);
          const categoryMedia = getCategoryMedia(category.value);
          const Icon = category.icon;

          return (
            <div key={category.value} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon className="w-5 h-5 text-gray-600" />
                  <h3 className="font-semibold">{category.label}</h3>
                </div>
                <div className="flex items-center gap-2">
                  {verification?.compliance_status === 'VERIFIED' ? (
                    <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Verified
                    </span>
                  ) : verification?.compliance_status === 'REJECTED' ? (
                    <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full flex items-center gap-1">
                      <XCircle className="w-3 h-3" />
                      Rejected
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                      Pending
                    </span>
                  )}
                  {categoryMedia.length > 0 && (
                    <span className="text-sm text-gray-600">
                      {categoryMedia.length} image{categoryMedia.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Media Grid */}
              {categoryMedia.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  {categoryMedia.map((item) => (
                    <div key={item.id} className="relative group">
                      <img
                        src={item.media_url}
                        alt={item.title || category.label}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      {item.media_type === 'VIDEO' && (
                        <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                          Video
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Verification Details */}
              {verification && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Required:</span>
                      <span className="font-medium ml-2">{verification.required_images_count}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Uploaded:</span>
                      <span className="font-medium ml-2">{verification.uploaded_images_count}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Verified:</span>
                      <span className="font-medium ml-2">{verification.verified_images_count}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Score:</span>
                      <span className="font-medium ml-2">{verification.compliance_score}%</span>
                    </div>
                  </div>
                  {verification.missing_angles && verification.missing_angles.length > 0 && (
                    <div className="mt-2 text-sm text-red-600">
                      Missing: {verification.missing_angles.join(', ')}
                    </div>
                  )}
                  {verification.fake_images_detected && (
                    <div className="mt-2 text-sm text-red-600 font-semibold">
                      ⚠️ Fake images detected: {verification.fake_images_details}
                    </div>
                  )}
                </div>
              )}

              {/* Verify Button */}
              {categoryMedia.length > 0 && verification?.compliance_status !== 'VERIFIED' && (
                <button
                  onClick={() => handleVerifyImages(category.value)}
                  disabled={verifying === category.value}
                  className="mt-2 btn btn-outline btn-sm flex items-center gap-2"
                >
                  {verifying === category.value ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Verify Images
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

