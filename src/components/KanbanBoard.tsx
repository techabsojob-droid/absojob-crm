'use me';
import React, { useState } from 'react';

export interface KanbanColumn<T> {
  id: string;
  title: string;
  badgeColor?: string;
  items: T[];
}

interface UniversalKanbanBoardProps<T> {
  columns: { id: string; title: string; color?: string }[];
  items: T[];
  getItemColumnId: (item: T) => string;
  renderCard: (item: T) => React.ReactNode;
  onItemMove?: (itemId: string, sourceColId: string, targetColId: string) => void;
  title?: string;
}

export function UniversalKanbanBoard<T extends { id: string }>({
  columns,
  items,
  getItemColumnId,
  renderCard,
  onItemMove,
  title,
}: UniversalKanbanBoardProps<T>) {
  const [boardItems, setBoardItems] = useState<T[]>(items);

  // Sync state if items change
  React.useEffect(() => {
    setBoardItems(items);
  }, [items]);

  const handleDragStart = (e: React.DragEvent, id: string, colId: string) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ itemId: id, sourceColId: colId }));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetColId: string) => {
    e.preventDefault();
    const dataRaw = e.dataTransfer.getData('text/plain');
    if (!dataRaw) return;

    try {
      const { itemId, sourceColId } = JSON.parse(dataRaw);
      if (sourceColId === targetColId) return;

      if (onItemMove) {
        onItemMove(itemId, sourceColId, targetColId);
      } else {
        setBoardItems((prev) =>
          prev.map((item) => {
            if (item.id === itemId) {
              return { ...item, stage: targetColId, status: targetColId };
            }
            return item;
          })
        );
      }
    } catch (err) {
      console.error('Failed to parse drag drop data:', err);
    }
  };

  return (
    <div className="w-full space-y-4">
      {title && (
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-gray-900">{title}</h2>
        </div>
      )}

      <div className="flex w-full gap-4 overflow-x-auto pb-6 pt-2 snap-x">
        {columns.map((col) => {
          const colItems = boardItems.filter((item) => getItemColumnId(item) === col.id);

          return (
            <div
              key={col.id}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
              className="flex flex-col min-w-[300px] max-w-[340px] flex-1 rounded-xl bg-gray-100/80 border border-gray-200 p-3 shadow-xs transition-colors hover:border-gray-300"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between px-2 py-2 mb-3 border-b border-gray-200/80">
                <div className="flex items-center space-x-2">
                  <span className={`w-3 h-3 rounded-full ${col.color || 'bg-blue-500'}`} />
                  <span className="font-semibold text-sm text-gray-800 uppercase tracking-wider">
                    {col.title}
                  </span>
                </div>
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-white text-gray-700 shadow-2xs border border-gray-200">
                  {colItems.length}
                </span>
              </div>

              {/* Column Content */}
              <div className="flex-1 space-y-3 min-h-[350px] overflow-y-auto pr-1">
                {colItems.length === 0 ? (
                  <div className="h-32 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-xs text-gray-400">
                    Drop items here
                  </div>
                ) : (
                  colItems.map((item) => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, item.id, col.id)}
                      className="cursor-grab active:cursor-grabbing transform transition hover:-translate-y-0.5"
                    >
                      {renderCard(item)}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
