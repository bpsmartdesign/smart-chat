import fs from "fs";
import path from "path";
import { Notification } from "../types";

export const NOTIF_DB = path.join(__dirname, "./../../db/cpx_notification.json");
export const readNotifications = (): Notification[] => {
  const data = fs.readFileSync(NOTIF_DB, "utf-8");
  return JSON.parse(data);
};
export const writeNotifications = (Notifications: Notification[]): void => {
  fs.writeFileSync(NOTIF_DB, JSON.stringify(Notifications, null, 2));
};
export const storeNotification = (notif: Notification): void => {
  let notifications = readNotifications();
  notifications.push(notif);

  // Keep the last 10 Notifications by user
  const filteredNotifications = notifications.filter(
    (not) => not.target_user_id === notif.target_user_id
  );

  if (filteredNotifications.length > 10) {
    notifications = notifications.filter(
      (not) =>
        !filteredNotifications.includes(not) ||
        filteredNotifications.indexOf(not) >= filteredNotifications.length - 10
    );
  }

  writeNotifications(notifications);
};
export const getUserNotifications = (userId: string): Notification[] => {
  const notifications = readNotifications();
  console.log("getting user notifications ...", notifications);
  return notifications.filter((notif) => notif.target_user_id === userId);
};
