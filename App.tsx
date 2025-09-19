
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useSocket } from './contexts/SocketContext';
import { User, Post, Tribe, TribeMessage, Notification as NotificationType, Comment } from './types';
import * as api from './api';

// Components
import Sidebar from './components/layout/Sidebar';
import FeedPage from './components/feed/FeedPage';
import ProfilePage from './components/profile/ProfilePage';
import ChatPage from './components/chat/ChatPage';
import DiscoverPage from './components/discover/DiscoverPage';
import LoginPage from './components/auth/LoginPage';
import TribesPage from './components/tribes/TribesPage';
import TribeDetailPage from './components/tribes/TribeDetailPage';
import EditTribeModal from './components/tribes/EditTribeModal';
import CreatePost from './components/feed/CreatePost';
import NotificationsPage from './components/notifications/NotificationsPage';
import { Toaster, toast } from './components/common/Toast';

export type NavItem = 'Home' | 'Discover' | 'Messages' | 'Tribes' | 'Notifications' | 'Profile' | 'Ember' | 'TribeDetail';

const EMBER_AI_USER: User = {
    id: 'ember-ai',
    name: 'Ember AI',
    username: 'ember_ai',
    avatarUrl: '/ember.png',
    bannerUrl: null,
    bio: 'Your fiery AI guide. Ask me anything!',
    followers: [],
    following: [],
    blockedUsers: [],
};

