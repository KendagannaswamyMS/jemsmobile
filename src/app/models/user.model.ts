export interface MenuItem {
  id?: number | string;
  title: string;
  icon?: string;
  route?: string;
  children?: MenuItem[];
}

export interface CurrentUser {
  token: string;
  email: string;
  userId: number;
  name: string;
  salutation?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  fullName?: string;
  role: 'Student' | 'Faculty' | 'HOD' | 'Staff' | 'Admin';
  isAdmin: boolean;
  departmentId: number;
  departmentName: string;
  designation?: string;
  profilePic?: string;
  menus?: MenuItem[];
}
