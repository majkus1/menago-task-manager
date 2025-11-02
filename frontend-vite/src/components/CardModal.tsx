import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import type { CardDto, CreateCardDto, CreateCommentDto, UserDto } from '@/types';
import { X, Trash2, MessageCircle, Paperclip, Send, Clock, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CardModalProps {
  card: CardDto | null;
  isOpen: boolean;
  onClose: () => void;
  onCreateCard?: (data: CreateCardDto, attachments?: File[]) => void;
  onUpdateCard?: (cardId: string, data: Partial<CardDto>) => void;
  currentUser?: UserDto;
  boardId?: string;
  isCreatingLoading?: boolean;
  creatingCardListId?: string | null;
}

export function CardModal({ card, isOpen, onClose, onCreateCard, onUpdateCard, currentUser, boardId, isCreatingLoading = false, creatingCardListId }: CardModalProps) {
  const { t, i18n } = useTranslation();
  const isCreating = !card;
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    title: card?.title || '',
    description: card?.description || '',
  });
  const [newComment, setNewComment] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update form data when card changes
  useEffect(() => {
    if (card) {
      setFormData({
        title: card.title || '',
        description: card.description || '',
      });
    } else {
      setFormData({
        title: '',
        description: '',
      });
    }
    // Reset attachments when card changes or modal closes
    if (!isOpen) {
      setAttachments([]);
    }
  }, [card, isOpen]);

  const createCardMutation = useMutation({
    mutationFn: (data: CreateCardDto) => apiClient.createCard(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board'] });
      onClose();
    },
  });

  // updateCardMutation is handled by parent component (BoardPage)
  // This mutation is for local updates only
  const _updateCardMutation = useMutation({
    mutationFn: ({ cardId, data }: { cardId: string; data: Partial<CardDto> }) => 
      apiClient.updateCard(cardId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
    },
  });

  const addAttachmentMutation = useMutation({
    mutationFn: ({ cardId, file }: { cardId: string; file: File }) => 
      apiClient.addAttachment(cardId, file),
    onMutate: async ({ cardId: _cardId, file }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['board', boardId] });
      
      // Snapshot previous value
      const previousBoard = queryClient.getQueryData(['board', boardId]);
      
      // Optimistically update
      if (previousBoard && card && currentUser) {
        const optimisticAttachment = {
          id: `temp-${Date.now()}`,
          fileName: file.name,
          filePath: '',
          contentType: file.type,
          fileSize: file.size,
          uploadedAt: new Date().toISOString(),
          cardId: card.id,
          uploadedBy: {
            id: currentUser.id,
            firstName: currentUser.firstName,
            lastName: currentUser.lastName,
            email: currentUser.email,
            createdAt: currentUser.createdAt,
            lastLoginAt: currentUser.lastLoginAt,
            isActive: currentUser.isActive,
          },
        };
        
        queryClient.setQueryData(['board', boardId], (old: any) => {
          if (!old) return old;
          
          return {
            ...old,
            lists: old.lists.map((list: any) => 
              list.id === card.listId 
                ? {
                    ...list,
                    cards: list.cards.map((c: any) =>
                      c.id === card.id
                        ? {
                            ...c,
                            attachments: [...(c.attachments || []), optimisticAttachment]
                          }
                        : c
                    )
                  }
                : list
            )
          };
        });
      }
      
      return { previousBoard };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousBoard) {
        queryClient.setQueryData(['board', boardId], context.previousBoard);
      }
    },
    onSuccess: () => {
      // Invalidate after a short delay to allow optimistic update to be visible
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['board', boardId] });
      }, 500);
    },
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: ({ cardId, attachmentId }: { cardId: string; attachmentId: string }) => 
      apiClient.deleteAttachment(cardId, attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
    },
  });

  const createCommentMutation = useMutation({
    mutationFn: (data: CreateCommentDto) => apiClient.createComment(data),
    onMutate: async (newComment) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['board', boardId] });
      
      // Snapshot previous value
      const previousBoard = queryClient.getQueryData(['board', boardId]);
      
      // Optimistically update
      if (previousBoard && card && currentUser) {
        const optimisticComment = {
          id: `temp-${Date.now()}`,
          content: newComment.content,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          cardId: card.id,
          user: {
            id: currentUser.id,
            firstName: currentUser.firstName,
            lastName: currentUser.lastName,
            email: currentUser.email,
            createdAt: currentUser.createdAt,
            lastLoginAt: currentUser.lastLoginAt,
            isActive: currentUser.isActive,
          },
        };
        
        queryClient.setQueryData(['board', boardId], (old: any) => {
          if (!old) return old;
          
          return {
            ...old,
            lists: old.lists.map((list: any) => 
              list.id === card.listId 
                ? {
                    ...list,
                    cards: list.cards.map((c: any) =>
                      c.id === card.id
                        ? {
                            ...c,
                            comments: [...(c.comments || []), optimisticComment]
                          }
                        : c
                    )
                  }
                : list
            )
          };
        });
      }
      
      return { previousBoard };
    },
    onError: (_err, _newComment, context) => {
      // Rollback on error
      if (context?.previousBoard) {
        queryClient.setQueryData(['board', boardId], context.previousBoard);
      }
    },
    onSuccess: () => {
      setNewComment('');
      // Invalidate after a short delay to allow optimistic update to be visible
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['board', boardId] });
      }, 500);
    },
  });

  // Check if any mutations are in progress
  const isMutating = 
    createCommentMutation.isPending || 
    addAttachmentMutation.isPending || 
    deleteAttachmentMutation.isPending;

  // Subscribe to board query to get real-time updates from cache
  const boardQuery = useQuery({
    queryKey: ['board', boardId],
    queryFn: () => apiClient.getBoard(boardId!),
    enabled: !!boardId && !!card && isOpen,
    refetchInterval: isMutating ? false : 2000, // Poll every 2 seconds when no mutations
  });

  // Get current card from cache (updates automatically with optimistic updates)
  const currentCard = useMemo(() => {
    if (!card || !boardQuery.data) return card;
    
    // Find card in board from cache
    for (const list of boardQuery.data.lists || []) {
      const foundCard = list.cards?.find((c: any) => c.id === card.id);
      if (foundCard) {
        return foundCard;
      }
    }
    return card;
  }, [card, boardQuery.data]);
  
  // Use currentCard instead of card for displaying data
  const displayCard = currentCard || card;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isCreating && onCreateCard) {
      const cardData: CreateCardDto = {
        title: formData.title,
        description: formData.description,
        listId: creatingCardListId || '',
        position: 0,
      };
      
      // Create the card with attachments
      onCreateCard(cardData, attachments);
    } else if (card && onUpdateCard) {
      onUpdateCard(card.id, {
        title: formData.title,
        description: formData.description,
      });
    }
  };

  const handleAddComment = () => {
    if (newComment.trim() && card) {
      createCommentMutation.mutate({
        content: newComment.trim(),
        cardId: card.id,
      });
    }
  };

  const handleAddAttachment = async (file: File) => {
    if (card) {
      addAttachmentMutation.mutate({ cardId: card.id, file });
    }
  };

  const handleDeleteAttachment = (attachmentId: string) => {
    if (card) {
      deleteAttachmentMutation.mutate({ cardId: card.id, attachmentId });
    }
  };

  const handleDownloadAttachment = async (attachmentId: string, fileName: string) => {
    if (card) {
      try {
        const blob = await apiClient.downloadAttachment(card.id, attachmentId);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (error) {
        console.error('Error downloading attachment:', error);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments(prev => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString(i18n.language === 'pl' ? 'pl-PL' : 'en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-gray-400 bg-opacity-20 backdrop-blur-sm flex items-center justify-center p-4 z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <Card className="border-0 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                <CardTitle className="text-lg">
                  {isCreating ? t('card.new') : t('card.edit')}
                </CardTitle>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>

            <CardContent className="space-y-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {isCreating ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                {/* Title */}
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('card.title')} *
                  </label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder={t('card.titlePlaceholder')}
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('card.description')}
                  </label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder={t('card.descriptionPlaceholder')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={4}
                  />
                </div>

                {/* File Attachments */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('card.attachments')}
                  </label>
                  
                  {/* File Input */}
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2"
                    >
                      <Paperclip className="w-4 h-4" />
                      {t('card.addFiles')}
                    </Button>
                  </div>

                  {/* Attachments List */}
                  {attachments.length > 0 && (
                    <div className="space-y-2">
                      {attachments.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                          <div className="flex items-center gap-2">
                            <Paperclip className="w-4 h-4 text-gray-500" />
                            <span className="text-sm font-medium">{file.name}</span>
                            <span className="text-xs text-gray-500">({formatFileSize(file.size)})</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeAttachment(index)}
                            className="h-6 w-6 text-red-500 hover:text-red-700"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={onClose}>
                    {t('common.cancel')}
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={!formData.title.trim() || isCreatingLoading || createCardMutation.isPending}
                  >
                    {isCreating ? (isCreatingLoading ? t('card.creatingCard') : t('card.createCard')) : t('card.saveChanges')}
                  </Button>
                </div>
              </form>
              ) : (
                /* Card View - For existing cards */
                <div className="space-y-6">
                  {/* Card Title */}
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{displayCard?.title}</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {t('card.created')} {displayCard?.createdAt ? formatDate(displayCard.createdAt) : t('common.unknown')}
                      {displayCard?.createdBy && (
                        <> {t('card.createdBy')} <span className="font-medium text-gray-700">{displayCard.createdBy.firstName} {displayCard.createdBy.lastName}</span></>
                      )}
                    </p>
                  </div>

                  {/* Card Description */}
                  {displayCard?.description && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">{t('card.description')}</h3>
                      <div className="bg-gray-50 p-4 rounded-md">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{displayCard.description}</p>
                      </div>
                    </div>
                  )}

                  {/* Attachments */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-700">{t('card.attachments')}</h3>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          files.forEach(file => handleAddAttachment(file));
                        }}
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1"
                        disabled={addAttachmentMutation.isPending}
                      >
                        <Paperclip className="w-3 h-3" />
                        {t('card.addAttachment')}
                      </Button>
                    </div>
                    
                    {displayCard?.attachments && displayCard.attachments.length > 0 ? (
                      <div className="space-y-2">
                        {displayCard.attachments.map((attachment) => (
                          <div key={attachment.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                            <div className="flex items-center gap-2">
                              <Paperclip className="w-4 h-4 text-gray-500" />
                              <span className="text-sm font-medium">{attachment.fileName}</span>
                              <span className="text-xs text-gray-500">({formatFileSize(attachment.fileSize)})</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDownloadAttachment(attachment.id, attachment.fileName)}
                                className="h-6 w-6 text-blue-500 hover:text-blue-700"
                              >
                                <FileText className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteAttachment(attachment.id)}
                                className="h-7 w-7 text-red-500 hover:text-white hover:bg-red-500 transition-colors duration-200"
                                disabled={deleteAttachmentMutation.isPending}
                                title={t('card.deleteAttachment')}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">{t('card.noAttachments')}</p>
                    )}
                  </div>

                  {/* Comments Section */}
                  <div className="border-t pt-6">
                    <div className="flex items-center gap-2 mb-4">
                      <MessageCircle className="w-5 h-5 text-gray-600" />
                      <h3 className="text-lg font-semibold">{t('card.comments')}</h3>
                    </div>

                    {/* Comments List */}
                    <div className="space-y-4 mb-4">
                      {displayCard?.comments && displayCard.comments.length > 0 ? (
                        displayCard.comments.map((comment) => (
                          <div key={comment.id} className="flex gap-3">
                            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                              {comment.user.firstName.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm">
                                  {comment.user.firstName} {comment.user.lastName}
                                </span>
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDate(comment.createdAt)}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
                                {comment.content}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500 italic text-center py-4">
                          {t('card.noComments')}
                        </p>
                      )}
                    </div>

                    {/* Add Comment */}
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <textarea
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder={t('card.addComment')}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                          rows={2}
                        />
                        <Button
                          onClick={handleAddComment}
                          disabled={!newComment.trim() || createCommentMutation.isPending}
                          className="px-3"
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      {/* Add attachment to comment */}
                      <div className="flex items-center gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            files.forEach(file => handleAddAttachment(file));
                          }}
                          className="hidden"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-1"
                          disabled={addAttachmentMutation.isPending}
                        >
                          <Paperclip className="w-3 h-3" />
                          {t('card.addAttachment')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
