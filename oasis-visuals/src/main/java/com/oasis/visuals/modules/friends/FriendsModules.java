package com.oasis.visuals.modules.friends;

import com.oasis.visuals.modules.Module;

public class FriendsModules {
    public static class FriendsListModule extends Module {
        public FriendsListModule() {
            super("friends-list", "Friends List", Category.FRIENDS, "Show online friends overlay");
        }
    }
    public static class OnlineStatusModule extends Module {
        public OnlineStatusModule() {
            super("online-status", "Online Status", Category.FRIENDS, "Display friend online/offline status");
        }
    }
    public static class FriendMessagesModule extends Module {
        public FriendMessagesModule() {
            super("friend-messages", "Friend Messages", Category.FRIENDS, "Receive friend messages in-game");
        }
    }
    public static class PartyModule extends Module {
        public PartyModule() {
            super("party", "Party", Category.FRIENDS, "Party system with friends");
        }
    }
}
