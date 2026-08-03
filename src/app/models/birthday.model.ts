export interface BirthdayUser {
  userId: number;
  salutaion: string;   // note: API typo (missing 't')
  userFName: string;
  userLName: string;
  userMname: string;
  userGender: string;
  userDoB: string;
  userEmailOfficial: string;
  userMobileNumber?: string;
  userEmergencyNumber?: string;
  userEmailPersonal?: string;
  userIsActive: boolean;
  userProfilepic?: string;
}
