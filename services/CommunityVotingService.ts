import AsyncStorage from "@react-native-async-storage/async-storage";

export type VoteReason = "more-appropriate" | "more-flattering" | "feels-safer";

export interface OutfitOption {
  id: string;
  imageUrl?: string;
  description: string;
  aiExplanation: string;
  label: "Recommended" | "Backup option";
}

export interface VotingSession {
  id: string;
  userId: string;
  outfitOptions: OutfitOption[];
  createdAt: string;
  expiresAt: string;
  occasion?: string;
  context?: string;
  status: "pending" | "voting" | "completed" | "expired";
  aiRecommendedOptionId: string;
  isExpress?: boolean;
}

export interface ExpressResultsInfo {
  price: number;
  formattedPrice: string;
  waitTimeMinutes: number;
  standardWaitMinutes: number;
}

export interface Vote {
  voterId: string;
  sessionId: string;
  selectedOptionId: string;
  reason?: VoteReason;
  timestamp: string;
}

export interface VotingResult {
  sessionId: string;
  totalVotes: number;
  optionResults: {
    optionId: string;
    voteCount: number;
    percentage: number;
    reasons: { reason: VoteReason; count: number }[];
  }[];
  aiInterpretation: string;
  winningOptionId: string;
  alignsWithAiRecommendation: boolean;
}

export interface VoterProfile {
  userId: string;
  styleCluster?: string;
  gender?: string;
  bodyType?: string;
  occasionTypes?: string[];
  trustScore: number;
}

const VOTING_REASONS: { id: VoteReason; label: string }[] = [
  { id: "more-appropriate", label: "More appropriate" },
  { id: "more-flattering", label: "More flattering" },
  { id: "feels-safer", label: "Feels safer" },
];

const VOTE_LIMIT_PER_DAY = 10;
const VOTING_WINDOW_MINUTES = 45;
const EXPRESS_VOTING_MINUTES = 5;
const EXPRESS_RESULTS_PRICE = 1.99;

