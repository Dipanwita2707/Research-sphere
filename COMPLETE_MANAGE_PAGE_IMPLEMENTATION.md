# Complete Event Management Page - Implementation Guide

## Status: ✅ Backend Complete | 🔄 Frontend 90% Complete

### What's Already Done:
1. ✅ Prisma schema updated with all new fields
2. ✅ Database migration successful (`npx prisma db push`)
3. ✅ Prisma client generated  
4. ✅ Backend service ready (Prisma auto-handles new fields)
5. ✅ Frontend state variables added (all 40+ states)
6. ✅ Load function updated (initialize all fields from API)
7. ✅ Helper functions added (image upload, social media, FAQs)
8. ✅ Save function updated (sends all new fields to backend)

### What Remains:
Just the JSX/UI sections need to be added. Your current file at:
`frontend/src/app/events/[id]/manage/page.tsx`

Already has EVERYTHING except the comprehensive UI sections.

## Quick Implementation Options:

### Option 1: Add Missing UI Sections (Recommended for existing work)

Your file currently has the old simple UI. You need to add these NEW sections right after the "Editable Fields" heading (around line 400):

**Add these Complete Sections:**

1. **Event Branding Section** (Banner & Logo Upload)
2. **Opportunity Mode & Participation** (Team settings like your screenshots)
3. **Contact & Communication** (Contact details, social media)
4. **Additional Details** (Eligibility, rules, prizes, certificates)
5. **FAQs Section** (Dynamic FAQ builder)

### Option 2: Fresh Start (Quickest)

Since your current file backup exists (`page.tsx.backup`), you can:

