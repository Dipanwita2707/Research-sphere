'use client';

import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, X, Save, Layers } from 'lucide-react';
import {
  useAllCategories,
  useCreateMasterCategory,
  useUpdateMasterCategory,
  useDeleteMasterCategory,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useCreateSubCategory,
  useUpdateSubCategory,
  useDeleteSubCategory,
  useRoleHandlers,
  useUpsertRoleHandler,
  useDeleteRoleHandler,
} from '@/features/ticket-management/hooks/useTickets';
import type {
  TmsMasterCategory, TmsCategory, TmsSubCategory, TmsPriority, CategoryEmployee,
  TmsRoleHandler, TmsRoleHandlerLevel,
} from '@/features/ticket-management/types/tms.types';

type Tab = 'master' | 'category' | 'sub' | 'roles';
type FormMode =
  | 'create-master' | 'edit-master'
  | 'create-category' | 'edit-category'
  | 'create-sub' | 'edit-sub'
  | null;

const PRIORITY_BADGE: Record<string, string> = {
  low: 'bg-green-50 text-green-700 border-green-200',
  medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  high: 'bg-red-50 text-red-700 border-red-200',
  urgent: 'bg-purple-50 text-purple-700 border-purple-200',
};

function slaLabel(hours: number): string {
  if (hours < 24) return `${hours} hours`;
  const days = Math.round(hours / 24);
  return days ===
   1 ? '1 day' : `${days} days`;
}

