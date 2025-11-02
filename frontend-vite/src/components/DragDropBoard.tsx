import React from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import type { CardDto, ListDto, MoveCardDto } from '@/types';
import { apiClient } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Plus, Trash2, Calendar, User } from 'lucide-react';
import { formatDate, getPriorityColor, getPriorityLabel } from '@/lib/utils';

interface DraggableCardProps {
  card: CardDto;
  onClick?: () => void;
  onDelete?: (cardId: string) => void;
  canDelete?: boolean;
}

function DraggableCard({ card, onClick, onDelete, canDelete }: DraggableCardProps) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`card-item cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-50' : ''} hover:shadow-md transition-shadow`}
      onClick={(e) => {
        // Prevent click when dragging
        if (!isDragging) {
          onClick?.();
        }
      }}
    >
      <div className="space-y-2">
        <h4 className="font-medium text-gray-900">{card.title}</h4>
        
        {card.description && (
          <p className="text-sm text-gray-600 line-clamp-2">
            {card.description}
          </p>
        )}

        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-2">
            {card.dueDate && (
              <div className="flex items-center space-x-1">
                <Calendar className="w-3 h-3" />
                <span>{formatDate(card.dueDate)}</span>
              </div>
            )}
          </div>
          
          {card.assignedTo && (
            <div className="flex items-center space-x-1">
              <User className="w-3 h-3" />
              <span>{card.assignedTo.firstName}</span>
            </div>
          )}
        </div>

        {card.labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {card.labels.map((label) => (
              <span
                key={label.id}
                className="px-2 py-1 text-xs rounded-full text-white"
                style={{ backgroundColor: label.color }}
              >
                {label.name}
              </span>
            ))}
          </div>
        )}

        {/* Delete button for admins */}
        {canDelete && onDelete && (
          <div className="flex justify-end pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(t('card.deleteCardConfirm', { title: card.title }))) {
                  onDelete(card.id);
                }
              }}
              className="h-7 w-7 p-0 text-red-500 hover:text-white hover:bg-red-500 transition-colors duration-200"
              title={t('card.deleteCard')}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

interface DraggableListProps {
  list: ListDto;
  onCardClick?: (card: CardDto) => void;
  onCreateCard?: (listId: string, title: string) => void;
  onOpenCardModal?: (card: CardDto) => void;
  onCreateNewCard?: (listId: string) => void;
  onDeleteCard?: (cardId: string) => void;
  onDeleteList?: (listId: string) => void;
  canDelete?: boolean;
}

