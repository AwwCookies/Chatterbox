import { create } from 'zustand';

export const useUIStore = create((set) => ({
  // Modal/panel visibility states
  settingsModalOpen: false,
  apiDebugPanelOpen: false,
  
  // Actions
  openSettingsModal: () => set({ settingsModalOpen: true }),
  closeSettingsModal: () => set({ settingsModalOpen: false }),
  toggleSettingsModal: () => set((state) => ({ settingsModalOpen: !state.settingsModalOpen })),
  
  openApiDebugPanel: () => set({ apiDebugPanelOpen: true }),
  closeApiDebugPanel: () => set({ apiDebugPanelOpen: false }),
  toggleApiDebugPanel: () => set((state) => ({ apiDebugPanelOpen: !state.apiDebugPanelOpen })),
  
  // Close all
  closeAll: () => set({ settingsModalOpen: false, apiDebugPanelOpen: false }),
}));
