export interface UserProfileData {
  profileId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  contactNumber: string;
  address: string;
  accountType: "Customer" | "Admin";
  status: "Active" | "Inactive" | "Suspended";
  createdAt: string;
  emailVerified: boolean;
  lastPasswordChange?: string;
}

export interface ProfileFormValues {
  firstName: string;
  lastName: string;
  contactNumber: string;
  address: string;
}
