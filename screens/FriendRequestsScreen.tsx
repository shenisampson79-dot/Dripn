import React, { useState } from "react";
import { StyleSheet, View, Pressable, Image } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useSocial, FriendRequest, SAMPLE_USERS } from "@/contexts/SocialContext";
import type { CommunityStackParamList } from "@/navigation/CommunityStackNavigator";

type FriendRequestsScreenProps = {
  navigation: NativeStackNavigationProp<CommunityStackParamList, "FriendRequests">;
};

type TabType = "incoming" | "outgoing" | "friends";

function formatTimeAgo(timestamp: string): string {
  const now = Date.now();
  const time = new Date(timestamp).getTime();
  const diff = now - time;

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${days}d ago`;
}

export default function FriendRequestsScreen({ navigation }: FriendRequestsScreenProps) {
  const { theme } = useTheme();
  const {
    incomingFriendRequests,
    outgoingFriendRequests,
    friends,
    acceptFriendRequest,
    declineFriendRequest,
    cancelFriendRequest,
    getUserById,
  } = useSocial();

  const [activeTab, setActiveTab] = useState<TabType>("incoming");

  const pendingIncoming = incomingFriendRequests.filter(r => r.status === "pending");
  const pendingOutgoing = outgoingFriendRequests.filter(r => r.status === "pending");

  const handleAccept = async (requestId: string) => {
    await acceptFriendRequest(requestId);
  };

  const handleDecline = async (requestId: string) => {
    await declineFriendRequest(requestId);
  };

  const handleCancel = async (requestId: string) => {
    await cancelFriendRequest(requestId);
  };

  const handleUserPress = (userId: string) => {
    navigation.navigate("UserProfile", { userId });
  };

  const renderIncomingRequest = (request: FriendRequest) => (
    <Card key={request.id} style={styles.requestCard}>
      <Pressable
        onPress={() => handleUserPress(request.fromUserId)}
        style={styles.requestContent}
      >
        <View style={[styles.avatar, { backgroundColor: theme.backgroundDefault }]}>
          {request.fromUserAvatar ? (
            <Image source={{ uri: request.fromUserAvatar }} style={styles.avatarImage} />
          ) : (
            <Feather name="user" size={24} color={theme.tabIconDefault} />
          )}
        </View>
        <View style={styles.requestInfo}>
          <ThemedText type="h4" style={styles.userName}>
            {request.fromUserName}
          </ThemedText>
          <ThemedText type="small" style={styles.timestamp}>
            {formatTimeAgo(request.timestamp)}
          </ThemedText>
        </View>
      </Pressable>
      <View style={styles.actionButtons}>
        <Pressable
          onPress={() => handleAccept(request.id)}
          style={({ pressed }) => [
            styles.acceptButton,
            { backgroundColor: theme.link, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Feather name="check" size={18} color="#FFFFFF" />
          <ThemedText type="body" style={styles.acceptText}>
            Accept
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => handleDecline(request.id)}
          style={({ pressed }) => [
            styles.declineButton,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Feather name="x" size={18} color={theme.text} />
          <ThemedText type="body">Decline</ThemedText>
        </Pressable>
      </View>
    </Card>
  );

  const renderOutgoingRequest = (request: FriendRequest) => {
    const targetUser = getUserById(request.toUserId);
    return (
      <Card key={request.id} style={styles.requestCard}>
        <Pressable
          onPress={() => handleUserPress(request.toUserId)}
          style={styles.requestContent}
        >
          <View style={[styles.avatar, { backgroundColor: theme.backgroundDefault }]}>
            <Feather name="user" size={24} color={theme.tabIconDefault} />
          </View>
          <View style={styles.requestInfo}>
            <ThemedText type="h4" style={styles.userName}>
              {targetUser?.name || "Fashion User"}
            </ThemedText>
            <ThemedText type="small" style={styles.timestamp}>
              Sent {formatTimeAgo(request.timestamp)}
            </ThemedText>
          </View>
        </Pressable>
        <View style={styles.actionButtons}>
          <View style={[styles.pendingBadge, { backgroundColor: theme.backgroundDefault }]}>
            <Feather name="clock" size={14} color={theme.tabIconDefault} />
            <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
              Pending
            </ThemedText>
          </View>
          <Pressable
            onPress={() => handleCancel(request.id)}
            style={({ pressed }) => [
              styles.cancelButton,
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: theme.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <ThemedText type="body">Cancel</ThemedText>
          </Pressable>
        </View>
      </Card>
    );
  };

  const renderFriend = (friendId: string) => {
    const friendUser = SAMPLE_USERS[friendId];
    if (!friendUser) return null;

    return (
      <Pressable
        key={friendId}
        onPress={() => handleUserPress(friendId)}
        style={({ pressed }) => [
          styles.friendCard,
          { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: theme.backgroundDefault }]}>
          {friendUser.avatar ? (
            <Image source={{ uri: friendUser.avatar }} style={styles.avatarImage} />
          ) : (
            <Feather name="user" size={24} color={theme.tabIconDefault} />
          )}
        </View>
        <View style={styles.friendInfo}>
          <ThemedText type="h4">{friendUser.name}</ThemedText>
          <View style={styles.friendBadge}>
            <Feather name="users" size={12} color={theme.link} />
            <ThemedText type="small" style={{ color: theme.link }}>
              Friend
            </ThemedText>
          </View>
        </View>
        <Feather name="chevron-right" size={20} color={theme.tabIconDefault} />
      </Pressable>
    );
  };

  const renderEmptyState = (type: TabType) => {
    const config = {
      incoming: {
        icon: "user-plus" as const,
        title: "No pending requests",
        description: "When someone sends you a friend request, it will appear here",
      },
      outgoing: {
        icon: "send" as const,
        title: "No sent requests",
        description: "Friend requests you send will appear here",
      },
      friends: {
        icon: "users" as const,
        title: "No friends yet",
        description: "Accept friend requests or send requests to connect with others",
      },
    };

    const { icon, title, description } = config[type];

    return (
      <View style={styles.emptyState}>
        <Feather name={icon} size={48} color={theme.tabIconDefault} />
        <ThemedText type="h4" style={styles.emptyTitle}>
          {title}
        </ThemedText>
        <ThemedText type="body" style={styles.emptyDescription}>
          {description}
        </ThemedText>
      </View>
    );
  };

  return (
    <ScreenScrollView>
      <View style={styles.tabContainer}>
        <Pressable
          onPress={() => setActiveTab("incoming")}
          style={[
            styles.tab,
            {
              backgroundColor: activeTab === "incoming" ? theme.link : theme.backgroundDefault,
            },
          ]}
        >
          <ThemedText
            type="body"
            style={{
              color: activeTab === "incoming" ? "#FFFFFF" : theme.text,
              fontWeight: "600",
            }}
          >
            Incoming
          </ThemedText>
          {pendingIncoming.length > 0 ? (
            <View style={[styles.badge, { backgroundColor: activeTab === "incoming" ? "#FFFFFF" : theme.link }]}>
              <ThemedText
                type="small"
                style={{
                  color: activeTab === "incoming" ? theme.link : "#FFFFFF",
                  fontWeight: "700",
                }}
              >
                {pendingIncoming.length}
              </ThemedText>
            </View>
          ) : null}
        </Pressable>

        <Pressable
          onPress={() => setActiveTab("outgoing")}
          style={[
            styles.tab,
            {
              backgroundColor: activeTab === "outgoing" ? theme.link : theme.backgroundDefault,
            },
          ]}
        >
          <ThemedText
            type="body"
            style={{
              color: activeTab === "outgoing" ? "#FFFFFF" : theme.text,
              fontWeight: "600",
            }}
          >
            Sent
          </ThemedText>
          {pendingOutgoing.length > 0 ? (
            <View style={[styles.badge, { backgroundColor: activeTab === "outgoing" ? "#FFFFFF" : theme.link }]}>
              <ThemedText
                type="small"
                style={{
                  color: activeTab === "outgoing" ? theme.link : "#FFFFFF",
                  fontWeight: "700",
                }}
              >
                {pendingOutgoing.length}
              </ThemedText>
            </View>
          ) : null}
        </Pressable>

        <Pressable
          onPress={() => setActiveTab("friends")}
          style={[
            styles.tab,
            {
              backgroundColor: activeTab === "friends" ? theme.link : theme.backgroundDefault,
            },
          ]}
        >
          <ThemedText
            type="body"
            style={{
              color: activeTab === "friends" ? "#FFFFFF" : theme.text,
              fontWeight: "600",
            }}
          >
            Friends
          </ThemedText>
          {friends.length > 0 ? (
            <View style={[styles.badge, { backgroundColor: activeTab === "friends" ? "#FFFFFF" : theme.link }]}>
              <ThemedText
                type="small"
                style={{
                  color: activeTab === "friends" ? theme.link : "#FFFFFF",
                  fontWeight: "700",
                }}
              >
                {friends.length}
              </ThemedText>
            </View>
          ) : null}
        </Pressable>
      </View>

      <View style={styles.content}>
        {activeTab === "incoming" ? (
          pendingIncoming.length > 0 ? (
            pendingIncoming.map(renderIncomingRequest)
          ) : (
            renderEmptyState("incoming")
          )
        ) : null}

        {activeTab === "outgoing" ? (
          pendingOutgoing.length > 0 ? (
            pendingOutgoing.map(renderOutgoingRequest)
          ) : (
            renderEmptyState("outgoing")
          )
        ) : null}

        {activeTab === "friends" ? (
          friends.length > 0 ? (
            friends.map(renderFriend)
          ) : (
            renderEmptyState("friends")
          )
        ) : null}
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  tabContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  content: {
    gap: Spacing.md,
  },
  requestCard: {
    padding: Spacing.md,
  },
  requestContent: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  requestInfo: {
    flex: 1,
  },
  userName: {
    marginBottom: 2,
  },
  timestamp: {
    opacity: 0.7,
  },
  actionButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  acceptButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  acceptText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  declineButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  pendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  cancelButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  friendCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  friendInfo: {
    flex: 1,
  },
  friendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
    gap: Spacing.md,
  },
  emptyTitle: {
    marginTop: Spacing.sm,
  },
  emptyDescription: {
    opacity: 0.7,
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
  },
});
