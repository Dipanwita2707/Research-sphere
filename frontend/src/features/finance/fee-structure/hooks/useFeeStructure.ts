import { useState, useCallback } from 'react';
import {
  feeStructureService,
  FeeStructure,
  CreateAcademicBatchDto,
  CreateFeeStructureDto,
  UpdateFeeStructureDto,
} from '../services/feeStructure.service';

export function useFeeStructure() {
  const [list, setList] = useState<FeeStructure[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async (params?: { type?: string; batchYear?: number; programId?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await feeStructureService.getAll(params);
      setList(res.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch fee structures');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchForProgram = useCallback(async (programId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await feeStructureService.getForProgram(programId);
      setList(res.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch fee structures');
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(async (data: CreateFeeStructureDto) => {
    setSaving(true);
    setError(null);
    try {
      const res = await feeStructureService.create(data);
      return res;
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to create fee structure';
      setError(msg);
      throw new Error(msg);
    } finally {
      setSaving(false);
    }
  }, []);

  const createAcademicBatch = useCallback(async (data: CreateAcademicBatchDto) => {
    setSaving(true);
    setError(null);
    try {
      const res = await feeStructureService.createAcademicBatch(data);
      return res;
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to create academic fee structures';
      setError(msg);
      throw new Error(msg);
    } finally {
      setSaving(false);
    }
  }, []);

  const update = useCallback(async (id: string, data: UpdateFeeStructureDto) => {
    setSaving(true);
    setError(null);
    try {
      const res = await feeStructureService.update(id, data);
      return res;
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to update fee structure';
      setError(msg);
      throw new Error(msg);
    } finally {
      setSaving(false);
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    setSaving(true);
    setError(null);
    try {
      await feeStructureService.remove(id);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to delete fee structure';
      setError(msg);
      throw new Error(msg);
    } finally {
      setSaving(false);
    }
  }, []);

  return { list, loading, saving, error, fetchAll, fetchForProgram, create, createAcademicBatch, update, remove };
}
