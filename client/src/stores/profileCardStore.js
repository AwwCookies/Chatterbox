import { create } from 'zustand';

// Store for managing multiple profile cards
export const useProfileCardStore = create((set, get) => ({
  cards: [], // Array of { id, username, position, isPinned, zIndex }
  nextZIndex: 100,

  openCard: (username) => {
    const { cards, nextZIndex } = get();
    
    // Check if card for this user already exists
    const existingIndex = cards.findIndex(c => c.username === username);
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

    // Calculate center position
    const centerX = Math.max(100, (window.innerWidth / 2) - 192); // 192 = half of 384px card width
    const centerY = Math.max(100, (window.innerHeight / 2) - 250); // Approximate half height
    
    // Offset if there are other cards (cascade effect)
    const offset = (cards.length % 5) * 30;

    const newCard = {
      id: `${username}-${Date.now()}`,
      username,
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

export default useProfileCardStore;