const App: React.FC = () => {
    const { currentUser, setCurrentUser, logout, isLoading: isAuthLoading } = useAuth();
    const { socket, notifications, unreadMessageCount, unreadTribeCount, unreadNotificationCount, clearUnreadTribe } = useSocket();
    
    // Global State
    const [users, setUsers] = useState<User[]>([]);
    const [posts, setPosts] = useState<Post[]>([]);
    const [tribes, setTribes] = useState<Tribe[]>([]);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [isCreatingPost, setIsCreatingPost] = useState(false);
    const [isAllPostsLoaded, setIsAllPostsLoaded] = useState(false);

    // Navigation State
    const [activeNavItem, setActiveNavItem] = useState<NavItem>('Home');
    const [viewedUser, setViewedUser] = useState<User | null>(null);
    const [viewedTribe, setViewedTribe] = useState<Tribe | null>(null);
    const [editingTribe, setEditingTribe] = useState<Tribe | null>(null);
    const [chatTarget, setChatTarget] = useState<User | null>(null);

    const userMap = useMemo(() => new Map(users.map((user: User) => [user.id, user])), [users]);

    const populatePost = useCallback((post: any, userMapToUse: Map<string, User>): Post | null => {
        const author = userMapToUse.get(post.user);
        if (!author) return null;
        return {
            ...post,
            author,
            comments: post.comments ? post.comments.map((comment: any) => ({
                ...comment,
                author: userMapToUse.get(comment.user),
            })).filter((c: any) => c.author) : [],
        };
    }, []);

    const fetchData = useCallback(async () => {
        if (!currentUser) {
            setIsInitialLoading(false);
            return;
        }
        try {
            const [usersData, feedPostsData, tribesData, notificationsData] = await Promise.all([
                api.fetchUsers(),
                api.fetchFeedPosts(),
                api.fetchTribes(),
                api.fetchNotifications(),
            ]);

            setUsers(usersData.data);
            const localUserMap = new Map<string, User>(usersData.data.map((user: User) => [user.id, user]));

            const populatedPosts = feedPostsData.data.map((post: any) => populatePost(post, localUserMap)).filter(Boolean);
            
            setPosts(populatedPosts as Post[]);
            
            const populatedTribes = tribesData.data.map((tribe: any) => ({
                ...tribe,
                messages: [], 
            }));

            setTribes(populatedTribes);

        } catch (error) {
            console.error("Failed to fetch initial data:", error);
            if ((error as any)?.response?.status === 401) {
                logout();
            }
        } finally {
            setIsInitialLoading(false);
        }
    }, [currentUser, logout, populatePost]);
    
    const fetchAllPostsForDiscover = useCallback(async () => {
      if (isAllPostsLoaded) return;
      try {
        const { data } = await api.fetchPosts();
        const populated = data.map((post: any) => populatePost(post, userMap)).filter(Boolean);
        
        const postMap = new Map(posts.map(p => [p.id, p]));
        (populated as Post[]).forEach(p => postMap.set(p.id, p));

        setPosts(Array.from(postMap.values()).sort((a: Post, b: Post) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        setIsAllPostsLoaded(true);
      } catch (error) {
        console.error("Failed to fetch all posts for discover", error);
      }
    }, [isAllPostsLoaded, userMap, posts, populatePost]);


    useEffect(() => {
        if (!isAuthLoading) {
            fetchData();
        }
    }, [fetchData, isAuthLoading]);
    
    // --- REAL-TIME EVENT LISTENERS ---
    useEffect(() => {
        if (!socket || !userMap.size) return;

        socket.on('newPost', (post) => {
            const populated = populatePost(post, userMap);
            if (populated) setPosts(prev => [populated, ...prev].sort((a: Post, b: Post) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        });
        
        socket.on('postUpdated', (updatedPost) => {
            const populated = populatePost(updatedPost, userMap);
            if (populated) setPosts(prev => prev.map(p => p.id === populated.id ? populated : p));
        });

        socket.on('postDeleted', (postId) => {
            setPosts(prev => prev.filter(p => p.id !== postId));
        });

        socket.on('newTribeMessage', (message: TribeMessage) => {
            if(viewedTribe && viewedTribe.id === message.tribeId) {
                const sender = userMap.get(message.senderId!);
                if (sender) {
                     setViewedTribe(prev => prev ? { ...prev, messages: [...prev.messages, {...message, sender}] } : null);
                }
            }
        });

        socket.on('tribeMessageDeleted', ({ tribeId, messageId }) => {
            if(viewedTribe && viewedTribe.id === tribeId) {
                setViewedTribe(prev => prev ? { ...prev, messages: prev.messages.filter(m => m.id !== messageId) } : null);
            }
        });

        socket.on('userUpdated', (updatedUser: User) => {
            setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
            if (currentUser?.id === updatedUser.id) {
                setCurrentUser(updatedUser);
            }
            if (viewedUser?.id === updatedUser.id) {
                setViewedUser(updatedUser);
            }
        });

        socket.on('tribeDeleted', (tribeId: string) => {
            setTribes(prev => prev.filter(t => t.id !== tribeId));
            if (viewedTribe?.id === tribeId) {
                setViewedTribe(null);
                setActiveNavItem('Tribes');
                toast.info('This tribe has been deleted by the owner.');
            }
        });

        return () => {
            socket.off('newPost');
            socket.off('postUpdated');
            socket.off('postDeleted');
            socket.off('newTribeMessage');
            socket.off('tribeMessageDeleted');
            socket.off('userUpdated');
            socket.off('tribeDeleted');
        };

    }, [socket, userMap, populatePost, currentUser?.id, setCurrentUser, viewedUser?.id, viewedTribe]);
    
    const handleSelectItem = (item: NavItem) => {
        setChatTarget(null);
        if (item === 'Profile') {
            setViewedUser(currentUser);
        } else {
            setViewedUser(null);
        }
        if (item !== 'TribeDetail') {
            setViewedTribe(null);
        }
        
        if (item === 'Ember') {
            handleStartConversation(EMBER_AI_USER);
            return;
        }
        
        setActiveNavItem(item);
    };

    const handleViewProfile = (user: User) => {
        setViewedUser(user);
        setActiveNavItem('Profile');
    };
    
    const handleStartConversation = (targetUser: User) => {
        setChatTarget(targetUser);
        setActiveNavItem('Messages');
    };

    // --- Post Handlers ---
    const handleAddPost = async (content: string, imageUrl?: string) => {
        if (!currentUser) return;
        setIsCreatingPost(true);
        try {
            await api.createPost({ content, imageUrl });
        } catch (error) {
            console.error("Failed to add post:", error);
            alert("Could not create post. Please try again.");
        } finally {
            setIsCreatingPost(false);
        }
    };

    const handleLikePost = async (postId: string) => {
        if (!currentUser) return;
        setPosts(posts.map(p => {
            if (p.id === postId) {
                const isLiked = p.likes.includes(currentUser.id);
                const newLikes = isLiked ? p.likes.filter(id => id !== currentUser.id) : [...p.likes, currentUser.id];
                return { ...p, likes: newLikes };
            }
            return p;
        }));
        try {
            await api.likePost(postId);
        } catch (error) {
            console.error("Failed to like post:", error);
        }
    };

    const handleCommentPost = async (postId: string, text: string) => {
        if (!currentUser) return;

        const tempComment: Comment = {
          id: `temp-${Date.now()}`,
          author: currentUser,
          text,
          timestamp: new Date().toISOString(),
        };

        const updatePostWithComment = (post: Post) => ({
            ...post,
            comments: [...post.comments, tempComment],
        });
        
        setPosts(prev => prev.map(p => p.id === postId ? updatePostWithComment(p) : p));
        
        try {
            await api.commentOnPost(postId, { text });
        } catch (error) {
            console.error("Failed to comment:", error);
            alert("Failed to post comment.");
            setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: p.comments.filter(c => c.id !== tempComment.id) } : p));
        }
    };

    const handleDeletePost = async (postId: string) => {
        if (!currentUser) return;
        try {
            await api.deletePost(postId);
        } catch (error) {
            console.error("Failed to delete post:", error);
        }
    };

    const handleDeleteComment = async (postId: string, commentId: string) => {
        if (!currentUser) return;
        try {
            await api.deleteComment(postId, commentId);
        } catch (error) {
            console.error("Failed to delete comment:", error);
        }
    };

    const handleSharePost = async (post: Post, destination: { type: 'tribe' | 'user', id: string }) => {
        if (!currentUser) return;
        const formattedText = `[Shared Post by @${post.author.username}]:\n${post.content}`;
        
        try {
            if (destination.type === 'tribe') {
                await api.sendTribeMessage(destination.id, { text: formattedText, imageUrl: post.imageUrl });
                alert(`Post successfully shared to tribe!`);
            } else {
                await api.sendMessage(destination.id, { message: formattedText, imageUrl: post.imageUrl });
                if (activeNavItem !== 'Messages') {
                    alert(`Post successfully shared with user! Check your messages.`);
                }
            }
        } catch (error) {
            console.error("Failed to share post:", error);
            alert("Could not share post. Please try again.");
        }
    };

    // --- User Handlers ---
    const handleUpdateUser = async (updatedUserData: Partial<User>) => {
        if (!currentUser) return;
        try {
            await api.updateProfile(updatedUserData);
        } catch (error) {
            console.error("Failed to update user:", error);
        }
    };
    
    const handleToggleFollow = async (targetUserId: string) => {
        if (!currentUser || currentUser.id === targetUserId) return;

        const originalCurrentUser = currentUser;
        const originalUsers = [...users];
        const originalViewedUser = viewedUser;

        const isCurrentlyFollowing = currentUser.following.includes(targetUserId);

        const updatedCurrentUser = {
            ...currentUser,
            following: isCurrentlyFollowing
                ? currentUser.following.filter(id => id !== targetUserId)
                : [...currentUser.following, targetUserId],
        };
        setCurrentUser(updatedCurrentUser);

        setUsers(prevUsers => prevUsers.map(user => {
            if (user.id === targetUserId) {
                return {
                    ...user,
                    followers: isCurrentlyFollowing
                        ? user.followers.filter(id => id !== currentUser.id)
                        : [...user.followers, currentUser.id],
                };
            }
            return user;
        }));
        
        if (viewedUser?.id === targetUserId) {
          setViewedUser(prev => prev ? {
            ...prev,
            followers: isCurrentlyFollowing
              ? prev.followers.filter(id => id !== currentUser!.id)
              : [...prev.followers, currentUser!.id]
          } : null)
        }

        try {
            await api.toggleFollow(targetUserId);
        } catch(error) {
            console.error('Failed to toggle follow', error);
            alert("Action failed. Please try again.");
            setCurrentUser(originalCurrentUser);
            setUsers(originalUsers);
            setViewedUser(originalViewedUser);
        }
    };

    const handleToggleBlock = async (targetUserId: string) => {
        if (!currentUser) return;
        try {
            await api.toggleBlock(targetUserId);
            // The userUpdated socket event will handle state changes
        } catch(error) {
            console.error('Failed to toggle block', error);
        }
    };
    
    const handleDeleteAccount = async () => {
        if (window.confirm("Are you sure? This action is irreversible.")) {
            try {
                await api.deleteAccount();
                alert("Account deleted successfully.");
                logout();
            } catch(error) {
                console.error("Failed to delete account:", error);
                alert("Could not delete account. Please try again.");
            }
        }
    };

    // --- Tribe Handlers ---
    const handleJoinToggle = async (tribeId: string) => {
        if (!currentUser) return;
        try {
            const { data: updatedTribe } = await api.joinTribe(tribeId);
            setTribes(tribes.map(t => t.id === tribeId ? { ...t, members: updatedTribe.members } : t));
             if (viewedTribe?.id === tribeId) {
                setViewedTribe(prev => prev ? { ...prev, members: updatedTribe.members } : null);
            }
        } catch (error) {
            console.error("Failed to join/leave tribe:", error);
        }
    };

    const handleCreateTribe = async (name: string, description: string, avatarUrl?: string) => {
        try {
            const { data: newTribe } = await api.createTribe({ name, description, avatarUrl });
            setTribes(prev => [{...newTribe, messages: []}, ...prev]);
        } catch (error) {
            console.error("Failed to create tribe:", error);
        }
    };

    const handleViewTribe = async (tribe: Tribe) => {
        try {
            clearUnreadTribe(tribe.id);
            setViewedTribe({ ...tribe, messages: [] });
            setActiveNavItem('TribeDetail');
            
            socket?.emit('joinRoom', `tribe-${tribe.id}`);

            const { data: messages } = await api.fetchTribeMessages(tribe.id);
            const populatedMessages = messages.map((msg: any) => ({
                ...msg,
                sender: userMap.get(msg.sender)
            })).filter((m: TribeMessage) => m.sender);

            setViewedTribe(prev => prev ? { ...prev, messages: populatedMessages } : null);
        } catch (error) {
            console.error("Failed to fetch tribe messages:", error);
        }
    };

    const handleEditTribe = async (tribeId: string, name: string, description: string, avatarUrl?: string | null) => {
      try {
          const { data: updatedTribeData } = await api.updateTribe(tribeId, { name, description, avatarUrl });
          setTribes(tribes.map(t => (t.id === tribeId ? { ...t, ...updatedTribeData } : t)));
          if (viewedTribe && viewedTribe.id === tribeId) {
              setViewedTribe(prev => prev ? { ...prev, ...updatedTribeData } : null);
          }
          setEditingTribe(null);
      } catch (error) {
          console.error("Failed to edit tribe:", error);
      }
    };
    
    const handleSendTribeMessage = async (tribeId: string, text: string, imageUrl?: string) => {
        if (!currentUser || !viewedTribe) return;
        try {
            await api.sendTribeMessage(tribeId, { text, imageUrl });
            // The message will be received via socket, so no optimistic update is needed
        } catch (error) {
            console.error("Failed to send tribe message:", error);
        }
    };
    
    const handleDeleteTribeMessage = async (tribeId: string, messageId: string) => {
        try {
            await api.deleteTribeMessage(tribeId, messageId);
        } catch (error) {
            console.error("Failed to delete tribe message", error);
            alert("Could not delete message.");
        }
    }

    const handleDeleteTribe = async (tribeId: string) => {
        if (window.confirm("Are you sure you want to delete this tribe? This is irreversible.")) {
            try {
                await api.deleteTribe(tribeId);
            } catch (error) {
                console.error("Failed to delete tribe", error);
                alert("Could not delete tribe.");
            }
        }
    }

    const visiblePosts = useMemo(() => {
        if (!currentUser) return [];
        return posts.filter(p => !currentUser.blockedUsers.includes(p.author.id) && !p.author.blockedUsers?.includes(currentUser.id));
    }, [posts, currentUser]);

    const visibleUsers = useMemo(() => {
        if (!currentUser) return [];
        return users.filter(u => !currentUser.blockedUsers.includes(u.id) && !u.blockedUsers?.includes(currentUser.id));
    }, [users, currentUser]);
    
    if (isAuthLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <img src="/loader.svg" alt="Loading..." className="w-24 h-24" />
            </div>
        );
    }
    
    if (!currentUser) {
        return <LoginPage />;
    }
    
    if (isInitialLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <img src="/loader.svg" alt="Loading..." className="w-24 h-24" />
            </div>
        );
    }

    const renderContent = () => {
        switch (activeNavItem) {
            case 'Home':
                const feedPosts = visiblePosts.filter(p => currentUser.following.includes(p.author.id) || p.author.id === currentUser.id);
                return (
                    <div className="max-w-2xl mx-auto">
                        <CreatePost currentUser={currentUser} allUsers={visibleUsers} onAddPost={handleAddPost} isPosting={isCreatingPost}/>
                        <FeedPage
                            posts={feedPosts}
                            currentUser={currentUser}
                            allUsers={visibleUsers}
                            allTribes={tribes}
                            onLikePost={handleLikePost}
                            onCommentPost={handleCommentPost}
                            onDeletePost={handleDeletePost}
                            onDeleteComment={handleDeleteComment}
                            onViewProfile={handleViewProfile}
                            onSharePost={handleSharePost}
                        />
                    </div>
                );
            case 'Discover':
                return <DiscoverPage
                    posts={visiblePosts}
                    users={visibleUsers}
                    tribes={tribes}
                    currentUser={currentUser}
                    onLikePost={handleLikePost}
                    onCommentPost={handleCommentPost}
                    onDeletePost={handleDeletePost}
                    onDeleteComment={handleDeleteComment}
                    onToggleFollow={handleToggleFollow}
                    onViewProfile={handleViewProfile}
                    onViewTribe={handleViewTribe}
                    onJoinToggle={handleJoinToggle}
                    onEditTribe={(tribe) => setEditingTribe(tribe)}
                    onSharePost={handleSharePost}
                    onLoadMore={fetchAllPostsForDiscover}
                />;
            case 'Messages':
                return <ChatPage 
                    currentUser={currentUser}
                    allUsers={visibleUsers}
                    emberUser={EMBER_AI_USER}
                    initialTargetUser={chatTarget}
                    onViewProfile={handleViewProfile}
                    onSharePost={handleSharePost}
                />;
            case 'Tribes':
                return <TribesPage 
                    tribes={tribes}
                    currentUser={currentUser}
                    onJoinToggle={handleJoinToggle}
                    onCreateTribe={handleCreateTribe}
                    onViewTribe={handleViewTribe}
                    onEditTribe={(tribe) => setEditingTribe(tribe)}
                />;
            case 'TribeDetail':
                if (!viewedTribe) return <div className="text-center p-8">Tribe not found. Go back to discover more tribes.</div>;
                return <TribeDetailPage
                    tribe={viewedTribe}
                    currentUser={currentUser}
                    onSendMessage={handleSendTribeMessage}
                    onDeleteMessage={handleDeleteTribeMessage}
                    onDeleteTribe={handleDeleteTribe}
                    onBack={() => setActiveNavItem('Tribes')}
                    onViewProfile={handleViewProfile}
                    onEditTribe={(tribe) => setEditingTribe(tribe)}
                    onJoinToggle={handleJoinToggle}
                />;
            case 'Notifications':
                return <NotificationsPage notifications={notifications} onViewProfile={handleViewProfile}/>;
            case 'Profile':
                if (!viewedUser || currentUser.blockedUsers.includes(viewedUser.id) || viewedUser.blockedUsers?.includes(currentUser.id)) {
                     return <div className="text-center p-8">User not found or is blocked.</div>;
                }
                const userPosts = visiblePosts.filter(p => p.author.id === viewedUser.id);
                return <ProfilePage
                    user={viewedUser}
                    allUsers={visibleUsers}
                    // Fix: Changed 'allTribes' to the correct state variable 'tribes'.
                    allTribes={tribes}
                    posts={userPosts}
                    currentUser={currentUser}
                    onLikePost={handleLikePost}
                    onCommentPost={handleCommentPost}
                    onDeletePost={handleDeletePost}
                    onDeleteComment={handleDeleteComment}
                    onViewProfile={handleViewProfile}
                    onUpdateUser={handleUpdateUser}
                    onAddPost={handleAddPost}
                    onToggleFollow={handleToggleFollow}
                    onToggleBlock={handleToggleBlock}
                    onStartConversation={handleStartConversation}
                    onLogout={logout}
                    onDeleteAccount={handleDeleteAccount}
                    onSharePost={handleSharePost}
                />;
            default:
                return <div>Page not found</div>;
        }
    };

    return (
        <div className="bg-background min-h-screen text-primary">
            <Toaster />
            <Sidebar 
                activeItem={activeNavItem} 
                onSelectItem={handleSelectItem} 
                currentUser={currentUser}
                unreadMessageCount={unreadMessageCount}
                unreadTribeCount={unreadTribeCount}
                unreadNotificationCount={unreadNotificationCount}
            />
            <main className="pt-20 pb-20 md:pb-4 px-4 md:px-6 max-w-7xl mx-auto">
                {renderContent()}
            </main>
            {editingTribe && (
              <EditTribeModal
                tribe={editingTribe}
                onClose={() => setEditingTribe(null)}
                onSave={handleEditTribe}
              />
            )}
        </div>
    );
};

export default App;