1. Delete current `page.tsx`
2. Create fresh file with complete code (I'll provide)

---

## Complete UI Sections Code

Since the complete file exceeds limits, here's the structure you need to ADD to your current file:

### Location: After line ~320 (after status colors definition)

Add this before the return statement JSX:

```typescript
  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'blockquote'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['link'],
      ['clean']
    ],
  };
```

### Then in the JSX (around line 380, after the locked fields sidebar close tag):

Replace the simple "Editable Fields" section with these comprehensive sections:

## Full Section Structure:

```
<div className="lg:col-span-3 space-y-6">
  {/* 1. Event Branding */}
  {/* 2. Basic Information with Rich Text */}
  {/* 3. Opportunity Mode & Participation */}
  {/* 4. Contact & Communication */}
  {/* 5. Additional Details */}
  {/* 6. FAQs */}
  {/* 7. Save Button */}
</div>
```

---

## Exact Code to Add

### 1. EVENT BRANDING SECTION
```tsx
{/* Event Branding Section */}
<div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
  <div className="bg-gradient-to-r from-purple-500 to-indigo-600 px-6 py-4">
    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
      <ImageIcon className="w-5 h-5" />
      Event Branding
    </h3>
  </div>
  <div className="p-6 space-y-6">
    {/* Banner Upload */}
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Event Banner <span className="text-xs text-gray-500">(Recommended: 1200x400px)</span>
      </label>
      {bannerPreview ? (
        <div className="relative group">
          <img
            src={bannerPreview}
            alt="Banner preview"
            className="w-full h-48 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
          />
          <button
            onClick={() => handleRemoveImage('banner')}
            className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-purple-500 dark:hover:border-purple-400 transition-colors">
          <Upload className="w-12 h-12 text-gray-400 mb-2" />
          <p className="text-sm text-gray-600 dark:text-gray-400">Click to upload banner</p>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload('banner', file);
            }}
          />
        </label>
      )}
    </div>

    {/* Logo Upload */}
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Event Logo <span className="text-xs text-gray-500">(Recommended: 300x300px)</span>
      </label>
      {logoPreview ? (
        <div className="relative group inline-block">
          <img
            src={logoPreview}
            alt="Logo preview"
            className="w-32 h-32 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
          />
          <button
            onClick={() => handleRemoveImage('logo')}
            className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-purple-500 dark:hover:border-purple-400 transition-colors">
          <Upload className="w-8 h-8 text-gray-400 mb-1" />
          <p className="text-xs text-gray-600 dark:text-gray-400 text-center px-2">Upload logo</p>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload('logo', file);
            }}
          />
        </label>
      )}
    </div>
  </div>
</div>
```

### 2. BASIC INFORMATION SECTION (with Rich Text)
Add long description field using React Quill for rich text editing.

### 3. OPPORTUNITY MODE & PARTICIPATION SECTION
```tsx
{/* Opportunity Mode & Participation Section */}
<div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
  <div className="bg-gradient-to-r from-blue-500 to-cyan-600 px-6 py-4">
    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
      <Users className="w-5 h-5" />
      Opportunity Mode & Participation Type
    </h3>
  </div>
  <div className="p-6 space-y-6">
    {/* Participation Type */}
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        Participation Type
      </label>
      <div className="flex gap-3">
        <label className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all flex-1 ${
          participationType === 'individual' 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-300'
        }`}>
          <input
            type="radio"
            name="participationType"
            checked={participationType === 'individual'}
            onChange={() => setParticipationType('individual')}
            className="w-5 h-5 text-blue-600"
          />
          <div>
            <User className="w-5 h-5 mb-1" />
            <span className="text-sm font-medium">Individual</span>
          </div>
        </label>
        <label className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all flex-1 ${
          participationType === 'team' 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-300'
        }`}>
          <input
            type="radio"
            name="participationType"
            checked={participationType === 'team'}
            onChange={() => setParticipationType('team')}
            className="w-5 h-5 text-blue-600"
          />
          <div>
            <Users className="w-5 h-5 mb-1" />
            <span className="text-sm font-medium">Team Participation</span>
          </div>
        </label>
      </div>
    </div>

    {/* Team Settings (Conditional) */}
    {participationType === 'team' && (
      <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Min Team Size <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={minTeamSize}
              onChange={(e) => setMinTeamSize(e.target.value ? Number(e.target.value) : '')}
              min="1"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              placeholder="Min: 1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Max Team Size <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={maxTeamSize}
              onChange={(e) => setMaxTeamSize(e.target.value ? Number(e.target.value) : '')}
              min="1"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              placeholder="Max: 2"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 border border-gray-300 dark:border-gray-600 rounded-lg">
          <input
            type="checkbox"
            id="interCollege"
            checked={interCollegeAllowed}
            onChange={(e) => setInterCollegeAllowed(e.target.checked)}
            className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
          />
          <label htmlFor="interCollege" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
            Allow inter-college teams
          </label>
        </div>

        <div className="flex items-center gap-3 p-4 border border-gray-300 dark:border-gray-600 rounded-lg">
          <input
            type="checkbox"
            id="interSpec"
            checked={interSpecializationAllowed}
            onChange={(e) => setInterSpecializationAllowed(e.target.checked)}
            className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
          />
          <label htmlFor="interSpec" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
            Allow inter-specialization teams
          </label>
        </div>
      </div>
    )}

    {/* Mode of Opportunity */}
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        Mode of Opportunity
      </label>
      <div className="flex gap-3">
        {(['online', 'offline', 'hybrid'] as OpportunityMode[]).map((mode) => (
          <label
            key={mode}
            className={`flex items-center justify-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all flex-1 ${
              opportunityMode === mode 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'border-gray-300 dark:border-gray-600 hover:border-blue-300'
            }`}
          >
            <input
              type="radio"
              name="opportunityMode"
              checked={opportunityMode === mode}
              onChange={() => setOpportunityMode(mode)}
              className="w-4 h-4 text-blue-600"
            />
            <span className="text-sm font-medium capitalize">{mode}</span>
          </label>
        ))}
      </div>
    </div>
  </div>
</div>
```

### Next Steps:

Your file already has 90% of the work done! You just need to:

1. **Find line ~380-400** where the current simple "Editable Fields" section ends
2. **Replace** that entire editable section with the new comprehensive sections above
3. Add the remaining sections (Contact, Additional Details, FAQs) using similar patterns

**OR** - Since you've been waiting, would you like me to provide you a **complete ready-to-paste file** that you can directly use? 

The complete file would be ~1500 lines with ALL sections beautifully implemented matching your screenshots! 🎨

आप कैसे proceed करना चाहोगे? Complete file दूं या sections add करते रहें? 😊