export default function CategoriesAdminPage() {
  const { data: masterCategories, isLoading } = useAllCategories();

  const [tab, setTab] = useState<Tab>('master');

  // ---- Form state ----
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIsAcademic, setFormIsAcademic] = useState(false);
  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formParentId, setFormParentId] = useState('');
  const [formEditId, setFormEditId] = useState('');
  const [formPriority, setFormPriority] = useState<TmsPriority>('medium');
  const [formSlaHours, setFormSlaHours] = useState<number>(48);
  const [error, setError] = useState('');

  // ---- Mutations ----
  const createMaster = useCreateMasterCategory();
  const updateMaster = useUpdateMasterCategory();
  const deleteMaster = useDeleteMasterCategory();
  const createCat = useCreateCategory();
  const updateCat = useUpdateCategory();
  const deleteCat = useDeleteCategory();
  const createSub = useCreateSubCategory();
  const updateSub = useUpdateSubCategory();
  const deleteSub = useDeleteSubCategory();

  // ---- Role Handlers ----
  const { data: roleHandlers } = useRoleHandlers();
  const upsertHandler = useUpsertRoleHandler();
  const removeHandler = useDeleteRoleHandler();
  const [roleInputs, setRoleInputs] = useState<Record<string, string>>({});
  const [roleError, setRoleError] = useState('');
  const [roleSaving, setRoleSaving] = useState<string | null>(null);

  // ---- Flatten data for table views ----
  const flatCategories = useMemo(() => {
    if (!masterCategories) return [];
    const result: (TmsCategory & { masterCategoryName: string })[] = [];
    masterCategories.forEach((mc) => {
      mc.categories?.forEach((cat) => {
        result.push({ ...cat, masterCategoryName: mc.name });
      });
    });
    return result;
  }, [masterCategories]);

  const flatSubCategories = useMemo(() => {
    if (!masterCategories) return [];
    const result: (TmsSubCategory & { categoryName: string; masterCategoryName: string })[] = [];
    masterCategories.forEach((mc) => {
      mc.categories?.forEach((cat) => {
        cat.subCategories?.forEach((sc) => {
          result.push({ ...sc, categoryName: cat.name, masterCategoryName: mc.name });
        });
      });
    });
    return result;
  }, [masterCategories]);

  // ---- Form handlers ----
  const openCreate = (mode: FormMode, parentId = '') => {
    setFormMode(mode);
    setFormParentId(parentId);
    setFormName('');
    setFormDescription('');
    setFormIsAcademic(false);
    setFormEmployeeId('');
    setFormEditId('');
    setFormPriority('medium');
    setFormSlaHours(48);
    setError('');
  };

  const openEdit = (mode: FormMode, item: {
    id: string; name: string; description?: string; isAcademic?: boolean;
    employeeId?: string | null; employee?: CategoryEmployee | null;
    priority?: string; slaHours?: number;
  }) => {
    setFormMode(mode);
    setFormEditId(item.id);
    setFormName(item.name);
    setFormDescription(item.description || '');
    setFormIsAcademic(item.isAcademic || false);
    // Show the human-readable UID (e.g. TEACH019) instead of the raw database UUID
    setFormEmployeeId(item.employee?.uid || '');
    setFormPriority((item.priority as TmsPriority) || 'medium');
    setFormSlaHours(item.slaHours ?? 48);
    setError('');
  };

  const handleSubmit = async () => {
    if (!formName.trim()) { setError('Name is required'); return; }
    setError('');
    try {
      switch (formMode) {
        case 'create-master':
          await createMaster.mutateAsync({
            name: formName, description: formDescription, isAcademic: formIsAcademic,
            ...(formEmployeeId && { employeeId: formEmployeeId }),
          });
          break;
        case 'edit-master':
          await updateMaster.mutateAsync({
            id: formEditId,
            payload: { name: formName, description: formDescription, isAcademic: formIsAcademic, employeeId: formEmployeeId || undefined },
          });
          break;
        case 'create-category':
          await createCat.mutateAsync({
            name: formName, description: formDescription, masterCategoryId: formParentId,
            ...(formEmployeeId && { employeeId: formEmployeeId }),
          });
          break;
        case 'edit-category':
          await updateCat.mutateAsync({
            id: formEditId,
            payload: { name: formName, description: formDescription, employeeId: formEmployeeId || undefined },
          });
          break;
        case 'create-sub':
          await createSub.mutateAsync({
            name: formName, description: formDescription, categoryId: formParentId,
            ...(formEmployeeId && { employeeId: formEmployeeId }),
            priority: formPriority, slaHours: formSlaHours,
          });
          break;
        case 'edit-sub':
          await updateSub.mutateAsync({
            id: formEditId,
            payload: { name: formName, description: formDescription, employeeId: formEmployeeId || undefined, priority: formPriority, slaHours: formSlaHours },
          });
          break;
      }
      setFormMode(null);
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } } };
      setError(apiError?.response?.data?.message || 'Operation failed');
    }
  };

  const handleDelete = async (type: 'master' | 'category' | 'sub', id: string) => {
    if (!confirm('Are you sure you want to delete this? This cannot be undone.')) return;
    try {
      if (type ===
   'master') await deleteMaster.mutateAsync(id);
      else if (type ===
   'category') await deleteCat.mutateAsync(id);
      else await deleteSub.mutateAsync(id);
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } } };
      alert(apiError?.response?.data?.message || 'Delete failed');
    }
  };

  // ---- Dropdown options for category ----
  const masterOptions = masterCategories?.map((mc) => ({ value: mc.id, label: mc.name })) || [];
  const categoryOptions = flatCategories.map((c) => ({ value: c.id, label: `${c.name} (${c.masterCategoryName})` }));

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="animate-spin rounded-full h-9 w-9 border-[3px] border-[#b3cde0] border-t-[#005b96]" />
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'master', label: 'Master Categories' },
    { key: 'category', label: 'Categories' },
    { key: 'sub', label: 'Subcategories' },
    { key: 'roles', label: 'Role Handlers' },
  ];

  // Figure out the modal title
  const modalTitle = formMode
    ? `${formMode.startsWith('create') ? 'Add' : 'Edit'} ${formMode.includes('master') ? 'Master Category' : formMode.includes('sub') ? 'Subcategory' : 'Category'}`
    : '';

  return (
    <div className="min-h-screen bg-[#f8fafc] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-[#011f4b] to-[#005b96] rounded-2xl shadow-lg shadow-[#005b96]/20">
            <Layers className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#011f4b] tracking-tight">Category Management</h1>
            <p className="text-sm text-[#6497b1] mt-0.5">Manage master categories, categories, and subcategories</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="inline-flex bg-white rounded-xl border border-[#b3cde0]/40 overflow-hidden mb-8" style={{ boxShadow: '0 2px 8px 0 rgba(0, 91, 150, 0.06)' }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-2.5 text-sm font-semibold transition-all ${
                tab ===
   t.key
                  ? 'bg-gradient-to-r from-[#011f4b] to-[#03396c] text-white shadow-md'
                  : 'text-[#6497b1] hover:text-[#005b96] hover:bg-[#005b96]/[0.04]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Card container */}
        <div className="bg-white rounded-2xl border border-[#b3cde0]/40 p-7" style={{ boxShadow: '0 2px 16px 0 rgba(0, 91, 150, 0.07)' }}>
          {/* Card header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-5 rounded-full bg-[#005b96]" />
              <h2 className="text-lg font-bold text-[#011f4b]">
                {tab ===
   'master' ? 'Master Categories' : tab ===
   'category' ? 'Categories' : tab ===
   'sub' ? 'Subcategories' : 'Role Handlers'}
              </h2>
            </div>
            {tab !== 'roles' && (
              <button
                onClick={() => {
                  if (tab ===
   'master') openCreate('create-master');
                  else if (tab ===
   'category') openCreate('create-category');
                  else openCreate('create-sub');
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#005b96] hover:bg-[#03396c] text-white rounded-xl text-sm font-semibold shadow-md shadow-[#005b96]/20 hover:shadow-lg transition-all"
              >
                <Plus className="w-4 h-4" />
                Add {tab ===
   'master' ? 'Master Category' : tab ===
   'category' ? 'Category' : 'Subcategory'}
              </button>
            )}
          </div>

          {/* ==========
   MASTER CATEGORIES TABLE ==========
   */}
          {tab ===
   'master' && (
            <div className="overflow-hidden rounded-xl border border-[#b3cde0]/30">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'linear-gradient(135deg, #011f4b 0%, #03396c 100%)' }}>
                  <th className="py-3.5 px-5 text-left text-[11px] font-semibold text-white/90 uppercase tracking-wider">ID</th>
                  <th className="py-3.5 px-5 text-left text-[11px] font-semibold text-white/90 uppercase tracking-wider">Category Name</th>
                  <th className="py-3.5 px-5 text-center text-[11px] font-semibold text-white/90 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {masterCategories?.map((mc, idx) => (
                  <tr key={mc.id} className={`border-b border-[#b3cde0]/15 hover:bg-[#005b96]/[0.03] transition-colors ${idx % 2 ===
   0 ? 'bg-white' : 'bg-[#f8fafc]'}`}>
                    <td className="py-3.5 px-5 text-[#005b96] font-semibold">{idx + 1}</td>
                    <td className="py-3.5 px-5 text-[#011f4b] font-medium">{mc.name}</td>
                    <td className="py-3.5 px-5">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openEdit('edit-master', mc)} className="p-1.5 rounded-lg text-[#005b96] hover:bg-[#005b96]/10 transition-colors" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete('master', mc.id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(!masterCategories || masterCategories.length ===
   0) && (
                  <tr><td colSpan={3} className="py-12 text-center text-[#6497b1]">No master categories</td></tr>
                )}
              </tbody>
            </table>
            </div>
          )}

          {/* ==========
   CATEGORIES TABLE ==========
   */}
          {tab ===
   'category' && (
            <div className="overflow-hidden rounded-xl border border-[#b3cde0]/30">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'linear-gradient(135deg, #011f4b 0%, #03396c 100%)' }}>
                  <th className="py-3.5 px-5 text-left text-[11px] font-semibold text-white/90 uppercase tracking-wider">ID</th>
                  <th className="py-3.5 px-5 text-left text-[11px] font-semibold text-white/90 uppercase tracking-wider">Category Name</th>
                  <th className="py-3.5 px-5 text-left text-[11px] font-semibold text-white/90 uppercase tracking-wider">Master Category</th>
                  <th className="py-3.5 px-5 text-center text-[11px] font-semibold text-white/90 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {flatCategories.map((cat, idx) => (
                  <tr key={cat.id} className={`border-b border-[#b3cde0]/15 hover:bg-[#005b96]/[0.03] transition-colors ${idx % 2 ===
   0 ? 'bg-white' : 'bg-[#f8fafc]'}`}>
                    <td className="py-3.5 px-5 text-[#005b96] font-semibold">{idx + 1}</td>
                    <td className="py-3.5 px-5 text-[#011f4b] font-medium">{cat.name}</td>
                    <td className="py-3.5 px-5">
                      <span className="inline-block px-2.5 py-1 rounded-lg bg-[#005b96]/[0.06] text-[#005b96] text-xs font-medium">{cat.masterCategoryName}</span>
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openEdit('edit-category', cat)} className="p-1.5 rounded-lg text-[#005b96] hover:bg-[#005b96]/10 transition-colors" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete('category', cat.id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {flatCategories.length ===
   0 && (
                  <tr><td colSpan={4} className="py-12 text-center text-[#6497b1]">No categories</td></tr>
                )}
              </tbody>
            </table>
            </div>
          )}

          {/* ==========
   SUBCATEGORIES TABLE ==========
   */}
          {tab ===
   'sub' && (
            <div className="overflow-x-auto rounded-xl border border-[#b3cde0]/30">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'linear-gradient(135deg, #011f4b 0%, #03396c 100%)' }}>
                    <th className="py-3.5 px-5 text-left text-[11px] font-semibold text-white/90 uppercase tracking-wider">ID</th>
                    <th className="py-3.5 px-5 text-left text-[11px] font-semibold text-white/90 uppercase tracking-wider">Subcategory Name</th>
                    <th className="py-3.5 px-5 text-left text-[11px] font-semibold text-white/90 uppercase tracking-wider">Category</th>
                    <th className="py-3.5 px-5 text-left text-[11px] font-semibold text-white/90 uppercase tracking-wider">Assigned Employee</th>
                    <th className="py-3.5 px-5 text-center text-[11px] font-semibold text-white/90 uppercase tracking-wider">Priority</th>
                    <th className="py-3.5 px-5 text-center text-[11px] font-semibold text-white/90 uppercase tracking-wider">SLA Time</th>
                    <th className="py-3.5 px-5 text-center text-[11px] font-semibold text-white/90 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {flatSubCategories.map((sc, idx) => (
                    <tr key={sc.id} className={`border-b border-[#b3cde0]/15 hover:bg-[#005b96]/[0.03] transition-colors ${idx % 2 ===
   0 ? 'bg-white' : 'bg-[#f8fafc]'}`}>
                      <td className="py-3.5 px-5 text-[#005b96] font-semibold">{idx + 1}</td>
                      <td className="py-3.5 px-5 text-[#011f4b] font-medium">{sc.name}</td>
                      <td className="py-3.5 px-5">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-[#005b96]/[0.06] text-[#005b96] text-xs font-medium">{sc.categoryName}</span>
                      </td>
                      <td className="py-3.5 px-5 text-[#011f4b]">
                        {sc.employee?.employeeDetails?.displayName || <span className="text-[#6497b1]">—</span>}
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${PRIORITY_BADGE[sc.priority || 'medium'] || PRIORITY_BADGE.medium}`}>
                          {sc.priority || 'Medium'}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-center text-[#011f4b] font-medium">
                        {slaLabel(sc.slaHours ?? 48)}
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => openEdit('edit-sub', sc)} className="p-1.5 rounded-lg text-[#005b96] hover:bg-[#005b96]/10 transition-colors" title="Edit">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete('sub', sc.id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {flatSubCategories.length ===
   0 && (
                    <tr><td colSpan={7} className="py-12 text-center text-[#6497b1]">No subcategories</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ==========
   ROLE HANDLERS TAB ==========
   */}
          {tab ===
   'roles' && (
            <div>
              <p className="text-sm text-[#6497b1] mb-5">
                Assign employees to handle tickets at the Registrar, Dean, and Vice Chancellor levels.
                These are used when tickets are escalated beyond the category hierarchy.
              </p>
              {roleError && (
                <div className="mb-4 px-4 py-3 bg-red-50/80 border border-red-200/50 rounded-xl text-sm text-red-700 flex items-center gap-2">
                  <span className="text-base">⚠</span> {roleError}
                </div>
              )}
              <div className="space-y-4">
                {([
                  { role: 'registrar' as TmsRoleHandlerLevel, label: 'Registrar', desc: 'Handles non-academic escalations from Master Category level' },
                  { role: 'dean_academics' as TmsRoleHandlerLevel, label: 'Dean (Academics)', desc: 'Handles academic escalations from Master Category level' },
                  { role: 'vice_chancellor' as TmsRoleHandlerLevel, label: 'Vice Chancellor', desc: 'Final escalation level for all tickets' },
                ]).map(({ role, label, desc }) => {
                  const current = (roleHandlers as TmsRoleHandler[] | undefined)?.find((h) => h.role ===
   role);
                  const inputVal = roleInputs[role] ?? (current?.employee?.uid || '');
                  return (
                    <div key={role} className="bg-[#f8fafc] rounded-xl border border-[#b3cde0]/30 p-5 hover:border-[#005b96]/20 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="text-sm font-bold text-[#011f4b]">{label}</h3>
                          <p className="text-xs text-[#6497b1] mt-0.5">{desc}</p>
                          {current?.employee && (
                            <p className="text-xs text-emerald-600 mt-1.5 font-medium">
                              ✓ Currently: {current.employee.employeeDetails?.designation ? `${current.employee.employeeDetails.designation} ` : ''}
                              {current.employee.employeeDetails?.displayName || current.employee.uid} ({current.employee.uid})
                            </p>
                          )}
                          {!current && (
                            <p className="text-xs text-amber-600 mt-1.5 font-medium">⚠ Not assigned — tickets at this level will show &quot;Assigned To: System&quot;</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <input
                          type="text"
                          value={inputVal}
                          onChange={(e) => setRoleInputs((prev) => ({ ...prev, [role]: e.target.value }))}
                          placeholder="Enter Employee UID (e.g. TEACH019)"
                          className="flex-1 px-3.5 py-2.5 border border-[#b3cde0]/50 rounded-xl text-sm bg-white text-[#011f4b] placeholder-[#6497b1]/50 focus:ring-2 focus:ring-[#005b96]/20 focus:border-[#005b96] outline-none transition-colors"
                        />
                        <button
                          onClick={async () => {
                            const uid = (roleInputs[role] ?? '').trim();
                            if (!uid) { setRoleError('Please enter an Employee UID'); return; }
                            setRoleError('');
                            setRoleSaving(role);
                            try {
                              await upsertHandler.mutateAsync({ role, employeeId: uid });
                              setRoleInputs((prev) => { const n = { ...prev }; delete n[role]; return n; });
                            } catch (err: unknown) {
                              const apiErr = err as { response?: { data?: { message?: string } } };
                              setRoleError(apiErr?.response?.data?.message || `Failed to save ${label} handler`);
                            } finally {
                              setRoleSaving(null);
                            }
                          }}
                          disabled={roleSaving ===
   role}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#005b96] hover:bg-[#03396c] text-white rounded-xl text-sm font-semibold disabled:opacity-50 shadow-sm transition-all"
                        >
                          <Save className="w-3.5 h-3.5" />
                          {roleSaving ===
   role ? 'Saving...' : 'Save'}
                        </button>
                        {current && (
                          <button
                            onClick={async () => {
                              if (!confirm(`Remove ${label} handler?`)) return;
                              setRoleError('');
                              try {
                                await removeHandler.mutateAsync(role);
                                setRoleInputs((prev) => ({ ...prev, [role]: '' }));
                              } catch {
                                setRoleError(`Failed to remove ${label} handler`);
                              }
                            }}
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                            title="Remove handler"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ==========
   MODAL ==========
   */}
        {formMode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#011f4b]/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-7 w-full max-w-md mx-4 relative border border-[#b3cde0]/30" style={{ boxShadow: '0 8px 32px 0 rgba(0, 91, 150, 0.15)' }}>
              <button onClick={() => setFormMode(null)} className="absolute top-4 right-4 p-1 rounded-lg text-[#6497b1] hover:text-[#005b96] hover:bg-[#005b96]/10 transition-colors">
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-lg font-bold text-[#011f4b] mb-5">{modalTitle}</h3>

              {error && (
                <div className="mb-4 p-3 bg-red-50/80 border border-red-200/50 rounded-xl text-sm text-red-700 flex items-center gap-2">
                  <span className="text-base">⚠</span> {error}
                </div>
              )}

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-semibold text-[#011f4b] mb-1.5">Name</label>
                  <input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-[#b3cde0]/50 rounded-xl text-sm bg-[#f8fafc] text-[#011f4b] placeholder-[#6497b1]/50 focus:ring-2 focus:ring-[#005b96]/20 focus:border-[#005b96] outline-none transition-colors"
                    placeholder="Enter name"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-[#011f4b] mb-1.5">Description</label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={2}
                    className="w-full px-3.5 py-2.5 border border-[#b3cde0]/50 rounded-xl text-sm bg-[#f8fafc] text-[#011f4b] placeholder-[#6497b1]/50 focus:ring-2 focus:ring-[#005b96]/20 focus:border-[#005b96] outline-none resize-none transition-colors"
                    placeholder="Optional description"
                  />
                </div>

                {/* isAcademic (master only) */}
                {formMode.includes('master') && (
                  <label className="flex items-center gap-2.5 text-sm font-medium text-[#011f4b]">
                    <input
                      type="checkbox"
                      checked={formIsAcademic}
                      onChange={(e) => setFormIsAcademic(e.target.checked)}
                      className="rounded border-[#b3cde0] text-[#005b96] focus:ring-[#005b96]/20"
                    />
                    Academic category
                  </label>
                )}

                {/* Parent selector for create-category */}
                {formMode ===
   'create-category' && (
                  <div>
                    <label className="block text-sm font-semibold text-[#011f4b] mb-1.5">Master Category</label>
                    <select
                      value={formParentId}
                      onChange={(e) => setFormParentId(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-[#b3cde0]/50 rounded-xl text-sm bg-[#f8fafc] text-[#011f4b] focus:ring-2 focus:ring-[#005b96]/20 focus:border-[#005b96] outline-none transition-colors"
                    >
                      <option value="">Select master category</option>
                      {masterOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                )}

                {/* Parent selector for create-sub */}
                {formMode ===
   'create-sub' && (
                  <div>
                    <label className="block text-sm font-semibold text-[#011f4b] mb-1.5">Category</label>
                    <select
                      value={formParentId}
                      onChange={(e) => setFormParentId(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-[#b3cde0]/50 rounded-xl text-sm bg-[#f8fafc] text-[#011f4b] focus:ring-2 focus:ring-[#005b96]/20 focus:border-[#005b96] outline-none transition-colors"
                    >
                      <option value="">Select category</option>
                      {categoryOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                )}

                {/* Employee ID */}
                <div>
                  <label className="block text-sm font-semibold text-[#011f4b] mb-1.5">Assign Employee (User ID)</label>
                  <input
                    value={formEmployeeId}
                    onChange={(e) => setFormEmployeeId(e.target.value)}
                    placeholder="Enter employee UUID (optional)"
                    className="w-full px-3.5 py-2.5 border border-[#b3cde0]/50 rounded-xl text-sm bg-[#f8fafc] text-[#011f4b] placeholder-[#6497b1]/50 focus:ring-2 focus:ring-[#005b96]/20 focus:border-[#005b96] outline-none transition-colors"
                  />
                </div>

                {/* Priority & SLA (sub-category only) */}
                {formMode.includes('sub') && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-[#011f4b] mb-1.5">Priority</label>
                      <select
                        value={formPriority}
                        onChange={(e) => setFormPriority(e.target.value as TmsPriority)}
                        className="w-full px-3.5 py-2.5 border border-[#b3cde0]/50 rounded-xl text-sm bg-[#f8fafc] text-[#011f4b] focus:ring-2 focus:ring-[#005b96]/20 focus:border-[#005b96] outline-none transition-colors"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#011f4b] mb-1.5">SLA Time (hours)</label>
                      <input
                        type="number"
                        min={1}
                        value={formSlaHours}
                        onChange={(e) => setFormSlaHours(parseInt(e.target.value, 10) || 48)}
                        className="w-full px-3.5 py-2.5 border border-[#b3cde0]/50 rounded-xl text-sm bg-[#f8fafc] text-[#011f4b] focus:ring-2 focus:ring-[#005b96]/20 focus:border-[#005b96] outline-none transition-colors"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-7">
                <button
                  onClick={() => setFormMode(null)}
                  className="px-5 py-2.5 text-sm font-medium text-[#6497b1] border border-[#b3cde0]/40 rounded-xl hover:bg-[#005b96]/[0.03] hover:text-[#005b96] transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  className="px-6 py-2.5 bg-[#005b96] hover:bg-[#03396c] text-white rounded-xl text-sm font-semibold shadow-md shadow-[#005b96]/20 transition-all"
                >
                  {formMode.startsWith('create') ? 'Create' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
