'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Plus, Package, Search, ChevronRight, Loader2, ListChecks, FolderPlus, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import AdminPageRefresh from '@/components/admin/AdminPageRefresh';
import PackageChecklistModal from '@/components/admin/PackageChecklistModal';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function PackageListPage() {
  const router = useRouter();
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checklistTarget, setChecklistTarget] = useState<{ id: string; name: string } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categories, setCategories] = useState<{ uuid: string; name: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categorySubmitting, setCategorySubmitting] = useState(false);
  const [newCategory, setNewCategory] = useState({ category: '', description: '' });
  const [categoryMenuOpen, setCategoryMenuOpen] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<{ uuid: string; category: string; description: string } | null>(null);
  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const categoryMenuRef = useRef<HTMLDivElement>(null);

  // Using service_types as packages
  const [newPackage, setNewPackage] = useState({
    name: '',
    description: '',
    hsn_sac_code: '',
    default_tax_rate: '18.00',
    is_active: true,
    category_uuid: ''
  });

  useEffect(() => {
    fetchPackages();
    fetchCategories();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryMenuOpen && categoryMenuRef.current && !categoryMenuRef.current.contains(e.target as Node)) {
        setCategoryMenuOpen(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [categoryMenuOpen]);

  const fetchCategories = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('categories')
        .select('uuid, category')
        .order('category');
      setCategories((data || []).map((c: any) => ({ uuid: c.uuid, name: c.category })));
    } catch {
      // ignore
    }
  };

  const fetchPackages = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/inventory/packages');
      const responseText = await res.text();
      
      if (!res.ok) {
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch {
          errorData = { error: responseText || 'Unknown error' };
        }
        setError(errorData.error || `HTTP ${res.status}: Failed to fetch packages`);
        setPackages([]);
        return;
      }
      
      const data = JSON.parse(responseText);
      setPackages(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Error fetching packages:', error);
      setError(error.message || 'Failed to load packages');
      setPackages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    
    try {
      const payload = {
        ...newPackage,
        default_tax_rate: parseFloat(newPackage.default_tax_rate),
        category_uuid: newPackage.category_uuid || null
      };
      
      const res = await fetch('/api/admin/inventory/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const responseText = await res.text();

      if (!res.ok) {
        let err;
        try {
          err = JSON.parse(responseText);
        } catch {
          err = { error: responseText || 'Failed to create package' };
        }
        throw new Error(err.error || 'Failed to create package');
      }

      const createdPkg = JSON.parse(responseText);
      setShowAddModal(false);
      setNewPackage({
        name: '', description: '', hsn_sac_code: '',
        default_tax_rate: '18.00', is_active: true, category_uuid: ''
      });
      
      // Refresh the list
      fetchPackages();
      
      // Navigate to detail page to add items
      router.push(`/dashboard/super_admin/inventory/packages/${createdPkg.id}`);
    } catch (error: any) {
      console.error('Error creating package:', error);
      setError(error.message || 'Failed to create package');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCategorySubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/inventory/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCategory)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create category');
      }
      setShowCategoryModal(false);
      setNewCategory({ category: '', description: '' });
      fetchCategories();
    } catch (error: any) {
      setError(error.message || 'Failed to create category');
    } finally {
      setCategorySubmitting(false);
    }
  };

  const handleEditCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    setCategorySubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/inventory/categories/${editingCategory.uuid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: editingCategory.category, description: editingCategory.description })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update category');
      setShowEditCategoryModal(false);
      setEditingCategory(null);
      fetchCategories();
    } catch (error: any) {
      setError(error.message || 'Failed to update category');
    } finally {
      setCategorySubmitting(false);
    }
  };

  const handleDeleteCategory = async (uuid: string) => {
    setCategorySubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/inventory/categories/${uuid}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete category');
      setShowDeleteConfirm(null);
      if (selectedCategory === uuid) setSelectedCategory(null);
      fetchCategories();
      fetchPackages();
    } catch (error: any) {
      setError(error.message || 'Failed to delete category');
    } finally {
      setCategorySubmitting(false);
    }
  };

  const filteredPackages = packages.filter(p => {
    const matchesSearch = !searchTerm ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.hsn_sac_code?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory ||
      (selectedCategory === '__uncategorized__' ? !p.category_uuid : p.category_uuid === selectedCategory);
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Service Packages</h1>
          <p className="text-gray-500">Manage services and their included products (parts/consumables)</p>
        </div>
        <div className="flex items-center gap-3">
          <AdminPageRefresh onClick={() => void fetchPackages()} loading={loading} />
          <button
            onClick={() => setShowCategoryModal(true)}
            className="flex items-center gap-2 px-4 py-2 border border-brand-primary text-brand-primary rounded-lg hover:bg-brand-primary/5 font-medium transition-colors"
          >
            <FolderPlus className="w-4 h-4" />
            Create New Service Category
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create New Service
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-red-800 font-medium">Error: {error}</p>
          <button 
            onClick={fetchPackages}
            className="mt-2 text-sm text-red-600 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search services..." 
            className="w-full pl-10 p-2 border rounded-lg bg-gray-50 focus:bg-white transition-colors"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 relative">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors ${
                !selectedCategory
                  ? 'bg-brand-primary text-white border-brand-primary'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              All ({packages.length})
            </button>
            {categories.map((cat) => {
              const count = packages.filter(p => p.category_uuid === cat.uuid).length;
              return (
                <div key={cat.uuid} className="relative flex items-center">
                  <button
                    onClick={() => setSelectedCategory(selectedCategory === cat.uuid ? null : cat.uuid)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors pr-7 ${
                      selectedCategory === cat.uuid
                        ? 'bg-brand-primary text-white border-brand-primary'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {cat.name} ({count})
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCategoryMenuOpen(categoryMenuOpen === cat.uuid ? null : cat.uuid);
                    }}
                    className={`absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-black/10 ${
                      selectedCategory === cat.uuid ? 'text-white/80 hover:text-white' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    <MoreVertical className="w-3 h-3" />
                  </button>
                  {categoryMenuOpen === cat.uuid && (
                    <div
                      ref={categoryMenuRef}
                      className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1 min-w-[130px]"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCategory({ uuid: cat.uuid, category: cat.name, description: '' });
                          setShowEditCategoryModal(true);
                          setCategoryMenuOpen(null);
                        }}
                        className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-50 text-gray-700"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteConfirm(cat.uuid);
                          setCategoryMenuOpen(null);
                        }}
                        className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-red-50 text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {packages.some(p => !p.category_uuid) && (
              <button
                onClick={() => setSelectedCategory(selectedCategory === '__uncategorized__' ? null : '__uncategorized__')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors ${
                  selectedCategory === '__uncategorized__'
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                Uncategorized ({packages.filter(p => !p.category_uuid).length})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      ) : filteredPackages.length === 0 && !error ? (
        <div className="text-center p-12 bg-white rounded-xl border border-dashed border-gray-300">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No Services Found</h3>
          <p className="text-gray-500 mb-4">Create your first service to get started.</p>
          <button 
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary btn-sm"
          >
            Create Service
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPackages.map((pkg) => (
            <div 
              key={pkg.id} 
              onClick={() => router.push(`/dashboard/super_admin/inventory/packages/${pkg.id}`)}
              className="group bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer overflow-hidden"
            >
              <div className="p-5">
                <div className="flex justify-between items-start mb-2">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <Package className="w-6 h-6" />
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${pkg.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {pkg.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                
                <h3 className="text-lg font-bold text-gray-900 group-hover:text-brand-primary transition-colors mb-1">
                  {pkg.name}
                </h3>
                <p className="text-sm text-gray-500 line-clamp-2 mb-4 h-10">
                  {pkg.description || 'No description provided.'}
                </p>

                <div className="flex justify-between items-end border-t border-gray-50 pt-4 gap-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">HSN Code</p>
                    <p className="text-sm font-medium text-gray-900">{pkg.hsn_sac_code || '-'}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setChecklistTarget({ id: String(pkg.id), name: String(pkg.name || '') });
                      }}
                      className="flex items-center text-blue-600 text-sm font-medium hover:text-blue-700"
                    >
                      <ListChecks className="w-4 h-4 mr-1" />
                      Checklist
                    </button>
                    <div className="flex items-center text-brand-primary text-sm font-medium">
                      Manage Items <ChevronRight className="w-4 h-4 ml-1" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 m-4 shadow-xl">
            <h2 className="text-xl font-bold mb-6">Create New Service Category</h2>
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category Name *</label>
                <input 
                  type="text" 
                  required 
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-brand-primary/20 outline-none" 
                  value={newCategory.category} 
                  onChange={e => setNewCategory({...newCategory, category: e.target.value})} 
                  placeholder="e.g. Car Periodic Service"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea 
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-brand-primary/20 outline-none" 
                  rows={3}
                  value={newCategory.description} 
                  onChange={e => setNewCategory({...newCategory, description: e.target.value})}
                  placeholder="Brief description of this category"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowCategoryModal(false)} 
                  className="flex-1 py-2 border rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={categorySubmitting} 
                  className="flex-1 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 font-medium disabled:opacity-50"
                >
                  {categorySubmitting ? 'Creating...' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      {showEditCategoryModal && editingCategory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 m-4 shadow-xl">
            <h2 className="text-xl font-bold mb-6">Edit Service Category</h2>
            <form onSubmit={handleEditCategory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category Name *</label>
                <input 
                  type="text" 
                  required 
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-brand-primary/20 outline-none" 
                  value={editingCategory.category} 
                  onChange={e => setEditingCategory({...editingCategory, category: e.target.value})} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea 
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-brand-primary/20 outline-none" 
                  rows={3}
                  value={editingCategory.description} 
                  onChange={e => setEditingCategory({...editingCategory, description: e.target.value})}
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => { setShowEditCategoryModal(false); setEditingCategory(null); }} 
                  className="flex-1 py-2 border rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={categorySubmitting} 
                  className="flex-1 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 font-medium disabled:opacity-50"
                >
                  {categorySubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Category Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 m-4 shadow-xl">
            <h2 className="text-lg font-bold mb-2 text-gray-900">Delete Category?</h2>
            <p className="text-sm text-gray-500 mb-6">
              This will remove the category. Services under this category will become uncategorized.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteConfirm(null)} 
                className="flex-1 py-2 border rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleDeleteCategory(showDeleteConfirm)}
                disabled={categorySubmitting}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50"
              >
                {categorySubmitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 m-4 shadow-xl">
            <h2 className="text-xl font-bold mb-6">Create New Service</h2>
            <form onSubmit={handleCreatePackage} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Name *</label>
                <input 
                  type="text" 
                  required 
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-brand-primary/20 outline-none" 
                  value={newPackage.name} 
                  onChange={e => setNewPackage({...newPackage, name: e.target.value})} 
                  placeholder="e.g. Gold Service"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parent Category *</label>
                <select
                  required
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-brand-primary/20 outline-none"
                  value={newPackage.category_uuid}
                  onChange={e => setNewPackage({...newPackage, category_uuid: e.target.value})}
                >
                  <option value="">Select a category</option>
                  {categories.map(cat => (
                    <option key={cat.uuid} value={cat.uuid}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea 
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-brand-primary/20 outline-none" 
                  rows={3}
                  value={newPackage.description} 
                  onChange={e => setNewPackage({...newPackage, description: e.target.value})}
                  placeholder="What does this service include?"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">HSN/SAC Code</label>
                  <input 
                    type="text" 
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-brand-primary/20 outline-none" 
                    value={newPackage.hsn_sac_code} 
                    onChange={e => setNewPackage({...newPackage, hsn_sac_code: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
                  <select 
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-brand-primary/20 outline-none"
                    value={newPackage.default_tax_rate}
                    onChange={e => setNewPackage({...newPackage, default_tax_rate: e.target.value})}
                  >
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)} 
                  className="flex-1 py-2 border rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting} 
                  className="flex-1 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 font-medium disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create & Add Items'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {checklistTarget ? (
        <PackageChecklistModal
          packageId={checklistTarget.id}
          packageNameHint={checklistTarget.name}
          onClose={() => setChecklistTarget(null)}
        />
      ) : null}
    </div>
  );
}
