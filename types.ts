
export interface GenerationRecord {
  id: string;
  timestamp: number;
  referenceImage: string;
  turnaroundImage: string;
  actionPosesImage: string;
  merchImage: string;
  postersImage: string;
  prompt: string;
}

export enum GenerationStatus {
  IDLE = 'IDLE',
  LOADING_TURNAROUND = 'LOADING_TURNAROUND',
  LOADING_POSES = 'LOADING_POSES',
  LOADING_MERCH = 'LOADING_MERCH',
  LOADING_POSTERS = 'LOADING_POSTERS',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}
