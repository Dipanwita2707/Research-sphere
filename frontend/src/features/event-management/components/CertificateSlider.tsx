'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, Award, Users, ChevronDown, AlertCircle,
  Loader2, CheckCircle2, Clock, UserCheck,
  UserX, History, Upload,
  ChevronRight, ChevronLeft, XCircle,
  Maximize2, Minimize2, FileText, Send, Eye,
  Type, Image as ImageIcon, Plus, Trash2, Bold,
  AlignLeft, AlignCenter, AlignRight, GripVertical, Move,
  Undo2, Check, ImagePlus,
} from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import { useToast } from '@/shared/ui-components/Toast';

// ── Types ────────────────────────────────────────────────────────
interface RecipientCounts {
  all: number;
  confirmed: number;
  pending: number;
  cancelled: number;
}

type StatusFilter = 'all' | 'confirmed' | 'pending' | 'cancelled' | 'selected';
type SliderTab = 'send' | 'history';
type Step = 'template' | 'configure' | 'recipients';

interface CertificateTemplate {
  id: string;
  name: string;
  certificateType: string;
  templateUrl: string | null;
  title: string;
  content: string;
  textColor: string;
  isDefault?: boolean;
  createdAt?: string;
}

interface CertificateLogEntry {
  id: string;
  certificateType: string;
  title: string;
  filter: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  status: string;
  errors: string[];
  sentAt: string;
  sentByName: string;
  sentByEmail: string | null;
}

interface CertificateSliderProps {
  open: boolean;
  onClose: () => void;
  eventId: string;
  eventName: string;
  selectedRegistrationIds?: string[];
}

// ── Text field type for the visual editor ────────────────────────
interface TextField {
  id: string;
  text: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  fontSize: number; // px on screen, mapped to PDF points
  color: string;
  fontWeight: 'normal' | 'bold';
  textAlign: 'left' | 'center' | 'right';
}

// ── Image overlay type ───────────────────────────────────────────
interface ImageField {
  id: string;
  url: string;   // object URL (for preview) or presigned S3 URL
  s3Key: string; // S3 key (empty until uploaded)
  x: number;     // percentage 0-100
  y: number;     // percentage 0-100
  width: number; // percentage of canvas width (5-80)
}

type UndoEntry = { type: 'text'; field: TextField } | { type: 'image'; field: ImageField };

let _tfIdCounter = 0;
const newTfId = () => `tf_${++_tfIdCounter}_${Date.now()}`;
let _ifIdCounter = 0;
const newIfId = () => `if_${++_ifIdCounter}_${Date.now()}`;

const DEFAULT_TEXT_FIELDS: () => TextField[] = () => [
  { id: newTfId(), text: 'Certificate of Participation', x: 50, y: 45, fontSize: 22, color: '#1c4980', fontWeight: 'bold', textAlign: 'center' },
  { id: newTfId(), text: '[Candidate Name]', x: 50, y: 55, fontSize: 18, color: '#1c4980', fontWeight: 'bold', textAlign: 'center' },
  { id: newTfId(), text: "This is to certify that [Candidate Name] from [Candidate's Organisation Name] as Team [Team Name] has participated in [Event Name] organized by the [Organizer].", x: 50, y: 65, fontSize: 11, color: '#1c4980', fontWeight: 'normal', textAlign: 'center' },
];

// ── Placeholder options ──────────────────────────────────────────
const PLACEHOLDERS = [
  { label: 'Candidate Name', value: '[Candidate Name]' },
  { label: 'Event Name', value: '[Event Name]' },
  { label: 'Organizer', value: '[Organizer]' },
  { label: 'Team Name', value: '[Team Name]' },
  { label: "Candidate's Organisation Name", value: "[Candidate's Organisation Name]" },
  { label: 'Date', value: '[Date]' },
];

// ── Status filter pills ──────────────────────────────────────────
const BASE_FILTERS: { value: StatusFilter; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'all', label: 'All', icon: Users, color: '#6366f1' },
  { value: 'confirmed', label: 'Confirmed', icon: UserCheck, color: '#10b981' },
  { value: 'pending', label: 'Pending', icon: Clock, color: '#f59e0b' },
  { value: 'cancelled', label: 'Cancelled', icon: UserX, color: '#ef4444' },
];