function DraggableList({ list, onCardClick, onCreateCard, onOpenCardModal, onCreateNewCard, onDeleteCard, onDeleteList, canDelete }: DraggableListProps) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({
    id: list.id,
  });

  return (
    <div 
      ref={setNodeRef}
      className={`list-container flex-shrink-0 w-full md:w-72 p-4 bg-gray-50 rounded-lg border-2 transition-colors ${
        isOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">{list.title}</h3>
        <div className="flex items-center gap-1">
          {canDelete && onDeleteList && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (confirm(t('list.deleteListConfirm', { title: list.title }))) {
                  onDeleteList(list.id);
                }
              }}
              className="h-7 w-7 text-red-500 hover:text-white hover:bg-red-500 transition-colors duration-200"
              title={t('list.deleteList')}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <SortableContext items={list.cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 mb-4 min-h-[100px]">
          {list.cards.map((card) => (
            <DraggableCard
              key={card.id}
              card={card}
              onClick={() => onOpenCardModal?.(card)}
              onDelete={onDeleteCard}
              canDelete={canDelete}
            />
          ))}
          {isOver && list.cards.length === 0 && (
            <div className="h-20 border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center text-blue-500 text-sm">
              {t('list.dropCardHere')}
            </div>
          )}
        </div>
      </SortableContext>

      <Button
        variant="ghost"
        className="w-full text-gray-500 hover:text-gray-700"
        onClick={() => onCreateNewCard?.(list.id)}
      >
        <Plus className="w-4 h-4 mr-2" />
        {t('list.addCard')}
      </Button>
    </div>
  );
}

interface DragDropBoardProps {
  board: BoardDto;
  onCardClick?: (card: CardDto) => void;
  onCreateCard?: (listId: string, title: string) => void;
  onCreateList?: (title: string) => void;
  onOpenCardModal?: (card: CardDto) => void;
  onCreateNewCard?: (listId: string) => void;
  onDeleteCard?: (cardId: string) => void;
  onDeleteList?: (listId: string) => void;
  canDelete?: boolean;
}

export function DragDropBoard({ board, onCardClick, onCreateCard, onCreateList, onOpenCardModal, onCreateNewCard, onDeleteCard, onDeleteList, canDelete }: DragDropBoardProps) {
  const [activeCard, setActiveCard] = React.useState<CardDto | null>(null);
  const queryClient = useQueryClient();

  const moveCardMutation = useMutation({
    mutationFn: (data: MoveCardDto) => apiClient.moveCard(data),
    onMutate: async (data) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['board', board.id] });

      // Snapshot the previous value
      const previousBoard = queryClient.getQueryData(['board', board.id]);

      // Optimistically update the UI
      queryClient.setQueryData(['board', board.id], (old: any) => {
        if (!old) return old;

        // Find the card being moved
        const movedCard = old.lists
          .flatMap((l: any) => l.cards)
          .find((card: any) => card.id === data.cardId);

        if (!movedCard) return old;

        const updatedLists = old.lists.map((list: any) => {
          // Remove card from old list (where it currently is)
          if (list.id === movedCard.listId) {
            return {
              ...list,
              cards: list.cards.filter((card: any) => card.id !== data.cardId)
            };
          }
          // Add card to new list
          if (list.id === data.targetListId) {
            const updatedCard = {
              ...movedCard,
              listId: data.targetListId,
              position: data.position
            };
            
            const newCards = [...list.cards];
            newCards.splice(data.position, 0, updatedCard);
            
            return {
              ...list,
              cards: newCards.map((card: any, index: number) => ({
                ...card,
                position: index
              }))
            };
          }
          return list;
        });

        return {
          ...old,
          lists: updatedLists
        };
      });

      // Return a context object with the snapshotted value
      return { previousBoard };
    },
    onError: (err, data, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousBoard) {
        queryClient.setQueryData(['board', board.id], context.previousBoard);
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure we have the latest data
      queryClient.invalidateQueries({ queryKey: ['board', board.id] });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3, // Zmniejszona odległość aktywacji
      },
    })
  );

  const handleDragStart = (event: any) => {
    const { active } = event;
    const card = board.lists
      .flatMap(list => list.cards)
      .find(card => card.id === active.id);
    
    if (card) {
      setActiveCard(card);
    }
  };

  const handleDragOver = (event: any) => {
    const { active, over } = event;
    
    if (!over) return;

    const activeCard = board.lists
      .flatMap(list => list.cards)
      .find(card => card.id === active.id);

    if (!activeCard) return;

    const overId = over.id as string;
    
    // Check if dropping on a list
    const targetList = board.lists.find(list => list.id === overId);
    if (targetList && targetList.id !== activeCard.listId) {
      // Visual feedback is handled by useDroppable
      return;
    }

    // Check if dropping on another card
    const targetCard = board.lists
      .flatMap(list => list.cards)
      .find(card => card.id === overId);
    
    if (targetCard && targetCard.listId !== activeCard.listId) {
      // Visual feedback for card-to-card drops
      return;
    }
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    setActiveCard(null);

    if (!over) return;

    const activeCard = board.lists
      .flatMap(list => list.cards)
      .find(card => card.id === active.id);

    if (!activeCard) return;

    const overId = over.id as string;
    
    // Check if dropping on a list
    const targetList = board.lists.find(list => list.id === overId);
    if (targetList && targetList.id !== activeCard.listId) {
      // Move card to the end of the target list
      moveCardMutation.mutate({
        cardId: activeCard.id,
        targetListId: targetList.id,
        position: targetList.cards.length,
      });
      return;
    }

    // Check if dropping on another card
    const targetCard = board.lists
      .flatMap(list => list.cards)
      .find(card => card.id === overId);
    
    if (targetCard && targetCard.listId !== activeCard.listId) {
      // Move card to the target card's list
      moveCardMutation.mutate({
        cardId: activeCard.id,
        targetListId: targetCard.listId,
        position: targetCard.position,
      });
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col md:flex-row gap-6 overflow-x-auto pb-6">
        {board.lists.map((list) => (
          <DraggableList
            key={list.id}
            list={list}
            onCardClick={onCardClick}
            onCreateCard={onCreateCard}
            onOpenCardModal={onOpenCardModal}
            onCreateNewCard={onCreateNewCard}
            onDeleteCard={onDeleteCard}
            onDeleteList={onDeleteList}
            canDelete={canDelete}
          />
        ))}
      </div>

      <DragOverlay>
        {activeCard ? (
          <div className="card-item opacity-90 rotate-3 shadow-lg border-2 border-blue-400 bg-white">
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">{activeCard.title}</h4>
              {activeCard.description && (
                <p className="text-sm text-gray-600 line-clamp-2">
                  {activeCard.description}
                </p>
              )}
              {moveCardMutation.isPending && (
                <div className="flex items-center justify-center py-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
