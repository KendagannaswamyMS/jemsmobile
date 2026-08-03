export interface EventImageFile {
  imgSrc: string;
  desc: string;
  title: string;
  fileType: string;
  isActive: boolean;
}

export interface EventPdfFile {
  fileSrc: string;
  desc: string;
  title: string;
  fileType: string;
  isActive: boolean;
}

export interface EventItem {
  eventID: number;
  eventHeading: string;
  eventDetail: string;
  eventDate: string;       // "DD-MM-YYYY"
  eventMMYYYY: string;     // "MMM-YYYY"
  eventDD: string;
  eventTime: string;
  imageThumbnail: string;
  approvalstatus: number;
  imageFiles: EventImageFile[];
  videoFiles: any[];
  pdfFiles: EventPdfFile[];
}

export interface EventsResponse {
  eventMaster: EventItem[];
}