// ── Main Component ───────────────────────────────────────────────
export default function CertificateSlider({ open, onClose, eventId, eventName, selectedRegistrationIds }: CertificateSliderProps) {
  const { toast } = useToast();

  const FILTERS = selectedRegistrationIds && selectedRegistrationIds.length > 0
    ? [{ value: 'selected' as StatusFilter, label: `Selected (${selectedRegistrationIds.length})`, icon: CheckCircle2, color: '#8b5cf6' }, ...BASE_FILTERS]
    : BASE_FILTERS;

  // ── State ──────────────────────────────────────────────────
  const [sliderTab, setSliderTab] = useState<SliderTab>('send');
  const [expanded, setExpanded] = useState(false);
  const [step, setStep] = useState<Step>('template');

  // Template state
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<CertificateTemplate | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Configure state — draggable text fields + image overlays
  const [textFields, setTextFields] = useState<TextField[]>(DEFAULT_TEXT_FIELDS());
  const [imageFields, setImageFields] = useState<ImageField[]>([]);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [activeFieldType, setActiveFieldType] = useState<'text' | 'image'>('text');
  const [showPlaceholderDropdown, setShowPlaceholderDropdown] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ fieldId: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Undo stack
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);

  // Recipients & send state
  const [filter, setFilter] = useState<StatusFilter>(
    selectedRegistrationIds && selectedRegistrationIds.length > 0 ? 'selected' : 'all'
  );
  const [counts, setCounts] = useState<RecipientCounts | null>(null);
  const [countsLoading, setCountsLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // Duplicate warning state
  const [duplicateWarning, setDuplicateWarning] = useState<{
    show: boolean;
    duplicateCount: number;
    totalRecipients: number;
    newRecipients: number;
  }>({ show: false, duplicateCount: 0, totalRecipients: 0, newRecipients: 0 });

  // History state
  const [historyLogs, setHistoryLogs] = useState<CertificateLogEntry[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Test certificate state
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  // ── Computed ───────────────────────────────────────────────
  const recipientCount = filter ===
   'selected'
    ? (selectedRegistrationIds?.length ?? 0)
    : (counts ? counts[filter as keyof RecipientCounts] : 0);

  // ── Sync filter + reset step when slider opens/closes ─────
  useEffect(() => {
    if (open) {
      const hasSelection = Array.isArray(selectedRegistrationIds) && selectedRegistrationIds.length > 0;
      setFilter(hasSelection ? 'selected' : 'all');
      setStep('template');
      setSliderTab('send');
    }
  }, [open, selectedRegistrationIds]);

  // ── Load templates on open ─────────────────────────────────
  useEffect(() => {
    if (!open || !eventId) return;
    loadTemplates();
    loadCounts();
  }, [open, eventId]);

  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const data = await eventService.getCertificateTemplates(eventId);
      setTemplates(data);
    } catch {
      // Silently handle — user will see empty list
    } finally {
      setLoadingTemplates(false);
    }
  }, [eventId]);

  const loadCounts = useCallback(async () => {
    setCountsLoading(true);
    try {
      const data = await eventService.getCertificateRecipientsCount(eventId);
      setCounts(data);
    } catch {
      // Silently handle
    } finally {
      setCountsLoading(false);
    }
  }, [eventId]);

  // ── Load history when tab switches ─────────────────────────
  useEffect(() => {
    if (sliderTab ===
   'history' && open) {
      loadHistory(1);
    }
  }, [sliderTab, open]);

  const loadHistory = useCallback(async (page: number) => {
    setHistoryLoading(true);
    try {
      const data = await eventService.getCertificateHistory(eventId, page);
      setHistoryLogs(data.logs);
      setHistoryPage(data.pagination.page);
      setHistoryTotal(data.pagination.totalPages);
    } catch {
      // Silently handle
    } finally {
      setHistoryLoading(false);
    }
  }, [eventId]);

  // ── Template upload handler ────────────────────────────────
  const handleTemplateUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'].includes(file.type)) {
      toast({ type: 'error', message: 'Only PNG, JPG, and SVG files are allowed.' });
      return;
    }
    if (file.size > 1 * 1024 * 1024) {
      toast({ type: 'error', message: 'File size must be less than 1 MB.' });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', file.name.replace(/\.[^/.]+$/, ''));

      const template = await eventService.uploadCertificateTemplate(eventId, formData);
      setTemplates((prev) => [template, ...prev]);
      setSelectedTemplate(template);
      toast({ type: 'success', message: 'Template uploaded successfully.' });
    } catch {
      toast({ type: 'error', message: 'Failed to upload template.' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [eventId, toast]);

  // ── Select template and move to configure ──────────────────
  const handleSelectTemplate = useCallback((template: CertificateTemplate) => {
    setSelectedTemplate(template);
    setTextFields(DEFAULT_TEXT_FIELDS());
    setImageFields([]);
    setActiveFieldId(null);
    setUndoStack([]);
    setStep('configure');
  }, []);

  // ── Create blank template (no image) & move to configure ───
  const handleCustomise = useCallback(async () => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('name', 'Custom Certificate');
      formData.append('title', 'Certificate of Participation');
      formData.append('content', "This is to certify that [Candidate Name] from [Candidate's Organisation Name] as Team [Team Name] has participated in [Event Name] organized by the [Organizer].");
      formData.append('textColor', '#1c4980');

      const template = await eventService.uploadCertificateTemplate(eventId, formData);
      setTemplates((prev) => [template, ...prev]);
      setSelectedTemplate(template);
      setTextFields(DEFAULT_TEXT_FIELDS());
      setImageFields([]);
      setActiveFieldId(null);
      setUndoStack([]);
      setStep('configure');
      toast({ type: 'success', message: 'Custom template created.' });
    } catch {
      toast({ type: 'error', message: 'Failed to create template.' });
    } finally {
      setUploading(false);
    }
  }, [eventId, toast]);

  // ── Delete template handler ─────────────────────────────────
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDeleteTemplate = useCallback(async (e: React.MouseEvent, tmplId: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this template?')) return;
    setDeleting(tmplId);
    try {
      await eventService.deleteCertificateTemplate(eventId, tmplId);
      setTemplates((prev) => prev.filter((t) => t.id !== tmplId));
      if (selectedTemplate?.id ===
   tmplId) setSelectedTemplate(null);
      toast({ type: 'success', message: 'Template deleted.' });
    } catch {
      toast({ type: 'error', message: 'Failed to delete template.' });
    } finally {
      setDeleting(null);
    }
  }, [eventId, selectedTemplate, toast]);

  // ── Insert placeholder into active text field ──────────────
  const insertPlaceholder = useCallback((value: string) => {
    if (!activeFieldId) {
      toast({ type: 'info', message: 'Select a text field first, then add a placeholder.' });
      setShowPlaceholderDropdown(false);
      return;
    }
    setTextFields((prev) => prev.map((f) =>
      f.id ===
   activeFieldId ? { ...f, text: f.text + ' ' + value } : f
    ));
    setShowPlaceholderDropdown(false);
  }, [activeFieldId, toast]);

  // ── Drag handlers (works for both text + image fields) ──────
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent, fieldId: string, fieldType: 'text' | 'image') => {
    e.preventDefault();
    e.stopPropagation();
    const field = fieldType ===
   'text'
      ? textFields.find((f) => f.id ===
   fieldId)
      : imageFields.find((f) => f.id ===
   fieldId);
    if (!field) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragRef.current = { fieldId, startX: clientX, startY: clientY, origX: field.x, origY: field.y };
    setActiveFieldId(fieldId);
    setActiveFieldType(fieldType);

    const handleMove = (ev: MouseEvent | TouchEvent) => {
      const drag = dragRef.current;
      if (!drag || !canvasRef.current) return;
      const cx = 'touches' in ev ? (ev as TouchEvent).touches[0].clientX : (ev as MouseEvent).clientX;
      const cy = 'touches' in ev ? (ev as TouchEvent).touches[0].clientY : (ev as MouseEvent).clientY;
      const rect = canvasRef.current.getBoundingClientRect();
      const dx = ((cx - drag.startX) / rect.width) * 100;
      const dy = ((cy - drag.startY) / rect.height) * 100;
      const newX = Math.max(0, Math.min(100, drag.origX + dx));
      const newY = Math.max(0, Math.min(100, drag.origY + dy));
      if (fieldType ===
   'text') {
        setTextFields((prev) => prev.map((f) =>
          f.id ===
   drag.fieldId ? { ...f, x: newX, y: newY } : f
        ));
      } else {
        setImageFields((prev) => prev.map((f) =>
          f.id ===
   drag.fieldId ? { ...f, x: newX, y: newY } : f
        ));
      }
    };

    const handleUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleUp);
  }, [textFields, imageFields]);

  // ── Add new text field ─────────────────────────────────────
  const addTextField = useCallback(() => {
    const nf: TextField = { id: newTfId(), text: 'New Text', x: 50, y: 50, fontSize: 14, color: '#1c4980', fontWeight: 'normal', textAlign: 'center' };
    setTextFields((prev) => [...prev, nf]);
    setActiveFieldId(nf.id);
  }, []);

  const removeTextField = useCallback((id: string) => {
    const field = textFields.find((f) => f.id ===
   id);
    if (field) setUndoStack((prev) => [...prev, { type: 'text', field }]);
    setTextFields((prev) => prev.filter((f) => f.id !== id));
    if (activeFieldId ===
   id) setActiveFieldId(null);
  }, [activeFieldId, textFields]);

  const updateField = useCallback((id: string, patch: Partial<TextField>) => {
    setTextFields((prev) => prev.map((f) => f.id ===
   id ? { ...f, ...patch } : f));
  }, []);

  // ── Image field handlers ───────────────────────────────────
  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'].includes(file.type)) {
      toast({ type: 'error', message: 'Only PNG, JPG, SVG, or WebP images are allowed.' });
      return;
    }
    if (file.size > 1 * 1024 * 1024) {
      toast({ type: 'error', message: 'Image must be less than 1 MB.' });
      return;
    }

    // Upload to S3 via the template upload endpoint (reuse)
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', `overlay_${file.name.replace(/\.[^/.]+$/, '')}`);
      const tmpl = await eventService.uploadCertificateTemplate(eventId, formData);

      const nf: ImageField = {
        id: newIfId(),
        url: tmpl.templateUrl || '',
        s3Key: tmpl.id, // store template id so backend can resolve the S3 key
        x: 50,
        y: 20,
        width: 15,
      };
      setImageFields((prev) => [...prev, nf]);
      setActiveFieldId(nf.id);
      setActiveFieldType('image');
      toast({ type: 'success', message: 'Image added to certificate.' });
    } catch {
      toast({ type: 'error', message: 'Failed to upload image.' });
    }
    if (imageInputRef.current) imageInputRef.current.value = '';
  }, [eventId, toast]);

  const removeImageField = useCallback((id: string) => {
    const field = imageFields.find((f) => f.id ===
   id);
    if (field) setUndoStack((prev) => [...prev, { type: 'image', field }]);
    setImageFields((prev) => prev.filter((f) => f.id !== id));
    if (activeFieldId ===
   id) setActiveFieldId(null);
  }, [activeFieldId, imageFields]);

  const updateImageField = useCallback((id: string, patch: Partial<ImageField>) => {
    setImageFields((prev) => prev.map((f) => f.id ===
   id ? { ...f, ...patch } : f));
  }, []);

  // ── Undo handler ───────────────────────────────────────────
  const handleUndo = useCallback(() => {
    if (undoStack.length ===
   0) return;
    const last = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    if (last.type ===
   'text') {
      setTextFields((prev) => [...prev, last.field]);
      setActiveFieldId(last.field.id);
      setActiveFieldType('text');
    } else {
      setImageFields((prev) => [...prev, last.field]);
      setActiveFieldId(last.field.id);
      setActiveFieldType('image');
    }
    toast({ type: 'info', message: 'Restored removed field.' });
  }, [undoStack, toast]);

  // ── Ctrl+Z keyboard shortcut ───────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key ===
   'z' && undoStack.length > 0) {
        e.preventDefault();
        handleUndo();
      }
    };
    if (open && step ===
   'configure') {
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }
  }, [open, step, undoStack, handleUndo]);

  // ── Send test certificate handler ──────────────────────────
  const handleSendTest = useCallback(async () => {
    if (!selectedTemplate) {
      toast({ type: 'error', message: 'Please select a template first.' });
      return;
    }
    if (!testEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
      toast({ type: 'error', message: 'Please enter a valid email address.' });
      return;
    }
    setSendingTest(true);
    try {
      const cw = canvasRef.current?.getBoundingClientRect().width || 600;
      await eventService.sendTestCertificate(eventId, {
        templateId: selectedTemplate.id,
        canvasWidth: cw,
        textFields: textFields.map((f) => ({
          text: f.text, x: f.x, y: f.y,
          fontSize: f.fontSize, color: f.color,
          fontWeight: f.fontWeight, textAlign: f.textAlign,
        })),
        imageFields: imageFields.map((f) => ({
          s3Key: f.s3Key, x: f.x, y: f.y, width: f.width,
        })),
        testEmail,
      });
      toast({ type: 'success', message: `Test certificate sent to ${testEmail}` });
    } catch {
      toast({ type: 'error', message: 'Failed to send test certificate.' });
    } finally {
      setSendingTest(false);
    }
  }, [selectedTemplate, testEmail, textFields, imageFields, eventId, toast]);

  // ── Build payload helper ────────────────────────────────────
  const buildPayload = useCallback((duplicateAction?: 'skip' | 'resend') => {
    if (!selectedTemplate) return null;
    const cw = canvasRef.current?.getBoundingClientRect().width || 600;
    const payload: {
      templateId: string;
      canvasWidth: number;
      textFields: Array<{ text: string; x: number; y: number; fontSize: number; color: string; fontWeight: string; textAlign: string }>;
      imageFields?: Array<{ s3Key: string; x: number; y: number; width: number }>;
      filter?: string;
      registrationIds?: string[];
      duplicateAction?: 'skip' | 'resend';
    } = {
      templateId: selectedTemplate.id,
      canvasWidth: cw,
      textFields: textFields.map((f) => ({
        text: f.text,
        x: f.x,
        y: f.y,
        fontSize: f.fontSize,
        color: f.color,
        fontWeight: f.fontWeight,
        textAlign: f.textAlign,
      })),
      imageFields: imageFields.map((f) => ({
        s3Key: f.s3Key, x: f.x, y: f.y, width: f.width,
      })),
    };

    if (filter ===
   'selected' && selectedRegistrationIds) {
      payload.registrationIds = selectedRegistrationIds;
    } else {
      payload.filter = filter;
    }

    if (duplicateAction) {
      payload.duplicateAction = duplicateAction;
    }

    return payload;
  }, [selectedTemplate, textFields, imageFields, filter, selectedRegistrationIds]);

  // ── Send handler ───────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!selectedTemplate) {
      toast({ type: 'error', message: 'Please select a certificate template first.' });
      return;
    }
    if (recipientCount ===
   0) {
      toast({ type: 'error', message: 'No recipients found for the selected filter.' });
      return;
    }

    setSending(true);
    try {
      const payload = buildPayload();
      if (!payload) return;

      const result = await eventService.sendCertificates(eventId, payload);

      // If backend returns a duplicate warning, show confirmation dialog
      if (result.requiresConfirmation) {
        setDuplicateWarning({
          show: true,
          duplicateCount: result.duplicateCount || 0,
          totalRecipients: result.totalRecipients || 0,
          newRecipients: result.newRecipients || 0,
        });
        setSending(false);
        return;
      }

      if (result.success) {
        const skippedMsg = result.skippedCount ? ` (${result.skippedCount} skipped — already sent)` : '';
        toast({ type: 'success', message: `Certificates sent to ${result.sent} recipient(s).${skippedMsg}` });
      } else {
        toast({
          type: 'warning',
          message: `Sent ${result.sent}, failed ${result.failed}.`,
        });
      }

      // Reset to first step
      setStep('template');
      setSelectedTemplate(null);
      setTextFields(DEFAULT_TEXT_FIELDS());
      setImageFields([]);
      setUndoStack([]);
      setDuplicateWarning({ show: false, duplicateCount: 0, totalRecipients: 0, newRecipients: 0 });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send certificates.';
      toast({ type: 'error', message });
    } finally {
      setSending(false);
    }
  }, [selectedTemplate, recipientCount, buildPayload, eventId, toast]);

  // ── Duplicate action handler (Skip Already Sent / Resend Anyway) ──
  const handleDuplicateAction = useCallback(async (action: 'skip' | 'resend') => {
    setDuplicateWarning((prev) => ({ ...prev, show: false }));
    setSending(true);
    try {
      const payload = buildPayload(action);
      if (!payload) return;

      const result = await eventService.sendCertificates(eventId, payload);

      if (result.success) {
        const skippedMsg = result.skippedCount ? ` (${result.skippedCount} skipped — already sent)` : '';
        toast({ type: 'success', message: `Certificates sent to ${result.sent} recipient(s).${skippedMsg}` });
      } else {
        toast({
          type: 'warning',
          message: `Sent ${result.sent}, failed ${result.failed}.`,
        });
      }

      setStep('template');
      setSelectedTemplate(null);
      setTextFields(DEFAULT_TEXT_FIELDS());
      setImageFields([]);
      setUndoStack([]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send certificates.';
      toast({ type: 'error', message });
    } finally {
      setSending(false);
    }
  }, [buildPayload, eventId, toast]);

  // ── Render ─────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Slider Panel */}
      <div
        className={`fixed top-0 right-0 h-full bg-gray-50 dark:bg-[#0f1117] shadow-2xl z-50 flex flex-col transition-all duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        } ${
          expanded ? 'w-full sm:w-[90vw] lg:w-[1100px]' : 'w-full sm:w-[560px]'
        }`}
      >

        {/* ── Duplicate Warning Modal ──────────────────────── */}
        {duplicateWarning.show && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
              <div className="bg-amber-50 dark:bg-amber-900/20 px-6 py-4 border-b border-amber-200 dark:border-amber-800/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/40 rounded-xl flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-amber-800 dark:text-amber-300">Duplicate Certificates Detected</h3>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">{duplicateWarning.duplicateCount} recipient{duplicateWarning.duplicateCount !== 1 ? 's' : ''} already sent</p>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4">
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  <strong className="text-ev-900 dark:text-white">{duplicateWarning.duplicateCount}</strong> of{' '}
                  <strong className="text-ev-900 dark:text-white">{duplicateWarning.totalRecipients}</strong> recipient{duplicateWarning.totalRecipients !== 1 ? 's' : ''} have already been sent a certificate for this event.
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">Choose how you&apos;d like to proceed:</p>
                <div className="space-y-2.5">
                  <button
                    onClick={() => handleDuplicateAction('skip')}
                    disabled={duplicateWarning.newRecipients ===
   0}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-ev-200 dark:border-ev-800 bg-ev-50 dark:bg-ev-900/20 hover:bg-ev-100 dark:hover:bg-ev-900/30 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <div className="w-8 h-8 bg-ev-100 dark:bg-ev-900/40 rounded-lg flex items-center justify-center shrink-0">
                      <UserCheck className="w-4 h-4 text-ev-700 dark:text-ev-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ev-800 dark:text-ev-200">Skip Already Sent</p>
                      <p className="text-xs text-ev-700 dark:text-ev-400">
                        Send only to {duplicateWarning.newRecipients} new recipient{duplicateWarning.newRecipients !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => handleDuplicateAction('resend')}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors text-left"
                  >
                    <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/40 rounded-lg flex items-center justify-center shrink-0">
                      <Send className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Resend Anyway</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Send to all {duplicateWarning.totalRecipients} recipient{duplicateWarning.totalRecipients !== 1 ? 's' : ''} (same verification IDs)
                      </p>
                    </div>
                  </button>
                </div>
              </div>
              <div className="px-6 py-3 border-t border-[#b3cde0] dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <button
                  onClick={() => setDuplicateWarning({ show: false, duplicateCount: 0, totalRecipients: 0, newRecipients: 0 })}
                  className="w-full py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        {/* ── Header ──────────────────────────────────────── */}
        <div className="border-b border-[#b3cde0] dark:border-gray-700/60 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-ev">
                <Award className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-ev-900 dark:text-white leading-none">Certificate</h2>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 truncate max-w-[180px]">{eventName}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setExpanded(!expanded)}
                className="hidden sm:flex w-8 h-8 items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors"
                title={expanded ? 'Collapse panel' : 'Expand panel'}
              >
                {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          {/* Tab Selector */}
          <div className="flex px-5 gap-0.5">
            <button
              type="button"
              onClick={() => setSliderTab('send')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                sliderTab ===
   'send'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400 dark:border-amber-400'
                  : 'border-transparent text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              Send Certificate
            </button>
            <button
              type="button"
              onClick={() => setSliderTab('history')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                sliderTab ===
   'history'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400 dark:border-amber-400'
                  : 'border-transparent text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              History
            </button>
          </div>
        </div>

        {/* ── Scrollable Content ──────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {sliderTab ===
   'send' ? (
            <div className="px-5 py-5 space-y-5">

              {/* ── Step Indicator ───────────────────────────── */}
              <div className="flex items-center gap-2">
                {(['template', 'configure', 'recipients'] as Step[]).map((s, i) => {
                  const labels = ['Template', 'Configure', 'Send'];
                  const icons = [ImageIcon, Type, Send];
                  const Icon = icons[i];
                  const isActive = step ===
   s;
                  const stepIndex = ['template', 'configure', 'recipients'].indexOf(step);
                  const isPast = i < stepIndex;
                  return (
                    <React.Fragment key={s}>
                      {i > 0 && <div className={`flex-1 h-0.5 rounded ${isPast || isActive ? 'bg-amber-500' : 'bg-gray-200 dark:bg-gray-700'}`} />}
                      <button
                        type="button"
                        onClick={() => {
                          const idx = ['template', 'configure', 'recipients'].indexOf(s);
                          if (idx <= stepIndex) setStep(s);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          isActive
                            ? 'bg-amber-500 text-white shadow-ev'
                            : isPast
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {labels[i]}
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>

              {/* ── Step 1: Template Selection ─────────────── */}
              {step ===
   'template' && (
                <div className="space-y-4">
                  {/* Header */}
                  <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-900/10 p-4">
                    <h3 className="text-sm font-bold text-amber-700 dark:text-amber-400">
                      {selectedTemplate ? 'Send Participation Certificate' : 'Choose Certificate Template'}
                    </h3>
                    <p className="text-xs text-amber-600/70 dark:text-amber-500/70 mt-0.5">{eventName}</p>
                  </div>

                  {/* Template grid */}
                  <div className="rounded-xl border border-[#b3cde0] dark:border-gray-700 bg-white dark:bg-gray-800/50 p-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">Choose Certificate Template</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {/* Customise (no image) option */}
                      <button
                        type="button"
                        onClick={handleCustomise}
                        disabled={uploading}
                        className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 hover:border-amber-400 dark:hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-all min-h-[120px] group"
                      >
                        {uploading ? (
                          <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
                        ) : (
                          <>
                            <Plus className="w-6 h-6 text-gray-400 group-hover:text-amber-500 transition-colors" />
                            <span className="text-xs font-semibold text-gray-500 group-hover:text-amber-600 transition-colors">Customise</span>
                          </>
                        )}
                      </button>

                      {/* Existing templates */}
                      {loadingTemplates ? (
                        <div className="col-span-2 flex items-center justify-center py-8">
                          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                        </div>
                      ) : (
                        templates.map((tmpl) => (
                          <button
                            key={tmpl.id}
                            type="button"
                            onClick={() => handleSelectTemplate(tmpl)}
                            className={`group relative flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 transition-all min-h-[120px] ${
                              selectedTemplate?.id ===
   tmpl.id
                                ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 ring-2 ring-amber-500/30'
                                : 'border-[#b3cde0] dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-amber-300'
                            }`}
                          >
                            {tmpl.templateUrl ? (
                              <img
                                src={tmpl.templateUrl}
                                alt={tmpl.name}
                                className="w-full h-16 object-cover rounded-lg"
                              />
                            ) : (
                              <div className="w-full h-16 rounded-lg bg-gradient-to-br from-ev-100 to-ev-200 dark:from-ev-900/30 dark:to-ev-900/30 flex items-center justify-center">
                                <Award className="w-6 h-6 text-ev-400" />
                              </div>
                            )}
                            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400 truncate w-full text-center">{tmpl.name}</span>
                            {selectedTemplate?.id ===
   tmpl.id && (
                              <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                                <CheckCircle2 className="w-3 h-3 text-white" />
                              </div>
                            )}
                            {/* Delete button */}
                            <button
                              type="button"
                              onClick={(e) => handleDeleteTemplate(e, tmpl.id)}
                              className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-200 dark:hover:bg-red-800/60 transition-all"
                              title="Delete template"
                            >
                              {deleting ===
   tmpl.id ? (
                                <Loader2 className="w-3 h-3 text-red-500 animate-spin" />
                              ) : (
                                <X className="w-3 h-3 text-red-500" />
                              )}
                            </button>
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Upload custom template */}
                  <div className="rounded-xl border border-[#b3cde0] dark:border-gray-700 bg-white dark:bg-gray-800/50 p-4">
                    <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Certificate Template<span className="text-red-500">*</span>
                    </h4>
                    <label
                      className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-amber-400 cursor-pointer transition-colors"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                        onChange={handleTemplateUpload}
                        className="hidden"
                      />
                      {uploading ? (
                        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-gray-400" />
                          <span className="text-sm font-medium text-amber-600 dark:text-amber-400">Choose file <span className="text-gray-400 font-normal">to upload</span></span>
                          <span className="text-[11px] text-gray-400">(CVS Maximum file size is 1 MB)</span>
                        </>
                      )}
                    </label>
                  </div>

                  {/* Next button */}
                  {selectedTemplate && (
                    <button
                      type="button"
                      onClick={() => setStep('configure')}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm transition-colors shadow-ev"
                    >
                      Save & Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              {/* ── Step 2: Visual Editor ─────────────────── */}
              {step ===
   'configure' && (
                <div className="space-y-4">
                  {/* Toolbar */}
                  <div className="rounded-xl border border-[#b3cde0] dark:border-gray-700 bg-white dark:bg-gray-800/50 p-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={addTextField}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Text
                    </button>

                    {/* Add Image button */}
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ev-700 hover:bg-ev-800 text-white text-xs font-semibold transition-colors"
                    >
                      <ImagePlus className="w-3.5 h-3.5" /> Add Image
                    </button>
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                      onChange={handleImageUpload}
                      className="hidden"
                    />

                    {/* Undo button */}
                    <button
                      type="button"
                      onClick={handleUndo}
                      disabled={undoStack.length ===
   0}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-medium text-gray-600 dark:text-gray-300 hover:border-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title="Undo (Ctrl+Z)"
                    >
                      <Undo2 className="w-3.5 h-3.5" /> Undo
                    </button>

                    {/* Placeholder dropdown */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowPlaceholderDropdown(!showPlaceholderDropdown)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-medium text-gray-600 dark:text-gray-300 hover:border-amber-400 transition-colors"
                      >
                        Placeholder <ChevronDown className="w-3 h-3" />
                      </button>
                      {showPlaceholderDropdown && (
                        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-[#b3cde0] dark:border-gray-700 rounded-lg shadow-lg z-30 py-1 w-64">
                          {PLACEHOLDERS.map((p) => (
                            <button
                              key={p.value}
                              type="button"
                              onClick={() => insertPlaceholder(p.value)}
                              className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                            >
                              {p.label} <span className="text-gray-400 ml-1">{p.value}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-auto">Drag text fields to position them</span>
                  </div>

                  {/* Canvas — template image with draggable text overlays */}
                  <div
                    ref={canvasRef}
                    className="relative rounded-xl overflow-hidden border-2 border-[#b3cde0] dark:border-gray-700 bg-gray-100 dark:bg-gray-900 select-none"
                    style={{ aspectRatio: '1.414 / 1' }}
                    onClick={() => setActiveFieldId(null)}
                  >
                    {/* Background */}
                    {selectedTemplate?.templateUrl ? (
                      <img src={selectedTemplate.templateUrl} alt="Template" className="absolute inset-0 w-full h-full object-cover pointer-events-none" draggable={false} />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-ev-50 to-ev-50 dark:from-ev-900 dark:to-ev-900" />
                    )}

                    {/* Draggable text fields */}
                    {textFields.map((field) => {
                      const isActive = activeFieldId ===
   field.id;
                      const previewText = field.text
                        .replace(/\[Candidate Name\]/gi, 'John Doe')
                        .replace(/\[Event Name\]/gi, eventName)
                        .replace(/\[Organizer\]/gi, 'SGT University')
                        .replace(/\[Team Name\]/gi, 'Team Alpha')
                        .replace(/\[Candidate's Organisation Name\]/gi, 'SGT University')
                        .replace(/\[Date\]/gi, new Date().toLocaleDateString('en-IN', { dateStyle: 'long' }));
                      return (
                        <div
                          key={field.id}
                          className={`absolute cursor-move transition-shadow ${isActive ? 'ring-2 ring-amber-500 ring-offset-1 z-20' : 'hover:ring-1 hover:ring-amber-300 z-10'}`}
                          style={{
                            left: `${field.x}%`,
                            top: `${field.y}%`,
                            transform: field.textAlign ===
   'center' ? 'translate(-50%, -50%)' : field.textAlign ===
   'right' ? 'translate(-100%, -50%)' : 'translate(0, -50%)',
                            fontSize: `${field.fontSize}px`,
                            color: field.color,
                            fontWeight: field.fontWeight,
                            textAlign: field.textAlign,
                            maxWidth: '90%',
                            lineHeight: 1.4,
                            wordBreak: 'break-word',
                          }}
                          onClick={(e) => { e.stopPropagation(); setActiveFieldId(field.id); setActiveFieldType('text'); }}
                          onMouseDown={(e) => handleDragStart(e, field.id, 'text')}
                          onTouchStart={(e) => handleDragStart(e, field.id, 'text')}
                        >
                          {previewText}
                          {isActive && (
                            <div className="absolute -top-1 -left-1 w-3 h-3 flex items-center justify-center">
                              <Move className="w-3 h-3 text-amber-500 drop-shadow" />
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Draggable image overlays */}
                    {imageFields.map((imgf) => {
                      const isActive = activeFieldId ===
   imgf.id;
                      return (
                        <div
                          key={imgf.id}
                          className={`absolute cursor-move transition-shadow ${isActive ? 'ring-2 ring-ev-700 ring-offset-1 z-20' : 'hover:ring-1 hover:ring-ev-400 z-10'}`}
                          style={{
                            left: `${imgf.x}%`,
                            top: `${imgf.y}%`,
                            width: `${imgf.width}%`,
                            transform: 'translate(-50%, -50%)',
                          }}
                          onClick={(e) => { e.stopPropagation(); setActiveFieldId(imgf.id); setActiveFieldType('image'); }}
                          onMouseDown={(e) => handleDragStart(e, imgf.id, 'image')}
                          onTouchStart={(e) => handleDragStart(e, imgf.id, 'image')}
                        >
                          {imgf.url && (
                            <img src={imgf.url} alt="Overlay" className="w-full h-auto pointer-events-none" draggable={false} />
                          )}
                          {isActive && (
                            <div className="absolute -top-1 -left-1 w-3 h-3 flex items-center justify-center">
                              <Move className="w-3 h-3 text-ev-700 drop-shadow" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Active field editor */}
                  {activeFieldId && activeFieldType ===
   'text' && (() => {
                    const af = textFields.find((f) => f.id ===
   activeFieldId);
                    if (!af) return null;
                    return (
                      <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-900/10 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5"><Type className="w-3.5 h-3.5" /> Edit Text Field</h4>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => removeTextField(af.id)} className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 transition-colors">
                              <Trash2 className="w-3 h-3" /> Remove
                            </button>
                            <button type="button" onClick={() => setActiveFieldId(null)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition-colors">
                              <Check className="w-3 h-3" /> Done
                            </button>
                          </div>
                        </div>

                        {/* Text content */}
                        <textarea
                          value={af.text}
                          onChange={(e) => updateField(af.id, { text: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-ev-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all resize-none"
                          placeholder="Enter text…"
                        />

                        {/* Controls row */}
                        <div className="flex flex-wrap items-center gap-3">
                          {/* Font size */}
                          <div className="flex items-center gap-1.5">
                            <label className="text-[10px] font-semibold text-gray-500 uppercase">Size</label>
                            <input
                              type="number"
                              min={8}
                              max={60}
                              value={af.fontSize}
                              onChange={(e) => updateField(af.id, { fontSize: Math.max(8, Math.min(60, Number(e.target.value))) })}
                              className="w-14 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs text-ev-900 dark:text-white text-center outline-none"
                            />
                          </div>

                          {/* Color */}
                          <div className="flex items-center gap-1.5">
                            <label className="text-[10px] font-semibold text-gray-500 uppercase">Color</label>
                            <input
                              type="color"
                              value={af.color}
                              onChange={(e) => updateField(af.id, { color: e.target.value })}
                              className="w-7 h-7 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                            />
                          </div>

                          {/* Bold */}
                          <button
                            type="button"
                            onClick={() => updateField(af.id, { fontWeight: af.fontWeight ===
   'bold' ? 'normal' : 'bold' })}
                            className={`p-1.5 rounded-md border transition-colors ${af.fontWeight ===
   'bold' ? 'bg-amber-100 border-amber-400 text-amber-700 dark:bg-amber-900/30 dark:border-amber-600 dark:text-amber-400' : 'border-gray-300 dark:border-gray-600 text-gray-500 hover:border-amber-300'}`}
                            title="Bold"
                          >
                            <Bold className="w-3.5 h-3.5" />
                          </button>

                          {/* Alignment */}
                          <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden">
                            {(['left', 'center', 'right'] as const).map((a) => {
                              const Icon = a ===
   'left' ? AlignLeft : a ===
   'center' ? AlignCenter : AlignRight;
                              return (
                                <button
                                  key={a}
                                  type="button"
                                  onClick={() => updateField(af.id, { textAlign: a })}
                                  className={`p-1.5 transition-colors ${af.textAlign ===
   a ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                >
                                  <Icon className="w-3.5 h-3.5" />
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <p className="text-[10px] text-gray-400">Use placeholders like [Candidate Name], [Event Name] etc. to personalize for each recipient.</p>
                      </div>
                    );
                  })()}

                  {/* Active image field editor */}
                  {activeFieldId && activeFieldType ===
   'image' && (() => {
                    const af = imageFields.find((f) => f.id ===
   activeFieldId);
                    if (!af) return null;
                    return (
                      <div className="rounded-xl border border-ev-200 dark:border-ev-800/40 bg-ev-50/50 dark:bg-ev-900/10 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-semibold text-ev-800 dark:text-ev-400 flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5" /> Edit Image</h4>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => removeImageField(af.id)} className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 transition-colors">
                              <Trash2 className="w-3 h-3" /> Remove
                            </button>
                            <button type="button" onClick={() => setActiveFieldId(null)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-ev-700 hover:bg-ev-800 text-white text-xs font-semibold transition-colors">
                              <Check className="w-3 h-3" /> Done
                            </button>
                          </div>
                        </div>

                        {/* Preview */}
                        {af.url && (
                          <div className="rounded-lg overflow-hidden border border-[#b3cde0] dark:border-gray-700 bg-white dark:bg-gray-800 p-2 flex items-center justify-center">
                            <img src={af.url} alt="Preview" className="max-h-20 object-contain" />
                          </div>
                        )}

                        {/* Width control */}
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <label className="text-[10px] font-semibold text-gray-500 uppercase">Width %</label>
                            <input
                              type="number"
                              min={5}
                              max={80}
                              value={af.width}
                              onChange={(e) => updateImageField(af.id, { width: Math.max(5, Math.min(80, Number(e.target.value))) })}
                              className="w-16 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs text-ev-900 dark:text-white text-center outline-none"
                            />
                          </div>
                          <input
                            type="range"
                            min={5}
                            max={80}
                            value={af.width}
                            onChange={(e) => updateImageField(af.id, { width: Number(e.target.value) })}
                            className="flex-1 accent-ev-700"
                          />
                        </div>

                        <p className="text-[10px] text-gray-400">Drag the image on the canvas to reposition it. Adjust width above.</p>
                      </div>
                    );
                  })()}

                  {/* Fields list */}
                  <div className="rounded-xl border border-[#b3cde0] dark:border-gray-700 bg-white dark:bg-gray-800/50 p-3">
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Text Fields ({textFields.length})</h4>
                    <div className="space-y-1">
                      {textFields.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => { setActiveFieldId(f.id); setActiveFieldType('text'); }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center gap-2 transition-colors ${activeFieldId ===
   f.id ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                        >
                          <GripVertical className="w-3 h-3 shrink-0 opacity-40" />
                          <span className="truncate flex-1">{f.text || '(empty)'}</span>
                          <span className="text-[10px] opacity-50">{f.fontSize}px</span>
                        </button>
                      ))}
                    </div>

                    {/* Image fields */}
                    {imageFields.length > 0 && (
                      <>
                        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mt-3 mb-2">Images ({imageFields.length})</h4>
                        <div className="space-y-1">
                          {imageFields.map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => { setActiveFieldId(f.id); setActiveFieldType('image'); }}
                              className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center gap-2 transition-colors ${activeFieldId ===
   f.id ? 'bg-ev-100 dark:bg-ev-900/20 text-ev-800 dark:text-ev-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                            >
                              <ImageIcon className="w-3 h-3 shrink-0 opacity-60" />
                              <span className="truncate flex-1">Image</span>
                              <span className="text-[10px] opacity-50">{f.width}%</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Send Test Certificate */}
                  <div className="rounded-xl border border-ev-200 dark:border-ev-800/40 bg-ev-50/50 dark:bg-ev-900/10 p-4 space-y-2">
                    <h4 className="text-xs font-semibold text-ev-800 dark:text-ev-400 flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5" /> Send Test Certificate
                    </h4>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Preview how the certificate looks by sending a test to any email.</p>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        placeholder="test@example.com"
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-ev-900 dark:text-white focus:ring-2 focus:ring-ev-700 focus:border-ev-700 outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={handleSendTest}
                        disabled={sendingTest || !testEmail}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-ev-700 hover:bg-ev-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
                      >
                        {sendingTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        {sendingTest ? 'Sending…' : 'Send Test'}
                      </button>
                    </div>
                  </div>

                  {/* Navigation buttons */}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep('template')}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 font-semibold text-sm transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep('recipients')}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm transition-colors shadow-ev"
                    >
                      Save & Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ── Step 3: Recipients & Send ─────────────── */}
              {step ===
   'recipients' && (
                <div className="space-y-4">
                  {/* Recipient count */}
                  <div className="rounded-xl border border-[#b3cde0] dark:border-gray-700 bg-white dark:bg-gray-800/50 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[#b3cde0]/30 dark:border-gray-700/60">
                      <div className="flex items-center gap-2.5">
                        <div className="flex -space-x-1.5">
                          {[['bg-amber-500', 'A'], ['bg-orange-500', 'B'], ['bg-yellow-500', 'C']].map(([bg, ltr], i) => (
                            <div key={i} className={`w-7 h-7 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center text-[9px] font-bold text-white ${bg}`}>{ltr}</div>
                          ))}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-ev-900 dark:text-white leading-none">
                            {countsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : recipientCount}
                            {!countsLoading && <span className="font-normal text-gray-500 dark:text-gray-400"> recipient{recipientCount !== 1 ? 's' : ''}</span>}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-md">To</span>
                    </div>

                    {/* Filter pills */}
                    <div className="px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2.5">Filter by status</p>
                      <div className="flex flex-wrap gap-1.5">
                        {FILTERS.map((f) => {
                          const active = filter ===
   f.value;
                          const count = f.value ===
   'selected'
                            ? (selectedRegistrationIds?.length ?? 0)
                            : (counts ? counts[f.value as keyof RecipientCounts] : '…');
                          return (
                            <button
                              key={f.value}
                              type="button"
                              onClick={() => setFilter(f.value)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                              style={
                                active
                                  ? { backgroundColor: f.color, color: '#fff' }
                                  : { backgroundColor: 'transparent', color: '#6b7280', border: '1px solid #e5e7eb' }
                              }
                            >
                              <f.icon className="w-3 h-3" />
                              {f.label}
                              <span className={`px-1.5 py-px rounded text-[10px] font-bold ${active ? 'bg-white/25 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                                {count}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Summary card */}
                  <div className="rounded-xl border border-[#b3cde0] dark:border-gray-700 bg-white dark:bg-gray-800/50 p-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">Certificate Summary</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Template</span>
                        <span className="font-medium text-ev-900 dark:text-white">{selectedTemplate?.name || '—'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Text Fields</span>
                        <span className="font-medium text-ev-900 dark:text-white">{textFields.length}</span>
                      </div>
                      {imageFields.length > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 dark:text-gray-400">Image Overlays</span>
                          <span className="font-medium text-ev-900 dark:text-white">{imageFields.length}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Recipients</span>
                        <span className="font-medium text-ev-900 dark:text-white">{recipientCount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Filter</span>
                        <span className="font-medium text-ev-900 dark:text-white capitalize">{filter}</span>
                      </div>
                    </div>
                  </div>

                  {/* Info banner */}
                  <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30">
                    <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                      Each recipient will receive a personalised certificate PDF via email.
                      This may take a few moments depending on the number of recipients.
                    </p>
                  </div>

                  {/* Navigation buttons */}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep('configure')}
                      className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 font-semibold text-sm transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={sending || recipientCount ===
   0}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors shadow-ev"
                    >
                      {sending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Sending…
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Send Certificates ({recipientCount})
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ── History Tab ────────────────────────────────── */
            <div className="px-5 py-5 space-y-4">
              {historyLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                </div>
              ) : historyLogs.length ===
   0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                    <Award className="w-7 h-7 text-gray-300 dark:text-gray-600" />
                  </div>
                  <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">No certificates sent yet</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Sent certificates will appear here.</p>
                </div>
              ) : (
                <>
                  {historyLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-xl border border-[#b3cde0] dark:border-gray-700 bg-white dark:bg-gray-800/50 overflow-hidden"
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2.5">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-ev-900 dark:text-white truncate">{log.title}</h4>
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                              by {log.sentByName} · {new Date(log.sentAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              log.status ===
   'sent'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : log.status ===
   'partial'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                : log.status ===
   'processing'
                                ? 'bg-ev-100 text-ev-800 dark:bg-ev-900/30 dark:text-ev-400'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}
                          >
                            {log.status}
                          </span>
                        </div>

                        {/* Stats row */}
                        <div className="flex items-center gap-4 text-xs">
                          <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                            <Users className="w-3 h-3" />
                            {log.recipientCount} recipients
                          </div>
                          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            {log.sentCount} sent
                          </div>
                          {log.failedCount > 0 && (
                            <div className="flex items-center gap-1 text-red-500 dark:text-red-400">
                              <XCircle className="w-3 h-3" />
                              {log.failedCount} failed
                            </div>
                          )}
                          <div className="flex items-center gap-1 text-gray-400 dark:text-gray-500 ml-auto">
                            <FileText className="w-3 h-3" />
                            {log.certificateType}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Pagination */}
                  {historyTotal > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-2">
                      <button
                        type="button"
                        disabled={historyPage <= 1}
                        onClick={() => loadHistory(historyPage - 1)}
                        className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        Previous
                      </button>
                      <span className="text-xs text-gray-500">
                        Page {historyPage} of {historyTotal}
                      </span>
                      <button
                        type="button"
                        disabled={historyPage >= historyTotal}
                        onClick={() => loadHistory(historyPage + 1)}
                        className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
