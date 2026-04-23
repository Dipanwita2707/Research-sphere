'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  loanLetterTemplateService,
  LoanLetterTemplate,
  LoanLetterTemplateUpdate,
  TEMPLATE_DEFAULTS,
} from '../services/loanLetterTemplate.service';

export function useLoanLetterTemplate() {
  const [template, setTemplate] = useState<LoanLetterTemplate>(TEMPLATE_DEFAULTS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchTemplate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await loanLetterTemplateService.get();
      setTemplate(res.data);
    } catch {
      // Non-fatal — keep defaults so the print view still works
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTemplate(); }, [fetchTemplate]);

  const saveTemplate = useCallback(async (data: LoanLetterTemplateUpdate) => {
    setSaving(true);
    setSaveSuccess(false);
    setError(null);
    try {
      const res = await loanLetterTemplateService.update(data);
      setTemplate(res.data);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  const uploadHeaderImage = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const res = await loanLetterTemplateService.uploadHeaderImage(file);
      setTemplate(prev => ({ ...prev, headerImageUrl: res.data.url }));
      return res.data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
      throw err;
    } finally {
      setUploading(false);
    }
  }, []);

  const uploadWatermarkImage = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const res = await loanLetterTemplateService.uploadWatermarkImage(file);
      setTemplate(prev => ({ ...prev, watermarkImageUrl: res.data.url }));
      return res.data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload watermark');
      throw err;
    } finally {
      setUploading(false);
    }
  }, []);

  return { template, loading, saving, uploading, error, saveSuccess, fetchTemplate, saveTemplate, uploadHeaderImage, uploadWatermarkImage };
}
