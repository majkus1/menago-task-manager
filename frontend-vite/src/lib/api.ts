import axios, { type AxiosResponse } from 'axios';
import type { AxiosInstance } from 'axios';
import type {
  AuthResponseDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  RegisterTeamDto,
  UserDto,
  BoardDto,
  BoardMemberDto,
  CreateBoardDto,
  UpdateBoardDto,
  ListDto,
  CreateListDto,
  UpdateListDto,
  CardDto,
  CreateCardDto,
  UpdateCardDto,
  MoveCardDto,
  CreateCommentDto,
  UpdateCommentDto,
  CardCommentDto,
  CreateLabelDto,
  UpdateLabelDto,
  LabelDto,
  InviteUserToTeamDto,
  UpdateTeamMemberRoleDto,
  TeamDto,
  TeamMemberDto,
  TeamInvitationDto,
  AcceptInvitationDto,
  InvitationResult,
  CreateTeamDto,
} from '@/types';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    // Always use relative path - Azure Static Web Apps will proxy to backend
    // via Azure Functions Proxy configured in Azure Portal
    const apiBaseUrl = '/api';
    
    this.client = axios.create({
      baseURL: apiBaseUrl,
      timeout: 10000,
      withCredentials: true, // Send cookies with requests (same-site now, works on mobile)
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Remove token interceptor - cookies are sent automatically
    // Response interceptor to handle auth errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Only redirect for auth-related endpoints, not for every 401
          const authEndpoints = ['/auth/me'];
          const isAuthEndpoint = authEndpoints.some(endpoint => 
            error.config?.url?.includes(endpoint)
          );
          
          // Don't redirect if we're already on login/register/forgot-password/reset-password page or invitation page
          const isPublicPage = ['/login', '/register', '/forgot-password', '/reset-password'].includes(window.location.pathname) ||
                              window.location.pathname.startsWith('/invitation');
          
          // Only redirect if it's an auth endpoint and we're not on a public page
          // Add small delay to prevent race conditions during page load
          if (isAuthEndpoint && !isPublicPage) {
            // Use setTimeout to prevent immediate redirect during initialization
            setTimeout(() => {
              const currentPath = window.location.pathname;
              if (currentPath !== '/login' && 
                  currentPath !== '/register' &&
                  currentPath !== '/forgot-password' &&
                  currentPath !== '/reset-password' &&
                  !currentPath.startsWith('/invitation')) {
                window.location.href = '/login';
              }
            }, 100);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async registerTeam(data: RegisterTeamDto): Promise<AuthResponseDto> {
    const response: AxiosResponse<AuthResponseDto> = await this.client.post(
      '/auth/register-team',
      data
    );
    return response.data;
  }

  async login(data: LoginDto): Promise<AuthResponseDto> {
    const response: AxiosResponse<AuthResponseDto> = await this.client.post(
      '/auth/login',
      data
    );
    return response.data;
  }

  async getCurrentUser(): Promise<UserDto> {
    const response: AxiosResponse<UserDto> = await this.client.get('/auth/me');
    return response.data;
  }

  async logout(): Promise<void> {
    await this.client.post('/auth/logout');
  }

  async inviteUser(data: InviteUserToTeamDto): Promise<void> {
    await this.client.post('/auth/invite-user', data);
  }

  async forgotPassword(data: ForgotPasswordDto): Promise<void> {
    await this.client.post('/auth/forgot-password', data);
  }

  async resetPassword(data: ResetPasswordDto): Promise<void> {
    await this.client.post('/auth/reset-password', data);
  }

  // Board endpoints
  async getBoards(): Promise<BoardDto[]> {
    const response: AxiosResponse<BoardDto[]> = await this.client.get('/boards');
    return response.data;
  }

  async getBoard(id: string): Promise<BoardDto> {
    const response: AxiosResponse<BoardDto> = await this.client.get(`/boards/${id}`);
    return response.data;
  }

  async createBoard(data: CreateBoardDto): Promise<BoardDto> {
    const response: AxiosResponse<BoardDto> = await this.client.post('/boards', data);
    return response.data;
  }

  async updateBoard(id: string, data: UpdateBoardDto): Promise<BoardDto> {
    const response: AxiosResponse<BoardDto> = await this.client.put(`/boards/${id}`, data);
    return response.data;
  }

  async deleteBoard(id: string): Promise<void> {
    await this.client.delete(`/boards/${id}`);
  }

  // List endpoints
  async createList(data: CreateListDto): Promise<ListDto> {
    const response: AxiosResponse<ListDto> = await this.client.post('/lists', data);
    return response.data;
  }

  async updateList(id: string, data: UpdateListDto): Promise<ListDto> {
    const response: AxiosResponse<ListDto> = await this.client.put(`/lists/${id}`, data);
    return response.data;
  }

  async deleteList(id: string): Promise<void> {
    await this.client.delete(`/lists/${id}`);
  }

  // Card endpoints
  async createCard(data: CreateCardDto): Promise<CardDto> {
    const response: AxiosResponse<CardDto> = await this.client.post('/cards', data);
    return response.data;
  }

  async updateCard(id: string, data: UpdateCardDto): Promise<CardDto> {
    const response: AxiosResponse<CardDto> = await this.client.put(`/cards/${id}`, data);
    return response.data;
  }

  async moveCard(data: MoveCardDto): Promise<CardDto> {
    const response: AxiosResponse<CardDto> = await this.client.post('/cards/move', data);
    return response.data;
  }

  async deleteCard(id: string): Promise<void> {
    await this.client.delete(`/cards/${id}`);
  }

  // Attachment endpoints
  async addAttachment(cardId: string, file: File): Promise<void> {
    const formData = new FormData();
    formData.append('file', file);
    
    await this.client.post(`/cards/${cardId}/attachments`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  async downloadAttachment(cardId: string, attachmentId: string): Promise<Blob> {
    const response = await this.client.get(
      `/cards/${cardId}/attachments/${attachmentId}/download`,
      { responseType: 'blob' }
    );
    return response.data;
  }

  async deleteAttachment(cardId: string, attachmentId: string): Promise<void> {
    await this.client.delete(`/cards/${cardId}/attachments/${attachmentId}`);
  }

  // Comment endpoints
  async createComment(data: CreateCommentDto): Promise<CardCommentDto> {
    const response: AxiosResponse<CardCommentDto> = await this.client.post('/comments', data);
    return response.data;
  }

  async updateComment(id: string, data: UpdateCommentDto): Promise<CardCommentDto> {
    const response: AxiosResponse<CardCommentDto> = await this.client.put(`/comments/${id}`, data);
    return response.data;
  }

  async deleteComment(id: string): Promise<void> {
    await this.client.delete(`/comments/${id}`);
  }

  // Label endpoints
  async createLabel(data: CreateLabelDto): Promise<LabelDto> {
    const response: AxiosResponse<LabelDto> = await this.client.post('/labels', data);
    return response.data;
  }

  async updateLabel(id: string, data: UpdateLabelDto): Promise<LabelDto> {
    const response: AxiosResponse<LabelDto> = await this.client.put(`/labels/${id}`, data);
    return response.data;
  }

  async deleteLabel(id: string): Promise<void> {
    await this.client.delete(`/labels/${id}`);
  }

  // Team endpoints
  async getTeams(): Promise<TeamDto[]> {
    const response: AxiosResponse<TeamDto[]> = await this.client.get('/teams');
    return response.data;
  }

  async getTeam(id: string): Promise<TeamDto> {
    const response: AxiosResponse<TeamDto> = await this.client.get(`/teams/${id}`);
    return response.data;
  }

  async getTeamMembers(teamId: string): Promise<TeamMemberDto[]> {
    const response: AxiosResponse<TeamMemberDto[]> = await this.client.get(`/teams/${teamId}/members`);
    return response.data;
  }

  async createTeam(data: CreateTeamDto): Promise<TeamDto> {
    const response: AxiosResponse<TeamDto> = await this.client.post('/teams', data);
    return response.data;
  }

  async deleteTeam(id: string): Promise<void> {
    await this.client.delete(`/teams/${id}`);
  }

  async inviteUserToTeam(data: InviteUserToTeamDto): Promise<InvitationResult> {
    const response: AxiosResponse<InvitationResult> = await this.client.post('/teams/invite-user', data);
    return response.data;
  }

  async updateTeamMemberRole(teamId: string, memberUserId: string, data: UpdateTeamMemberRoleDto): Promise<void> {
    await this.client.post(`/teams/${teamId}/members/${memberUserId}/role`, data);
  }

  async removeTeamMember(teamId: string, memberUserId: string): Promise<void> {
    await this.client.delete(`/teams/${teamId}/members/${memberUserId}`);
  }

  // Board member endpoints
  async addBoardMember(boardId: string, userId: string): Promise<void> {
    await this.client.post(`/boards/${boardId}/members`, { userId });
  }

  async removeBoardMember(boardId: string, memberUserId: string): Promise<void> {
    await this.client.delete(`/boards/${boardId}/members/${memberUserId}`);
  }

  async getBoardMembers(boardId: string): Promise<BoardMemberDto[]> {
    const response: AxiosResponse<BoardMemberDto[]> = await this.client.get(`/boards/${boardId}/members`);
    return response.data;
  }

  async getTeamMembersForBoard(boardId: string): Promise<TeamMemberDto[]> {
    const response: AxiosResponse<TeamMemberDto[]> = await this.client.get(`/boards/${boardId}/team-members`);
    return response.data;
  }

  async fixExistingBoards(): Promise<{ message: string; fixedCount: number }> {
    const response: AxiosResponse<{ message: string; fixedCount: number }> = await this.client.post('/boards/fix-existing-boards');
    return response.data;
  }

  // Invitation endpoints
  async acceptInvitation(data: AcceptInvitationDto): Promise<AuthResponseDto> {
    const response: AxiosResponse<AuthResponseDto> = await this.client.post('/invitations/accept', data);
    return response.data;
  }

  async getPendingInvitations(email: string): Promise<TeamInvitationDto[]> {
    const response: AxiosResponse<TeamInvitationDto[]> = await this.client.get(`/invitations/pending/${email}`);
    return response.data;
  }

  async validateInvitationToken(token: string): Promise<{ isValid: boolean }> {
    const response: AxiosResponse<{ isValid: boolean }> = await this.client.get(`/invitations/validate/${token}`);
    return response.data;
  }
}

export const apiClient = new ApiClient();
