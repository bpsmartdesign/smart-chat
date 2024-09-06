export interface CpxImg {
  id: string;
  photo: string;
  fileName: string;
  fileExtension: string;
}
export interface UserImg extends CpxImg {
  userId: string;
}
export interface UserDetail {
  id?: string;
  sex?: string | null;
  town?: string | null;
  userId?: string;
  country?: string | null;
  lastName?: string | null;
  firstName?: string | null;
  postalCode?: string | null;
  dateOfBirth?: string | null;
  profilepictureURL?: string | null;
}
export interface User {
  id?: string;
  email: string;
  password: string;
  isActive: boolean;
  isDeleted: boolean;
  phoneNumber: string;
  creationDate: string;
  isCodeVerified: boolean;
  verificationCode?: string | null;
  userDetail?: UserDetail;
  profilePhoto?: UserImg | null;
}
export interface UserShort {
  id: string;
  firstName: string;
  lastName: string;
  photo: UserImg;
}
export interface Message {
  id: string;
  sender: UserShort;
  receiver: UserShort;
  message: string;
}
