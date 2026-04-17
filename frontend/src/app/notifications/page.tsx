'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  ExternalLink,
  RefreshCw,
  Filter,
  Clock,
  FileText,
  AlertCircle,
  MessageSquare,
  Info,
  X,
} from 'lucide-react';
import { notificationService, Notification } from '@/shared/services/notification.service';
import { formatDistanceToNow } from 'date-fns';
import logger from '@/shared/utils/logger';

// Icon mapping based on notification type
const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'ipr_changes_requested':
      return <AlertCircle className="w-5 h-5 text-orange-500" />;
    case 'ipr_suggestion_response':
      return <MessageSquare className="w-5 h-5 text-blue-500" />;
    case 'ipr_resubmitted':
      return <RefreshCw className="w-5 h-5 text-green-500" />;
    case 'ipr_approved':
    case 'ipr_status':
      return <Check className="w-5 h-5 text-green-500" />;
    case 'ipr_rejected':
      return <X className="w-5 h-5 text-red-500" />;
    case 'ipr_inventor':
    case 'ipr_contributor':
      return <FileText className="w-5 h-5 text-purple-500" />;
    default:
      return <Info className="w-5 h-5 text-gray-500" />;
  }
};

// Background color based on notification type
const getNotificationBgColor = (type: string, isRead: boolean) => {
  if (isRead) return 'bg-white';
  
  switch (type) {
    case 'ipr_changes_requested':
      return 'bg-orange-50';
    case 'ipr_suggestion_response':
      return 'bg-blue-50';
    case 'ipr_resubmitted':
      return 'bg-green-50';
    case 'ipr_approved':
      return 'bg-green-50';
    case 'ipr_rejected':
      return 'bg-red-50';
    default:
      return 'bg-gray-50';
  }
};

export default function NotificationsPage() {
  const router = useRouter();
  const formatUpdateTypeLabel = (type?: string) => {
    if (!type) return '';
    return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await notificationService.getNotifications({
        page: pagination.page,
        limit: pagination.limit,
        unreadOnly: filter ===
   'unread',
      });
      setNotifications(response.data);
      setUnreadCount(response.unreadCount);
      setPagination(response.pagination);
    } catch (error) {
      logger.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id ===
   id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      logger.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (error) {
      logger.error('Failed to mark all notifications as read:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await notificationService.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (error) {
      logger.error('Failed to delete notification:', error);
    }
  };

  const handleAction = async (notification: Notification) => {
    // Mark as read first
    if (!notification.isRead) {
      await handleMarkAsRead(notification.id);
    }
    
    // Navigate to action URL if available
    if (notification.metadata?.actionUrl) {
      router.push(notification.metadata.actionUrl);
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Bell className="w-8 h-8 text-blue-600" />
          Notifications
        </h1>
        <p className="text-gray-600 mt-2">
          Stay updated on your IPR applications and reviews
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as 'all' | 'unread')}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Notifications</option>
                <option value="unread">Unread Only</option>
              </select>
            </div>
            
            {/* Unread Badge */}
            {unreadCount > 0 && (
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                {unreadCount} unread
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchNotifications}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <CheckCheck className="w-4 h-4" />
                Mark All Read
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : notifications.length ===
   0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No notifications</h3>
            <p className="text-gray-500 mt-1">
              {filter ===
   'unread' ? "You're all caught up!" : "You don't have any notifications yet."}
            </p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`${getNotificationBgColor(notification.type, notification.isRead)} rounded-xl shadow-sm border border-gray-200 p-4 transition-all hover:shadow-md`}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="flex-shrink-0 mt-1">
                  {getNotificationIcon(notification.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className={`font-medium ${notification.isRead ? 'text-gray-700' : 'text-gray-900'}`}>
                      {notification.title}
                    </h3>
                    <span className="flex-shrink-0 text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(notification.createdAt)}
                    </span>
                  </div>
                  
                  <p className={`mt-1 text-sm ${notification.isRead ? 'text-gray-500' : 'text-gray-700'}`}>
                    {notification.message}
                  </p>

                  {/* Metadata: show update type, priority and author if present */}
                  {(notification.metadata?.updateType || notification.metadata?.priority || notification.metadata?.createdBy || notification.metadata?.reviewerName || notification.metadata?.createdByUid) && (
                    <div className="mt-3 flex items-center gap-3">
                      {notification.metadata?.updateType && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium uppercase">
                          {formatUpdateTypeLabel(notification.metadata.updateType)}
                        </span>
                      )}

                      {notification.metadata?.priority && (
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                          notification.metadata.priority ===
   'urgent' ? 'bg-red-100 text-red-700 border border-red-300' :
                          notification.metadata.priority ===
   'high' ? 'bg-orange-100 text-orange-700 border border-orange-300' :
                          notification.metadata.priority ===
   'medium' ? 'bg-blue-100 text-blue-700 border border-blue-300' :
                          'bg-gray-100 text-gray-700 border border-gray-300'
                        }`}>
                          {notification.metadata.priority[0].toUpperCase() + notification.metadata.priority.slice(1)}
                        </span>
                      )}

                      {(notification.metadata?.reviewerName || notification.metadata?.createdBy || notification.metadata?.createdByUid || (notification.metadata?.createdBy && notification.metadata.createdBy.uid)) && (
                        <div className="text-xs text-gray-500">
                          By {notification.metadata.reviewerName || (notification.metadata.createdBy && (typeof notification.metadata.createdBy ===
   'string' ? notification.metadata.createdBy : notification.metadata.createdBy.employeeDetails?.displayName || `${notification.metadata.createdBy.firstName || ''} ${notification.metadata.createdBy.lastName || ''}`.trim()))}
                          {notification.metadata.createdByUid ? ` (${notification.metadata.createdByUid})` : (notification.metadata.createdBy && (notification.metadata.createdBy.uid || notification.metadata.createdBy.userId) ? ` (${notification.metadata.createdBy.uid || notification.metadata.createdBy.userId})` : '')}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="mt-3 flex items-center gap-2">
                    {notification.metadata?.actionUrl && (
                      <button
                        onClick={() => handleAction(notification)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        {notification.metadata?.actionLabel || 'View'}
                      </button>
                    )}
                    
                    {!notification.isRead && (
                      <button
                        onClick={() => handleMarkAsRead(notification.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-gray-600 hover:bg-gray-100 text-sm rounded-lg transition-colors"
                      >
                        <Check className="w-4 h-4" />
                        Mark as Read
                      </button>
                    )}
                    
                    <button
                      onClick={() => handleDelete(notification.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-red-600 hover:bg-red-50 text-sm rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>

                {/* Unread Indicator */}
                {!notification.isRead && (
                  <div className="flex-shrink-0">
                    <div className="w-2.5 h-2.5 bg-blue-600 rounded-full"></div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
            disabled={pagination.page ===
   1}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPagination((p) => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
            disabled={pagination.page ===
   pagination.totalPages}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
