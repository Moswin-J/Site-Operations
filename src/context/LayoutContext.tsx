import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from './AuthContext';

export interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
  static?: boolean;
  isDraggable?: boolean;
  isResizable?: boolean;
}

interface LayoutContextType {
  isEditMode: boolean;
  toggleEditMode: () => void;
  getLayout: (pageId: string) => any[] | undefined;
  saveLayout: (pageId: string, layout: any[]) => Promise<void>;
  addWidget: (pageId: string, widgetId: string, defaultProps: Partial<LayoutItem>) => Promise<void>;
  removeWidget: (pageId: string, widgetId: string) => Promise<void>;
  resetLayout: (pageId: string) => Promise<void>;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [layouts, setLayouts] = useState<Record<string, any[]>>({});
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, 'user_layouts', user.id), (snapshot) => {
      if (snapshot.exists()) {
        setLayouts(snapshot.data().layouts || {});
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `user_layouts/${user.id}`);
    });

    return () => unsubscribe();
  }, [user]);

  const toggleEditMode = () => setIsEditMode(prev => !prev);

  const getLayout = (pageId: string) => layouts[pageId];

  const saveLayout = async (pageId: string, layout: LayoutItem[]) => {
    if (!user) return;

    // Sanitize layout to remove undefined values which Firestore doesn't support
    const sanitizedLayout = layout.map(item => 
      Object.fromEntries(Object.entries(item).filter(([_, v]) => v !== undefined))
    );

    const newLayouts = { ...layouts, [pageId]: sanitizedLayout };
    try {
      await setDoc(doc(db, 'user_layouts', user.id), {
        layouts: newLayouts,
        updated_at: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `user_layouts/${user.id}`);
    }
  };

  const addWidget = async (pageId: string, widgetId: string, defaultProps: Partial<LayoutItem>) => {
    if (!user) return;
    const currentLayout = layouts[pageId] || [];
    if (currentLayout.find((item: any) => item.i === widgetId)) return;

    const newItem: LayoutItem = {
      i: widgetId,
      x: 0,
      y: Infinity, // Put at bottom
      w: defaultProps.w || 4,
      h: defaultProps.h || 4,
      ...defaultProps
    };

    await saveLayout(pageId, [...currentLayout, newItem]);
  };

  const removeWidget = async (pageId: string, widgetId: string) => {
    if (!user) return;
    const currentLayout = layouts[pageId] || [];
    const newLayout = currentLayout.filter((item: any) => item.i !== widgetId);
    await saveLayout(pageId, newLayout);
  };

  const resetLayout = async (pageId: string) => {
    if (!user) return;
    const newLayouts = { ...layouts };
    delete newLayouts[pageId];
    
    // Sanitize all layouts to remove undefined values
    const sanitizedLayouts: Record<string, any[]> = {};
    Object.entries(newLayouts).forEach(([id, layout]) => {
      sanitizedLayouts[id] = layout.map(item => 
        Object.fromEntries(Object.entries(item).filter(([_, v]) => v !== undefined))
      );
    });

    setLayouts(sanitizedLayouts);
    try {
      await setDoc(doc(db, 'user_layouts', user.id), {
        layouts: sanitizedLayouts,
        updated_at: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `user_layouts/${user.id}`);
    }
  };

  return (
    <LayoutContext.Provider value={{ isEditMode, toggleEditMode, getLayout, saveLayout, addWidget, removeWidget, resetLayout }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const context = useContext(LayoutContext);
  if (context === undefined) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
}
