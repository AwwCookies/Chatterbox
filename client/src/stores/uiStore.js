import { create } from 'zustand';

export const useUIStore = create((set) => ({
  // Modal/panel visibility states
  settingsModalOpen: false,
  
  // Actions
  openSettingsModal: () => set({ settingsModalOpen: true }),
  closeSettingsModal: () => set({ settingsModalOpen: false }),
  toggleSettingsModal: () => set((state) => ({ settingsModalOpen: !state.settingsModalOpen })),
  
  // Close all
  closeAll: () => set({ settingsModalOpen: false }),
}));
