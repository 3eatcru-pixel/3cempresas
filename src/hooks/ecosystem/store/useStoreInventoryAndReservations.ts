import React from 'react';
import { StorageAdapter } from '../../../services/adapters/StorageAdapterTypes';
import { InventoryBatch, Reservation, Supplier } from '../../../types';
import { hasReservationConflict } from '../../../utils/storeDomain';
import {
  generateReservationId,
  generateStandardId,
  generateSupplierId,
} from '../../../utils/idGenerator';

interface UseStoreInventoryAndReservationsParams {
  adapter: StorageAdapter;
  selectedStoreId: string;
  reservations: Reservation[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  resolveActiveTenantId: (targetStoreId?: string) => string;
  showNotification: (msg: string) => void;
}

export const useStoreInventoryAndReservations = ({
  adapter,
  selectedStoreId,
  reservations,
  setSuppliers,
  resolveActiveTenantId,
  showNotification,
}: UseStoreInventoryAndReservationsParams) => {
  const addInventoryBatch = async (batch: Omit<InventoryBatch, 'id'>): Promise<boolean> => {
    try {
      const id = generateStandardId('bat');
      await adapter.saveInventoryBatch({
        ...batch,
        id,
        storeId: batch.storeId || selectedStoreId,
        tenantId: batch.tenantId || resolveActiveTenantId(batch.storeId),
      });
      showNotification('Lote de estoque registrado.');
      return true;
    } catch {
      showNotification('Erro ao registrar lote.');
      return false;
    }
  };

  const addSupplier = async (sup: Omit<Supplier, 'id'>) => {
    try {
      const id = generateSupplierId();
      await adapter.saveSupplier({
        ...sup,
        id,
        storeId: sup.storeId || selectedStoreId,
        tenantId: sup.tenantId || resolveActiveTenantId(sup.storeId || selectedStoreId),
      });
      showNotification(`Fornecedor ${sup.companyName} cadastrado!`);
    } catch {
      showNotification('Erro ao cadastrar fornecedor.');
    }
  };

  const updateSupplier = async (id: string, updates: Partial<Supplier>): Promise<boolean> => {
    try {
      let merged: Supplier | null = null;
      setSuppliers((prev) =>
        prev.map((s) => {
          if (s.id === id) {
            merged = { ...s, ...updates, id };
            return merged;
          }
          return s;
        })
      );
      if (merged) {
        await adapter.saveSupplier(merged);
      } else {
        await adapter.setDocument('suppliers', id, { ...updates, id }, true);
      }
      showNotification('Fornecedor atualizado com sucesso!');
      return true;
    } catch {
      showNotification('Erro ao atualizar fornecedor.');
      return false;
    }
  };

  const deleteSupplier = async (id: string) => {
    try {
      await adapter.deleteSupplier(id);
      setSuppliers((prev) => prev.filter((s) => s.id !== id));
      showNotification('Fornecedor removido.');
    } catch {
      showNotification('Erro ao remover fornecedor.');
    }
  };

  const addReservation = async (res: Omit<Reservation, 'id'>): Promise<boolean> => {
    try {
      const conflict = hasReservationConflict(reservations, {
        storeId: res.storeId,
        date: res.date,
        time: res.time,
        professional: res.professional,
        durationMinutes: res.durationMinutes,
      });
      if (conflict) {
        showNotification(
          `Conflito de horário: ${conflict.professional || 'Profissional'} já atende ${conflict.clientName} às ${conflict.time}.`
        );
        return false;
      }

      const id = generateReservationId();
      await adapter.saveReservation({
        ...res,
        id,
        tenantId: res.tenantId || resolveActiveTenantId(res.storeId),
      });
      showNotification(`Reserva para ${res.clientName} agendada!`);
      return true;
    } catch {
      showNotification('Erro ao agendar reserva.');
      return false;
    }
  };

  const updateReservationStatus = async (id: string, status: Reservation['status']) => {
    try {
      const target = reservations.find((r) => r.id === id);
      if (target) {
        await adapter.saveReservation({ ...target, status });
        showNotification('Status da reserva atualizado.');
      }
    } catch {
      showNotification('Erro ao atualizar reserva.');
    }
  };

  const deleteReservation = async (id: string) => {
    try {
      await adapter.deleteReservation(id);
      showNotification('Reserva removida.');
    } catch {
      showNotification('Erro ao remover reserva.');
    }
  };

  return {
    addInventoryBatch,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    addReservation,
    updateReservationStatus,
    deleteReservation,
  };
};
