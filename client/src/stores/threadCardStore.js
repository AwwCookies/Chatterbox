import { create } from 'zustand';

// Store for managing multiple thread cards
export const useThreadCardStore = create((set, get) => ({
  cards: [], // Array of { id, messageId, channelId, position, isPinned, zIndex }
  nextZIndex: 200, // Start higher than profile cards

  openCard: (messageId, channelId = null) => {
    const { cards, nextZIndex } = get();
    
    // Check if card for this thread already exists
    const existingIndex = cards.findIndex(c => c.messageId === messageId);
    if (existingIndex !== -1) {
      // Bring existing card to front
      set({
        cards: cards.map((card, i) => 
          i === existingIndex ? { ...card, zIndex: nextZIndex } : card
        ),
        nextZIndex: nextZIndex + 1,
      });
      return;
    }

    // Calculate center position with offset for cascade effect
    const centerX = Math.max(100, (window.innerWidth / 2) - 224); // 224 = half of 448px card width
    const centerY = Math.max(80, (window.innerHeight / 2) - 200);
    
    // Offset if there are other cards (cascade effect)
    const offset = (cards.length % 5) * 30;

    const newCard = {
      id: `thread-${messageId}-${Date.now()}`,
      messageId,
      channelId,
      position: { x: centerX + offset, y: centerY + offset },
      isPinned: false,
      zIndex: nextZIndex,
    };

    set({
      cards: [...cards, newCard],
      nextZIndex: nextZIndex + 1,
    });
  },

  closeCard: (id) => {
    set({ cards: get().cards.filter(c => c.id !== id) });
  },

  updatePosition: (id, position) => {
    set({
      cards: get().cards.map(card =>
        card.id === id ? { ...card, position } : card
      ),
    });
  },

  togglePin: (id) => {
    set({
      cards: get().cards.map(card =>
        card.id === id ? { ...card, isPinned: !card.isPinned } : card
      ),
    });
  },

  bringToFront: (id) => {
    const { cards, nextZIndex } = get();
    set({
      cards: cards.map(card =>
        card.id === id ? { ...card, zIndex: nextZIndex } : card
      ),
      nextZIndex: nextZIndex + 1,
    });
  },

  closeAllUnpinned: () => {
    set({ cards: get().cards.filter(c => c.isPinned) });
  },

  closeAll: () => {
    set({ cards: [] });
  },
}));

export default useThreadCardStore;
