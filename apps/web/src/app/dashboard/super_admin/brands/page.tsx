'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, Loader2, Upload, X, Check, Car } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface CarBrand {
  id: string;
  name: string;
  logo_url: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function CarBrandsPage() {
  const supabase = createClientComponentClient();
  const [brands, setBrands] = useState<CarBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState<CarBrand | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    logo_url: '',
    display_order: 0,
    is_active: true,
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');

  useEffect(() => {
    fetchBrands();
  }, []);

  async function fetchBrands() {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/super_admin/car-brands');
      if (!response.ok) throw new Error('Failed to fetch brands');

      const result = await response.json();
      setBrands(result.data || []);
    } catch (error) {
      console.error('Error fetching brands:', error);
      alert('Failed to load brands');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogoUpload(file: File, brandName: string) {
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('brand_name', brandName);

      const response = await fetch('/api/super_admin/car-brands/upload-logo', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload logo');
      }

      const result = await response.json();
      return result.logo_url;
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      throw error;
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('Brand name is required');
      return;
    }

    try {
      let logoUrl = formData.logo_url;

      // Upload logo if file is selected
      if (logoFile) {
        logoUrl = await handleLogoUpload(logoFile, formData.name);
      }

      if (!logoUrl) {
        alert('Please upload a logo or provide a logo URL');
        return;
      }

      const brandData = {
        ...formData,
        logo_url: logoUrl,
      };

      const url = editingBrand 
        ? `/api/super_admin/car-brands/${editingBrand.id}`
        : '/api/super_admin/car-brands';
      
      const method = editingBrand ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brandData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save brand');
      }

      await fetchBrands();
      handleCloseModal();
      alert(editingBrand ? 'Brand updated successfully' : 'Brand added successfully');
    } catch (error: any) {
      console.error('Error saving brand:', error);
      alert(error.message || 'Failed to save brand');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this brand?')) return;

    try {
      const response = await fetch(`/api/super_admin/car-brands/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete brand');

      await fetchBrands();
      alert('Brand deleted successfully');
    } catch (error) {
      console.error('Error deleting brand:', error);
      alert('Failed to delete brand');
    }
  }

  function handleEdit(brand: CarBrand) {
    setEditingBrand(brand);
    setFormData({
      name: brand.name,
      logo_url: brand.logo_url,
      display_order: brand.display_order,
      is_active: brand.is_active,
    });
    setLogoPreview(brand.logo_url);
    setLogoFile(null);
    setShowModal(true);
  }

  function handleAddNew() {
    setEditingBrand(null);
    setFormData({
      name: '',
      logo_url: '',
      display_order: brands.length + 1,
      is_active: true,
    });
    setLogoPreview('');
    setLogoFile(null);
    setShowModal(true);
  }

  function handleCloseModal() {
    setShowModal(false);
    setEditingBrand(null);
    setFormData({
      name: '',
      logo_url: '',
      display_order: 0,
      is_active: true,
    });
    setLogoPreview('');
    setLogoFile(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  const filteredBrands = brands.filter(brand =>
    brand.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Car Brands Management</h1>
          <p className="text-gray-500">Manage car brand logos and information</p>
        </div>
        <button
          onClick={handleAddNew}
          className="flex items-center gap-2 bg-brand-primary hover:bg-brand-primary-hover text-white px-4 py-2 rounded-lg font-semibold transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Brand
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search brands..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
          />
        </div>
      </div>

      {/* Brands Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      ) : filteredBrands.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Car className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500 text-lg">No brands found</p>
          <button
            onClick={handleAddNew}
            className="mt-4 text-brand-primary hover:underline"
          >
            Add your first brand
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredBrands.map((brand) => (
            <div
              key={brand.id}
              className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex flex-col items-center space-y-4">
                {/* Logo */}
                <div className="w-32 h-32 bg-gray-50 rounded-lg flex items-center justify-center border-2 border-gray-200">
                  {brand.logo_url ? (
                    <img
                      src={brand.logo_url}
                      alt={brand.name}
                      className="w-full h-full object-contain p-2"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent && !parent.querySelector('.brand-fallback')) {
                          const fallback = document.createElement('div');
                          fallback.className = 'brand-fallback text-xs font-bold text-gray-400 text-center px-2';
                          fallback.textContent = brand.name;
                          parent.appendChild(fallback);
                        }
                      }}
                    />
                  ) : (
                    <Car className="w-12 h-12 text-gray-400" />
                  )}
                </div>

                {/* Brand Name */}
                <div className="text-center">
                  <h3 className="font-bold text-gray-900">{brand.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Order: {brand.display_order} • {brand.is_active ? 'Active' : 'Inactive'}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 w-full">
                  <button
                    onClick={() => handleEdit(brand)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors text-sm font-medium"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(brand.id)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors text-sm font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {editingBrand ? 'Edit Brand' : 'Add New Brand'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Brand Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Brand Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Maruti Suzuki"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  required
                />
              </div>

              {/* Logo Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Brand Logo <span className="text-red-500">*</span>
                </label>
                <div className="space-y-4">
                  {/* File Upload */}
                  <div>
                    <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-brand-primary transition-colors">
                      <Upload className="w-5 h-5 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {logoFile ? logoFile.name : 'Click to upload logo'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                    <p className="text-xs text-gray-500 mt-2">
                      Supported formats: JPEG, PNG, WEBP, SVG (Max 5MB)
                    </p>
                  </div>

                  {/* Logo Preview */}
                  {(logoPreview || formData.logo_url) && (
                    <div className="w-32 h-32 bg-gray-50 rounded-lg flex items-center justify-center border-2 border-gray-200 mx-auto">
                      <img
                        src={logoPreview || formData.logo_url}
                        alt="Logo preview"
                        className="w-full h-full object-contain p-2"
                      />
                    </div>
                  )}

                  {/* Or URL Input */}
                  <div className="text-center text-sm text-gray-500">OR</div>
                  <input
                    type="url"
                    value={formData.logo_url}
                    onChange={(e) => {
                      setFormData({ ...formData, logo_url: e.target.value });
                      if (e.target.value) setLogoPreview(e.target.value);
                    }}
                    placeholder="Enter logo URL"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                </div>
              </div>

              {/* Display Order */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Display Order
                </label>
                <input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  min="0"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Lower numbers appear first in the list
                </p>
              </div>

              {/* Active Status */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-5 h-5 text-brand-primary rounded focus:ring-brand-primary"
                />
                <label htmlFor="is_active" className="text-sm font-semibold text-gray-700">
                  Active (Show on home page)
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      {editingBrand ? 'Update Brand' : 'Add Brand'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

