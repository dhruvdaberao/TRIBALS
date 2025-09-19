import React, { useEffect } from 'react';
import { Notification, User } from '../../types';
import UserAvatar from '../common/UserAvatar';
import * as api from '../../api';
import { useSocket } from '../../contexts/SocketContext';

interface NotificationsPageProps {
  notifications: Notification[];
  onViewProfile: (user: User) => void;
}

const NotificationItem: React.FC<{ notification: Notification; onViewProfile: (user: User) => void; }> = ({ notification, onViewProfile }) => {
  const { sender, type, timestamp } = notification;

  const renderText = () => {
    switch (type) {
      case 'follow':
        return 'started following you.';
      case 'like':
        return 'liked your post.';
      case 'comment':
        return 'commented on your post.';
      default:
        return '';
    }
  };
  
  const timeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);

    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  return (
    <div className={`p-4 flex items-start space-x-4 border-b border-border ${!notification.read ? 'bg-accent/5' : ''}`}>
      <div className="w-12 h-12 flex-shrink-0 cursor-pointer" onClick={() => onViewProfile(sender)}>
        <UserAvatar user={sender} />
      </div>
      <div className="flex-1">
        <p className="text-primary">
          <strong className="cursor-pointer hover:underline" onClick={() => onViewProfile(sender)}>{sender.name}</strong>
          <span className="text-secondary"> @{sender.username} </span>
          {renderText()}
        </p>
        <p className="text-sm text-secondary mt-1">{timeAgo(timestamp)}</p>
      </div>
    </div>
  );
};

const NotificationsPage: React.FC<NotificationsPageProps> = ({ notifications, onViewProfile }) => {
  const { setNotifications } = useSocket();
  
  useEffect(() => {
      const markAsRead = async () => {
          try {
              // Only make API call if there are unread notifications
              if (notifications.some(n => !n.read)) {
                  await api.markNotificationsRead();
                  // Optimistically update the UI
                  setNotifications(prev => prev.map(n => ({...n, read: true})));
              }
          } catch (error) {
              console.error("Failed to mark notifications as read", error);
          }
      };
      // Add a small delay to avoid marking as read if user accidentally clicks
      const timer = setTimeout(markAsRead, 1000);
      return () => clearTimeout(timer);
  }, [notifications, setNotifications]);
  
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-primary mb-6 font-display">Notifications</h1>
      <div className="bg-surface rounded-2xl border border-border shadow-md overflow-hidden">
        {notifications.length > 0 ? (
          notifications.map(notification => (
            <NotificationItem 
                key={notification.id} 
                notification={notification} 
                onViewProfile={onViewProfile} 
            />
          ))
        ) : (
          <p className="text-center text-secondary p-8">You have no notifications yet.</p>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