class CommunityVotingServiceClass {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.EXPO_PUBLIC_API_URL || "https://dripn-server--shenisampson79.replit.app";
  }

  getVotingReasons(): typeof VOTING_REASONS {
    return VOTING_REASONS;
  }

  getExpressResultsInfo(currencySymbol: string = "£"): ExpressResultsInfo {
    return {
      price: EXPRESS_RESULTS_PRICE,
      formattedPrice: `${currencySymbol}${EXPRESS_RESULTS_PRICE.toFixed(2)}`,
      waitTimeMinutes: EXPRESS_VOTING_MINUTES,
      standardWaitMinutes: VOTING_WINDOW_MINUTES,
    };
  }

  async createVotingSession(
    userId: string,
    outfitOptions: OutfitOption[],
    aiRecommendedOptionId: string,
    context?: { occasion?: string; description?: string },
    isExpress: boolean = false
  ): Promise<VotingSession> {
    const now = new Date();
    const windowMinutes = isExpress ? EXPRESS_VOTING_MINUTES : VOTING_WINDOW_MINUTES;
    const expiresAt = new Date(now.getTime() + windowMinutes * 60 * 1000);

    const session: VotingSession = {
      id: `vs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      outfitOptions: outfitOptions.slice(0, 3),
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      occasion: context?.occasion,
      context: context?.description,
      status: "voting",
      aiRecommendedOptionId,
      isExpress,
    };

    await AsyncStorage.setItem(`voting_session_${session.id}`, JSON.stringify(session));

    const userSessions = await this.getUserSessions(userId);
    userSessions.push(session.id);
    await AsyncStorage.setItem(`user_voting_sessions_${userId}`, JSON.stringify(userSessions));

    return session;
  }

  async getVotingSession(sessionId: string): Promise<VotingSession | null> {
    try {
      const stored = await AsyncStorage.getItem(`voting_session_${sessionId}`);
      if (!stored) return null;
      
      const session: VotingSession = JSON.parse(stored);
      
      if (new Date(session.expiresAt) < new Date()) {
        session.status = "expired";
        await AsyncStorage.setItem(`voting_session_${sessionId}`, JSON.stringify(session));
      }
      
      return session;
    } catch (error) {
      console.error("Error getting voting session:", error);
      return null;
    }
  }

  async getUserSessions(userId: string): Promise<string[]> {
    try {
      const stored = await AsyncStorage.getItem(`user_voting_sessions_${userId}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  async canUserVote(voterId: string): Promise<{ canVote: boolean; reason?: string; remaining?: number }> {
    try {
      const today = new Date().toDateString();
      const voteCountKey = `vote_count_${voterId}_${today}`;
      const stored = await AsyncStorage.getItem(voteCountKey);
      const voteCount = stored ? parseInt(stored, 10) : 0;

      if (voteCount >= VOTE_LIMIT_PER_DAY) {
        return {
          canVote: false,
          reason: "You've reached your daily voting limit. Come back tomorrow!",
          remaining: 0,
        };
      }

      return {
        canVote: true,
        remaining: VOTE_LIMIT_PER_DAY - voteCount,
      };
    } catch {
      return { canVote: true, remaining: VOTE_LIMIT_PER_DAY };
    }
  }

  async submitVote(
    voterId: string,
    sessionId: string,
    selectedOptionId: string,
    reason?: VoteReason
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const canVote = await this.canUserVote(voterId);
      if (!canVote.canVote) {
        return { success: false, error: canVote.reason };
      }

      const session = await this.getVotingSession(sessionId);
      if (!session) {
        return { success: false, error: "Voting session not found" };
      }

      if (session.status !== "voting") {
        return { success: false, error: "Voting has ended for this outfit" };
      }

      if (session.userId === voterId) {
        return { success: false, error: "You cannot vote on your own outfit" };
      }

      const existingVotes = await this.getSessionVotes(sessionId);
      if (existingVotes.some((v) => v.voterId === voterId)) {
        return { success: false, error: "You've already voted on this outfit" };
      }

      const vote: Vote = {
        voterId,
        sessionId,
        selectedOptionId,
        reason,
        timestamp: new Date().toISOString(),
      };

      existingVotes.push(vote);
      await AsyncStorage.setItem(`votes_${sessionId}`, JSON.stringify(existingVotes));

      const today = new Date().toDateString();
      const voteCountKey = `vote_count_${voterId}_${today}`;
      const stored = await AsyncStorage.getItem(voteCountKey);
      const voteCount = stored ? parseInt(stored, 10) : 0;
      await AsyncStorage.setItem(voteCountKey, String(voteCount + 1));

      return { success: true };
    } catch (error) {
      console.error("Error submitting vote:", error);
      return { success: false, error: "Failed to submit vote" };
    }
  }

  async getSessionVotes(sessionId: string): Promise<Vote[]> {
    try {
      const stored = await AsyncStorage.getItem(`votes_${sessionId}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  async getVotingResults(sessionId: string, stylistId?: string): Promise<VotingResult | null> {
    try {
      const session = await this.getVotingSession(sessionId);
      if (!session) return null;

      const votes = await this.getSessionVotes(sessionId);
      
      const optionResults = session.outfitOptions.map((option) => {
        const optionVotes = votes.filter((v) => v.selectedOptionId === option.id);
        const reasons = VOTING_REASONS.map((r) => ({
          reason: r.id,
          count: optionVotes.filter((v) => v.reason === r.id).length,
        }));

        return {
          optionId: option.id,
          voteCount: optionVotes.length,
          percentage: votes.length > 0 ? Math.round((optionVotes.length / votes.length) * 100) : 0,
          reasons,
        };
      });

      const sortedResults = [...optionResults].sort((a, b) => b.voteCount - a.voteCount);
      const winningOptionId = sortedResults[0]?.optionId || session.aiRecommendedOptionId;
      const alignsWithAiRecommendation = winningOptionId === session.aiRecommendedOptionId;

      const aiInterpretation = this.generateAIInterpretation(
        session,
        optionResults,
        winningOptionId,
        alignsWithAiRecommendation,
        votes.length,
        stylistId
      );

      return {
        sessionId,
        totalVotes: votes.length,
        optionResults,
        aiInterpretation,
        winningOptionId,
        alignsWithAiRecommendation,
      };
    } catch (error) {
      console.error("Error getting voting results:", error);
      return null;
    }
  }

  private generateAIInterpretation(
    session: VotingSession,
    results: VotingResult["optionResults"],
    winningId: string,
    alignsWithAI: boolean,
    totalVotes: number,
    stylistId?: string
  ): string {
    const winningOption = session.outfitOptions.find((o) => o.id === winningId);
    const recommendedOption = session.outfitOptions.find((o) => o.id === session.aiRecommendedOptionId);
    const winningResult = results.find((r) => r.optionId === winningId);

    if (totalVotes === 0) {
      return this.formatForStylist(
        "No votes yet, but my recommendation stands. Trust your stylist!",
        stylistId
      );
    }

    if (totalVotes < 3) {
      return this.formatForStylist(
        `Only ${totalVotes} ${totalVotes === 1 ? "person has" : "people have"} voted so far. I'd still go with my original pick.`,
        stylistId
      );
    }

    if (alignsWithAI) {
      if (winningResult && winningResult.percentage >= 70) {
        return this.formatForStylist(
          `${winningResult.percentage}% of people with similar style agree with me. Go with it confidently.`,
          stylistId
        );
      }
      return this.formatForStylist(
        "Most people preferred what I recommended — that aligns with my pick. Go with it.",
        stylistId
      );
    }

    const aiResult = results.find((r) => r.optionId === session.aiRecommendedOptionId);
    const margin = winningResult && aiResult ? winningResult.percentage - aiResult.percentage : 0;

    if (margin < 10) {
      return this.formatForStylist(
        "Votes were split, but the backup option is slightly safer for your context — that's my pick.",
        stylistId
      );
    }

    return this.formatForStylist(
      `People with similar style leaned toward the ${winningOption?.label?.toLowerCase() || "other option"}. For your setting, I'd go with that.`,
      stylistId
    );
  }

  private formatForStylist(message: string, stylistId?: string): string {
    const stylistPersonalities: Record<string, (msg: string) => string> = {
      ruby: (msg) => msg.replace("Go with it", "You've got this!").replace("my pick", "what I'd choose for you"),
      max: (msg) => msg.replace("Go with it", "Looking good!").replace("Trust", "You can trust"),
      jade: (msg) => msg.replace("I'd go with", "Just wear").replace("slightly safer", "the move"),
      marcus: (msg) => msg.replace("my pick", "the call").replace("I'd go with", "Wear"),
    };

    if (stylistId && stylistPersonalities[stylistId]) {
      return stylistPersonalities[stylistId](message);
    }

    return message;
  }

  getTimeRemaining(session: VotingSession): { minutes: number; seconds: number; expired: boolean } {
    const now = new Date();
    const expires = new Date(session.expiresAt);
    const diff = expires.getTime() - now.getTime();

    if (diff <= 0) {
      return { minutes: 0, seconds: 0, expired: true };
    }

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    return { minutes, seconds, expired: false };
  }

  async getCuratedVoters(
    sessionId: string,
    requestingUserId: string
  ): Promise<{ description: string; count: number }> {
    return {
      description: "People with similar style & occasion",
      count: Math.floor(Math.random() * 20) + 10,
    };
  }

  async flagVoter(voterId: string, sessionId: string, reason: string): Promise<void> {
    const flagsKey = `voter_flags_${voterId}`;
    try {
      const stored = await AsyncStorage.getItem(flagsKey);
      const flags = stored ? JSON.parse(stored) : [];
      flags.push({ sessionId, reason, timestamp: new Date().toISOString() });
      await AsyncStorage.setItem(flagsKey, JSON.stringify(flags));
    } catch (error) {
      console.error("Error flagging voter:", error);
    }
  }
}

export const CommunityVotingService = new CommunityVotingServiceClass();
