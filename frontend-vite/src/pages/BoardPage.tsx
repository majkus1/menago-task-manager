import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import type { CreateListDto, CreateCardDto, BoardDto, CardDto } from '@/types';
import { BoardRole } from '@/types';
import { ArrowLeft, Plus, Users, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { DragDropBoard } from '@/components/DragDropBoard';
import { BoardMemberManagement } from '@/components/BoardMemberManagement';
import { CardModal } from '@/components/CardModal';
import { useAuth } from '@/contexts/AuthContext';

export function BoardPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [newListTitle, setNewListTitle] = useState('');
  const [showCreateList, setShowCreateList] = useState(false);
  const [showMemberManagement, setShowMemberManagement] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardDto | null>(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const [isCreatingCard, setIsCreatingCard] = useState(false);
  const [creatingCardListId, setCreatingCardListId] = useState<string | null>(null);
  const [isCreatingCardLoading, setIsCreatingCardLoading] = useState(false);

  const { data: board, isLoading: boardLoading, error: boardError } = useQuery({
    queryKey: ['board', id],
    queryFn: () => apiClient.getBoard(id!),
    enabled: !!id,
    retry: false, // Don't retry on 404 - board doesn't exist
  });

  // Handle 404 - board was deleted or doesn't exist
  useEffect(() => {
    if (boardError && (boardError as any)?.response?.status === 404) {
      // Remove the board from cache and redirect
      queryClient.removeQueries({ queryKey: ['board', id] });
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === 'boards'
      });
      navigate('/dashboard');
    }
  }, [boardError, id, navigate, queryClient]);

  // Check permissions
  const isBoardOwner = board?.owner.id === user?.id;
  const isTeamOwner = board?.team?.owner.id === user?.id;
  const isTeamAdmin = board?.team?.members.find(m => m.user.id === user?.id)?.role === 1;
  const canManageBoard = isBoardOwner || isTeamOwner || isTeamAdmin;

  const createListMutation = useMutation({
    mutationFn: (data: CreateListDto) => apiClient.createList(data),
    onMutate: async (data) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['board', id] });

      // Snapshot the previous value
      const previousBoard = queryClient.getQueryData(['board', id]);

      // Optimistically update the UI
      queryClient.setQueryData(['board', id], (old: any) => {
        if (!old) return old;

        const newList = {
          id: `temp-${Date.now()}`, // Temporary ID
          title: data.title,
          position: data.position,
          isArchived: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          boardId: data.boardId,
          cards: []
        };

        return {
          ...old,
          lists: [...old.lists, newList]
        };
      });

      // Clear form immediately
      setNewListTitle('');
      setShowCreateList(false);

      return { previousBoard };
    },
    onError: (err, _data, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousBoard) {
        queryClient.setQueryData(['board', id], context.previousBoard);
      }
      console.error('Error creating list:', err);
      const errorMessage = err instanceof Error ? err.message : t('alerts.unknownError');
      alert(t('alerts.createListError') + ': ' + errorMessage);
    },
    onSettled: () => {
      // Always refetch after error or success to ensure we have the latest data
      queryClient.invalidateQueries({ queryKey: ['board', id] });
    },
  });

  const createCardMutation = useMutation({
    mutationFn: (data: CreateCardDto) => apiClient.createCard(data),
    onMutate: async (data) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['board', id] });

      // Snapshot the previous value
      const previousBoard = queryClient.getQueryData(['board', id]);

      // Optimistically update the UI
      queryClient.setQueryData(['board', id], (old: any) => {
        if (!old) return old;

        const newCard = {
          id: `temp-${Date.now()}`, // Temporary ID
          title: data.title,
          description: '',
          position: data.position,
          priority: 0,
          dueDate: null,
          isArchived: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          listId: data.listId,
          createdBy: {
            id: 'current-user',
            firstName: 'Ty',
            lastName: '',
            email: 'user@example.com',
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
            isActive: true
          },
          assignedTo: null,
          labels: [],
          comments: [],
          attachments: []
        };

        return {
          ...old,
          lists: old.lists.map((list: any) => {
            if (list.id === data.listId) {
              return {
                ...list,
                cards: [...list.cards, newCard]
              };
            }
            return list;
          })
        };
      });

      return { previousBoard };
    },
    onError: (err, _data, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousBoard) {
        queryClient.setQueryData(['board', id], context.previousBoard);
      }
      console.error('Error creating card:', err);
      const errorMessage = err instanceof Error ? err.message : t('alerts.unknownError');
      alert(t('alerts.createCardError') + ': ' + errorMessage);
    },
    onSettled: () => {
      // Always refetch after error or success to ensure we have the latest data
      queryClient.invalidateQueries({ queryKey: ['board', id] });
    },
  });

  const updateCardMutation = useMutation({
    mutationFn: ({ cardId, data }: { cardId: string; data: Partial<CardDto> }) => 
      apiClient.updateCard(cardId, data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', id] });
    },
    onError: (error) => {
      console.error('Error updating card:', error);
      alert(t('alerts.updateCardError') || 'Error updating card');
    },
  });

  const deleteCardMutation = useMutation({
    mutationFn: (cardId: string) => apiClient.deleteCard(cardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', id] });
    },
    onError: (error) => {
      console.error('Error deleting card:', error);
      alert(t('alerts.deleteCardError'));
    },
  });

  const deleteListMutation = useMutation({
    mutationFn: (listId: string) => apiClient.deleteList(listId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', id] });
    },
    onError: (error) => {
      console.error('Error deleting list:', error);
      alert(t('alerts.deleteListError'));
    },
  });

  const deleteBoardMutation = useMutation({
    mutationFn: () => apiClient.deleteBoard(id!),
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['boards'] });
      await queryClient.cancelQueries({ queryKey: ['board', id] });

      // Snapshot the previous values
      const previousBoard = queryClient.getQueryData<BoardDto>(['board', id]);
      
      // Get all boards cache keys that might exist for rollback
      const allBoardsCaches: Array<{ key: any[]; cache: any }> = [];
      
      // Snapshot all boards caches for potential rollback
      queryClient.getQueriesData({ predicate: (query) => query.queryKey[0] === 'boards' }).forEach(([key, data]) => {
        if (data && Array.isArray(data)) {
          allBoardsCaches.push({ key: key as any[], cache: data });
        }
      });

      // Optimistically remove the board from ALL boards caches using setQueriesData
      // This will update ['boards'], ['boards', teamId], and any other variations
      queryClient.setQueriesData(
        { predicate: (query) => query.queryKey[0] === 'boards' },
        (old: any) => {
          if (!old || !Array.isArray(old)) return old;
          return old.filter((b: any) => b.id !== id);
        }
      );

      // Also remove the board cache completely
      queryClient.removeQueries({ queryKey: ['board', id] });

      return { previousBoard, previousBoardsCaches: allBoardsCaches };
    },
    onSuccess: async () => {
      // Invalidate all board-related queries to ensure consistency
      // This will invalidate ['boards'], ['boards', teamId], and any other variations
      await queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return key[0] === 'boards' || (key[0] === 'board' && key[1] === id);
        }
      });
      
      // Force refetch boards list immediately to ensure fresh data when navigating to dashboard
      await queryClient.refetchQueries({ 
        predicate: (query) => query.queryKey[0] === 'boards'
      });
      
      // Navigate after cache is updated and data is refetched
      navigate('/dashboard');
    },
    onError: (error, _variables, context) => {
      // Rollback on error - restore previous board cache
      if (context?.previousBoard) {
        queryClient.setQueryData(['board', id], context.previousBoard);
      }
      // Restore boards caches
      if (context?.previousBoardsCaches) {
        context.previousBoardsCaches.forEach(({ key, cache }) => {
          queryClient.setQueryData(key, cache);
        });
      }
      console.error('Error deleting board:', error);
      alert(t('alerts.deleteBoardError'));
    },
  });

  const handleCreateList = (title?: string) => {
    const listTitle = title || newListTitle.trim();
    
    if (!listTitle) {
      return;
    }
    
    if (!id) {
      return;
    }
    
    const createListData = {
      title: listTitle,
      boardId: id,
      position: board?.lists.length || 0,
    };
    createListMutation.mutate(createListData);
  };

  const handleCreateCard = (listId: string, title: string) => {
    if (title.trim()) {
      createCardMutation.mutate({
        title: title.trim(),
        listId,
        position: 0,
      });
    }
  };

  const handleCreateCardFromModal = async (data: CreateCardDto, attachments?: File[]) => {
    setIsCreatingCardLoading(true);
    try {
      // Create the card first
      const createdCard = await apiClient.createCard(data);
      
      // Upload attachments if any
      if (attachments && attachments.length > 0) {
        for (const file of attachments) {
          await apiClient.addAttachment(createdCard.id, file);
        }
      }
      
      // Refresh the board data
      await queryClient.invalidateQueries({ queryKey: ['board', id] });
      
      // Close modal and reset state after success
      setShowCardModal(false);
      setIsCreatingCard(false);
      setCreatingCardListId(null);
      setIsCreatingCardLoading(false);
    } catch (error) {
      console.error('Error creating card with attachments:', error);
      setIsCreatingCardLoading(false);
      // Don't close modal on error - let user retry
    }
  };

  const handleUpdateCard = (cardId: string, data: Partial<CardDto>) => {
    updateCardMutation.mutate({ cardId, data });
    setShowCardModal(false);
    setSelectedCard(null);
  };

  const handleOpenCardModal = (card: CardDto) => {
    setSelectedCard(card);
    setShowCardModal(true);
    setIsCreatingCard(false);
  };

  const handleCreateNewCard = (listId: string) => {
    setCreatingCardListId(listId);
    setSelectedCard(null);
    setShowCardModal(true);
    setIsCreatingCard(true);
  };

  const handleDeleteCard = (cardId: string) => {
    deleteCardMutation.mutate(cardId);
  };

  const handleDeleteList = (listId: string) => {
    deleteListMutation.mutate(listId);
  };

  const handleCloseCardModal = () => {
    setShowCardModal(false);
    setSelectedCard(null);
    setIsCreatingCard(false);
    setCreatingCardListId(null);
  };

  if (boardLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('board.loading')}</p>
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('board.notFound')}</h2>
          <Button onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('board.backToDashboard')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t('board.back')}
              </Button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{board.title}</h1>
                {board.description && (
                  <p className="text-sm text-gray-600">{board.description}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowMemberManagement(true)}
                className="flex items-center gap-2"
              >
                <Users className="w-4 h-4" />
                {t('board.members')} ({board.members.length})
              </Button>
              
              {canManageBoard && (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (confirm(t('board.deleteConfirm'))) {
                      deleteBoardMutation.mutate();
                    }
                  }}
                  disabled={deleteBoardMutation.isPending}
                  className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                  {deleteBoardMutation.isPending ? t('board.deleting') : t('board.deleteBoard')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Board Content */}
      <main className="p-6">
        <DragDropBoard
          board={board}
          onCreateCard={handleCreateCard}
          onCreateList={handleCreateList}
          onOpenCardModal={handleOpenCardModal}
          onCreateNewCard={handleCreateNewCard}
          onDeleteCard={handleDeleteCard}
          onDeleteList={handleDeleteList}
          canDelete={canManageBoard}
        />

        {/* Create New List */}
        {showCreateList && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-6"
          >
            <Card>
              <CardHeader>
                <CardTitle>{t('board.createNewList')}</CardTitle>
                <CardDescription>
                  {t('board.createListSubtitle')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Input
                    placeholder={t('board.listNamePlaceholder')}
                    value={newListTitle}
                    onChange={(e) => setNewListTitle(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreateList();
                      }
                    }}
                    className="flex-1 w-full"
                    autoFocus
                  />
                  <div className="flex gap-2 sm:flex-row">
                    <Button
                      onClick={() => handleCreateList()}
                      disabled={!newListTitle.trim() || createListMutation.isPending}
                      className="flex-1 sm:flex-none"
                    >
                      {createListMutation.isPending ? t('board.creating') : t('board.addList')}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowCreateList(false);
                        setNewListTitle('');
                      }}
                      className="flex-1 sm:flex-none"
                    >
                      {t('common.cancel')}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {!showCreateList && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6"
          >
            <Button
              variant="outline"
              className="h-12 w-64 text-gray-500 hover:text-gray-700"
              onClick={() => setShowCreateList(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('board.addAnotherList')}
            </Button>
          </motion.div>
        )}
      </main>

      {/* Member Management Modal */}
      {showMemberManagement && board && user && (
        <BoardMemberManagement
          boardId={board.id}
          teamId={board.team?.id}
          currentUserRole={
            board.members.find(m => m.userId === user.id)?.role as BoardRole || 
            (isBoardOwner ? BoardRole.Owner : 
             (isTeamOwner || isTeamAdmin ? BoardRole.Admin : BoardRole.Member))
          }
          onClose={() => setShowMemberManagement(false)}
        />
      )}

      {/* Card Modal */}
      <CardModal
        card={isCreatingCard ? null : selectedCard}
        isOpen={showCardModal}
        onClose={handleCloseCardModal}
        onCreateCard={isCreatingCard ? (data, attachments) => {
          const cardData = { ...data, listId: creatingCardListId || data.listId };
          handleCreateCardFromModal(cardData, attachments);
        } : undefined}
        onUpdateCard={!isCreatingCard ? handleUpdateCard : undefined}
        currentUser={user || undefined}
        boardId={id}
        isCreatingLoading={isCreatingCardLoading}
        creatingCardListId={creatingCardListId}
      />
    </div>
  );
}
