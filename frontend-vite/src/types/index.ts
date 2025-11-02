// Auth Types
export interface RegisterTeamDto {
  teamName: string;
  teamDescription?: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface ForgotPasswordDto {
  email: string;
  language?: string;
}

export interface ResetPasswordDto {
  token: string;
  email: string;
  newPassword: string;
}

export interface InviteUserToTeamDto {
  email: string;
  teamId: string;
  language?: string;
}

export interface AddBoardMemberDto {
  boardId: string;
  userId: string;
  role?: BoardRole;
}

export interface RemoveBoardMemberDto {
  boardId: string;
  userId: string;
}

export interface UpdateTeamMemberRoleDto {
  teamMemberId: string;
  role: TeamRole;
}

export enum TeamRole {
  Member = 0,
  Admin = 1,
  Owner = 2
}

export enum BoardRole {
  Member = 0,
  Admin = 1,
  Owner = 2
}

export interface AuthResponseDto {
  token: string;
  expiresAt: string;
  user: UserDto;
}

export interface UserDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: string;
  lastLoginAt?: string;
  isActive: boolean;
}

// Board Types
export interface CreateBoardDto {
  title: string;
  description?: string;
  color?: string;
  teamId?: string;
  memberUserIds?: string[];
  addAllTeamMembers?: boolean;
}

export interface UpdateBoardDto {
  title?: string;
  description?: string;
  color?: string;
  isArchived?: boolean;
}

export interface BoardDto {
  id: string;
  title: string;
  description?: string;
  color: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  owner: UserDto;
  team?: TeamDto;
  lists: ListDto[];
  members: BoardMemberDto[];
}

export interface BoardMemberDto {
  id: string;
  userId: string;
  boardId: string;
  role: BoardRole;
  joinedAt: string;
  isActive: boolean;
  user: UserDto;
}

// List Types
export interface CreateListDto {
  title: string;
  boardId: string;
  position?: number;
}

export interface UpdateListDto {
  title?: string;
  position?: number;
  isArchived?: boolean;
}

export interface ListDto {
  id: string;
  title: string;
  position: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  boardId: string;
  cards: CardDto[];
}

// Card Types
export enum CardPriority {
  Low = 0,
  Medium = 1,
  High = 2,
  Critical = 3,
}

export interface CreateCardDto {
  title: string;
  description?: string;
  listId: string;
  position?: number;
  priority?: CardPriority;
  dueDate?: string;
  assignedToId?: string;
}

export interface UpdateCardDto {
  title?: string;
  description?: string;
  position?: number;
  priority?: CardPriority;
  dueDate?: string;
  assignedToId?: string;
  isArchived?: boolean;
}

export interface MoveCardDto {
  cardId: string;
  targetListId: string;
  position: number;
}

export interface CardDto {
  id: string;
  title: string;
  description?: string;
  position: number;
  priority: CardPriority;
  dueDate?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  listId: string;
  createdBy: UserDto;
  assignedTo?: UserDto;
  labels: LabelDto[];
  comments: CardCommentDto[];
  attachments: CardAttachmentDto[];
}

// Comment Types
export interface CreateCommentDto {
  content: string;
  cardId: string;
}

export interface UpdateCommentDto {
  content?: string;
}

export interface CardCommentDto {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  cardId: string;
  user: UserDto;
}

// Label Types
export interface CreateLabelDto {
  name: string;
  color: string;
  boardId: string;
}

export interface UpdateLabelDto {
  name?: string;
  color?: string;
}

export interface LabelDto {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  boardId: string;
}

// Attachment Types
export interface CardAttachmentDto {
  id: string;
  fileName: string;
  filePath: string;
  contentType: string;
  fileSize: number;
  uploadedAt: string;
  cardId: string;
  uploadedBy: UserDto;
}

// Team Types
export interface CreateTeamDto {
  name: string;
  description?: string;
}

export interface TeamDto {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  owner: UserDto;
  members: TeamMemberDto[];
  boards: BoardDto[];
}

export interface TeamMemberDto {
  id: string;
  userId: string;
  teamId: string;
  role: TeamRole;
  joinedAt: string;
  isActive: boolean;
  user: UserDto;
}

// API Response Types
export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}

// Invitation Types
export interface TeamInvitationDto {
  id: string;
  email: string;
  teamId: string;
  teamName: string;
  invitedByUserName: string;
  createdAt: string;
  expiresAt: string;
  isAccepted: boolean;
  isExpired: boolean;
}

export interface AcceptInvitationDto {
  token: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface InvitationResult {
  success: boolean;
  message: string;
  requiresRegistration: boolean;
}
