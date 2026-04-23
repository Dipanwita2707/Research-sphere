import { useState, useCallback } from 'react';
import { loanLetterService, LoanLetter, CreateLoanLetterDto } from '../services/loanLetter.service';

export function useLoanLetter() {
  const [list, setList] = useState<LoanLetter[]>([]);
  const [total, setTotal] = useState(0);
  const [generatedLetter, setGeneratedLetter] = useState<LoanLetter | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(async (params?: { page?: number; limit?: number; search?: string; ownOnly?: boolean; departmentId?: string; programId?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await loanLetterService.getAll(params);
      setList(res.data || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch loan letters');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchById = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await loanLetterService.getById(id);
      setGeneratedLetter(res.data);
      return res.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch loan letter');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(async (data: CreateLoanLetterDto) => {
    setSaving(true);
    setError(null);
    try {
      const res = await loanLetterService.create(data);
      setGeneratedLetter(res.data);
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to generate loan letter';
      setError(msg);
      const enhancedError = new Error(msg) as Error & { existingLetter?: LoanLetter | null };
      enhancedError.existingLetter = err.response?.data?.existingLetter || null;
      throw enhancedError;
    } finally {
      setSaving(false);
    }
  }, []);

  return { list, total, generatedLetter, setGeneratedLetter, loading, saving, error, fetchList, fetchById, create };
}
