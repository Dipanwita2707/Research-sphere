import api from '@/shared/api/api';
import logger from '@/shared/utils/logger';

export interface EditSuggestion {
  id: string;
  iprApplicationId: string;
  reviewerId: string;
  fieldName: string;
  fieldPath?: string;
  originalValue?: string;
  suggestedValue?: string;
  suggestionNote?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'superseded';
  applicantResponse?: string;
  reviewedAt?: string;
  respondedAt?: string;
  createdAt: string;
  updatedAt: string;
  reviewer: {
    uid: string;
    employeeDetails?: {
      displayName?: string;
      firstName?: string;
      lastName?: string;
    };
  };
}

export interface CollaborativeSession {
  id: string;
  iprApplicationId: string;
  reviewerId: string;
  sessionData: any;
  isActive: boolean;
  startedAt: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EditSuggestionResponse {
  suggestions: EditSuggestion[];
  groupedSuggestions: Record<string, EditSuggestion[]>;
  summary: {
    total: number;
    pending: number;
    accepted: number;
    rejected: number;
  };
}

export interface BatchSuggestion {
  fieldName: string;
  fieldPath?: string;
  originalValue?: string;
  suggestedValue: string;
  suggestionNote?: string;
}

export interface BatchResponse {
  suggestionId: string;
  action: 'accept' | 'reject';
  response?: string;
}

export interface ReviewHistoryData {
  reviews: any[];
  suggestions: EditSuggestion[];
  workflowHistory: any[];
  summary: {
    totalReviews: number;
    totalSuggestions: number;
    pendingSuggestions: number;
    acceptedSuggestions: number;
    rejectedSuggestions: number;
  };
}

class CollaborativeEditingService {
  /**
   * Start a collaborative editing session
   */
  async startCollaborativeSession(iprApplicationId: string) {
    const response = await api.post(`/collaborative-editing/sessions/${iprApplicationId}/start`);
    return response.data;
  }

  /**
   * Get current collaborative editing session
   */
  async getCollaborativeSession(iprApplicationId: string) {
    const response = await api.get(`/collaborative-editing/sessions/${iprApplicationId}`);
    return response.data;
  }

  /**
   * End collaborative editing session
   */
  async endCollaborativeSession(sessionId: string) {
    const response = await api.post(`/collaborative-editing/sessions/${sessionId}/end`);
    return response.data;
  }

  /**
   * Create an edit suggestion (individual - legacy)
   */
  async createEditSuggestion(iprApplicationId: string, suggestion: BatchSuggestion) {
    const response = await api.post(
      `/collaborative-editing/${iprApplicationId}/suggestions`,
      suggestion
    );
    return response.data;
  }

  /**
   * Submit batch suggestions (Reviewer submits all at once)
   */
  async submitBatchSuggestions(iprApplicationId: string, suggestions: BatchSuggestion[], reviewComments?: string) {
    const response = await api.post(
      `/collaborative-editing/${iprApplicationId}/suggestions/batch`,
      { suggestions, reviewComments }
    );
    return response.data;
  }

  /**
   * Get edit suggestions for an IPR application
   */
  async getEditSuggestions(iprApplicationId: string, status?: string): Promise<{ data: EditSuggestionResponse }> {
    const params = status ? { status } : {};
    const response = await api.get(`/collaborative-editing/${iprApplicationId}/suggestions`, { params });
    return response.data;
  }

  /**
   * Respond to an edit suggestion (accept/reject) - Individual
   */
  async respondToSuggestion(suggestionId: string, action: 'accept' | 'reject', response?: string) {
    const responseData = await api.post(`/collaborative-editing/suggestions/${suggestionId}/respond`, {
      action,
      response
    });
    return responseData.data;
  }

  /**
   * Respond to all suggestions at once (Applicant batch response)
   */
  async respondToBatchSuggestions(iprApplicationId: string, responses: BatchResponse[]) {
    const responseData = await api.post(
      `/collaborative-editing/${iprApplicationId}/respond/batch`,
      { responses }
    );
    return responseData.data;
  }

  /**
   * Get review history for an IPR application
   */
  async getReviewHistory(iprApplicationId: string): Promise<{ data: ReviewHistoryData }> {
    const response = await api.get(`/collaborative-editing/${iprApplicationId}/history`);
    return response.data;
  }

  /**
   * Get pending suggestions count for an IPR application
   */
  async getPendingSuggestionsCount(iprApplicationId: string): Promise<number> {
    try {
      const result = await this.getEditSuggestions(iprApplicationId, 'pending');
      return result.data.summary.pending;
    } catch (error) {
      logger.error('Failed to get pending suggestions count:', error);
      return 0;
    }
  }

  // ========== MENTOR COLLABORATIVE EDITING METHODS ===
  /**
   * Mentor creates an individual edit suggestion
   */
  async mentorCreateEditSuggestion(iprApplicationId: string, suggestion: BatchSuggestion) {
    const response = await api.post(
      `/collaborative-editing/mentor/${iprApplicationId}/suggestions`,
      suggestion
    );
    return response.data;
  }

  /**
   * Mentor submits batch suggestions
   */
  async mentorSubmitBatchSuggestions(
    iprApplicationId: string, 
    suggestions: BatchSuggestion[], 
    overallComments?: string
  ) {
    const response = await api.post(
      `/collaborative-editing/mentor/${iprApplicationId}/suggestions/batch`,
      { suggestions, overallComments }
    );
    return response.data;
  }

  /**
   * Get mentor's edit suggestions for an application
   */
  async getMentorEditSuggestions(iprApplicationId: string) {
    const response = await api.get(`/collaborative-editing/mentor/${iprApplicationId}/suggestions`);
    return response.data;
  }
}

export const collaborativeEditingService = new CollaborativeEditingService();
export default collaborativeEditingService;