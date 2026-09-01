import React from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import { useLayout, LayoutItem } from '../context/LayoutContext';
import { cn } from '../lib/utils';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface CustomizableGridProps {
  pageId: string;
  children: React.ReactNode;
  defaultLayout: LayoutItem[];
}

export function CustomizableGrid({ pageId, children, defaultLayout }: CustomizableGridProps) {
  const { isEditMode, getLayout, saveLayout, removeWidget } = useLayout();
  const savedLayout = getLayout(pageId);
  const currentLayout = (savedLayout && savedLayout.length > 0) ? savedLayout : defaultLayout;

  const onLayoutChange = (currentLayout: any[]) => {
    if (isEditMode) {
      saveLayout(pageId, currentLayout);
    }
  };

  // Only render children that are in the current layout
  const visibleChildren = React.Children.toArray(children).filter((child) => {
    if (!React.isValidElement(child)) return false;
    // React.Children.toArray prefixes keys with '.$' or similar. 
    // We need to strip it to match our layout IDs.
    const key = (child.key as string).replace(/^\.\$/, '');
    return currentLayout.some((item: any) => item.i === key);
  });

  return (
    <div className="min-h-[600px] w-full relative">
      <ResponsiveGridLayout
        className="layout min-h-[600px]"
      layouts={{ 
        lg: currentLayout,
        md: currentLayout,
        sm: currentLayout,
        xs: currentLayout,
        xxs: currentLayout
      }}
      breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
      cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
      rowHeight={30}
      isDraggable={isEditMode}
      isResizable={isEditMode}
      onLayoutChange={onLayoutChange}
      draggableHandle=".drag-handle"
    >
      {visibleChildren.map((child) => {
        if (!React.isValidElement(child)) return child;
        
        const key = (child.key as string).replace(/^\.\$/, '');
        return (
          <div key={key} className={cn(
            "group relative",
            isEditMode && "ring-2 ring-emerald-500/20 rounded-2xl bg-white/50"
          )}>
            {isEditMode && (
              <>
                <div className="drag-handle absolute top-2 right-2 z-50 p-1 bg-white border border-slate-200 rounded-lg cursor-move opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                    <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
                  </svg>
                </div>
                <button 
                  onClick={() => removeWidget(pageId, key)}
                  className="absolute top-2 left-2 z-50 p-1 bg-white border border-red-100 rounded-lg cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-50 text-red-500"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </>
            )}
            <div className="h-full w-full overflow-hidden">
              {child}
            </div>
          </div>
        );
      })}
      </ResponsiveGridLayout>
    </div>
  );
}
