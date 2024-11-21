export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  date: string;
}
export interface Notification {
  id: string;
  target_user_id: string;
  title: string;
  txt: string;
  target:
    | "new_msg"
    | "new_proposal"
    | "new_reservation"
    | "cancelled_proposal"
    | "cancelled_reservation";
  date: string;
}